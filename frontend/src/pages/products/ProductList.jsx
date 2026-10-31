import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../../api/products'
import { useAuth } from '../../context/AuthContext'
import DataTable from '../../components/DataTable'
import Badge from '../../components/Badge'
import SearchBar from '../../components/SearchBar'
import Pagination from '../../components/Pagination'
import ProductForm from './ProductForm'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function ProductList() {
  const navigate = useNavigate()
  const { isAdmin, isStaff } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getProducts({ search, page, limit: 20 })
      const data = res.data
      setProducts(data.products || data.data || data)
      if (data.totalPages) setTotalPages(data.totalPages)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load products.')
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const handleCreate = async (payload) => {
    await createProduct(payload)
    fetchProducts()
  }

  const handleEdit = async (payload) => {
    await updateProduct(editProduct._id || editProduct.id, payload)
    fetchProducts()
  }

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete product "${product.name}"? This cannot be undone.`)) return
    try {
      await deleteProduct(product._id || product.id)
      fetchProducts()
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to delete product.')
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (_, row) => (
        <button
          className="btn-link"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 600, padding: 0 }}
          onClick={() => navigate(`/products/${row?.id || row?._id}`)}
        >
          {row?.name || '—'}
        </button>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (_, row) => (
        <span style={{ textTransform: 'capitalize' }}>{row?.type || <span className="text-muted">—</span>}</span>
      ),
    },
    {
      key: 'sales_price',
      label: 'Sales Price',
      render: (_, row) => fmt(row?.sales_price),
    },
    {
      key: 'cost_price',
      label: 'Cost Price',
      render: (_, row) => fmt(row?.cost_price),
    },
    {
      key: 'variant_count',
      label: 'Variants',
      render: (_, row) => (row?.variant_count ?? row?.variants_count ?? 0),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (_, row) => <Badge status={(row?.is_active !== 0 && row?.is_active !== false) ? 'active' : 'closed'} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/products/${row?.id || row?._id}`)}>
            View
          </button>
          {isStaff() && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setEditProduct(row); setShowForm(true) }}>
              ✏️ Edit
            </button>
          )}
          {isAdmin() && (
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row)}>
              🗑️
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Manage your product catalog</p>
        </div>
        {isStaff() && (
          <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowForm(true) }}>
            + Add Product
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products..." />
      </div>

      <DataTable columns={columns} data={products} loading={loading} emptyMessage="No products found." />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <ProductForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSave={editProduct ? handleEdit : handleCreate}
        initialData={editProduct}
      />
    </div>
  )
}
