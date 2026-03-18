import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function CrudPage({
    tableName,
    title,
    icon = '📋',
    columns = [],
    formFields = [],
    defaultSort = 'created_at',
    extraFilters = null,
    onValidate = null,
    onFormChange = null,
    onDelete = null,
    customActions = null,
    disableActionsWhen = null
}) {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editItem, setEditItem] = useState(null)
    const [formData, setFormData] = useState({})
    const [search, setSearch] = useState('')
    const [error, setError] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 15

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

            if (onValidate) {
                const validationError = await onValidate(saveData, editItem)
                if (validationError) {
                    throw new Error(validationError)
                }
            }

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
            if (onDelete) {
                const itemToDelete = data.find(d => d.id === id)
                await onDelete(itemToDelete)
            }
            const { error } = await supabase.from(tableName).delete().eq('id', id)
            if (error) throw error
            loadData()
        } catch (err) {
            console.error('Delete error:', err)
        }
    }

    function handleChange(e) {
        const nextData = { ...formData, [e.target.name]: e.target.value }
        setFormData(nextData)
        if (onFormChange) {
            onFormChange(e.target.name, e.target.value, nextData, formFields)
        }
    }

    const filteredData = data.filter(item => {
        if (!search) return true
        return columns.some(col => {
            const val = item[col.key]
            return val && String(val).toLowerCase().includes(search.toLowerCase())
        })
    })

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE)
    const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    const handleSearchChange = (e) => {
        setSearch(e.target.value)
        setCurrentPage(1)
    }

    function renderPagination() {
        if (totalPages <= 1) return null
        const pages = []
        const start = Math.max(1, currentPage - 2)
        const end = Math.min(totalPages, start + 4)
        for (let i = start; i <= end; i++) pages.push(i)
        return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Halaman {currentPage} dari {totalPages} ({filteredData.length} data)
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
                    {pages.map(p => (
                        <button key={p} className={`btn ${currentPage === p ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '5px 10px', fontSize: '12px', minWidth: '32px' }}
                            onClick={() => setCurrentPage(p)}>{p}</button>
                    ))}
                    <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
                </div>
            </div>
        )
    }

    function formatCell(item, col) {
        const val = item[col.key]
        if (col.format === 'shortId') return <span className="cell-id">{val ? val.substring(0, 8).toUpperCase() : '-'}</span>
        if (col.format === 'currency') return <span className="cell-currency">Rp {(val || 0).toLocaleString('id-ID')}</span>
        if (col.format === 'date') return <span className="cell-date">{val ? new Date(val).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</span>
        if (col.format === 'badge') {
            const cls = col.badgeMap?.[val] || 'badge-info'
            return <span className={`badge ${cls}`}>{val || '-'}</span>
        }
        if (col.format === 'number') return <span className="cell-number">{(val || 0).toLocaleString('id-ID')}</span>
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

            {/* Desktop Table */}
            <div className="table-container desktop-table">
                <div className="table-toolbar">
                    <div className="table-search">
                        🔍
                        <input
                            type="text"
                            placeholder="Cari data..."
                            value={search}
                            onChange={handleSearchChange}
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
                                {paginatedData.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                        {columns.map(col => <td key={col.key}>{formatCell(item, col)}</td>)}
                                        <td>
                                            <div className="table-actions">
                                                {customActions && customActions(item, loadData)}
                                                {!(disableActionsWhen && disableActionsWhen(item)) && (
                                                    <>
                                                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>✏️</button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>🗑️</button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                {renderPagination()}
            </div>

            {/* Mobile Cards */}
            <div className="mobile-cards">
                <div className="table-toolbar" style={{ borderRadius: 'var(--radius-lg)', marginBottom: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <div className="table-search">
                        🔍
                        <input
                            type="text"
                            placeholder="Cari data..."
                            value={search}
                            onChange={handleSearchChange}
                        />
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {filteredData.length} data
                    </span>
                </div>

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
                    <div className="cards-list">
                        {paginatedData.map((item, idx) => (
                            <div key={item.id} className="data-card">
                                <div className="data-card-header">
                                    <span className="data-card-number">#{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</span>
                                    <div className="data-card-actions">
                                        {customActions && customActions(item, loadData)}
                                        {!(disableActionsWhen && disableActionsWhen(item)) && (
                                            <>
                                                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>✏️</button>
                                                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>🗑️</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="data-card-body">
                                    {columns.map(col => (
                                        <div key={col.key} className="data-card-row">
                                            <span className="data-card-label">{col.label}</span>
                                            <span className="data-card-value">{formatCell(item, col)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {renderPagination()}
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
