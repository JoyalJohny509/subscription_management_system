import { useState, useEffect, useCallback } from 'react'
import { getUsers, createUser, updateUser } from '../../api/users'
import { useAuth } from '../../context/AuthContext'
import DataTable from '../../components/DataTable'
import Badge from '../../components/Badge'
import SearchBar from '../../components/SearchBar'
import Pagination from '../../components/Pagination'
import UserForm from './UserForm'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')

export default function UserList() {
  const { isAdmin } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getUsers({ search, role: roleFilter, page, limit: 20 })
      const data = res.data
      setUsers(data.users || data.data || data)
      if (data.totalPages) setTotalPages(data.totalPages)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, page])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleCreate = async (payload) => {
    await createUser(payload)
    fetchUsers()
  }

  const handleEdit = async (payload) => {
    await updateUser(editUser._id || editUser.id, payload)
    fetchUsers()
  }

  const columns = [
    { key: 'name', label: 'Name', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (v) => <Badge status={v} /> },
    {
      key: 'is_active',
      label: 'Status',
      render: (v) => (
        <Badge status={v !== false ? 'active' : 'closed'} />
      ),
    },
    { key: 'createdAt', label: 'Created', render: (v) => fmtDate(v) },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="table-actions">
          {isAdmin() && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setEditUser(row); setShowForm(true) }}
            >
              ✏️ Edit
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
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage admin, staff and customer accounts</p>
        </div>
        {isAdmin() && (
          <button
            className="btn btn-primary"
            onClick={() => { setEditUser(null); setShowForm(true) }}
          >
            + Create Staff
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search users..." />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ width: 'auto', minWidth: '140px' }}>
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
          <option value="customer">Customer</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        emptyMessage="No users found."
      />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <UserForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSave={editUser ? handleEdit : handleCreate}
        initialData={editUser}
      />
    </div>
  )
}
