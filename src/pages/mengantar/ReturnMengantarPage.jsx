import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getAverageHpp } from '../../lib/stockUtils'

const STATUS_MAP = {
    'Diproses': { label: 'Diproses', cls: 'badge-warning', icon: '⏳', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    'Diterima': { label: 'Diterima', cls: 'badge-success', icon: '✅', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
    'Hilang': { label: 'Hilang', cls: 'badge-danger', icon: '❌', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
}

function getStatusBadge(status) {
    const mapped = STATUS_MAP[status] || { label: status || 'Diproses', cls: 'badge-warning' }
    return <span className={`badge ${mapped.cls}`}>{mapped.label}</span>
}

function fmtDate(d) {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric'
    })
}

export default function ReturnMengantarPage() {
    const [data, setData] = useState([])
    const [filtered, setFiltered] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [tokoFilter, setTokoFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState('all')
    const [customFrom, setCustomFrom] = useState('')
    const [customTo, setCustomTo] = useState('')
    const [selectedMonth, setSelectedMonth] = useState('')

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 20

    // Modal Add State
    const [showAddModal, setShowAddModal] = useState(false)
    const [addSearchQuery, setAddSearchQuery] = useState('')
    const [searchingOrder, setSearchingOrder] = useState(false)
    const [foundOrder, setFoundOrder] = useState(null)
    const [addError, setAddError] = useState('')
    const [returnReason, setReturnReason] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        loadData()
    }, [dateFilter, customFrom, customTo, selectedMonth])

    useEffect(() => {
        applyFilters()
    }, [data, search, statusFilter, tokoFilter])

    const loadData = async () => {
        setLoading(true)
        setError(null)
        try {
            let query = supabase.from('mengantar_returns').select('*').order('created_at', { ascending: false })

            // Date filter logic
            const now = new Date()
            let from = null
            let to = null

            if (dateFilter === '7') {
                from = new Date(now.setDate(now.getDate() - 7)).toISOString()
            } else if (dateFilter === '30') {
                from = new Date(now.setDate(now.getDate() - 30)).toISOString()
            } else if (dateFilter === 'month') {
                from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
                to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
            } else if (dateFilter === 'year') {
                from = new Date(now.getFullYear(), 0, 1).toISOString()
                to = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString()
            } else if (dateFilter === 'select_month' && selectedMonth) {
                const [y, m] = selectedMonth.split('-')
                from = new Date(y, m - 1, 1).toISOString()
                to = new Date(y, m, 0, 23, 59, 59).toISOString()
            } else if (dateFilter === 'custom' && customFrom && customTo) {
                from = new Date(customFrom).toISOString()
                to = new Date(customTo + 'T23:59:59').toISOString()
            }

            if (from) query = query.gte('created_at', from)
            if (to) query = query.lte('created_at', to)

            const { data: returnsData, error: returnsError } = await query
            if (returnsError) throw returnsError

            if (returnsData && returnsData.length > 0) {
                // Fetch associated sales data
                const orderIds = returnsData.map(r => r.order_id)
                let salesData = []
                for (let i = 0; i < orderIds.length; i += 100) {
                    const chunk = orderIds.slice(i, i + 100)
                    const { data: s } = await supabase.from('mengantar_sales').select('*').in('order_id', chunk)
                    if (s) salesData = [...salesData, ...s]
                }

                const salesMap = {}
                salesData.forEach(s => { salesMap[s.order_id] = s })

                const merged = returnsData.map(ret => ({
                    ...ret,
                    sales_record: salesMap[ret.order_id] || {}
                }))

                setData(merged)
            } else {
                setData([])
            }
            setCurrentPage(1)
        } catch (err) {
            console.error('Load Error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const applyFilters = () => {
        let result = [...data]

        // Status Barang Filter
        if (statusFilter !== 'all') {
            result = result.filter(item => (item.status || 'Diproses') === statusFilter)
        }

        // Toko Filter
        if (tokoFilter !== 'all') {
            result = result.filter(item => {
                const sr = item.sales_record || {}
                return (sr.warehouse_name || '') === tokoFilter
            })
        }

        // Search Filter
        if (search) {
            const q = search.toLowerCase()
            result = result.filter(item => {
                const sr = item.sales_record || {}
                return (
                    (item.order_id || '').toLowerCase().includes(q) ||
                    (item.tracking_id || sr.tracking_id || '').toLowerCase().includes(q) ||
                    (sr.buyer_username || '').toLowerCase().includes(q) ||
                    (sr.recipient || '').toLowerCase().includes(q) ||
                    (sr.product_name || '').toLowerCase().includes(q)
                )
            })
        }

        setFiltered(result)
        setCurrentPage(1)
    }

    const uniqueToko = [...new Set(data.map(d => d.sales_record?.warehouse_name).filter(Boolean))].sort()

    const handleSearchOrderForReturn = async () => {
        if (!addSearchQuery) return
        setSearchingOrder(true)
        setFoundOrder(null)
        setAddError('')

        try {
            const q = addSearchQuery.trim()
            const { data: results, error } = await supabase
                .from('mengantar_sales')
                .select('*')
                .or(`order_id.eq.${q},tracking_id.eq.${q}`)
                .limit(1)

            if (error) throw error

            if (!results || results.length === 0) {
                setAddError('Pesanan tidak ditemukan berdasarkan Order ID atau Resi tersebut.')
            } else {
                const order = results[0]
                const status = (order.order_status || '').toLowerCase()

                if (status === 'dikirim' || status === 'shipped') {
                    // Check if it's already in the returns table
                    const { data: existingReturn } = await supabase
                        .from('mengantar_returns')
                        .select('order_id')
                        .eq('order_id', order.order_id)
                        .single()

                    if (existingReturn) {
                        setAddError('Pesanan ini sudah ditambahkan ke daftar Return sebelumnya.')
                    } else {
                        setFoundOrder(order)
                    }
                } else {
                    setAddError(`Pesanan ditemukan, namun statusnya saat ini adalah "${order.order_status}". Hanya pesanan dengan status "Dikirim/Shipped" yang bisa di-return.`)
                }
            }

        } catch (err) {
            setAddError('Gagal mencari pesanan: ' + err.message)
        } finally {
            setSearchingOrder(false)
        }
    }

    const handleSubmitReturn = async () => {
        if (!foundOrder) return
        setSubmitting(true)
        setAddError('')

        try {
            // 1. Insert into mengantar_returns
            const { error: insertError } = await supabase
                .from('mengantar_returns')
                .insert({
                    order_id: foundOrder.order_id,
                    reason: returnReason,
                    status: 'Diproses'
                })

            if (insertError) throw insertError

            // 2. Update order_status in mengantar_sales to 'Return'
            const { error: updateError } = await supabase
                .from('mengantar_sales')
                .update({ order_status: 'Return' })
                .eq('order_id', foundOrder.order_id)

            if (updateError) throw updateError

            // Success! Reset and reload
            setShowAddModal(false)
            setAddSearchQuery('')
            setFoundOrder(null)
            setReturnReason('')
            loadData()

        } catch (err) {
            console.error('Submit return error:', err)
            setAddError('Gagal menyimpan komplain return: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleStatusChange = async (returnId, newStatus) => {
        try {
            const item = data.find(d => d.id === returnId)
            if (!item) return

            if (item.is_validated) {
                alert('Data ini sudah divalidasi dan tidak bisa diubah lagi.');
                return;
            }

            const oldStatus = item.status || 'Diproses'
            const orderId = item.order_id
            const sr = item.sales_record || {}

            // optimisitic
            setData(prev => prev.map(d => d.id === returnId ? { ...d, status: newStatus } : d))
            setFiltered(prev => prev.map(d => d.id === returnId ? { ...d, status: newStatus } : d))

            if (oldStatus !== newStatus) {
                const qty = parseInt(sr.quantity) || 0

                // Cleanup old mutations
                await supabase.from('stock_mutations').delete().like('note', `%Return: ${orderId}%`)

                if (qty > 0 && (newStatus === 'Diterima' || newStatus === 'Hilang')) {
                    const type = newStatus === 'Diterima' ? 'in' : 'out'
                    const desc = `Retur ${newStatus} dari Return: ${orderId}`
                    const skuToUse = sr.seller_sku
                    const pName = sr.product_name

                    const avgHpp = await getAverageHpp(skuToUse, pName)

                    const { error: mutErr } = await supabase.from('stock_mutations').insert([{
                        product_name: pName,
                        sku: skuToUse,
                        qty: qty,
                        hpp: avgHpp,
                        type: type,
                        reference_id: orderId,
                        note: desc,
                        date: new Date().toISOString().substring(0, 10),
                        created_at: new Date().toISOString()
                    }])
                    if (mutErr) throw mutErr
                }
            }

            const { error } = await supabase.from('mengantar_returns').update({ status: newStatus }).eq('id', returnId)
            if (error) throw error
        } catch (err) {
            console.error('Update status error:', err)
            loadData() // revert
            alert('Gagal update status barang: ' + err.message)
        }
    }

    const handleValidate = async (returnId) => {
        try {
            if (!window.confirm('Validasi return ini? Setelah divalidasi, status dan stok tidak bisa diubah lagi.')) return;

            setData(prev => prev.map(d => d.id === returnId ? { ...d, is_validated: true } : d))
            setFiltered(prev => prev.map(d => d.id === returnId ? { ...d, is_validated: true } : d))

            const { error } = await supabase.from('mengantar_returns').update({ is_validated: true }).eq('id', returnId)
            if (error) throw error

            alert('Return berhasil divalidasi!');
        } catch (err) {
            console.error('Validate error:', err)
            loadData()
            alert('Gagal memvalidasi: ' + err.message)
        }
    }

    const handleStatusDanaChange = async (returnId, newStatusDana) => {
        try {
            setData(prev => prev.map(item => item.id === returnId ? { ...item, status_dana: newStatusDana } : item))
            const { error } = await supabase.from('mengantar_returns').update({ status_dana: newStatusDana }).eq('id', returnId)
            if (error) throw error
        } catch (err) {
            alert('Gagal update status dana: ' + err.message)
            loadData()
        }
    }

    const handleBiayaReturnChange = async (returnId, newBiaya) => {
        try {
            // Optimistic update
            setData(prev => prev.map(item => item.id === returnId ? { ...item, biaya_return: newBiaya } : item))

            // Allow empty string to mean null/0
            const numValue = newBiaya === '' ? null : Number(newBiaya.replace(/\D/g, ''))

            const { error } = await supabase.from('mengantar_returns').update({ biaya_return: numValue }).eq('id', returnId)
            if (error) throw error
        } catch (err) {
            console.error('Update biaya return', err)
        }
    }

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
    const paginatedData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    return (
        <div>
            <div className="page-header">
                <h1>🔄 Return Penjualan</h1>
                <div className="page-header-actions">
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        ➕ Tambah Return
                    </button>
                </div>
            </div>

            {error && (
                <div className="alert alert-error" style={{ marginBottom: '20px' }}>
                    <strong>Database Error:</strong> {error}.
                    <br /><br />
                    Pastikan tabel <code>mengantar_returns</code> sudah dibuat dengan kolom: <code>id</code> (UUID), <code>order_id</code> (TEXT UNIQUE), <code>tracking_id</code> (TEXT), <code>reason</code> (TEXT), <code>status</code> (TEXT DEFAULT 'Diproses'), dan <code>created_at</code>.
                </div>
            )}

            {/* Dashboard Cards */}
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>📦</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Total Komplain Return</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{filtered.length.toLocaleString()}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>⏳</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Diproses</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{filtered.filter(f => (f.status || 'Diproses') === 'Diproses').length.toLocaleString()}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>✅</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Diterima</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{filtered.filter(f => f.status === 'Diterima').length.toLocaleString()}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>❌</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Hilang</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{filtered.filter(f => f.status === 'Hilang').length.toLocaleString()}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-search">
                        🔍
                        <input
                            type="text"
                            placeholder="Cari order, resi, pembeli..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="filter-group">
                        <select className="filter-select" value={tokoFilter} onChange={e => setTokoFilter(e.target.value)}>
                            <option value="all">Semua Toko</option>
                            {uniqueToko.map(toko => (
                                <option key={toko} value={toko}>{toko}</option>
                            ))}
                        </select>
                        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="all">Semua Status Barang</option>
                            <option value="Diproses">Diproses</option>
                            <option value="Diterima">Diterima</option>
                            <option value="Hilang">Hilang</option>
                        </select>
                        <select className="filter-select" value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
                            <option value="all">Semua Waktu</option>
                            <option value="7">7 Hari</option>
                            <option value="30">30 Hari</option>
                            <option value="month">Bulan Ini</option>
                            <option value="select_month">Pilih Bulan</option>
                            <option value="year">Tahun Ini</option>
                            <option value="custom">Custom</option>
                        </select>
                        {dateFilter === 'select_month' && (
                            <div className="filter-custom-date">
                                <input type="month" className="filter-date-input" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                            </div>
                        )}
                        {dateFilter === 'custom' && (
                            <div className="filter-custom-date">
                                <input type="date" className="filter-date-input" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                                <span style={{ color: 'var(--text-muted)' }}>s/d</span>
                                <input type="date" className="filter-date-input" value={customTo} onChange={e => setCustomTo(e.target.value)} />
                            </div>
                        )}
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{filtered.length} data</span>
                </div>

                {/* Desktop Table */}
                <div className="table-wrapper desktop-table">
                    {loading ? (
                        <div className="empty-state"><div className="spinner"></div><p>Memuat data...</p></div>
                    ) : paginatedData.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">📭</div><p>Belum ada data Return</p></div>
                    ) : (
                        <table className="tiktok-table">
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>Tgl Input</th>
                                    <th>Order / Resi</th>
                                    <th>Toko / Customer</th>
                                    <th>Detail Produk</th>
                                    <th>Status Barang</th>
                                    <th>Status Dana</th>
                                    <th>Biaya Return</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((item, idx) => {
                                    const sr = item.sales_record || {}
                                    return (
                                        <tr key={item.id}>
                                            <td>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                            <td>
                                                <div className="cell-date">{fmtDate(item.created_at)}</div>
                                            </td>
                                            <td>
                                                <div className="cell-main" style={{ fontFamily: 'monospace' }}>{item.order_id}</div>
                                                <div className="cell-sub">{item.tracking_id || sr.tracking_id || '-'}</div>
                                            </td>
                                            <td>
                                                <div className="cell-main">{sr.recipient || sr.buyer_username || '-'}</div>
                                                <div className="cell-sub" style={{ color: 'var(--text-muted)' }}>{sr.warehouse_name || '-'}</div>
                                            </td>
                                            <td>
                                                <div className="cell-main">{sr.product_name || '-'}</div>
                                                <div className="cell-sub">{sr.variation || '-'} · {sr.quantity || 0} pcs</div>
                                            </td>
                                            <td>
                                                <div style={{ marginBottom: '4px' }}>
                                                    <select
                                                        className="filter-select"
                                                        style={{
                                                            padding: '4px 8px', fontSize: '12px', borderRadius: '6px',
                                                            backgroundColor: item.status === 'Hilang' ? 'rgba(239, 68, 68, 0.1)' :
                                                                item.status === 'Diterima' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                            color: item.status === 'Hilang' ? '#ef4444' :
                                                                item.status === 'Diterima' ? '#22c55e' : '#f59e0b',
                                                            border: 'none', outline: 'none', cursor: 'pointer'
                                                        }}
                                                        value={item.status || 'Diproses'}
                                                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                                        disabled={item.is_validated}
                                                    >
                                                        <option value="Diproses">Diproses</option>
                                                        <option value="Diterima">Diterima</option>
                                                        <option value="Hilang">Hilang</option>
                                                    </select>
                                                </div>
                                                {item.is_validated ? (
                                                    <div style={{ marginTop: '4px' }}><span style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontWeight: 500, display: 'inline-block' }}>Tervalidasi</span></div>
                                                ) : (item.status === 'Diterima' || item.status === 'Hilang') ? (
                                                    <div style={{ marginTop: '4px' }}>
                                                        <button
                                                            className="btn"
                                                            style={{ backgroundColor: '#3b82f6', color: 'white', padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                                                            onClick={() => handleValidate(item.id)}
                                                        >
                                                            Validasi ✓
                                                        </button>
                                                    </div>
                                                ) : null}
                                                <div className="cell-sub" style={{ color: 'var(--text-danger)', marginTop: '4px' }}>
                                                    {item.reason}
                                                </div>
                                            </td>
                                            <td>
                                                <select
                                                    className="filter-select"
                                                    style={{
                                                        padding: '4px 8px', fontSize: '12px', borderRadius: '6px',
                                                        border: '1px solid var(--border-color)', outline: 'none', cursor: 'pointer'
                                                    }}
                                                    value={item.status_dana || 'Diproses'}
                                                    onChange={(e) => handleStatusDanaChange(item.id, e.target.value)}
                                                >
                                                    <option value="Diproses">Diproses</option>
                                                    <option value="Siap Tarik">Siap Tarik</option>
                                                    <option value="Telah Ditarik">Telah Ditarik</option>
                                                    <option value="Hangus">Hangus</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    style={{ width: '100px', fontSize: '12px', padding: '4px 8px' }}
                                                    placeholder="Rp 0"
                                                    value={item.biaya_return !== undefined && item.biaya_return !== null ? item.biaya_return : ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, '')
                                                        handleBiayaReturnChange(item.id, val)
                                                    }}
                                                />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Mobile Cards */}
                <div className="mobile-cards" style={{ padding: '12px' }}>
                    {loading ? (
                        <div className="empty-state"><div className="spinner"></div><p>Memuat data...</p></div>
                    ) : paginatedData.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">📭</div><p>Belum ada data</p></div>
                    ) : (
                        <div className="cards-list">
                            {paginatedData.map((item, idx) => {
                                const sr = item.sales_record || {}
                                return (
                                    <div key={item.id} className="data-card">
                                        <div className="data-card-header">
                                            <span className="data-card-number">#{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{fmtDate(item.created_at)}</span>
                                        </div>
                                        <div className="data-card-body">
                                            <div className="data-card-row">
                                                <span className="data-card-label">Order ID</span>
                                                <span className="data-card-value" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{item.order_id}</span>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Resi</span>
                                                <span className="data-card-value" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{item.tracking_id || sr.tracking_id || '-'}</span>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Customer</span>
                                                <span className="data-card-value">{sr.recipient || sr.buyer_username || '-'}</span>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Produk</span>
                                                <span className="data-card-value">{sr.product_name || '-'} ({sr.quantity || 0} pcs)</span>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Status Retur</span>
                                                <div>
                                                    <select
                                                        className="filter-select"
                                                        style={{
                                                            padding: '4px 8px', fontSize: '12px', borderRadius: '6px',
                                                            backgroundColor: item.status === 'Hilang' ? 'rgba(239, 68, 68, 0.1)' :
                                                                item.status === 'Diterima' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                            color: item.status === 'Hilang' ? '#ef4444' :
                                                                item.status === 'Diterima' ? '#22c55e' : '#f59e0b',
                                                            border: 'none', outline: 'none', cursor: 'pointer'
                                                        }}
                                                        value={item.status || 'Diproses'}
                                                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                                        disabled={item.is_validated}
                                                    >
                                                        <option value="Diproses">Diproses</option>
                                                        <option value="Diterima">Diterima</option>
                                                        <option value="Hilang">Hilang</option>
                                                    </select>
                                                    {item.is_validated ? (
                                                        <div style={{ marginTop: '6px' }}><span style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontWeight: 500, display: 'inline-block' }}>Tervalidasi</span></div>
                                                    ) : (item.status === 'Diterima' || item.status === 'Hilang') ? (
                                                        <div style={{ marginTop: '6px' }}>
                                                            <button
                                                                className="btn"
                                                                style={{ backgroundColor: '#3b82f6', color: 'white', padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                                                                onClick={() => handleValidate(item.id)}
                                                            >
                                                                Validasi ✓
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Alasan</span>
                                                <span className="data-card-value" style={{ color: 'var(--text-danger)' }}>{item.reason || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                        <button className="btn btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Sebelumnya</button>
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Halaman {currentPage} dari {totalPages}</span>
                        <button className="btn btn-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Berikutnya</button>
                    </div>
                )}
            </div>

            {/* Modal Tambah Return */}
            {showAddModal && (
                <div className="modal-backdrop">
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Tambah Return Baru</h2>
                            <button className="btn-close" onClick={() => { setShowAddModal(false); setFoundOrder(null); setAddSearchQuery(''); setAddError(''); }}></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Masukkan Order ID atau Nomor Resi:</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Order ID / Resi..."
                                        value={addSearchQuery}
                                        onChange={e => setAddSearchQuery(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSearchOrderForReturn()}
                                        disabled={searchingOrder || submitting}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSearchOrderForReturn}
                                        disabled={searchingOrder || !addSearchQuery || submitting}
                                    >
                                        {searchingOrder ? 'Mencari...' : 'Cari'}
                                    </button>
                                </div>
                                <span className="form-hint">Pesanan harus dalam status "Dikirim/Shipped" di menu Penjualan.</span>
                            </div>

                            {addError && (
                                <div className="alert alert-error" style={{ marginBottom: '16px' }}>{addError}</div>
                            )}

                            {foundOrder && (
                                <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)' }}>Pesanan Ditemukan:</h4>
                                    <div style={{ fontSize: '13px', display: 'grid', gap: '8px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Order ID</span>
                                            <span style={{ fontFamily: 'monospace' }}>{foundOrder.order_id}</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Resi</span>
                                            <span style={{ fontFamily: 'monospace' }}>{foundOrder.tracking_id || '-'}</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Produk</span>
                                            <span>{foundOrder.product_name} ({foundOrder.quantity} pcs)</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Pembeli</span>
                                            <span>{foundOrder.recipient || foundOrder.buyer_username}</span>
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginTop: '16px', marginBottom: '0' }}>
                                        <label className="form-label">Alasan Return (Opsional):</label>
                                        <textarea
                                            className="form-input"
                                            placeholder="Tulis alasan kenapa barang direturn..."
                                            rows="2"
                                            value={returnReason}
                                            onChange={e => setReturnReason(e.target.value)}
                                            disabled={submitting}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setShowAddModal(false); setFoundOrder(null); setAddSearchQuery(''); setAddError(''); }} disabled={submitting}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSubmitReturn} disabled={!foundOrder || submitting}>
                                {submitting ? 'Menyimpan...' : 'Simpan Return'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
