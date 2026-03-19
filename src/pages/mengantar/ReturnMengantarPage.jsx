import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { utils, writeFile } from 'xlsx'

export default function ReturnMengantarPage() {
    const [data, setData] = useState([])
    const [filtered, setFiltered] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [scanInput, setScanInput] = useState('')
    const [processingScan, setProcessingScan] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [ekspedisiFilter, setEkspedisiFilter] = useState('Semua')
    const [statusFilter, setStatusFilter] = useState('Semua')
    const [dateRange, setDateRange] = useState({ start: '', end: '' })
    const [lockedBiaya, setLockedBiaya] = useState({})
    const [showScanConfirm, setShowScanConfirm] = useState(false)
    const [scanPreview, setScanPreview] = useState(null) // { salesInfo }
    

    // Stats
    const totalReturn = filtered.length
    const diproses = filtered.filter(item => item.return_status === 'Diproses').length
    const diterima = filtered.filter(item => item.return_status === 'Diterima').length
    const hilang = filtered.filter(item => item.return_status === 'Hilang').length
    const totalBiayaRTS = filtered.reduce((sum, item) => sum + (Number(item.biaya_rts) || 0), 0)

    const scanInputRef = useRef(null)

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        applyFilters()
    }, [data, searchTerm, ekspedisiFilter, statusFilter, dateRange])

    const loadData = async () => {
        setLoading(true)
        setError(null)
        try {
            const { data: returnData, error: fetchError } = await supabase
                .from('mengantar_returns')
                .select(`
                    *,
                    mengantar_sales (
                        order_id,
                        customer_name,
                        goods_description,
                        create_date,
                        product_id,
                        quantity,
                        expedition,
                        timestamp,
                        cod
                    )
                `)
                .order('created_at', { ascending: false })
            
            if (fetchError) throw fetchError
            setData(returnData || [])
        } catch (err) {
            console.error('Load error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const applyFilters = () => {
        let result = [...data]
        if (searchTerm) {
            const q = searchTerm.toLowerCase()
            result = result.filter(item => 
                (item.tracking_id || '').toLowerCase().includes(q) ||
                (item.mengantar_sales?.order_id || '').toLowerCase().includes(q) ||
                (item.mengantar_sales?.customer_name || '').toLowerCase().includes(q) ||
                (item.mengantar_sales?.goods_description || '').toLowerCase().includes(q)
            )
        }
        if (ekspedisiFilter !== 'Semua') {
            result = result.filter(item => item.mengantar_sales?.expedition === ekspedisiFilter)
        }
        if (statusFilter !== 'Semua') {
            result = result.filter(item => item.return_status === statusFilter)
        }
        if (dateRange.start) {
            result = result.filter(item => {
                if (!item.mengantar_sales?.create_date) return false;
                return new Date(item.mengantar_sales.create_date) >= new Date(dateRange.start)
            })
        }
        if (dateRange.end) {
            result = result.filter(item => {
                if (!item.mengantar_sales?.create_date) return false;
                const endDate = new Date(dateRange.end)
                endDate.setHours(23, 59, 59, 999)
                return new Date(item.mengantar_sales.create_date) <= endDate
            })
        }
        setFiltered(result)
    }

    const uniqueEkspedisi = [...new Set(data.map(item => item.mengantar_sales?.expedition).filter(Boolean))]

    const handleScanSubmit = async (e) => {
        e.preventDefault()
        if (!scanInput.trim() || processingScan) return
        
        setProcessingScan(true)
        setError(null)
        const trackingId = scanInput.trim()
        
        try {
            // 1. Cari data di mengantar_sales berdasarkan tracking_id
            const { data: salesInfo, error: salesError } = await supabase
                .from('mengantar_sales')
                .select('id, tracking_id, last_status, customer_name, goods_description, quantity, expedition, cod, create_date, order_id')
                .eq('tracking_id', trackingId)
                .single()
            
            if (salesError || !salesInfo) {
                throw new Error(`Resi ${trackingId} tidak ditemukan di Penjualan Mengantar.`)
            }

            // 2. Cek apakah sudah ada di mengantar_returns
            const { data: existingReturn } = await supabase
                .from('mengantar_returns')
                .select('id')
                .eq('tracking_id', trackingId)
                .maybeSingle()
            
            if (existingReturn) {
                throw new Error(`Resi ${trackingId} sudah ada di daftar Return.`)
            }

            // 3. Tampilkan modal konfirmasi dengan detail order
            setScanPreview({ salesInfo })
            setShowScanConfirm(true)

        } catch (err) {
            console.error('Scan error:', err)
            setError(err.message)
        } finally {
            setProcessingScan(false)
        }
    }

    const confirmScan = async () => {
        if (!scanPreview) return
        const { salesInfo } = scanPreview
        setShowScanConfirm(false)
        setProcessingScan(true)
        setError(null)

        try {
            // Update status di mengantar_sales menjadi 'RTS'
            const { error: updateSalesErr } = await supabase
                .from('mengantar_sales')
                .update({ last_status: 'RTS' })
                .eq('id', salesInfo.id)

            if (updateSalesErr) throw updateSalesErr

            // Insert ke mengantar_returns
            const { error: insertErr } = await supabase
                .from('mengantar_returns')
                .insert([{
                    mengantar_sales_id: salesInfo.id,
                    tracking_id: salesInfo.tracking_id,
                    return_status: 'Diproses',
                    biaya_rts: 0
                }])
            
            if (insertErr) throw insertErr

            setScanInput('')
            setScanPreview(null)
            loadData()
        } catch (err) {
            console.error('Confirm scan error:', err)
            setError(err.message)
        } finally {
            setProcessingScan(false)
            if (scanInputRef.current) scanInputRef.current.focus()
        }
    }

    const cancelScan = () => {
        setShowScanConfirm(false)
        setScanPreview(null)
        if (scanInputRef.current) scanInputRef.current.focus()
    }

    const handleStatusChange = async (id, newStatus) => {
        try {
            const item = data.find(d => d.id === id)
            if (item) {
                const trId = item.tracking_id || item.order_id
                if (trId) {
                    await supabase.from('stock_mutations')
                        .delete()
                        .eq('reference_id', trId)
                        .like('note', 'Return %')
                }
            }

            // Optimistic update
            setData(prev => prev.map(item => item.id === id ? { ...item, return_status: newStatus } : item))
            setFiltered(prev => prev.map(item => item.id === id ? { ...item, return_status: newStatus } : item))
            
            const { error: updateErr } = await supabase
                .from('mengantar_returns')
                .update({ return_status: newStatus })
                .eq('id', id)
            if (updateErr) throw updateErr
        } catch (err) {
            console.error('Gagal update status:', err)
            alert('Gagal update status: ' + err.message)
            loadData() // revert
        }
    }

    const handleValidate = async (id, currentStatus) => {
        if (!confirm(`Validasi return ini dengan status ${currentStatus}? Setelah divalidasi, data tidak dapat diubah lagi.`)) return
        try {
            // Optimistic validation
            setData(prev => prev.map(item => item.id === id ? { ...item, is_validated: true } : item))
            setFiltered(prev => prev.map(item => item.id === id ? { ...item, is_validated: true } : item))

            const { error: updateErr } = await supabase
                .from('mengantar_returns')
                .update({ is_validated: true })
                .eq('id', id)
            
            if (updateErr) throw updateErr
        } catch (err) {
            alert('Gagal memvalidasi status: ' + err.message)
            loadData() // revert
        }
    }

    const updateBiayaRTS = async (id, currentBiayaStr, newBiayaStr, trackingId) => {
        const newBiaya = Number(newBiayaStr)
        if (isNaN(newBiaya) || newBiaya <= 0) return
        
        if (!confirm(`Simpan Biaya RTS Rp ${newBiaya.toLocaleString('id-ID')}? Data ini tidak bisa diubah lagi dan akan memotong batas maksimal Dana Bisa Dicairkan.`)) return
        
        try {
            // 1. Simpan biaya di mengantar_returns
            const { error: updateErr } = await supabase
                .from('mengantar_returns')
                .update({ biaya_rts: newBiaya })
                .eq('id', id)
            
            if (updateErr) throw updateErr

            // 2. Catat ke tabel expenses menggunakan COA yg diminta
            const today = new Date().toISOString().split('T')[0]
            const { error: expErr } = await supabase
                .from('expenses')
                .insert([{
                    date: today,
                    category: '[5011] Biaya RTS Mengantar',
                    amount: newBiaya,
                    payment_method: '[1013] Mengantar',
                    note: `Biaya RTS resi ${trackingId || id}`
                }])
            
            if (expErr) console.warn('Gagal catat pengeluaran:', expErr.message)

            setLockedBiaya(prev => ({...prev, [id]: true}))
            loadData()
        } catch (err) {
            alert('Gagal update biaya RTS: ' + err.message)
            loadData() // revert UI
        }
    }


    const fmt = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num || 0)
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID') : '-'

    const handleExport = () => {
        if (!filtered || filtered.length === 0) { alert('Tidak ada data untuk di-export'); return }
        const exportData = filtered.map((item, idx) => ({
            'No': idx + 1,
            'Tanggal Order': item.mengantar_sales?.create_date ? new Date(item.mengantar_sales.create_date).toLocaleDateString('id-ID') : '-',
            'Order ID': item.mengantar_sales?.order_id || '-',
            'Penerima': item.mengantar_sales?.customer_name || '-',
            'Product ID': item.mengantar_sales?.product_id || '-',
            'Detail Produk': item.mengantar_sales?.goods_description || '-',
            'Qty': item.mengantar_sales?.quantity || 1,
            'Tagihan (COD)': item.mengantar_sales?.cod || 0,
            'Ekspedisi': item.mengantar_sales?.expedition || '-',
            'Tracking ID': item.tracking_id || '-',
            'Status Return': item.return_status || '-',
            'Biaya RTS': item.biaya_rts || 0,
            'Tgl Update': item.updated_at ? new Date(item.updated_at).toLocaleString('id-ID') : '-'
        }))
        const worksheet = utils.json_to_sheet(exportData)
        const workbook = utils.book_new()
        utils.book_append_sheet(workbook, worksheet, "Return Mengantar")
        writeFile(workbook, `Return_Mengantar_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    return (
        <div className="page-container" style={{ padding: '20px' }}>

            {/* Scan Confirmation Modal */}
            {showScanConfirm && scanPreview && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '480px' }}>
                        <div className="modal-header">
                            <h2>🔄 Konfirmasi Return RTS</h2>
                            <button className="modal-close" onClick={cancelScan}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                Data ditemukan. Lanjutkan proses Return (RTS) untuk resi ini?
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Tracking ID</span>
                                    <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{scanPreview.salesInfo.tracking_id}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Order ID</span>
                                    <span style={{ fontWeight: 600 }}>{scanPreview.salesInfo.order_id || '-'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Penerima</span>
                                    <span style={{ fontWeight: 600 }}>{scanPreview.salesInfo.customer_name || '-'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Produk</span>
                                    <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{scanPreview.salesInfo.goods_description || '-'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Qty</span>
                                    <span style={{ fontWeight: 600 }}>{scanPreview.salesInfo.quantity || 1} pcs</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Ekspedisi</span>
                                    <span style={{ fontWeight: 600 }}>{scanPreview.salesInfo.expedition || '-'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>COD</span>
                                    <span style={{ fontWeight: 700, color: '#10b981' }}>{fmt(scanPreview.salesInfo.cod)}</span>
                                </div>
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Status Saat Ini</span>
                                    <span className="badge badge-info">{scanPreview.salesInfo.last_status || '-'}</span>
                                </div>
                            </div>
                            <div className="alert alert-warning" style={{ fontSize: '12px', margin: 0 }}>
                                ⚠️ Status penjualan akan diubah menjadi <strong>RTS</strong> dan dicatat di daftar Return.
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={cancelScan}>❌ Batal</button>
                            <button className="btn btn-primary" onClick={confirmScan} disabled={processingScan}>
                                {processingScan ? '⏳ Memproses...' : '✅ Ya, Lanjutkan RTS'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                        🔄 Return Mengantar
                    </h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
                        Scan resi untuk mengubah status penjualan menjadi RTS dan kelola status return
                    </p>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', flex: '1', maxWidth: '500px', justifyContent: 'flex-end' }}>
                    <button onClick={handleExport} className="btn" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📥 Export
                    </button>
                    <form onSubmit={handleScanSubmit} style={{ display: 'flex', gap: '8px', flex: '1' }}>
                        <input 
                            ref={scanInputRef}
                            type="text" 
                            placeholder="Scan / Input Resi Mengantar..." 
                            value={scanInput}
                            onChange={(e) => setScanInput(e.target.value)}
                            className="form-input"
                            style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                            disabled={processingScan}
                            autoFocus
                        />
                        <button type="submit" className="btn btn-primary" disabled={processingScan || !scanInput.trim()}>
                            {processingScan ? 'Memproses...' : 'Scan RTS'}
                        </button>
                    </form>
                </div>
            </div>

            {error && (
                <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
                    <strong>⚠️ Error:</strong> {error}
                </div>
            )}

            {/* Dashboard Cards */}
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>📦</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Total Return</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{totalReturn.toLocaleString('id-ID')}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>⏳</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Diproses</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{diproses.toLocaleString('id-ID')}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>✅</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Diterima</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{diterima.toLocaleString('id-ID')}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>❌</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Hilang</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{hilang.toLocaleString('id-ID')}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>💸</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Total Biaya RTS</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(totalBiayaRTS)}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-search">
                        🔍
                        <input type="text" placeholder="Cari Tracking ID, Order ID, atau Produk..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="filter-group">
                        <select 
                            className="filter-select" 
                            value={ekspedisiFilter} 
                            onChange={(e) => setEkspedisiFilter(e.target.value)}
                        >
                            <option value="Semua">Semua Ekspedisi</option>
                            {uniqueEkspedisi.map(exp => (
                                <option key={exp} value={exp}>{exp}</option>
                            ))}
                        </select>
                        <select 
                            className="filter-select" 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="Semua">Semua Status</option>
                            <option value="Diproses">Diproses</option>
                            <option value="Diterima">Diterima</option>
                            <option value="Hilang">Hilang</option>
                        </select>
                        <div className="filter-custom-date">
                            <input 
                                type="date" 
                                className="filter-date-input" 
                                value={dateRange.start} 
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                title="Tanggal Awal"
                            />
                            <span>-</span>
                            <input 
                                type="date" 
                                className="filter-date-input" 
                                value={dateRange.end} 
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                title="Tanggal Akhir"
                            />
                        </div>
                    </div>
                </div>
                <div className="table-wrapper">
                    {loading ? (
                        <div className="empty-state"><div className="spinner"></div><p>Memuat data...</p></div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📭</div>
                            <p>Belum ada data return Mengantar</p>
                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Scan resi di atas untuk mencatat barang return</span>
                        </div>
                    ) : (
                        <table className="tiktok-table">
                            <thead>
                                <tr>
                                    <th>No.</th>
                                    <th>Info Order</th>
                                    <th>Penerima</th>
                                    <th>Produk</th>
                                    <th>Qty</th>
                                    <th>Tagihan</th>
                                    <th>Pengiriman</th>
                                    <th>Status Return</th>
                                    <th>Biaya RTS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td>{idx + 1}</td>
                                        <td>
                                            <div className="cell-date">{fmtDate(item.mengantar_sales?.create_date)}</div>
                                            <div className="cell-sub" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{item.mengantar_sales?.order_id || '-'}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{item.mengantar_sales?.customer_name || '-'}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{item.mengantar_sales?.product_id || '-'}</div>
                                            <div style={{ maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {item.mengantar_sales?.goods_description || '-'}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{item.mengantar_sales?.quantity || 1}</div>
                                        </td>
                                        <td>
                                            <div className="cell-currency" style={{ fontWeight: 500 }}>{fmt(item.mengantar_sales?.cod)}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 500, fontSize: '13px' }}>{item.mengantar_sales?.expedition || '-'}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.tracking_id}</div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                                                <select
                                                    value={item.return_status || 'Diproses'}
                                                    onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                                    disabled={item.is_validated}
                                                    className={`form-select ${
                                                        item.return_status === 'Diterima' ? 'status-success' : 
                                                        item.return_status === 'Hilang' ? 'status-danger' : 'status-warning'
                                                    }`}
                                                    style={{ padding: '6px 30px 6px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', fontWeight: 600, cursor: item.is_validated ? 'default' : 'pointer', appearance: 'auto' }}
                                                >
                                                    <option value="Diproses">Diproses</option>
                                                    <option value="Diterima">Diterima</option>
                                                    <option value="Hilang">Hilang</option>
                                                </select>

                                                {item.is_validated ? (
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>✅ Divalidasi</span>
                                                ) : (item.return_status === 'Diterima' || item.return_status === 'Hilang') ? (
                                                    <button 
                                                        onClick={() => handleValidate(item.id, item.return_status)}
                                                        className="btn btn-primary" 
                                                        style={{ padding: '4px 8px', fontSize: '11px', width: '100%', justifyContent: 'center' }}
                                                    >
                                                        Validasi ✓
                                                    </button>
                                                ) : null}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {item.biaya_rts > 0 || lockedBiaya[item.id] ? (
                                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {fmt(item.biaya_rts)}
                                                    </span>
                                                ) : (
                                                    <>
                                                        <input 
                                                            type="number" 
                                                            id={`input-biaya-${item.id}`}
                                                            defaultValue={item.biaya_rts} 
                                                            style={{ width: '90px', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                                                            placeholder="0"
                                                        />
                                                        <button 
                                                            onClick={() => {
                                                                const newVal = document.getElementById(`input-biaya-${item.id}`).value;
                                                                updateBiayaRTS(item.id, item.biaya_rts, newVal, item.tracking_id)
                                                            }}
                                                            className="btn btn-primary" 
                                                            style={{ padding: '6px 10px', fontSize: '12px' }}
                                                        >
                                                            Simpan
                                                        </button>
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
            </div>
        </div>
    )
}
