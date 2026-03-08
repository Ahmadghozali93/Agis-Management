import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { parseCSV, parseXLSX, mapTiktokRow } from '../../lib/csvParser'

const STATUS_MAP = {
    'Completed': { label: 'Selesai', cls: 'badge-success', icon: '✅', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
    'Selesai': { label: 'Selesai', cls: 'badge-success', icon: '✅', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
    'Selesai Otomatis': { label: 'Selesai Auto', cls: 'badge-success', icon: '✅', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
    'done': { label: 'Selesai Auto', cls: 'badge-success', icon: '✅', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
    'Shipped': { label: 'Dikirim', cls: 'badge-info', icon: '🚚', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    'Dikirim': { label: 'Dikirim', cls: 'badge-info', icon: '🚚', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    'Unpaid': { label: 'Belum Bayar', cls: 'badge-warning', icon: '⏳', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    'Belum Bayar': { label: 'Belum Bayar', cls: 'badge-warning', icon: '⏳', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    'In Transit': { label: 'Transit', cls: 'badge-info', icon: '🚚', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    'Delivered': { label: 'Terkirim', cls: 'badge-success', icon: '📍', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    'Terkirim': { label: 'Terkirim', cls: 'badge-success', icon: '📍', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    'Cancelled': { label: 'Dibatalkan', cls: 'badge-danger', icon: '❌', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    'Dibatalkan': { label: 'Dibatalkan', cls: 'badge-danger', icon: '❌', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    'To ship': { label: 'Siap Kirim', cls: 'badge-warning', icon: '📦', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    'Menunggu Pengepakan': { label: 'Siap Kirim', cls: 'badge-warning', icon: '📦', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    'RTS': { label: 'RTS', cls: 'badge-danger', icon: '❌', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    'Return': { label: 'Return', cls: 'badge-warning', icon: '🔄', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
    'Retur': { label: 'Return', cls: 'badge-warning', icon: '🔄', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' }
}

function getStatusBadge(status) {
    const mapped = STATUS_MAP[status] || { label: status || '-', cls: 'badge-info' }
    return <span className={`badge ${mapped.cls}`}>{mapped.label}</span>
}

function fmt(val) {
    return 'Rp ' + (val || 0).toLocaleString('id-ID')
}

function fmtDate(val) {
    if (!val) return '-'
    const date = new Date(val)
    if (isNaN(date.getTime())) return '-'
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const yyyy = date.getFullYear()
    return `${dd}/${mm}/${yyyy}`
}

export default function PenjualanTiktokPage() {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [dateFilter, setDateFilter] = useState('all')
    const [customFrom, setCustomFrom] = useState('')
    const [customTo, setCustomTo] = useState('')
    const [selectedMonth, setSelectedMonth] = useState('')

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 20

    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState(null)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [importStats, setImportStats] = useState(null)
    const [pendingImportData, setPendingImportData] = useState([])
    const [error, setError] = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')
    const [tokoFilter, setTokoFilter] = useState('all')
    const fileRef = useRef(null)

    const getDateRange = useCallback(() => {
        const now = new Date()
        let from = null

        if (dateFilter === '7') {
            from = new Date(now)
            from.setDate(from.getDate() - 7)
        } else if (dateFilter === '30') {
            from = new Date(now)
            from.setDate(from.getDate() - 30)
        } else if (dateFilter === 'month') {
            from = new Date(now.getFullYear(), now.getMonth(), 1)
        } else if (dateFilter === 'year') {
            from = new Date(now.getFullYear(), 0, 1)
        } else if (dateFilter === 'custom') {
            return {
                from: customFrom ? new Date(customFrom).toISOString() : null,
                to: customTo ? new Date(customTo + 'T23:59:59').toISOString() : null
            }
        } else if (dateFilter === 'select_month' && selectedMonth) {
            const [y, m] = selectedMonth.split('-')
            const fromDate = new Date(y, m - 1, 1)
            const toDate = new Date(y, m, 0, 23, 59, 59)
            return {
                from: fromDate.toISOString(),
                to: toDate.toISOString()
            }
        } else if (dateFilter === 'all') {
            return { from: null, to: null }
        }

        return {
            from: from ? from.toISOString() : null,
            to: now.toISOString()
        }
    }, [dateFilter, customFrom, customTo, selectedMonth])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            let query = supabase.from('tiktok_sales').select('*').order('order_date', { ascending: false })

            const { from, to } = getDateRange()
            if (from) query = query.gte('order_date', from)
            if (to) query = query.lte('order_date', to)

            const { data: salesData, error: queryError } = await query
            if (queryError) throw queryError
            if (!queryError && salesData) {
                setData(salesData)
                setCurrentPage(1) // Reset to first page when data changes
            }
        } catch (error) {
            console.error('Load error:', error)
        } finally {
            setLoading(false)
        }
    }, [getDateRange])

    useEffect(() => { loadData() }, [loadData])

    // Get unique toko/warehouse for filter dropdown (from raw data)
    const uniqueToko = [...new Set(data.map(d => d.warehouse_name).filter(Boolean))].sort()

    // Search & Status filter
    const filtered = data.filter(item => {
        // Toko Filter
        if (tokoFilter !== 'all') {
            if ((item.warehouse_name || '') !== tokoFilter) return false
        }

        // Status Check First
        if (statusFilter !== 'all') {
            const currentStatus = (item.order_status || '').toLowerCase()
            const filterVal = statusFilter.toLowerCase()

            if (filterVal === 'shipped') {
                if (currentStatus !== 'shipped' && currentStatus !== 'dikirim') return false
            } else if (filterVal === 'done') {
                if (currentStatus !== 'done' && currentStatus !== 'completed' && currentStatus !== 'selesai' && currentStatus !== 'selesai otomatis') return false
            } else {
                if (currentStatus !== filterVal) return false
            }
        }

        // Search Check
        if (!search) return true
        const q = search.toLowerCase()
        return (
            (item.order_id || '').toLowerCase().includes(q) ||
            (item.product_name || '').toLowerCase().includes(q) ||
            (item.buyer_username || '').toLowerCase().includes(q) ||
            (item.recipient || '').toLowerCase().includes(q) ||
            (item.seller_sku || '').toLowerCase().includes(q) ||
            (item.tracking_id || '').toLowerCase().includes(q)
        )
    })

    // Dashboard stats
    const totalOrders = filtered.length
    const totalQty = filtered.reduce((sum, d) => sum + (d.quantity || 0), 0)

    // Row 1
    const gmvTiktok = filtered.reduce((sum, d) => sum + (d.order_amount || 0), 0)
    const omsetKotor = filtered.reduce((sum, d) => sum + (d.sku_subtotal_before_discount || 0), 0)
    const estimasiPencairan = Math.round(omsetKotor * 0.85)
    const aov = totalOrders > 0 ? Math.round(gmvTiktok / totalOrders) : 0

    // Row 2
    const isCompleted = os => ['completed', 'delivered', 'done', 'selesai', 'selesai otomatis'].includes((os || '').toLowerCase())
    const isFailedCod = os => {
        const lower = (os || '').toLowerCase()
        return lower === 'rts' || lower === 'failed cod' || lower.includes('gagal') || lower === 'delivery failed'
    }
    const isReturn = os => {
        const lower = (os || '').toLowerCase()
        return lower === 'return' || lower === 'retur' || lower === 'returned'
    }
    const isBatal = os => {
        const lower = (os || '').toLowerCase()
        return lower === 'batal' || lower === 'cancelled' || lower === 'canceled' || lower === 'unpaid' || lower === 'belum dibayar' || lower === 'awaiting payment'
    }
    const isProses = os => !isCompleted(os) && !isFailedCod(os) && !isReturn(os) && !isBatal(os)

    // Group 2
    const pendapatanProses = filtered.filter(d => isProses(d.order_status)).reduce((sum, d) => sum + (d.order_amount || 0), 0)
    const nominalFailedCod = filtered.filter(d => isFailedCod(d.order_status)).reduce((sum, d) => sum + (d.order_amount || 0), 0)
    const nominalReturn = filtered.filter(d => isReturn(d.order_status)).reduce((sum, d) => sum + (d.order_amount || 0), 0)
    const pendapatanSelesai = filtered.filter(d => isCompleted(d.order_status)).reduce((sum, d) => sum + (d.order_amount || 0), 0)

    // Import handler
    async function handleImport(e) {
        const file = e.target.files[0]
        if (!file) return
        setImporting(true)
        setImportResult(null)

        try {
            console.log("Reading file:", file.name)
            let rows = []

            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                const buffer = await file.arrayBuffer()
                rows = parseXLSX(buffer)
                console.log("Parsed XLSX rows count:", rows.length)
            } else {
                const text = await file.text()
                rows = parseCSV(text)
                console.log("Parsed CSV rows count:", rows.length)
            }

            if (rows.length === 0) throw new Error('File kosong atau format tidak sesuai')

            if (rows.length > 0) {
                console.log("First row keys:", Object.keys(rows[0]))
                if (!('Order ID' in rows[0])) {
                    throw new Error('Kolom "Order ID" tidak ditemukan di header file. Pastikan ini file export dari TikTok Shop.')
                }
            }

            // Fetch product SKU map from DB
            const { data: products } = await supabase.from('products').select('sku, name')
            const productMap = {}
                ; (products || []).forEach(p => {
                    if (p.sku) productMap[p.sku] = p.name
                })

            const mapped = rows.map(row => mapTiktokRow(row, productMap))
            console.log("Mapped rows count:", mapped.length)

            // Deduplicate by order_id + seller_sku (keep last occurrence)
            const uniqueMap = new Map()
            mapped.forEach(item => {
                if (!item.order_id) return // skip empty order ids
                const key = `${item.order_id}__${item.seller_sku}`
                uniqueMap.set(key, item)
            })
            const uniqueData = Array.from(uniqueMap.values())
            console.log("Unique data count:", uniqueData.length)

            if (uniqueData.length === 0) throw new Error('Tidak ada data valid untuk di-import')

            // === SKU Validation Check ===
            const validData = []
            let countGagal = 0
            const missingSkus = new Set()

            uniqueData.forEach(item => {
                if (item.seller_sku && !productMap[item.seller_sku]) {
                    countGagal++
                    missingSkus.add(item.seller_sku)
                } else {
                    validData.push(item)
                }
            })
            // === End SKU Validation Check ===

            // === Duplicate Validation Check ===
            const orderIdsToCheck = validData.map(item => item.order_id)

            // Check in chunks of 100 since URLs can get long if there are many orders
            let existingRecords = []
            for (let i = 0; i < orderIdsToCheck.length; i += 100) {
                const chunk = orderIdsToCheck.slice(i, i + 100)
                const { data: existing, error: checkError } = await supabase
                    .from('tiktok_sales')
                    .select('order_id, seller_sku')
                    .in('order_id', chunk)

                if (checkError) {
                    console.error("Error validation checking:", checkError)
                    throw new Error("Gagal memvalidasi data duplikat.")
                }
                if (existing) {
                    existingRecords = [...existingRecords, ...existing]
                }
            }

            // Create a set of existing keys for fast lookup
            const existingKeys = new Set(existingRecords.map(record => `${record.order_id}__${record.seller_sku}`))

            const toInsert = []
            let countDuplikat = 0

            validData.forEach(item => {
                if (existingKeys.has(`${item.order_id}__${item.seller_sku}`)) {
                    countDuplikat++
                } else {
                    toInsert.push(item)
                }
            })
            // === End Duplicate Validation ===

            // Instead of upserting right away, show confirmation modal
            setImportStats({
                berhasil: toInsert.length,
                gagal: countGagal,
                duplikat: countDuplikat,
                missingSkus: Array.from(missingSkus)
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
            // Upsert in batches
            let inserted = 0
            const batchSize = 50
            for (let i = 0; i < pendingImportData.length; i += batchSize) {
                const batch = pendingImportData.slice(i, i + batchSize)
                const { error } = await supabase
                    .from('tiktok_sales')
                    .upsert(batch, { onConflict: 'order_id,seller_sku', ignoreDuplicates: false })
                if (error) {
                    console.error("Upsert error:", error)
                    throw error
                }
                inserted += batch.length
                console.log(`Upserted batch ${i / batchSize + 1}, total inserted so far: ${inserted}`)
            }

            setImportResult({
                success: true,
                berhasil: inserted,
                gagal: importStats.gagal,
                duplikat: importStats.duplikat,
                missingSkus: importStats.missingSkus
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

    // Compute unique statuses and their counts based on the CURRENT filtered data (respecting date/search/toko, ignoring status filter)
    const baseFilteredForStats = data.filter(item => {
        // Toko Filter
        if (tokoFilter !== 'all') {
            if ((item.warehouse_name || '') !== tokoFilter) return false
        }

        // Search Check
        if (search) {
            const q = search.toLowerCase()
            const matchesSearch = (item.order_id || '').toLowerCase().includes(q) ||
                (item.product_name || '').toLowerCase().includes(q) ||
                (item.buyer_username || '').toLowerCase().includes(q) ||
                (item.recipient || '').toLowerCase().includes(q) ||
                (item.seller_sku || '').toLowerCase().includes(q) ||
                (item.tracking_id || '').toLowerCase().includes(q)
            if (!matchesSearch) return false
        }
        return true
    })

    const statusCounts = {}
    baseFilteredForStats.forEach(item => {
        const status = item.order_status || 'Unknown'
        statusCounts[status] = (statusCounts[status] || 0) + 1
    })

    // Get array of unique statuses
    const uniqueStatuses = Object.keys(statusCounts).sort()

    // Pagination logic
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
    const paginatedData = filtered.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    )

    // Reset pagination if filter changes reduce total pages
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1)
        }
    }, [filtered.length, totalPages, currentPage])

    return (
        <div>
            <div className="page-header">
                <h1>🎵 Penjualan TikTok</h1>
                <div className="page-header-actions">
                    <label className={`btn btn-primary ${importing ? 'btn-disabled' : ''}`} style={{ cursor: importing ? 'wait' : 'pointer' }}>
                        {importing ? '⏳ Importing...' : '📥 Import File'}
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

            {showConfirmModal && importStats && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h2>📋 Konfirmasi Import Data</h2>
                            <button className="modal-close" onClick={cancelImport}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Hasil pengecekan file yang diunggah:</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '10px 14px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 500 }}>✅ Data Baru</span>
                                    <span style={{ fontWeight: 700, fontSize: '20px', color: '#10b981' }}>{importStats.berhasil}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(107, 114, 128, 0.08)', border: '1px solid rgba(107, 114, 128, 0.2)', borderRadius: '8px', padding: '10px 14px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 500 }}>🔄 Duplikat (Dilewati)</span>
                                    <span style={{ fontWeight: 700, fontSize: '20px', color: 'var(--text-muted)' }}>{importStats.duplikat}</span>
                                </div>
                                {importStats.gagal > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '10px 14px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 500 }}>⚠️ Gagal (SKU Tidak Dikenal)</span>
                                        <span style={{ fontWeight: 700, fontSize: '20px', color: '#ef4444' }}>{importStats.gagal}</span>
                                    </div>
                                )}
                            </div>
                            {importStats.missingSkus && importStats.missingSkus.length > 0 && (
                                <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', marginBottom: '12px' }}>
                                    <p style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 600, color: '#ef4444' }}>SKU belum terdaftar di Master Produk:</p>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{importStats.missingSkus.join(', ')}</p>
                                </div>
                            )}
                            {importStats.berhasil === 0 && (
                                <div className="alert alert-error">⚠️ Tidak ada data baru yang bisa di-import.</div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={cancelImport}>Batal</button>
                            {importStats.berhasil > 0 && (
                                <button className="btn btn-primary" onClick={confirmImport}>✅ Ya, Import Sekarang</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {importResult && (
                <div className={`alert ${importResult.success ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '20px' }}>
                    {importResult.success ? (
                        <div>
                            <strong>✅ Import Selesai:</strong>
                            <ul style={{ margin: '8px 0 0 20px' }}>
                                <li>Berhasil: <b>{importResult.berhasil}</b> data</li>
                                <li>Duplikat: <b>{importResult.duplikat}</b> data</li>
                                {importResult.gagal > 0 && (
                                    <li>Gagal (SKU Tidak Dikenal): <b>{importResult.gagal}</b> data</li>
                                )}
                            </ul>
                        </div>
                    ) : (
                        `⚠️ Gagal import: ${importResult.message}`
                    )}
                </div>
            )}

            {/* Dashboard Cards Row 1 */}
            <div className="stats-grid" style={{ marginBottom: '16px' }}>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>🛒</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>GMV TiktokShop</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(gmvTiktok)}</h3>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>💰</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0', whiteSpace: 'nowrap' }}>Omset Kotor (Total HJ)</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(omsetKotor)}</h3>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>💸</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Estimasi Pencairan</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(estimasiPencairan)}</h3>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>📈</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>AOV</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(aov)}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dashboard Cards Row 2 */}
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>⏳</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0', whiteSpace: 'nowrap' }}>Pendapatan Dalam Proses</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(pendapatanProses)}</h3>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>❌</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Nominal RTS</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(nominalFailedCod)}</h3>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#f97316' }}>🔄</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Nominal Return</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(nominalReturn)}</h3>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>✅</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Pendapatan Selesai</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(pendapatanSelesai)}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dashboard Cards Row 3 */}
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#f97316' }}>📋</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Total Pesanan</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{totalOrders.toLocaleString('id-ID')}</h3>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>📦</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Total Produk Terjual</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{totalQty.toLocaleString('id-ID')}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dashboard Cards by Status */}
            <div className="stats-grid status-cards-grid" style={{ marginBottom: '24px' }}>
                {uniqueStatuses.map(status => {
                    const mapped = STATUS_MAP[status] || {
                        label: status,
                        icon: '📌',
                        color: '#6b7280',
                        bg: 'rgba(107, 114, 128, 0.1)'
                    }

                    return (
                        <div key={status} className="stat-card" style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="stat-card-icon" style={{ background: mapped.bg, color: mapped.color }}>{mapped.icon}</div>
                                <div>
                                    <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Status: {mapped.label}</p>
                                    <h3 className="stat-card-value" style={{ margin: 0 }}>{statusCounts[status].toLocaleString('id-ID')}</h3>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Filters */}
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-search">
                        🔍
                        <input
                            type="text"
                            placeholder="Cari order, produk, customer, resi..."
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
                            {uniqueStatuses.map(status => {
                                const mapped = STATUS_MAP[status] || { label: status }
                                return (
                                    <option key={status} value={status}>
                                        {mapped.label} ({statusCounts[status]})
                                    </option>
                                )
                            })}
                        </select>
                        <select
                            className="filter-select"
                            value={dateFilter}
                            onChange={e => setDateFilter(e.target.value)}
                        >
                            <option value="7">7 Hari</option>
                            <option value="30">30 Hari</option>
                            <option value="month">Bulan Ini</option>
                            <option value="select_month">Pilih Bulan</option>
                            <option value="year">Tahun Ini</option>
                            <option value="custom">Custom</option>
                            <option value="all">Semua Tgl</option>
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
                        <div className="empty-state"><div className="empty-state-icon">📭</div><p>Belum ada data penjualan</p></div>
                    ) : (
                        <table className="tiktok-table">
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>Tgl Order</th>
                                    <th>Toko / Customer</th>
                                    <th>Detail Produk</th>
                                    <th>SKU/Qty</th>
                                    <th>Keuangan</th>
                                    <th>Status</th>
                                    <th>Pengiriman</th>
                                    <th>Diupload</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((item, idx) => (
                                    <tr key={item.id || idx}>
                                        <td>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                        <td>
                                            <div className="cell-date">{fmtDate(item.order_date)}</div>
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
                                            <div className="cell-sub">{item.quantity || 0} pcs</div>
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <div className="cell-currency">{fmt(item.order_amount)}</div>
                                            <div className="cell-sub" style={{ color: 'var(--text-muted)' }}>HJ: {fmt(item.sku_subtotal_before_discount)}</div>
                                        </td>
                                        <td>{getStatusBadge(item.order_status)}</td>
                                        <td>
                                            <div className="cell-main" style={{ fontSize: '12px', fontFamily: 'monospace' }}>{item.tracking_id || '-'}</div>
                                            <div className="cell-sub">
                                                {item.shipping_provider || '-'}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="cell-date">{fmtDate(item.created_at)}</div>
                                            <div className="cell-sub">{item.created_at ? new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
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
                                        {getStatusBadge(item.order_status)}
                                    </div>
                                    <div className="data-card-body">
                                        <div className="data-card-row">
                                            <span className="data-card-label">Tgl Order</span>
                                            <span className="data-card-value">{fmtDate(item.order_date)}</span>
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
                                            <span className="data-card-label">Gudang</span>
                                            <span className="data-card-value">{item.warehouse_name || '-'}</span>
                                        </div>
                                        <div className="data-card-row">
                                            <span className="data-card-label">Total</span>
                                            <span className="data-card-value cell-currency">{fmt(item.order_amount)}</span>
                                        </div>
                                        <div className="data-card-row">
                                            <span className="data-card-label">Pengiriman</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-primary)' }}>{item.tracking_id || '-'}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.shipping_provider || '-'}</div>
                                            </div>
                                        </div>
                                        <div className="data-card-row">
                                            <span className="data-card-label">Waktu Upload</span>
                                            <span className="data-card-value" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {fmtDate(item.created_at)} {item.created_at ? new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
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
