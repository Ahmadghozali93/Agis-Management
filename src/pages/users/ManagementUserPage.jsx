import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function ManagementUserPage() {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all')
    const { approveUser, rejectUser, updateUserRole, deleteUser, profile: currentUser } = useAuth()

    useEffect(() => { loadUsers() }, [])

    async function loadUsers() {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })
            if (error) throw error
            setUsers(data || [])
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleApprove(userId) {
        try {
            await approveUser(userId)
            loadUsers()
        } catch (err) {
            console.error('Error approving:', err)
        }
    }

    async function handleReject(userId) {
        if (!confirm('Yakin ingin menolak user ini?')) return
        try {
            await rejectUser(userId)
            loadUsers()
        } catch (err) {
            console.error('Error rejecting:', err)
        }
    }

    async function handleRoleChange(userId, newRole) {
        try {
            await updateUserRole(userId, newRole)
            loadUsers()
        } catch (err) {
            console.error('Error updating role:', err)
        }
    }

    async function handleDelete(userId) {
        if (!confirm('Yakin ingin menghapus user ini? Tindakan ini tidak bisa dibatalkan.')) return
        try {
            await deleteUser(userId)
            loadUsers()
        } catch (err) {
            console.error('Error deleting:', err)
        }
    }

    const filtered = users.filter(u => {
        if (filter !== 'all' && u.status !== filter) return false
        if (!search) return true
        return u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            u.email?.toLowerCase().includes(search.toLowerCase())
    })

    const pendingCount = users.filter(u => u.status === 'pending').length

    function getStatusBadge(status) {
        const map = {
            'approved': 'badge-success',
            'pending': 'badge-warning',
            'rejected': 'badge-danger'
        }
        return <span className={`badge ${map[status] || 'badge-info'}`}>{status}</span>
    }

    function getRoleBadge(role) {
        const map = {
            'admin': 'badge-danger',
            'owner': 'badge-purple',
            'spv': 'badge-info',
            'host': 'badge-success',
            'creator': 'badge-warning'
        }
        return <span className={`badge ${map[role] || 'badge-info'}`}>{role}</span>
    }

    return (
        <div>
            <div className="page-header">
                <h1>👥 Management User</h1>
                {pendingCount > 0 && (
                    <span className="badge badge-warning" style={{ fontSize: '13px', padding: '6px 14px' }}>
                        ⏳ {pendingCount} Pending Approval
                    </span>
                )}
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">Total Users</span>
                        <div className="stat-card-icon purple">👥</div>
                    </div>
                    <div className="stat-card-value">{users.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">Approved</span>
                        <div className="stat-card-icon green">✅</div>
                    </div>
                    <div className="stat-card-value">{users.filter(u => u.status === 'approved').length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">Pending</span>
                        <div className="stat-card-icon orange">⏳</div>
                    </div>
                    <div className="stat-card-value">{pendingCount}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">Rejected</span>
                        <div className="stat-card-icon red">❌</div>
                    </div>
                    <div className="stat-card-value">{users.filter(u => u.status === 'rejected').length}</div>
                </div>
            </div>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-search">
                        🔍
                        <input placeholder="Cari user..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="tabs" style={{ margin: 0 }}>
                        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Semua</button>
                        <button className={`tab ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Pending</button>
                        <button className={`tab ${filter === 'approved' ? 'active' : ''}`} onClick={() => setFilter('approved')}>Approved</button>
                        <button className={`tab ${filter === 'rejected' ? 'active' : ''}`} onClick={() => setFilter('rejected')}>Rejected</button>
                    </div>
                </div>
                <div className="table-wrapper">
                    {loading ? (
                        <div className="empty-state"><div className="spinner"></div><p>Memuat...</p></div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">👤</div><p>Tidak ada user</p></div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>Nama</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Terdaftar</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((user, i) => (
                                    <tr key={user.id}>
                                        <td>{i + 1}</td>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {user.full_name}
                                            {user.id === currentUser?.id && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>(Anda)</span>}
                                        </td>
                                        <td>{user.email}</td>
                                        <td>
                                            {user.id !== currentUser?.id ? (
                                                <select
                                                    className="form-select"
                                                    style={{ padding: '4px 8px', fontSize: '12px', width: 'auto', minWidth: '100px' }}
                                                    value={user.role}
                                                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                >
                                                    <option value="admin">Admin</option>
                                                    <option value="owner">Owner</option>
                                                    <option value="spv">SPV</option>
                                                    <option value="host">Host</option>
                                                    <option value="creator">Creator</option>
                                                </select>
                                            ) : getRoleBadge(user.role)}
                                        </td>
                                        <td>{getStatusBadge(user.status)}</td>
                                        <td>{user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID') : '-'}</td>
                                        <td>
                                            <div className="table-actions">
                                                {user.status === 'pending' && (
                                                    <>
                                                        <button className="btn btn-sm btn-success" onClick={() => handleApprove(user.id)}>✅</button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => handleReject(user.id)}>❌</button>
                                                    </>
                                                )}
                                                {user.status === 'rejected' && (
                                                    <button className="btn btn-sm btn-success" onClick={() => handleApprove(user.id)}>✅ Approve</button>
                                                )}
                                                {user.id !== currentUser?.id && (
                                                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(user.id)}>🗑️</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
