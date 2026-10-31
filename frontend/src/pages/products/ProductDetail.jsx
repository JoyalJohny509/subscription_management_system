import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getProductById,
  updateProduct,
  getVariants,
  createVariant,
  updateVariant,
  deleteVariant,
} from '../../api/products'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import Badge from '../../components/Badge'
import ProductForm from './ProductForm'
import { Pencil, Trash2, ArrowLeft, Layers, Plus } from 'lucide-react'

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

function VariantForm({ isOpen, onClose, onSave, initialData }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({ name: '', additional_price: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        additional_price: initialData.additional_price !== undefined && initialData.additional_price !== null ? initialData.additional_price : '',
      })
    } else {
      setForm({ name: '', additional_price: '' })
    }
    setError('')
  }, [initialData, isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) { setError('Name is required'); return }
    setLoading(true)
    setError('')
    try {
      await onSave({ name: form.name, additional_price: parseFloat(form.additional_price) || 0 })
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to save variant.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Variant' : 'Add Variant'} size="sm">
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <label>Variant Name *</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Enterprise, Basic" />
        </div>
        <div className="form-group">
          <label>Additional Price (₹)</label>
          <input
            type="number"
            step="0.01"
            value={form.additional_price}
            onChange={(e) => setForm((f) => ({ ...f, additional_price: e.target.value }))}
            placeholder="0.00"
          />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><span className="spinner spinner-sm" /> Saving...</> : isEdit ? 'Save Changes' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isStaff } = useAuth()

  const [product, setProduct] = useState(null)
  const [variants, setVariants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showEditProduct, setShowEditProduct] = useState(false)
  const [showVariantForm, setShowVariantForm] = useState(false)
  const [editVariant, setEditVariant] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [pRes, vRes] = await Promise.all([getProductById(id), getVariants(id)])
      setProduct(pRes.data?.data || pRes.data)
      const varList = vRes.data?.data || vRes.data?.variants || vRes.data || []
      setVariants(Array.isArray(varList) ? varList : [])
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to load product.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleEditProduct = async (payload) => {
    await updateProduct(id, payload)
    fetchData()
  }

  const handleSaveVariant = async (payload) => {
    if (editVariant) {
      await updateVariant(id, editVariant._id || editVariant.id, payload)
    } else {
      await createVariant(id, payload)
    }
    fetchData()
  }

  const handleDeleteVariant = async (variant) => {
    if (!window.confirm(`Delete variant "${variant.name}"?`)) return
    try {
      await deleteVariant(id, variant._id || variant.id)
      fetchData()
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to delete variant.')
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-lg" />
        <span>Loading product...</span>
      </div>
    )
  }

  if (!product) {
    return (
      <div>
        <div className="alert alert-error">{error || 'Product not found.'}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/products')}>← Back</button>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/products')} title="Back to products"><ArrowLeft size={14} /></button>
          <div>
            <h1 className="page-title">{product.name}</h1>
            <p className="page-subtitle">{product.type || 'Product'}</p>
          </div>
        </div>
        {isStaff() && (
          <button className="btn btn-secondary" onClick={() => setShowEditProduct(true)}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Pencil size={13} /> Edit Product</span></button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Product Info */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 className="card-title">Product Information</h3>
          <Badge status={product.is_active !== false ? 'active' : 'closed'} />
        </div>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Sales Price</span>
            <span className="info-value" style={{ color: 'var(--success)', fontWeight: 700 }}>{fmt(product.sales_price)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Cost Price</span>
            <span className="info-value">{fmt(product.cost_price)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Type</span>
            <span className="info-value">{product.type || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Notes</span>
            <span className="info-value">{product.notes || '—'}</span>
          </div>
        </div>
      </div>

      {/* Variants */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Variants ({variants.length})</h3>
          {isStaff() && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setEditVariant(null); setShowVariantForm(true) }}
            >
              + Add Variant
            </button>
          )}
        </div>

        {variants.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', opacity: 0.4 }}><Layers size={36} /></div>
            <div className="empty-state-text">No variants yet</div>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Additional Price</th>
                  {isStaff() && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v._id || v.id}>
                    <td style={{ fontWeight: 600 }}>{v.name}</td>
                    <td>{fmt(v.additional_price)}</td>
                    {isStaff() && (
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setEditVariant(v); setShowVariantForm(true) }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteVariant(v)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEditProduct && (
        <ProductForm
          key={product?.id || 'prod'}
          isOpen={showEditProduct}
          onClose={() => setShowEditProduct(false)}
          onSave={handleEditProduct}
          initialData={product}
        />
      )}

      {showVariantForm && (
        <VariantForm
          key={editVariant?._id || editVariant?.id || 'var'}
          isOpen={showVariantForm}
          onClose={() => { setShowVariantForm(false); setEditVariant(null) }}
          onSave={handleSaveVariant}
          initialData={editVariant}
        />
      )}
    </div>
  )
}
