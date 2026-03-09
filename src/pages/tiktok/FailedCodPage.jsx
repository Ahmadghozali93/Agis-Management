import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { getAverageHpp } from '../../lib/stockUtils'
import { parseCSV, parseXLSX, mapTiktokFailedCodRow } from '../../lib/csvParser'

const STATUS_MAP = {
    'RTS': { label: 'RTS (Retur)', cls: 'badge-danger', icon: '❌', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    'Completed': { label: 'Selesai', cls: 'badge-success', icon: '✅', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
    'Selesai': { label: 'Selesai', cls: 'badge-success', icon: '✅', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
    'Selesai Otomatis': { label: 'Selesai Auto', cls: 'badge-success', icon: '✅', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
    'done': { label: 'Selesai Auto', cls: 'badge-success', icon: '✅', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
    'Shipped': { label: 'Dikirim', cls: 'badge-info', icon: '🚚', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    'Dikirim': { label: 'Dikirim', cls: 'badge-info', icon: '🚚', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' }
}

function getStatusBadge(status) {
    const mapped = STATUS_MAP[status] || { label: status || 'RTS', cls: 'badge-danger' }
    return <span className={`badge ${mapped.cls}`}>{mapped.label}</span>
}

function fmt(val) {
    return 'Rp ' + (val || 0).toLocaleString('id-ID')
}

export default function FailedCodPage() {
    const [data, setData] = useState([])
    const [filtered, setFiltered] = useState([])
    const [loading, setLoading] = useState(true)
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState(null)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [importStats, setImportStats] = useState(null)
    const [pendingImportData, setPendingImportData] = useState([])
    const [error, setError] = useState(null)
    const [search, setSearch] = useState('')
    const [dateFilter, setDateFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [tokoFilter, setTokoFilter] = useState('all')
    const [customFrom, setCustomFrom] = useState('')
    const [customTo, setCustomTo] = useState('')
    const [selectedMonth, setSelectedMonth] = useState('')

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 20

    const fileRef = useRef(null)

    useEffect(() => {
        loadData()
    }, [dateFilter, customFrom, customTo, selectedMonth])

    useEffect(() => {
        applyFilters(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data])

    useEffect(() => {
        applyFilters(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, statusFilter, tokoFilter])

    const loadData = async () => {
        setLoading(true)
        try {
            let query = supabase.from('tiktok_failed_cod').select('*').order('created_at', { ascending: false })

            // Basic Date Filtering for Load if needed
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

            if (from) query = query.gte('return_time', from)
            if (to) query = query.lte('return_time', to)

            const { data: result, error: queryError } = await query
            if (queryError) throw queryError
            if (result) {
                // Fetch associated sales details so we can match Penjualan menu exactly
                const orderIds = result.map(r => r.order_id).filter(Boolean)
                const uniqueOrderIds = [...new Set(orderIds)]

                let mergedData = []

                if (uniqueOrderIds.length > 0) {
                    let salesData = []
                    for (let i = 0; i < uniqueOrderIds.length; i += 100) {
                        const chunk = uniqueOrderIds.slice(i, i + 100)
                        const { data: s } = await supabase.from('tiktok_sales').select('*').in('order_id', chunk)
                        if (s) salesData = [...salesData, ...s]
                    }

                    const failedMap = {}
                    result.forEach(f => {
                        failedMap[f.order_id] = f
                    })

                    // Attach the failed detail to the original mapped sales line item
                    salesData.forEach(sale => {
                        const failedRecord = failedMap[sale.order_id]
                        if (failedRecord) {
                            mergedData.push({
                                ...sale,
                                failed_cod_record: failedRecord
                            })
                        }
                    })

                    // Handle missing cases (if Failed COD has order_id not in Sales DB)
                    const salesOrderIds = new Set(salesData.map(s => s.order_id))
                    result.forEach(f => {
                        if (!salesOrderIds.has(f.order_id)) {
                            mergedData.push({
                                id: f.id,
                                order_id: f.order_id,
                                order_status: 'RTS',
                                failed_cod_record: f
                            })
                        }
                    })
                }

                mergedData.sort((a, b) => {
                    const dtA = a.failed_cod_record?.return_time || a.created_at
                    const dtB = b.failed_cod_record?.return_time || b.created_at
                    return new Date(dtB) - new Date(dtA)
                })

                setData(mergedData)
                setCurrentPage(1)
            }
        } catch (err) {
            console.error('Load error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleStatusChange = async (orderId, newStatus) => {
        try {
            // Optimistic UI update
            setData(prevData => prevData.map(item => {
                const failedRec = item.failed_cod_record || {}
                if (item.order_id === orderId) {
                    return {
                        ...item,
                        failed_cod_record: { ...failedRec, return_status: newStatus }
                    }
                }
                return item
            }))

            // Re-apply filters with new data
            setFiltered(prevFiltered => prevFiltered.map(item => {
                const failedRec = item.failed_cod_record || {}
                if (item.order_id === orderId) {
                    return {
                        ...item,
                        failed_cod_record: { ...failedRec, return_status: newStatus }
                    }
                }
                return item
            }))

            const item = data.find(d => d.order_id === orderId)
            const oldStatus = item?.failed_cod_record?.return_status || 'Diproses'
            const isVal = item?.failed_cod_record?.is_validated || false

            if (isVal) {
                alert('Data ini sudah divalidasi dan tidak bisa diubah lagi.');
                return;
            }

            if (item && oldStatus !== newStatus) {
                const qty = parseInt(item.quantity) || 0;

                // Cleanup any existing mutation from previous status resolution
                await supabase.from('stock_mutations').delete().like('note', `%Failed COD: ${orderId}%`)

                // Insert new mutation if resolving to Diterima or Hilang
                if (qty > 0 && (newStatus === 'Diterima' || newStatus === 'Hilang')) {
                    const type = newStatus === 'Diterima' ? 'in' : 'out'
                    const desc = `Retur ${newStatus} dari Failed COD: ${orderId}`

                    const skuToUse = item.seller_sku || item.sku_id
                    const avgHpp = await getAverageHpp(skuToUse, item.product_name)

                    const { error: mutError } = await supabase.from('stock_mutations').insert([{
                        product_name: item.product_name,
                        sku: skuToUse,
                        qty: qty,
                        hpp: avgHpp,
                        type: type,
                        reference_id: orderId,
                        note: desc,
                        date: new Date().toISOString().substring(0, 10),
                        created_at: new Date().toISOString()
                    }])
                    if (mutError) throw mutError
                }
            }

            const { error: updateError } = await supabase
                .from('tiktok_failed_cod')
                .update({ return_status: newStatus })
                .eq('order_id', orderId)

            if (updateError) throw updateError
        } catch (err) {
            console.error('Update status error:', err)
            // Revert on error
            loadData()
            alert('Gagal mengupdate status: ' + err.message)
        }
    }

    const handleValidate = async (orderId) => {
        try {
            if (!window.confirm('Validasi retur ini? Setelah divalidasi, status dan stok tidak bisa diubah lagi.')) return;

            // Optimistic UI update
            setData(prevData => prevData.map(item => {
                const failedRec = item.failed_cod_record || {}
                if (item.order_id === orderId) {
                    return {
                        ...item,
                        failed_cod_record: { ...failedRec, is_validated: true }
                    }
                }
                return item
            }))
            setFiltered(prevFiltered => prevFiltered.map(item => {
                const failedRec = item.failed_cod_record || {}
                if (item.order_id === orderId) {
                    return {
                        ...item,
                        failed_cod_record: { ...failedRec, is_validated: true }
                    }
                }
                return item
            }))

            const { error: updateError } = await supabase
                .from('tiktok_failed_cod')
                .update({ is_validated: true })
                .eq('order_id', orderId)

            if (updateError) throw updateError

            alert('Retur berhasil divalidasi!');
        } catch (err) {
            console.error('Validate error:', err)
            loadData()
            alert('Gagal memvalidasi: ' + err.message)
        }
    }

    // Get unique toko/warehouse for filter dropdown
    const uniqueToko = [...new Set(data.map(d => d.warehouse_name).filter(Boolean))].sort()

    const applyFilters = (resetPage = true) => {
        const filteredData = data.filter(item => {
            const failedRec = item.failed_cod_record || {}

            // Toko Filter
            if (tokoFilter !== 'all') {
                if ((item.warehouse_name || '') !== tokoFilter) return false
            }

            if (statusFilter !== 'all') {
                const rs = failedRec.return_status || 'Diproses'
                if (rs !== statusFilter) return false
            }

            if (!search) return true
            const q = search.toLowerCase()

            return (
                (item.order_id || '').toLowerCase().includes(q) ||
                (item.tracking_id || failedRec.tracking_id || '').toLowerCase().includes(q) ||
                (item.buyer_username || '').toLowerCase().includes(q) ||
                (item.recipient || '').toLowerCase().includes(q) ||
                (item.product_name || '').toLowerCase().includes(q) ||
                (failedRec.return_reason || '').toLowerCase().includes(q)
            )
        })
        setFiltered(filteredData)
        if (resetPage) {
            setCurrentPage(1)
        }
    }

    const fmtDate = (d) => {
        if (!d) return '-'
        return new Date(d).toLocaleDateString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric'
        })
    }

    const handleImport = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setImporting(true)
        setImportResult(null)
        setError(null)

        try {
            console.log("Reading file:", file.name)
            let rows = []

            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                const buffer = await file.arrayBuffer()
                rows = parseXLSX(buffer)
            } else {
                const text = await file.text()
                rows = parseCSV(text)
            }

            if (rows.length === 0) throw new Error('File kosong atau format tidak sesuai')

            const mapped = rows.map(mapTiktokFailedCodRow)

            // Deduplicate by order_id (keep last occurrence)
            const uniqueMap = new Map()
            mapped.forEach(item => {
                if (!item.order_id) return // skip empty order ids
                uniqueMap.set(item.order_id, item)
            })
            const uniqueData = Array.from(uniqueMap.values())

            if (uniqueData.length === 0) throw new Error('Tidak ada data retur valid untuk di-import')

            // Duplicate Validation Check
            const orderIdsToCheck = uniqueData.map(item => item.order_id)
            let existingRecords = []
            for (let i = 0; i < orderIdsToCheck.length; i += 100) {
                const chunk = orderIdsToCheck.slice(i, i + 100)
                const { data: existing, error: checkError } = await supabase
                    .from('tiktok_failed_cod')
                    .select('order_id')
                    .in('order_id', chunk)

                if (checkError) {
                    console.error("Duplicate check error. Does tiktok_failed_cod table schema match (order_id, tracking_id, return_reason, return_time)?", checkError)
                    throw new Error("Gagal memeriksa data ganda. Pastikan struktur tabel tiktok_failed_cod di database sudah diperbarui (" + checkError.message + ").")
                }
                if (existing) {
                    existingRecords = [...existingRecords, ...existing]
                }
            }

            const existingKeys = new Set(existingRecords.map(record => record.order_id))

            const toInsert = []
            let countDuplikat = 0

            uniqueData.forEach(item => {
                if (existingKeys.has(item.order_id)) {
                    countDuplikat++
                } else {
                    toInsert.push(item)
                }
            })

            setImportStats({
                berhasil: toInsert.length,
                duplikat: countDuplikat
            })
            setPendingImportData(toInsert)
            setShowConfirmModal(true)

        } catch (err) {
            console.error("Import error:", err)
            setImportResult({ success: false, message: err.message })
        } finally {
            setImporting(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    const confirmImport = async () => {
        setShowConfirmModal(false)
        setImporting(true)
        setError(null)
        setImportResult(null)

        try {
            // Upsert in batches to tiktok_failed_cod
            let inserted = 0
            const batchSize = 50
            for (let i = 0; i < pendingImportData.length; i += batchSize) {
                const batch = pendingImportData.slice(i, i + batchSize)
                const { error } = await supabase
                    .from('tiktok_failed_cod')
                    .upsert(batch, { onConflict: 'order_id', ignoreDuplicates: false })

                if (error) {
                    console.error("DB Upsert error:", error)
                    throw new Error("Gagal menyimpan data ke database. Peringatan: Kolom mungkin tidak sesuai. " + error.message)
                }
                inserted += batch.length
            }

            // === CORE REQUIREMENT: Update the main tiktok_sales table's status to 'RTS'. ===
            const orderIdsToUpdate = pendingImportData.map(item => item.order_id)
            for (let i = 0; i < orderIdsToUpdate.length; i += 100) {
                const chunk = orderIdsToUpdate.slice(i, i + 100)
                const { error: rtsError } = await supabase
                    .from('tiktok_sales')
                    .update({ order_status: 'RTS' })
                    .in('order_id', chunk)

                if (rtsError) {
                    console.error("Failed to update RTS in tiktok_sales", rtsError)
                }
            }

            setImportResult({
                success: true,
                berhasil: inserted,
                duplikat: importStats.duplikat
            })
            loadData()
        } catch (err) {
            console.error("Confirm Import error:", err)
            setImportResult({ success: false, message: err.message })
        } finally {
            setImporting(false)
            setPendingImportData([])
            setImportStats(null)
        }
    }

    const cancelImport = () => {
        setShowConfirmModal(false)
        setPendingImportData([])
        setImportStats(null)
    }

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
    const paginatedData = filtered.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    )

    return (
        <div>
            <div className="page-header">
                <h1>❌ Failed COD (Retur)</h1>
                <div className="page-header-actions">
                    <label className={`btn btn-primary ${importing ? 'btn-disabled' : ''}`} style={{ cursor: importing ? 'wait' : 'pointer' }}>
                        {importing ? '⏳ Importing...' : '📥 Import File Retur'}
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleImport}
                            style={{ display: 'none' }}
                            disabled={importing}
                        />
                    </label>
                </div>
            </div>

            {error && (
                <div className="alert alert-error" style={{ marginBottom: '20px' }}>
                    <strong>Database Error:</strong> {error}.
                    <br /><br />
                    Pastikan tabel <code>tiktok_failed_cod</code> di Supabase sudah dibuat ulang dengan kolom:
                    <br />- <code>id</code> (UUID)
                    <br />- <code>order_id</code> (TEXT, UNIQUE)
                    <br />- <code>tracking_id</code> (TEXT)
                    <br />- <code>return_reason</code> (TEXT)
                    <br />- <code>return_time</code> (TIMESTAMP WITH TIME ZONE)
                    <br />- <code>return_status</code> (TEXT) /* DEFAULT 'Diproses' */
                    <br />- <code>created_at</code> (TIMESTAMP WITH TIME ZONE)
                </div>
            )}

            {showConfirmModal && importStats && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h2>Konfirmasi Import Data Retur</h2>
                            <button className="btn-close" onClick={cancelImport}>×</button>
                        </div>
                        <div className="modal-body">
                            <p>Berikut adalah hasil pengecekan file yang diunggah:</p>
                            <ul style={{ margin: '16px 0', paddingLeft: '24px', lineHeight: '1.6' }}>
                                <li>✅ Akan ditambahkan: <b>{importStats.berhasil}</b> data</li>
                                <li>🔄 Duplikat (diabaikan): <b>{importStats.duplikat}</b> data</li>
                            </ul>
                            <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>*Catatan: Order di Penjualan yang sesuai akan otomatis menjadi RTS jika Anda melanjutkan proses ini.</p>
                            <br />
                            {importStats.berhasil > 0 ? (
                                <p>Apakah Anda yakin ingin memproses data tersebut ke dalam sistem?</p>
                            ) : (
                                <p style={{ color: 'var(--text-danger)' }}>Tidak ada data baru yang bisa di-import.</p>
                            )}
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <button className="btn btn-secondary" onClick={cancelImport}>Batal</button>
                            {importStats.berhasil > 0 && (
                                <button className="btn btn-primary" onClick={confirmImport}>Ya, Input Data</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {importResult && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px', borderTop: importResult.success ? '4px solid var(--success)' : '4px solid var(--danger)' }}>
                        <div className="modal-header">
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {importResult.success ? '✅ Import Berhasil' : '⚠️ Import Gagal'}
                            </h2>
                            <button className="btn-close" onClick={() => setImportResult(null)}>×</button>
                        </div>
                        <div className="modal-body" style={{ padding: '20px' }}>
                            {importResult.success ? (
                                <div>
                                    <p style={{ marginBottom: '16px', fontSize: '15px' }}>Rekap data yang berhasil dikembalikan (RTS):</p>
                                    <ul style={{ margin: '0 0 16px 20px', lineHeight: '1.6' }}>
                                        <li>Berhasil ditambahkan: <b style={{ color: 'var(--success)' }}>{importResult.berhasil}</b> data</li>
                                        <li>Duplikat (diabaikan): <b style={{ color: 'var(--text-muted)' }}>{importResult.duplikat}</b> data</li>
                                    </ul>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        *Order terkait di tabel Penjualan otomatis diupdate menjadi RTS.
                                    </p>
                                </div>
                            ) : (
                                <p style={{ color: 'var(--danger)' }}>{importResult.message}</p>
                            )}
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                            <button className="btn btn-primary" onClick={() => setImportResult(null)}>Tutup</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dashboard Cards */}
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>📦</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Total Paket Retur</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{filtered.length.toLocaleString('id-ID')}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>⌛</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Diproses</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{filtered.filter(f => (f.failed_cod_record?.return_status || 'Diproses') === 'Diproses').length.toLocaleString('id-ID')}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>✅</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Diterima</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{filtered.filter(f => f.failed_cod_record?.return_status === 'Diterima').length.toLocaleString('id-ID')}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>❌</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Hilang</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{filtered.filter(f => f.failed_cod_record?.return_status === 'Hilang').length.toLocaleString('id-ID')}</h3>
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
                            placeholder="Cari order, resi, alasan..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="filter-group">
                        <select
                            className="filter-select"
                            value={tokoFilter}
                            onChange={e => setTokoFilter(e.target.value)}
                        >
                            <option value="all">Semua Toko</option>
                            {uniqueToko.map(toko => (
                                <option key={toko} value={toko}>{toko}</option>
                            ))}
                        </select>
                        <select
                            className="filter-select"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="all">Semua Status</option>
                            <option value="Diproses">Diproses</option>
                            <option value="Diterima">Diterima</option>
                            <option value="Hilang">Hilang</option>
                        </select>
                        <select
                            className="filter-select"
                            value={dateFilter}
                            onChange={e => setDateFilter(e.target.value)}
                        >
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
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>s/d</span>
                                <input type="date" className="filter-date-input" value={customTo} onChange={e => setCustomTo(e.target.value)} />
                            </div>
                        )}
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {filtered.length} data
                    </span>
                </div>

                {/* Desktop Table */}
                <div className="table-wrapper desktop-table">
                    {loading ? (
                        <div className="empty-state"><div className="spinner"></div><p>Memuat data...</p></div>
                    ) : paginatedData.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">📭</div><p>Belum ada data Failed COD</p></div>
                    ) : (
                        <table className="tiktok-table">
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>Tgl Order</th>
                                    <th>Toko / Customer</th>
                                    <th>Detail Produk</th>
                                    <th>SKU/Qty</th>
                                    <th>Status Retur</th>
                                    <th>Pengiriman</th>
                                    <th>Tgl Upload</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((item, idx) => {
                                    const failedRec = item.failed_cod_record || {}
                                    return (
                                        <tr key={item.id || idx}>
                                            <td>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                            <td>
                                                <div className="cell-date">{fmtDate(item.order_date || failedRec.return_time)}</div>
                                                <div className="cell-sub">{item.order_id}</div>
                                            </td>
                                            <td>
                                                <div className="cell-main">
                                                    {item.buyer_username || item.recipient || '-'}
                                                </div>
                                                <div className="cell-sub" style={{ color: 'var(--text-muted)' }}>
                                                    {item.warehouse_name || '-'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="cell-main">{item.product_name || '-'}</div>
                                                <div className="cell-sub">{item.variation || '-'}</div>
                                            </td>
                                            <td>
                                                <div className="cell-main" style={{ fontFamily: 'monospace' }}>{item.seller_sku || '-'}</div>
                                                <div className="cell-sub">{item.quantity ? `${item.quantity} pcs` : '-'}</div>
                                            </td>
                                            <td>
                                                <div style={{ marginBottom: '6px' }}>
                                                    <select
                                                        className="filter-select"
                                                        style={{
                                                            padding: '4px 8px',
                                                            fontSize: '12px',
                                                            borderRadius: '6px',
                                                            backgroundColor: failedRec.return_status === 'Hilang' ? 'rgba(239, 68, 68, 0.1)' :
                                                                failedRec.return_status === 'Diterima' ? 'rgba(34, 197, 94, 0.1)' :
                                                                    'rgba(59, 130, 246, 0.1)',
                                                            color: failedRec.return_status === 'Hilang' ? '#ef4444' :
                                                                failedRec.return_status === 'Diterima' ? '#22c55e' :
                                                                    '#3b82f6',
                                                            border: 'none',
                                                            outline: 'none',
                                                            cursor: 'pointer'
                                                        }}
                                                        value={failedRec.return_status || 'Diproses'}
                                                        onChange={(e) => handleStatusChange(item.order_id, e.target.value)}
                                                        disabled={failedRec.is_validated}
                                                    >
                                                        <option value="Diproses">Diproses</option>
                                                        <option value="Diterima">Diterima</option>
                                                        <option value="Hilang">Hilang</option>
                                                    </select>
                                                </div>
                                                {failedRec.is_validated ? (
                                                    <div style={{ marginTop: '8px' }}><span style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontWeight: 500, display: 'inline-block' }}>Tervalidasi</span></div>
                                                ) : (failedRec.return_status === 'Diterima' || failedRec.return_status === 'Hilang') ? (
                                                    <div style={{ marginTop: '8px' }}>
                                                        <button
                                                            className="btn"
                                                            style={{
                                                                backgroundColor: '#3b82f6',
                                                                color: 'white',
                                                                padding: '4px 8px',
                                                                fontSize: '11px',
                                                                borderRadius: '4px',
                                                                border: 'none',
                                                                cursor: 'pointer'
                                                            }}
                                                            onClick={() => handleValidate(item.order_id)}
                                                        >
                                                            Validasi ✓
                                                        </button>
                                                    </div>
                                                ) : null}
                                                <div className="cell-sub" style={{ color: 'var(--text-danger)', marginTop: '6px' }}>
                                                    {failedRec.return_reason}
                                                </div>
                                                {failedRec.return_time && (
                                                    <div className="cell-sub">
                                                        Retur: {fmtDate(failedRec.return_time)}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div className="cell-main" style={{ fontSize: '12px', fontFamily: 'monospace' }}>{item.tracking_id || failedRec.tracking_id || '-'}</div>
                                                <div className="cell-sub">
                                                    {item.shipping_provider || '-'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="cell-date">{fmtDate(failedRec.created_at || item.created_at)}</div>
                                                <div className="cell-sub">{(failedRec.created_at || item.created_at) ? new Date(failedRec.created_at || item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
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
                                const failedRec = item.failed_cod_record || {}
                                return (
                                    <div key={item.id || idx} className="data-card">
                                        <div className="data-card-header">
                                            <span className="data-card-number">#{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</span>
                                            {getStatusBadge(item.order_status || 'RTS')}
                                        </div>
                                        <div className="data-card-body">
                                            <div className="data-card-row">
                                                <span className="data-card-label">Tgl Order</span>
                                                <span className="data-card-value">{fmtDate(item.order_date || failedRec.return_time)}</span>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Order ID</span>
                                                <span className="data-card-value" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{item.order_id || '-'}</span>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Customer</span>
                                                <span className="data-card-value">{item.recipient || item.buyer_username || '-'}</span>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Produk</span>
                                                <span className="data-card-value">{item.product_name || '-'}</span>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Variasi / Qty</span>
                                                <span className="data-card-value">{item.variation || '-'} · {item.quantity || 0} pcs</span>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Status Retur</span>
                                                <select
                                                    className="filter-select"
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '12px',
                                                        borderRadius: '6px',
                                                        backgroundColor: failedRec.return_status === 'Hilang' ? 'rgba(239, 68, 68, 0.1)' :
                                                            failedRec.return_status === 'Diterima' ? 'rgba(34, 197, 94, 0.1)' :
                                                                'rgba(59, 130, 246, 0.1)',
                                                        color: failedRec.return_status === 'Hilang' ? '#ef4444' :
                                                            failedRec.return_status === 'Diterima' ? '#22c55e' :
                                                                '#3b82f6',
                                                        border: 'none',
                                                        outline: 'none',
                                                        cursor: 'pointer'
                                                    }}
                                                    value={failedRec.return_status || 'Diproses'}
                                                    onChange={(e) => handleStatusChange(item.order_id, e.target.value)}
                                                >
                                                    <option value="Diproses">Diproses</option>
                                                    <option value="Diterima">Diterima</option>
                                                    <option value="Hilang">Hilang</option>
                                                </select>
                                                {failedRec.is_validated && (
                                                    <div style={{ marginTop: '8px' }}><span style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontWeight: 500, display: 'inline-block' }}>Tervalidasi</span></div>
                                                )}
                                            </div>
                                            {(!failedRec.is_validated && (failedRec.return_status === 'Diterima' || failedRec.return_status === 'Hilang')) && (
                                                <div className="data-card-row">
                                                    <span className="data-card-label">Aksi</span>
                                                    <button
                                                        className="btn"
                                                        style={{
                                                            backgroundColor: '#3b82f6',
                                                            color: 'white',
                                                            padding: '6px 12px',
                                                            fontSize: '12px',
                                                            borderRadius: '4px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            width: '100%'
                                                        }}
                                                        onClick={() => handleValidate(item.order_id)}
                                                    >
                                                        Validasi Mutasi ✓
                                                    </button>
                                                </div>
                                            )}
                                            {failedRec.return_time && (
                                                <div className="data-card-row">
                                                    <span className="data-card-label">Tgl Retur</span>
                                                    <span className="data-card-value">{fmtDate(failedRec.return_time)}</span>
                                                </div>
                                            )}
                                            <div className="data-card-row">
                                                <span className="data-card-label">Pengiriman</span>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-primary)' }}>{item.tracking_id || failedRec.tracking_id || '-'}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.shipping_provider || '-'}</div>
                                                </div>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Alasan Retur</span>
                                                <span className="data-card-value" style={{ color: 'var(--text-danger)', fontSize: '12px' }}>{failedRec.return_reason}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                        <button
                            className="btn btn-secondary"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                            Sebelumnya
                        </button>
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                            Halaman {currentPage} dari {totalPages}
                        </span>
                        <button
                            className="btn btn-secondary"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                            Berikutnya
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
