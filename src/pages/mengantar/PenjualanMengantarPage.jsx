import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { utils, writeFile } from 'xlsx'
import { parseCSV, parseXLSX, mapMengantarRow } from '../../lib/csvParser'

export default function PenjualanMengantarPage() {
    const [data, setData] = useState([])
    const [filtered, setFiltered] = useState([])
    const [loading, setLoading] = useState(true)
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState(null)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [importStats, setImportStats] = useState(null)
    const [pendingImportData, setPendingImportData] = useState([])
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [ekspedisiFilter, setEkspedisiFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState('all')
    const [customRange, setCustomRange] = useState({ start: '', end: '' })
    const [selectedMonth, setSelectedMonth] = useState('')

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 20

    const fileInputRef = useRef(null)

    useEffect(() => { loadData() }, [])

    useEffect(() => {
        applyFilters()
    }, [data, searchTerm, statusFilter, ekspedisiFilter, dateFilter, customRange, selectedMonth])

    const loadData = async () => {
        setLoading(true)
        setError(null)
        try {
            const { data: salesData, error: fetchError } = await supabase
                .from('mengantar_sales')
                .select('*')
                .order('create_date', { ascending: false })
            if (fetchError) throw fetchError
            setData(salesData || [])
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
                (item.order_id || '').toLowerCase().includes(q) ||
                (item.tracking_id || '').toLowerCase().includes(q) ||
                (item.customer_name || '').toLowerCase().includes(q) ||
                (item.goods_description || '').toLowerCase().includes(q)
            )
        }

        if (statusFilter !== 'all') {
            result = result.filter(item => (item.last_status || '') === statusFilter)
        }

        if (ekspedisiFilter !== 'all') {
            result = result.filter(item => (item.expedition || '') === ekspedisiFilter)
        }

        const now = new Date()
        let startDate = null
        let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

        if (dateFilter === '7days') { startDate = new Date(now); startDate.setDate(now.getDate() - 7) }
        else if (dateFilter === '30days') { startDate = new Date(now); startDate.setDate(now.getDate() - 30) }
        else if (dateFilter === 'month') { startDate = new Date(now.getFullYear(), now.getMonth(), 1) }
        else if (dateFilter === 'year') { startDate = new Date(now.getFullYear(), 0, 1) }
        else if (dateFilter === 'select_month' && selectedMonth) {
            const [y, m] = selectedMonth.split('-')
            startDate = new Date(y, m - 1, 1); endDate = new Date(y, m, 0, 23, 59, 59)
        } else if (dateFilter === 'custom' && customRange.start && customRange.end) {
            startDate = new Date(customRange.start); endDate = new Date(customRange.end); endDate.setHours(23, 59, 59)
        }

        if (startDate && endDate && dateFilter !== 'all') {
            result = result.filter(item => {
                const date = new Date(item.create_date || item.created_at)
                return date >= startDate && date <= endDate
            })
        }

        setFiltered(result)
        setCurrentPage(1)
    }
    // Import
    const handleImportClick = () => fileInputRef.current?.click()

    const handleImport = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setImporting(true)
        setImportResult(null)
        setError(null)

        try {
            let rows = []
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                try {
                    rows = parseXLSX(await file.arrayBuffer())
                    if (rows.length === 0) throw new Error('Empty')
                } catch (err) {
                    rows = parseCSV(await file.text())
                }
            } else {
                rows = parseCSV(await file.text())
            }
            if (rows.length === 0) throw new Error('File kosong atau format tidak sesuai')

            const mapped = rows.map(r => mapMengantarRow(r)).filter(item => item.order_id || item.tracking_id)
            if (mapped.length === 0) throw new Error('Tidak ada data valid. Pastikan kolom "Order ID" ada di header file.')

            // Fetch all products to build lookup maps
            const { data: prods } = await supabase.from('products').select('name, sku')
            const skuToProduct = {}  // sku.lower → { name, sku }
            const nameToProduct = {} // name.lower → { name, sku }
            ;(prods || []).forEach(p => {
                if (p.sku) skuToProduct[p.sku.toLowerCase().trim()] = { name: p.name, sku: p.sku }
                if (p.name) nameToProduct[p.name.toLowerCase().trim()] = { name: p.name, sku: p.sku }
            })

            // Normalisasi goods_description dan product_id saat import:
            // Prioritas 1: Cocokkan file.product_id dengan SKU master → pakai nama produk master
            // Prioritas 2: Cocokkan goods_description dengan nama produk → pakai SKU master
            mapped.forEach(item => {
                const skuKey = (item.product_id || '').toLowerCase().trim()
                const nameKey = (item.goods_description || '').toLowerCase().trim()

                if (skuKey && skuToProduct[skuKey]) {
                    // SKU ditemukan → gunakan nama produk canonical dari master
                    item.goods_description = skuToProduct[skuKey].name
                    item.product_id = skuToProduct[skuKey].sku
                } else if (nameKey && nameToProduct[nameKey]) {
                    // Nama cocok → isi SKU
                    item.product_id = nameToProduct[nameKey].sku
                    item.goods_description = nameToProduct[nameKey].name // normalisasi casing
                }
                // Jika tidak ada match sama sekali: biarkan apa adanya dari file
            })


            // Duplicate check by order_id
            const orderIds = mapped.map(item => item.order_id).filter(Boolean)
            let existingRecords = []
            for (let i = 0; i < orderIds.length; i += 100) {
                const chunk = orderIds.slice(i, i + 100)
                const { data: existing } = await supabase.from('mengantar_sales').select('order_id').in('order_id', chunk)
                if (existing) existingRecords = [...existingRecords, ...existing]
            }
            const existingKeys = new Set(existingRecords.map(r => r.order_id))

            const toInsert = []
            let countDuplikat = 0
            mapped.forEach(item => {
                if (item.order_id && existingKeys.has(item.order_id)) {
                    countDuplikat++
                } else {
                    toInsert.push(item)
                    if (item.order_id) existingKeys.add(item.order_id)
                }
            })


            setImportStats({ berhasil: toInsert.length, duplikat: countDuplikat })
            setPendingImportData(toInsert)
            setShowConfirmModal(true)
        } catch (err) {
            console.error('Import error:', err)
            setError(err.message)
        } finally {
            setImporting(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const confirmImport = async () => {
        setShowConfirmModal(false)
        setImporting(true)
        setError(null)
        setImportResult(null)
        try {
            let inserted = 0
            for (let i = 0; i < pendingImportData.length; i += 50) {
                const batch = pendingImportData.slice(i, i + 50)
                const { error } = await supabase.from('mengantar_sales').insert(batch)
                if (error) throw error
                inserted += batch.length
            }
            setImportResult({ success: true, berhasil: inserted, duplikat: importStats.duplikat })
            loadData()
        } catch (err) {
            console.error('Confirm import error:', err)
            setError(err.message)
            setImportResult({ error: err.message })
        } finally {
            setImporting(false)
            setPendingImportData([])
            setImportStats(null)
        }
    }

    const cancelImport = () => { setShowConfirmModal(false); setPendingImportData([]); setImportStats(null) }

    // Export
    const handleExport = () => {
        if (!filtered || filtered.length === 0) { alert('Tidak ada data untuk di-export'); return }
        const exportData = filtered.map((item, idx) => ({
            'No': idx + 1,
            'Tanggal': item.create_date ? new Date(item.create_date).toLocaleDateString('id-ID') : '-',
            'Expedition': item.expedition || '-',
            'Order ID': item.order_id || '-',
            'Tracking ID': item.tracking_id || '-',
            'STT Number': item.stt_number || '-',
            'Nama Konsumen': item.customer_name || '-',
            'Product ID': item.product_id || '-',
            'Produk': item.goods_description || '-',
            'Qty': item.quantity || 0,
            'COD': item.cod || 0,
            'Harga Jual': item.harga_jual || 0,
            'Diskon Persentase': item.diskon_persentase || 0,
            'Diskon Nominal': item.diskon_nominal || 0,
            'Harga Barang Setelah Diskon': item.harga_setelah_diskon || 0,
            'COGS': item.cogs || 0,
            'Ongkir': item.estimated_pricing || 0,
            'Status': item.last_status || '-',
            'Last Update': item.last_update ? new Date(item.last_update).toLocaleDateString('id-ID') : '-',
            'Timestamp Upload': item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID') : '-'
        }))
        const worksheet = utils.json_to_sheet(exportData)
        const workbook = utils.book_new()
        utils.book_append_sheet(workbook, worksheet, "Penjualan Mengantar")
        writeFile(workbook, `Penjualan_Mengantar_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    // Helpers
    const fmt = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num || 0)
    const fmtDate = (d) => {
        if (!d) return '-'
        const date = new Date(d)
        if (isNaN(date.getTime())) return '-'
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const uniqueStatuses = [...new Set(data.map(d => d.last_status).filter(Boolean))].sort()
    const uniqueEkspedisi = [...new Set(data.map(d => d.expedition).filter(Boolean))].sort()

    // Status counts based on filtered data
    const statusCounts = filtered.reduce((acc, item) => {
        const status = item.last_status || 'Unknown'
        acc[status] = (acc[status] || 0) + 1
        return acc
    }, {})

    const totalCOD = filtered.reduce((sum, item) => sum + (Number(item.cod) || 0), 0)
    const totalOngkir = filtered.reduce((sum, item) => sum + (Number(item.estimated_pricing) || 0), 0)
    const estimasiPencairan = totalCOD - totalOngkir

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
    const paginatedData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    useEffect(() => { if (currentPage > totalPages && totalPages > 0) setCurrentPage(1) }, [filtered.length, totalPages, currentPage])

    return (
        <div className="page-container" style={{ padding: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>🛒 Penjualan Mengantar</h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Kelola data penjualan dari platform Mengantar</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📤</span> Export Excel
                    </button>
                    <input type="file" accept=".csv,.xlsx,.xls" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} />
                    <button className="btn btn-primary" onClick={handleImportClick} disabled={importing} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {importing ? (<><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div> Mengimpor...</>) : (<><span>📥</span> Import Excel/CSV</>)}
                    </button>
                </div>
            </div>

            {/* Confirm Modal */}
            {showConfirmModal && importStats && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h2>📋 Konfirmasi Import Data</h2>
                            <button className="modal-close" onClick={cancelImport}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Hasil pengecekan file:</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '10px 14px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 500 }}>✅ Data Baru</span>
                                    <span style={{ fontWeight: 700, fontSize: '20px', color: '#10b981' }}>{importStats.berhasil}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(107, 114, 128, 0.08)', border: '1px solid rgba(107, 114, 128, 0.2)', borderRadius: '8px', padding: '10px 14px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 500 }}>🔄 Duplikat (Dilewati)</span>
                                    <span style={{ fontWeight: 700, fontSize: '20px', color: 'var(--text-muted)' }}>{importStats.duplikat}</span>
                                </div>
                            </div>
                            {importStats.berhasil === 0 ? (
                                <div className="alert alert-error">⚠️ Tidak ada data baru untuk di-import.</div>
                            ) : (
                                <div className="alert alert-success">✨ Data valid. Siap untuk di-import.</div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={cancelImport}>Batal</button>
                            {importStats.berhasil > 0 && <button className="btn btn-primary" onClick={confirmImport}>✅ Ya, Import Sekarang</button>}
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
                    <strong>⚠️ Error:</strong> {error}
                </div>
            )}

            {importResult && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px', borderTop: importResult.success ? '4px solid var(--success)' : '4px solid var(--danger)' }}>
                        <div className="modal-header">
                            <h2>{importResult.success ? '✅ Import Berhasil' : '⚠️ Import Gagal'}</h2>
                            <button className="btn-close" onClick={() => setImportResult(null)}>×</button>
                        </div>
                        <div className="modal-body" style={{ padding: '20px' }}>
                            {importResult.success ? (
                                <ul style={{ margin: '0 0 16px 20px', lineHeight: '1.6' }}>
                                    <li>Berhasil ditambahkan: <b style={{ color: 'var(--success)' }}>{importResult.berhasil}</b> data</li>
                                    <li>Duplikat (diabaikan): <b style={{ color: 'var(--text-muted)' }}>{importResult.duplikat}</b> data</li>
                                </ul>
                            ) : (
                                <p style={{ color: 'var(--danger)' }}>{importResult.error}</p>
                            )}
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-primary" onClick={() => setImportResult(null)}>Tutup</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>📦</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Total Pesanan</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{filtered.length.toLocaleString('id-ID')}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>💰</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Total COD</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(totalCOD)}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>🚚</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Total Ongkir</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(totalOngkir)}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>�</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Estimasi Pencairan</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(estimasiPencairan)}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Cards */}
            {Object.keys(statusCounts).length > 0 && (
                <div className="stats-grid" style={{ marginBottom: '24px' }}>
                    {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                        let icon = '📦'
                        let colorClass = 'rgba(59, 130, 246, 0.1)'
                        let textColor = '#3b82f6'

                        if (status.toLowerCase().includes('delivered')) {
                            icon = '✅'
                            colorClass = 'rgba(16, 185, 129, 0.1)'
                            textColor = '#10b981'
                        } else if (status.toLowerCase().includes('return') || status.toLowerCase().includes('fail')) {
                            icon = '❌'
                            colorClass = 'rgba(239, 68, 68, 0.1)'
                            textColor = '#ef4444'
                        } else if (status.toLowerCase().includes('dikirim')) {
                            icon = '🚚'
                            colorClass = 'rgba(245, 158, 11, 0.1)'
                            textColor = '#f59e0b'
                        }

                        return (
                            <div key={status} className="stat-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="stat-card-icon" style={{ background: colorClass, color: textColor }}>{icon}</div>
                                    <div>
                                        <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>{status}</p>
                                        <h3 className="stat-card-value" style={{ margin: 0 }}>{count.toLocaleString('id-ID')}</h3>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Table */}
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-search">
                        🔍
                        <input type="text" placeholder="Cari order ID, tracking, konsumen, produk..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="filter-group">
                        <select className="filter-select" value={ekspedisiFilter} onChange={e => setEkspedisiFilter(e.target.value)}>
                            <option value="all">Semua Ekspedisi</option>
                            {uniqueEkspedisi.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="all">Semua Status</option>
                            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select className="filter-select" value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
                            <option value="all">Semua Waktu</option>
                            <option value="7days">7 Hari</option>
                            <option value="30days">30 Hari</option>
                            <option value="month">Bulan Ini</option>
                            <option value="select_month">Pilih Bulan</option>
                            <option value="year">Tahun Ini</option>
                            <option value="custom">Custom</option>
                        </select>
                        {dateFilter === 'select_month' && <input type="month" className="filter-date-input" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />}
                        {dateFilter === 'custom' && (
                            <div className="filter-custom-date">
                                <input type="date" className="filter-date-input" value={customRange.start} onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))} />
                                <span style={{ color: 'var(--text-muted)' }}>s/d</span>
                                <input type="date" className="filter-date-input" value={customRange.end} onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))} />
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
                        <div className="empty-state">
                            <div className="empty-state-icon">📭</div>
                            <p>Belum ada data penjualan Mengantar</p>
                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Klik tombol Import Excel/CSV untuk mengunggah data</span>
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
                                    <th>Update</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((item, idx) => (
                                    <tr key={item.id || idx}>
                                        <td>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                        <td>
                                            <div className="cell-date">{fmtDate(item.create_date)}</div>
                                            <div className="cell-sub" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{item.order_id || '-'}</div>
                                        </td>
                                        <td>
                                            <div className="cell-main">{item.customer_name || '-'}</div>
                                            <div className="cell-sub" style={{ color: 'var(--text-muted)' }}>{item.city || '-'}</div>
                                        </td>
                                        <td>
                                            <div className="cell-main" style={{ fontFamily: 'monospace' }}>{item.product_id || '-'}</div>
                                            <div className="cell-sub">{item.goods_description || '-'}</div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div className="cell-main">{item.quantity || '-'} pcs</div>
                                        </td>
                                        <td>
                                            <div className="cell-currency">{fmt(item.cod)}</div>
                                            <div className="cell-sub" style={{ color: 'var(--text-muted)' }}>Ongkir: {fmt(item.estimated_pricing)}</div>
                                        </td>
                                        <td>
                                            <div className="cell-main" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{item.tracking_id || '-'}</div>
                                            <div className="cell-sub">{item.expedition || '-'}</div>
                                        </td>
                                        <td style={{ fontSize: '12px' }}>{item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                        <td>
                                            <span className={`badge ${(item.last_status || '').toLowerCase().includes('delivered') ? 'badge-success' :
                                                (item.last_status || '').toLowerCase().includes('return') || (item.last_status || '').toLowerCase().includes('fail') ? 'badge-danger' :
                                                    'badge-warning'
                                                }`}>
                                                {item.last_status || '-'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
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
                            {paginatedData.map((item, idx) => (
                                <div key={item.id || idx} className="data-card">
                                    <div className="data-card-header">
                                        <span className="data-card-number">#{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</span>
                                        <span className={`badge ${(item.last_status || '').toLowerCase().includes('delivered') ? 'badge-success' : (item.last_status || '').toLowerCase().includes('return') ? 'badge-danger' : 'badge-warning'}`}>
                                            {item.last_status || '-'}
                                        </span>
                                    </div>
                                    <div className="data-card-body">
                                        <div className="data-card-row"><span className="data-card-label">Create Date & ID</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <div className="data-card-value">{fmtDate(item.create_date)}</div>
                                                <div className="data-card-value" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{item.order_id || '-'}</div>
                                            </div>
                                        </div>
                                        <div className="data-card-row"><span className="data-card-label">Konsumen & Kota</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <div className="data-card-value">{item.customer_name || '-'}</div>
                                                <div className="data-card-value" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.city || '-'}</div>
                                            </div>
                                        </div>
                                        <div className="data-card-row"><span className="data-card-label">Produk</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <div className="data-card-value">{item.goods_description || '-'}</div>
                                                <div className="data-card-value" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>SKU: {item.product_id || '-'}</div>
                                                <div className="data-card-value" style={{ fontSize: '12px' }}>Qty: {item.quantity || 0}</div>
                                            </div>
                                        </div>
                                        <div className="data-card-row"><span className="data-card-label">COD & Ongkir</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <div className="data-card-value" style={{ fontWeight: 600 }}>{fmt(item.cod)}</div>
                                                <div className="data-card-value" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ongkir: {fmt(item.estimated_pricing)}</div>
                                            </div>
                                        </div>
                                        <div className="data-card-row"><span className="data-card-label">Resi & Ekspedisi</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <div className="data-card-value" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{item.tracking_id || '-'}</div>
                                                <div className="data-card-value" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.expedition || '-'} ({item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'})</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
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
        </div>
    )
}
