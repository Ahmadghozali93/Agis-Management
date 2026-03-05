import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function CrudPage({
    tableName,
    title,
    icon = '📋',
    columns = [],
    formFields = [],
    defaultSort = 'created_at',
    extraFilters = null
}) {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editItem, setEditItem] = useState(null)
    const [formData, setFormData] = useState({})
    const [search, setSearch] = useState('')
    const [error, setError] = useState('')

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            let query = supabase.from(tableName).select('*').order(defaultSort, { ascending: false })
            if (extraFilters) {
                Object.entries(extraFilters).forEach(([key, val]) => {
                    query = query.eq(key, val)
                })
            }
            const { data: result, error } = await query
            if (error) throw error
            setData(result || [])
        } catch (err) {
            console.error('Load error:', err)
        } finally {
            setLoading(false)
        }
    }, [tableName, defaultSort, extraFilters])

    useEffect(() => { loadData() }, [loadData])

    function openCreate() {
        const initial = {}
        formFields.forEach(f => { initial[f.name] = f.defaultValue || '' })
        setFormData(initial)
        setEditItem(null)
        setError('')
        setShowModal(true)
    }

    function openEdit(item) {
        setFormData({ ...item })
        setEditItem(item)
        setError('')
        setShowModal(true)
    }

    async function handleSave(e) {
        e.preventDefault()
        setError('')
        try {
            const saveData = {}
            formFields.forEach(f => {
                saveData[f.name] = formData[f.name] ?? ''
            })

            if (editItem) {
                const { error } = await supabase
                    .from(tableName)
                    .update(saveData)
                    .eq('id', editItem.id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from(tableName)
                    .insert([saveData])
                if (error) throw error
            }
            setShowModal(false)
            loadData()
        } catch (err) {
            setError(err.message)
        }
    }

    async function handleDelete(id) {
        if (!confirm('Yakin ingin menghapus data ini?')) return
        try {
            const { error } = await supabase.from(tableName).delete().eq('id', id)
            if (error) throw error
            loadData()
        } catch (err) {
            console.error('Delete error:', err)
        }
    }

    function handleChange(e) {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const filteredData = data.filter(item => {
        if (!search) return true
        return columns.some(col => {
            const val = item[col.key]
            return val && String(val).toLowerCase().includes(search.toLowerCase())
        })
    })

    function formatCell(item, col) {
        const val = item[col.key]
        if (col.format === 'currency') return 'Rp ' + (val || 0).toLocaleString('id-ID')
        if (col.format === 'date') return val ? new Date(val).toLocaleDateString('id-ID') : '-'
        if (col.format === 'badge') {
            const cls = col.badgeMap?.[val] || 'badge-info'
            return <span className={`badge ${cls}`}>{val || '-'}</span>
        }
        if (col.format === 'number') return (val || 0).toLocaleString('id-ID')
        return val || '-'
    }

    return (
        <div>
            <div className="page-header">
                <h1>{icon} {title}</h1>
                <div className="page-header-actions">
                    <button className="btn btn-primary" onClick={openCreate}>+ Tambah {title}</button>
                </div>
            </div>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-search">
                        🔍
                        <input
                            type="text"
                            placeholder="Cari data..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {filteredData.length} data
                    </span>
                </div>

                <div className="table-wrapper">
                    {loading ? (
                        <div className="empty-state">
                            <div className="spinner"></div>
                            <p>Memuat data...</p>
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📭</div>
                            <p>Belum ada data</p>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>No</th>
                                    {columns.map(col => <th key={col.key}>{col.label}</th>)}
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td>{idx + 1}</td>
                                        {columns.map(col => <td key={col.key}>{formatCell(item, col)}</td>)}
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>✏️</button>
                                                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h2>{editItem ? 'Edit' : 'Tambah'} {title}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                {error && <div className="alert alert-error">⚠️ {error}</div>}
                                {formFields.map(field => (
                                    <div key={field.name} className="form-group">
                                        <label>{field.label}</label>
                                        {field.type === 'select' ? (
                                            <select
                                                className="form-select"
                                                name={field.name}
                                                value={formData[field.name] || ''}
                                                onChange={handleChange}
                                                required={field.required !== false}
                                            >
                                                <option value="">Pilih {field.label}</option>
                                                {field.options?.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        ) : field.type === 'textarea' ? (
                                            <textarea
                                                className="form-input"
                                                name={field.name}
                                                placeholder={field.placeholder || ''}
                                                value={formData[field.name] || ''}
                                                onChange={handleChange}
                                                required={field.required !== false}
                                            />
                                        ) : (
                                            <input
                                                type={field.type || 'text'}
                                                className="form-input"
                                                name={field.name}
                                                placeholder={field.placeholder || ''}
                                                value={formData[field.name] || ''}
                                                onChange={handleChange}
                                                required={field.required !== false}
                                                step={field.type === 'number' ? 'any' : undefined}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary">
                                    {editItem ? '💾 Simpan' : '➕ Tambah'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
