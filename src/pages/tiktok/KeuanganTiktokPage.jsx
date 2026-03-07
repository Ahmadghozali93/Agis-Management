import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { parseCSV, parseXLSX, mapTiktokFinanceRow } from '../../lib/csvParser'

export default function KeuanganTiktokPage() {
    const [data, setData] = useState([])
    const [filtered, setFiltered] = useState([])
    const [loading, setLoading] = useState(true)
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState(null)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [dateFilter, setDateFilter] = useState('all') // 7days, 30days, month, year, custom, all
    const [customRange, setCustomRange] = useState({ start: '', end: '' })
    const [selectedMonth, setSelectedMonth] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [tokoFilter, setTokoFilter] = useState('all')

    // Store Selection Modal State
    const [storeOptions, setStoreOptions] = useState([])
    const [showStoreModal, setShowStoreModal] = useState(false)
    const [pendingFile, setPendingFile] = useState(null)
    const [selectedStore, setSelectedStore] = useState('')

    // Matched orders from tiktok_sales cache to avoid N+1 queries during render
    const [matchedOrders, setMatchedOrders] = useState(new Set())

    // Withdraw Modal State
    const [showWithdrawModal, setShowWithdrawModal] = useState(false)
    const [withdrawStore, setWithdrawStore] = useState('')
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [withdrawTargetBank, setWithdrawTargetBank] = useState('')
    const [withdrawDate, setWithdrawDate] = useState(new Date().toISOString().substring(0, 10))
    const [withdrawing, setWithdrawing] = useState(false)
    const [withdrawalsTableExists, setWithdrawalsTableExists] = useState(true)
    const [accumulatedWithdrawals, setAccumulatedWithdrawals] = useState({}) // { storeName: totalWithdrawnAmount }
    const [bankAccounts, setBankAccounts] = useState([])

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 20

    const fileInputRef = useRef(null)

    useEffect(() => {
        fetchData()
    }, [])

    useEffect(() => {
        applyFilters()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, searchTerm, dateFilter, customRange, matchedOrders, tokoFilter, selectedMonth])

    const fetchData = async () => {
        setLoading(true)
        setError(null)
        try {
            // 1. Fetch finance data
            const { data: financeData, error: financeError } = await supabase
                .from('tiktok_finance')
                .select('*')
                .order('settlement_date', { ascending: false })

            if (financeError) throw financeError

            setData(financeData || [])

            // 2. Cross-reference with sales data to determine Match/Unmatch
            if (financeData && financeData.length > 0) {
                const orderIds = financeData.map(f => f.order_id).filter(Boolean)
                // Deduplicate order_ids for query
                const uniqueOrderIds = [...new Set(orderIds)]

                // Fetch existing orders in sales table
                const { data: salesData, error: salesError } = await supabase
                    .from('tiktok_sales')
                    .select('order_id')
                    .in('order_id', uniqueOrderIds)

                if (!salesError && salesData) {
                    const matched = new Set(salesData.map(s => s.order_id))
                    setMatchedOrders(matched)
                }
            }

            // Fetch accumulated withdrawals to calculate remaining balance
            const { data: withdrawalsData, error: withdrawalsError } = await supabase
                .from('tiktok_withdrawals')
                .select('store, amount')

            if (withdrawalsError) {
                if (withdrawalsError.code === '42P01') {
                    // Sequence/Table does not exist error
                    setWithdrawalsTableExists(false)
                } else {
                    console.error("Fetch withdrawals error:", withdrawalsError)
                }
            } else if (withdrawalsData) {
                const acc = {}
                withdrawalsData.forEach(w => {
                    const storeName = w.store || 'Unknown'
                    acc[storeName] = (acc[storeName] || 0) + Number(w.amount || 0)
                })
                setAccumulatedWithdrawals(acc)
                setWithdrawalsTableExists(true)
            }

            // 3. Fetch unique stores for dropdown
            const { data: storesData } = await supabase
                .from('tiktok_sales')
                .select('warehouse_name')
            if (storesData) {
                const uniqueStores = [...new Set(storesData.map(s => s.warehouse_name).filter(Boolean))]
                setStoreOptions(uniqueStores)
                if (uniqueStores.length > 0) setSelectedStore(uniqueStores[0])
            }

            // 4. Fetch Bank Accounts for Withdraw
            const { data: banksData } = await supabase
                .from('bank_accounts')
                .select('*')
                .order('created_at', { ascending: true })
            if (banksData) {
                setBankAccounts(banksData)
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    const handleImport = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setPendingFile(file)
        setShowStoreModal(true)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const processImport = async () => {
        if (!pendingFile || !selectedStore) return
        setShowStoreModal(false)
        setImporting(true)
        setImportResult(null)
        setError(null)

        try {
            console.log("Reading file:", pendingFile.name)
            let rows = []

            if (pendingFile.name.endsWith('.xlsx') || pendingFile.name.endsWith('.xls')) {
                const buffer = await pendingFile.arrayBuffer()
                rows = parseXLSX(buffer)
            } else {
                const text = await pendingFile.text()
                rows = parseCSV(text)
            }

            if (rows.length === 0) throw new Error('File kosong atau format tidak sesuai')

            // For Keuangan, TikTok uses 'Order/adjustment ID' instead of 'Order ID'
            if (rows.length > 0) {
                const firstRowKeys = Object.keys(rows[0]).map(k => k.toLowerCase())
                if (!firstRowKeys.includes('order/adjustment id') && !firstRowKeys.includes('order id')) {
                    throw new Error('Kolom "Order/adjustment ID" tidak ditemukan di header file.')
                }
                // (Store column validation removed)
            }

            const mapped = rows.map(r => {
                const parsed = mapTiktokFinanceRow(r)
                parsed.store = selectedStore // override
                return parsed
            })

            // Keep only those with an order ID
            const uniqueMap = new Map()
            mapped.forEach(item => {
                if (!item.order_id) return
                uniqueMap.set(item.order_id, item) // For finance, order_id is usually unique per settlement row
            })
            const uniqueData = Array.from(uniqueMap.values())

            if (uniqueData.length === 0) throw new Error('Tidak ada data settlement yang valid untuk di-import')

            // === Duplicate Check ===
            const orderIdsToCheck = uniqueData.map(item => item.order_id)
            let existingRecords = []

            for (let i = 0; i < orderIdsToCheck.length; i += 100) {
                const chunk = orderIdsToCheck.slice(i, i + 100)
                const { data: existing, error: checkError } = await supabase
                    .from('tiktok_finance')
                    .select('order_id')
                    .in('order_id', chunk)

                if (checkError) {
                    throw new Error("Gagal memvalidasi data duplikat.")
                }
                if (existing) existingRecords = [...existingRecords, ...existing]
            }

            const existingKeys = new Set(existingRecords.map(record => record.order_id))
            const firstDuplicate = uniqueData.find(item => existingKeys.has(item.order_id))

            if (firstDuplicate) {
                throw new Error(`Data ditolak! Ada data ganda yang sudah masuk sebelumnya (Order ID: ${firstDuplicate.order_id}).`)
            }

            // Insert in batches
            let inserted = 0
            const batchSize = 50
            for (let i = 0; i < uniqueData.length; i += batchSize) {
                const batch = uniqueData.slice(i, i + batchSize)
                const { error } = await supabase
                    .from('tiktok_finance')
                    .upsert(batch, { onConflict: 'order_id', ignoreDuplicates: false })
                if (error) throw error
                inserted += batch.length
            }

            // === Match & Update Sales Status to Selesai ===
            // Identify which of these newly imported orderIds actually exist in tiktok_sales
            let matchedToUpdate = []
            for (let i = 0; i < orderIdsToCheck.length; i += 100) {
                const chunk = orderIdsToCheck.slice(i, i + 100)
                const { data: matchedSales } = await supabase
                    .from('tiktok_sales')
                    .select('order_id')
                    .in('order_id', chunk)

                if (matchedSales) {
                    matchedToUpdate = [...matchedToUpdate, ...matchedSales.map(s => s.order_id)]
                }
            }

            // Update status in tiktok_sales to 'done' for matched orders
            if (matchedToUpdate.length > 0) {
                for (let i = 0; i < matchedToUpdate.length; i += 100) {
                    const chunk = matchedToUpdate.slice(i, i + 100)
                    await supabase
                        .from('tiktok_sales')
                        .update({ order_status: 'done' })
                        .in('order_id', chunk)
                }
            }

            setImportResult({ success: true, count: uniqueData.length })
            fetchData()
        } catch (error) {
            console.error('Import error:', error)
            setError(error.message)
            setImportResult({ error: error.message })
        } finally {
            setImporting(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const [syncing, setSyncing] = useState(false)

    const handleSyncUnmatched = async () => {
        setSyncing(true)
        setError(null)
        setImportResult(null)

        try {
            // Find all order IDs that are currently unmatched
            const unmatchedOrderIds = data.map(item => item.order_id).filter(id => !matchedOrders.has(id))

            if (unmatchedOrderIds.length === 0) {
                setImportResult({ success: true, count: 0, message: 'Semua data Keuangan sudah Match dengan Penjualan.' })
                return
            }

            let newlyMatched = []

            // Check against tiktok_sales
            for (let i = 0; i < unmatchedOrderIds.length; i += 100) {
                const chunk = unmatchedOrderIds.slice(i, i + 100)
                const { data: matchedSales, error: checkError } = await supabase
                    .from('tiktok_sales')
                    .select('order_id')
                    .in('order_id', chunk)

                if (checkError) throw checkError
                if (matchedSales) {
                    newlyMatched = [...newlyMatched, ...matchedSales.map(s => s.order_id)]
                }
            }

            // Update matched ones to 'done'
            if (newlyMatched.length > 0) {
                for (let i = 0; i < newlyMatched.length; i += 100) {
                    const chunk = newlyMatched.slice(i, i + 100)
                    const { error: updateError } = await supabase
                        .from('tiktok_sales')
                        .update({ order_status: 'done' })
                        .in('order_id', chunk)

                    if (updateError) throw updateError
                }
                setImportResult({ success: true, count: newlyMatched.length, message: `Berhasil mensinkronkan ${newlyMatched.length} pesanan baru.` })
                fetchData() // Refresh view
            } else {
                setImportResult({ success: true, count: 0, message: 'Tidak ada data match baru yang ditemukan.' })
            }

        } catch (err) {
            console.error('Sync error:', err)
            setError('Gagal sinkronisasi data: ' + err.message)
        } finally {
            setSyncing(false)
        }
    }

    // --- Withdraw Logic ---
    const handleOpenWithdraw = () => {
        setWithdrawStore(tokoFilter === 'all' ? storeOptions[0] || '' : tokoFilter)
        setShowWithdrawModal(true)
    }

    const getMaxWithdrawable = (storeName) => {
        if (!storeName) return 0
        const storeMatchedOrders = filtered.filter(item => matchedOrders.has(item.order_id) && (item.store || '') === storeName)
        const totalSettlement = storeMatchedOrders.reduce((sum, item) => sum + (Number(item.pencairan) || 0), 0)
        const withdrawnAlready = accumulatedWithdrawals[storeName] || 0
        return Math.max(0, totalSettlement - withdrawnAlready)
    }

    // Auto-update amount when store changes in modal
    useEffect(() => {
        if (showWithdrawModal) {
            setWithdrawAmount(getMaxWithdrawable(withdrawStore))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [withdrawStore, showWithdrawModal])

    const handleWithdrawSubmit = async (e) => {
        e.preventDefault()
        if (!withdrawalsTableExists) {
            setError("Tabel pencairan belum tersedia. Harap buat tabel `tiktok_withdrawals` di Supabase.")
            return
        }
        setWithdrawing(true)
        setError(null)
        try {
            const amountNum = Number(withdrawAmount)
            if (amountNum <= 0) throw new Error("Nominal penarikan harus lebih dari 0")

            const maxAllowed = getMaxWithdrawable(withdrawStore)
            if (amountNum > maxAllowed) throw new Error(`Nominal penarikan melebihi batas maksimal untuk toko ini (${fmt(maxAllowed)})`)

            // 1. Insert into tiktok_withdrawals
            const { error: withdrawErr } = await supabase.from('tiktok_withdrawals').insert([{
                store: withdrawStore,
                amount: amountNum,
                target_bank: withdrawTargetBank,
                withdraw_date: new Date(withdrawDate).toISOString()
            }])
            if (withdrawErr) throw withdrawErr

            // 2. Insert into incomes
            const { error: incomeErr } = await supabase.from('incomes').insert([{
                source: `Pencairan TikTok - ${withdrawStore}`,
                amount: amountNum,
                note: `Masuk ke ${withdrawTargetBank || 'Bank'}`,
                date: new Date(withdrawDate).toISOString().substring(0, 10)
            }])
            if (incomeErr) throw incomeErr

            setImportResult({ success: true, count: 1, message: `Berhasil mencairkan dana sebesar ${fmt(amountNum)} ke ${withdrawTargetBank}` })
            setShowWithdrawModal(false)
            setWithdrawTargetBank('')
            fetchData() // Refresh balances
        } catch (err) {
            console.error("Withdraw error:", err)
            setError(err.message)
        } finally {
            setWithdrawing(false)
        }
    }

    const applyFilters = () => {
        let result = [...data]

        // 0. Status filter
        if (statusFilter !== 'all') {
            if (statusFilter === 'match') {
                result = result.filter(item => matchedOrders.has(item.order_id))
            } else if (statusFilter === 'unmatch') {
                result = result.filter(item => !matchedOrders.has(item.order_id))
            }
        }


        // 1. Search filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase()
            result = result.filter(item =>
                item.order_id?.toLowerCase().includes(lowerTerm) ||
                item.store?.toLowerCase().includes(lowerTerm)
            )
        }

        // Toko Filter
        if (tokoFilter !== 'all') {
            result = result.filter(item => (item.store || '') === tokoFilter)
        }

        // 2. Date filter
        const now = new Date()
        let startDate = null
        let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

        if (dateFilter === '7days') {
            startDate = new Date(now)
            startDate.setDate(now.getDate() - 7)
        } else if (dateFilter === '30days') {
            startDate = new Date(now)
            startDate.setDate(now.getDate() - 30)
        } else if (dateFilter === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        } else if (dateFilter === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1)
        } else if (dateFilter === 'select_month' && selectedMonth) {
            const [y, m] = selectedMonth.split('-')
            startDate = new Date(y, m - 1, 1)
            endDate = new Date(y, m, 0, 23, 59, 59)
        } else if (dateFilter === 'custom' && customRange.start && customRange.end) {
            startDate = new Date(customRange.start)
            endDate = new Date(customRange.end)
            endDate.setHours(23, 59, 59)
        }

        if (startDate && endDate && dateFilter !== 'all') {
            result = result.filter(item => {
                const date = new Date(item.settlement_date || item.created_at)
                return date >= startDate && date <= endDate
            })
        }

        setFiltered(result)
        setCurrentPage(1) // Reset to first page when filters change
    }

    // Dashboard metrics calculation
    const fmt = (num) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(num || 0)
    }

    const fmtDate = (dateString) => {
        if (!dateString) return '-'
        const date = new Date(dateString)
        if (isNaN(date.getTime())) return '-'
        const dd = String(date.getDate()).padStart(2, '0')
        const mm = String(date.getMonth() + 1).padStart(2, '0')
        const yyyy = date.getFullYear()
        return `${dd}/${mm}/${yyyy}`
    }

    // Metrics calculation
    const matchedFiltered = filtered.filter(item => matchedOrders.has(item.order_id))

    // Dana Bisa Dicairkan is computed only for matched rows minus the accumulated withdrawals that apply to the filtered stores
    // If tokoFilter is 'all', we sum all matched settlements and subtract ALL accumulated withdrawals
    let totalSettlement = matchedFiltered.reduce((sum, item) => sum + (Number(item.pencairan) || 0), 0)
    let totalWithdrawnFromFiltered = 0;

    if (tokoFilter === 'all') {
        totalWithdrawnFromFiltered = Object.values(accumulatedWithdrawals).reduce((sum, val) => sum + val, 0)
    } else {
        totalWithdrawnFromFiltered = accumulatedWithdrawals[tokoFilter] || 0
    }

    const danaTercairkan = Math.max(0, totalSettlement - totalWithdrawnFromFiltered)

    // Total Platform fee is computed only for matched rows
    const totalPlatformFee = matchedFiltered.reduce((sum, item) => sum + (Number(item.platform_fee) || 0), 0)

    // "Pesanan Cocok" -> sum of matched cases
    const totalPesananCocok = matchedFiltered.length

    // Pagination logic
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
    const paginatedData = filtered.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    )

    // Ensure currentPage is valid if data shrinks
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1)
        }
    }, [filtered.length, totalPages, currentPage])

    return (
        <div className="page-container" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                        💳 Keuangan TikTok
                    </h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
                        Kelola data settlement, pencairan, dan potongan biaya platform
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {!withdrawalsTableExists && (
                        <div className="badge badge-danger" title="Tabel tiktok_withdrawals tidak ditemukan">⚠️ DB Missing</div>
                    )}
                    <button
                        className="btn btn-secondary"
                        onClick={handleOpenWithdraw}
                        disabled={importing || withdrawing || !withdrawalsTableExists}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {withdrawing ? (
                            <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: 'var(--primary-color) transparent transparent transparent' }}></div> Wait...</>
                        ) : (
                            <><span>💸</span> Withdraw</>
                        )}
                    </button>

                    <input
                        type="file"
                        accept=".csv, .xlsx, .xls"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleImport}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={handleImportClick}
                        disabled={importing || syncing}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {importing ? (
                            <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div> Mengimpor...</>
                        ) : (
                            <><span>📥</span> Import Excel/CSV</>
                        )}
                    </button>
                </div>
            </div>

            {/* Error & Success Messages */}
            {error && (
                <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
                    <strong>⚠️ Error:</strong> {error}
                </div>
            )}
            {importResult?.success && (
                <div className="alert alert-success" style={{ marginBottom: '20px' }}>
                    ✅ Berhasil mengimpor {importResult.count} data keuangan.
                </div>
            )}

            {/* Dashboard Cards matching Penjualan */}
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>💵</div>
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
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Dana Bisa Dicairkan</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(danaTercairkan)}</h3>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>📉</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Total Platform Fee</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(totalPlatformFee)}</h3>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>✅</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Pesanan Cocok</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{totalPesananCocok}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="card">
                <div className="data-table-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div className="table-search" style={{ maxWidth: '300px', flex: 1 }}>
                        🔍
                        <input
                            type="text"
                            placeholder="Cari Order ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        // We can remove form-input as table-search defines the input style inside it
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>

                        <select
                            className="form-input"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ width: 'auto' }}
                        >
                            <option value="all">Semua Status</option>
                            <option value="match">Match (Cocok)</option>
                            <option value="unmatch">Unmatch (Tidak Cocok)</option>
                        </select>
                        <select
                            className="form-input"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            style={{ width: 'auto' }}
                        >
                            <option value="all">Semua Waktu</option>
                            <option value="7days">7 Hari Terakhir</option>
                            <option value="30days">30 Hari Terakhir</option>
                            <option value="month">Bulan Ini</option>
                            <option value="year">Tahun Ini</option>
                            <option value="select_month">Pilih Bulan</option>
                            <option value="custom">Pilih Tanggal</option>
                        </select>
                        {dateFilter === 'select_month' && (
                            <div className="filter-custom-date" style={{ flexWrap: 'wrap' }}>
                                <input type="month" className="form-input" style={{ width: 'auto' }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                            </div>
                        )}
                        {dateFilter === 'custom' && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input type="date" className="form-input" value={customRange.start} onChange={e => setCustomRange({ ...customRange, start: e.target.value })} />
                                <span>-</span>
                                <input type="date" className="form-input" value={customRange.end} onChange={e => setCustomRange({ ...customRange, end: e.target.value })} />
                            </div>
                        )}
                        <select
                            className="filter-select"
                            value={tokoFilter}
                            onChange={e => setTokoFilter(e.target.value)}
                        >
                            <option value="all">Semua Toko</option>
                            {storeOptions.map(toko => (
                                <option key={toko} value={toko}>{toko}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Desktop Table */}
                <div className="table-responsive" style={{ display: 'block' }}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>
                            <div className="spinner"></div>
                            <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Memuat data keuangan...</p>
                        </div>
                    ) : paginatedData.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📄</div>
                            <p>Belum ada data keuangan yang diimpor</p>
                        </div>
                    ) : (
                        <table className="tiktok-table">
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>Order ID</th>
                                    <th>Store</th>
                                    <th>Settlement Date</th>
                                    <th style={{ textAlign: 'right' }}>Harga Jual</th>
                                    <th style={{ textAlign: 'right' }}>Platform Fee</th>
                                    <th style={{ textAlign: 'right' }}>Pencairan</th>
                                    <th style={{ textAlign: 'center' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((item, idx) => {
                                    const isMatch = matchedOrders.has(item.order_id)
                                    return (
                                        <tr key={item.id || idx}>
                                            <td>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                            <td>
                                                <div className="cell-main" style={{ fontFamily: 'monospace' }}>{item.order_id || '-'}</div>
                                            </td>
                                            <td>
                                                <div className="cell-main">{item.store || '-'}</div>
                                            </td>
                                            <td>
                                                <div className="cell-date">{fmtDate(item.settlement_date)}</div>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div className="cell-currency">{fmt(item.harga_jual)}</div>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div className="cell-currency" style={{ color: 'var(--text-danger)' }}>{fmt(item.platform_fee)}</div>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div className="cell-currency" style={{ color: 'var(--text-success)' }}>{fmt(item.pencairan)}</div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {isMatch ? (
                                                    <span className="badge badge-success">Match</span>
                                                ) : (
                                                    <span className="badge badge-danger">Unmatch</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Mobile Cards View */}
                <div className="mobile-cards" style={{ padding: '12px' }}>
                    {/* Simplified mobile view matching the table */}
                    {loading ? (
                        <div className="empty-state"><div className="spinner"></div><p>Memuat...</p></div>
                    ) : paginatedData.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">📄</div><p>Belum ada data</p></div>
                    ) : (
                        <div className="cards-list">
                            {paginatedData.map((item, idx) => {
                                const isMatch = matchedOrders.has(item.order_id)
                                return (
                                    <div key={item.id || idx} className="data-card">
                                        <div className="data-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="data-card-number" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{item.order_id}</span>
                                            {isMatch ? <span className="badge badge-success">Match</span> : <span className="badge badge-danger">Unmatch</span>}
                                        </div>
                                        <div className="data-card-body">
                                            <div className="data-card-row">
                                                <span className="data-card-label">Store</span>
                                                <span className="data-card-value">{item.store || '-'}</span>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Settlement</span>
                                                <span className="data-card-value">{fmtDate(item.settlement_date)}</span>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Harga Jual</span>
                                                <span className="data-card-value">{fmt(item.harga_jual)}</span>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Platform Fee</span>
                                                <span className="data-card-value" style={{ color: 'var(--text-danger)' }}>{fmt(item.platform_fee)}</span>
                                            </div>
                                            <div className="data-card-row">
                                                <span className="data-card-label">Pencairan</span>
                                                <span className="data-card-value" style={{ fontWeight: 'bold', color: 'var(--text-success)' }}>{fmt(item.pencairan)}</span>
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

            {/* Modal Pilih Store */}
            {showStoreModal && (
                <div className="modal-backdrop" style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="card" style={{ width: '400px', padding: '24px', background: 'var(--bg-card)' }}>
                        <h3 style={{ margin: '0 0 12px 0' }}>Pilih Nama Toko</h3>
                        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                            File Export Keuangan akan diimport ke dalam Sistem. Silakan pilih nama Toko (Store) yang sesuai dengan data Penjualannya.
                        </p>

                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Store</label>
                        <select
                            className="form-input"
                            value={selectedStore}
                            onChange={e => setSelectedStore(e.target.value)}
                            style={{ width: '100%', marginBottom: '24px' }}
                        >
                            <option value="">-- Pilih Toko --</option>
                            {storeOptions.map(st => (
                                <option key={st} value={st}>{st}</option>
                            ))}
                        </select>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => { setShowStoreModal(false); setPendingFile(null) }}>Batal</button>
                            <button className="btn btn-primary" onClick={processImport} disabled={!selectedStore || importing}>
                                {importing ? 'Memproses...' : 'Lanjut Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal Withdraw Dana */}
            {showWithdrawModal && (
                <div className="modal-backdrop" style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000
                }}>
                    <form className="card" onSubmit={handleWithdrawSubmit} style={{ width: '400px', padding: '24px', background: 'var(--bg-card)' }}>
                        <h3 style={{ margin: '0 0 12px 0' }}>💸 Withdraw Dana Pencairan</h3>
                        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                            Pencairan dana dari TikTok akan dicatat dan otomatis masuk ke laporan Pemasukan.
                        </p>

                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Toko / Akun TikTok</label>
                            <select
                                className="form-input"
                                value={withdrawStore}
                                onChange={e => setWithdrawStore(e.target.value)}
                                style={{ width: '100%' }}
                                required
                            >
                                <option value="">-- Pilih Toko --</option>
                                {storeOptions.map(st => (
                                    <option key={st} value={st}>{st}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Dana Tersedia</label>
                            <div className="form-input" style={{ width: '100%', background: 'var(--bg-secondary)', cursor: 'not-allowed' }}>
                                {fmt(getMaxWithdrawable(withdrawStore))}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Nominal Penarikan (Rp)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={withdrawAmount}
                                onChange={e => setWithdrawAmount(e.target.value)}
                                style={{ width: '100%' }}
                                min="1"
                                max={getMaxWithdrawable(withdrawStore)}
                                required
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Bank Tujuan</label>
                            <select
                                className="form-input"
                                value={withdrawTargetBank}
                                onChange={e => setWithdrawTargetBank(e.target.value)}
                                style={{ width: '100%' }}
                                required
                            >
                                <option value="">-- Pilih Bank / Kas Tujuan --</option>
                                {bankAccounts.map(b => (
                                    <option key={b.id} value={`${b.bank_name} - ${b.account_number} a.n ${b.account_name}`}>
                                        {b.account_type === 'Kas' ? '💵' : '🏦'} {b.bank_name} {b.account_number ? `- ${b.account_number}` : ''} {b.account_name ? `(${b.account_name})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Tanggal Penarikan</label>
                            <input
                                type="date"
                                className="form-input"
                                value={withdrawDate}
                                onChange={e => setWithdrawDate(e.target.value)}
                                style={{ width: '100%' }}
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowWithdrawModal(false)}>Batal</button>
                            <button type="submit" className="btn btn-primary" disabled={withdrawing || !withdrawStore || Number(withdrawAmount) <= 0}>
                                {withdrawing ? 'Memproses...' : 'Tarik Dana'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}
