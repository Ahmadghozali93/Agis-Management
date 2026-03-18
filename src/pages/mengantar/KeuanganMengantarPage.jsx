import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { utils, writeFile } from 'xlsx'
import { parseCSV, parseXLSX, mapMengantarFinanceRow } from '../../lib/csvParser'

export default function KeuanganMengantarPage() {
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
    const [dateFilter, setDateFilter] = useState('all') 
    const [customRange, setCustomRange] = useState({ start: '', end: '' })
    const [selectedMonth, setSelectedMonth] = useState('')

    // Withdraw Modal State
    const [showWithdrawModal, setShowWithdrawModal] = useState(false)
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [withdrawTargetBank, setWithdrawTargetBank] = useState('')
    const [withdrawDate, setWithdrawDate] = useState(new Date().toISOString().substring(0, 10))
    const [withdrawing, setWithdrawing] = useState(false)
    const [withdrawalsTableExists, setWithdrawalsTableExists] = useState(true)
    const [accumulatedWithdrawals, setAccumulatedWithdrawals] = useState(0)
    const [totalBiayaRtS, setTotalBiayaRtS] = useState(0)
    const [bankAccounts, setBankAccounts] = useState([])

    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 20
    const fileInputRef = useRef(null)

    useEffect(() => {
        fetchData()
    }, [])

    useEffect(() => {
        applyFilters()
    }, [data, searchTerm, dateFilter, customRange, selectedMonth])

    const fetchData = async () => {
        setLoading(true)
        setError(null)
        try {
            // 1. Fetch finance data
            const { data: financeData, error: financeError } = await supabase
                .from('mengantar_finance')
                .select('*')
                .order('date', { ascending: false })

            if (financeError) throw financeError
            setData(financeData || [])

            // 2. Fetch accumulated withdrawals
            const { data: withdrawalsData, error: withdrawalsError } = await supabase
                .from('mengantar_withdrawals')
                .select('amount')

            if (withdrawalsError) {
                if (withdrawalsError.code === '42P01') setWithdrawalsTableExists(false)
            } else if (withdrawalsData) {
                const sum = withdrawalsData.reduce((acc, w) => acc + Number(w.amount || 0), 0)
                setAccumulatedWithdrawals(sum)
                setWithdrawalsTableExists(true)
            }

            // 3. Fetch accumulated Biaya RTS from returns
            const { data: rtsData } = await supabase
                .from('mengantar_returns')
                .select('biaya_rts')
            
            if (rtsData) {
                const sumRTS = rtsData.reduce((acc, r) => acc + Number(r.biaya_rts || 0), 0)
                setTotalBiayaRtS(sumRTS)
            }

            // 4. Fetch Bank Accounts for Withdraw
            const { data: banksData } = await supabase
                .from('coa')
                .select('id, code, name, description')
                .eq('account_group', 'Kas/Bank')
                .order('code', { ascending: true })
            if (banksData) {
                setBankAccounts(banksData.map(a => {
                    let label = a.code ? `[${a.code}] ${a.name}` : a.name
                    if (a.description) label += ` - ${a.description}`
                    return { id: a.id, bank_name: label }
                }))
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

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
                    // Fallback for fake .xls files (actually CSV or HTML)
                    rows = parseCSV(await file.text())
                }
            } else {
                rows = parseCSV(await file.text())
            }
            if (rows.length === 0) throw new Error('File kosong atau format tidak sesuai')

            if (rows.length > 0) {
                const keys = Object.keys(rows[0]).map(k => k.toLowerCase())
                if (!keys.includes('tracking id') && !keys.includes('resi')) {
                    throw new Error('Kolom "Tracking ID" tidak ditemukan di header file.')
                }
            }

            const mapped = rows.map(mapMengantarFinanceRow).filter(item => item.tracking_id)

            // Deduplicate incoming rows
            const uniqueMap = {}
            mapped.forEach(item => {
                const tid = item.tracking_id
                if (!uniqueMap[tid]) {
                    uniqueMap[tid] = { ...item }
                } else {
                    uniqueMap[tid].total += (item.total || 0)
                    uniqueMap[tid].cod_fee += (item.cod_fee || 0)
                }
            })
            const uniqueData = Object.values(uniqueMap)
            if (uniqueData.length === 0) throw new Error('Tidak ada data valid dengan Tracking ID.')

            // Duplicate Check against DB
            const idsToCheck = uniqueData.map(item => item.tracking_id)
            let existingRecords = []
            for (let i = 0; i < idsToCheck.length; i += 100) {
                const chunk = idsToCheck.slice(i, i + 100)
                const { data: existing } = await supabase.from('mengantar_finance').select('tracking_id').in('tracking_id', chunk)
                if (existing) existingRecords = [...existingRecords, ...existing]
            }
            const existingKeys = new Set(existingRecords.map(r => r.tracking_id))
            const toInsert = []
            let countDuplikat = 0

            uniqueData.forEach(item => {
                if (existingKeys.has(item.tracking_id)) countDuplikat++
                else { toInsert.push(item); existingKeys.add(item.tracking_id) }
            })

            setImportStats({ berhasil: toInsert.length, duplikat: countDuplikat })
            setPendingImportData(toInsert)
            setShowConfirmModal(true)
        } catch (error) {
            setError(error.message)
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
                const { error } = await supabase.from('mengantar_finance').upsert(batch, { onConflict: 'tracking_id', ignoreDuplicates: false })
                if (error) throw error
                inserted += batch.length
            }

            // Auto-update status penjualan ke 'Selesai' untuk tracking_id yang cocok
            // dan langsung insert stock_mutations dengan HPP
            const allTrackingIds = pendingImportData.map(item => item.tracking_id).filter(Boolean)
            let totalMatch = 0

            // Ambil semua produk untuk lookup HPP dan SKU
            const { data: allProducts } = await supabase.from('products').select('id, name, sku, hpp')
            const skuToHpp = {}
            const skuToProductName = {}
            const nameToHpp = {}
            const nameToSku = {}
            ;(allProducts || []).forEach(p => {
                if (p.sku) {
                    skuToHpp[p.sku.toLowerCase()] = p.hpp
                    skuToProductName[p.sku.toLowerCase()] = p.name
                }
                if (p.name) {
                    nameToHpp[p.name.toLowerCase().trim()] = p.hpp
                    nameToSku[p.name.toLowerCase().trim()] = p.sku
                }
            })

            for (let i = 0; i < allTrackingIds.length; i += 100) {
                const chunk = allTrackingIds.slice(i, i + 100)

                // Juga coba dengan prefix apostrof untuk data lama di DB
                const chunkWithApostrophe = chunk.map(id => `'${id}`)
                const allVariants = [...new Set([...chunk, ...chunkWithApostrophe])]

                // Cari data di mengantar_sales yang belum Selesai
                const { data: matches } = await supabase
                    .from('mengantar_sales')
                    .select('id, tracking_id, last_status, goods_description, product_id, quantity, cogs')
                    .in('tracking_id', allVariants)
                    .not('last_status', 'eq', 'Selesai') // jangan overwrite yang sudah Selesai
                    .not('last_status', 'eq', 'RTS')     // jangan overwrite status RTS

                if (matches && matches.length > 0) {
                    const matchIds = matches.map(m => m.id)

                    // Update status ke Selesai
                    await supabase
                        .from('mengantar_sales')
                        .update({ last_status: 'Selesai' })
                        .in('id', matchIds)

                    // Insert stock_mutations out dengan HPP dari products
                    const mutations = []
                    const today = new Date().toISOString()
                    for (const m of matches) {
                        const skuKey = (m.product_id || '').toLowerCase()
                        const nameKey = (m.goods_description || '').toLowerCase().trim()
                        const hpp = skuKey && skuToHpp[skuKey]
                            ? skuToHpp[skuKey]
                            : (nameKey && nameToHpp[nameKey] ? nameToHpp[nameKey] : (m.cogs || 0))
                        const productName = skuKey && skuToProductName[skuKey]
                            ? skuToProductName[skuKey]
                            : (m.goods_description || 'Produk Mengantar')
                        const note = `Penjualan Mengantar: ${m.tracking_id}`

                        // Cek dulu agar tidak double-insert
                        const { data: existing } = await supabase
                            .from('stock_mutations')
                            .select('id')
                            .eq('note', note)
                            .maybeSingle()

                        if (!existing) {
                            mutations.push({
                                reference_id: m.tracking_id,
                                product_name: productName,
                                sku: (skuKey && skuToHpp[skuKey] ? m.product_id : null) || nameToSku[nameKey] || null,
                                type: 'out',
                                qty: Number(m.quantity) || 1,
                                note,
                                date: today,
                                hpp: Number(hpp) || 0
                            })
                        }
                    }

                    if (mutations.length > 0) {
                        await supabase.from('stock_mutations').insert(mutations)
                    }

                    totalMatch += matchIds.length
                }
            }

            setImportResult({ success: true, berhasil: inserted, duplikat: importStats.duplikat, matched: totalMatch })

            fetchData()
        } catch (error) {
            setError(error.message)
            setImportResult({ error: error.message })
        } finally {
            setImporting(false)
            setPendingImportData([])
            setImportStats(null)
        }
    }


    const cancelImport = () => { setShowConfirmModal(false); setPendingImportData([]); setImportStats(null) }

    const applyFilters = () => {
        let result = [...data]

        if (searchTerm) {
            const q = searchTerm.toLowerCase()
            result = result.filter(item =>
                (item.tracking_id || '').toLowerCase().includes(q) ||
                (item.customer_name || '').toLowerCase().includes(q) ||
                (item.courier || '').toLowerCase().includes(q)
            )
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
                const d = new Date(item.date || item.created_at)
                return d >= startDate && d <= endDate
            })
        }

        setFiltered(result)
        setCurrentPage(1)
    }

    const handleOpenWithdraw = () => {
        setWithdrawAmount(Math.max(0, danaTercairkan))
        setShowWithdrawModal(true)
    }

    const handleWithdrawSubmit = async (e) => {
        e.preventDefault()
        if (!withdrawalsTableExists) return setError("Tabel mengantar_withdrawals belum tersedia.")
        setWithdrawing(true)
        setError(null)
        try {
            const amountNum = Number(withdrawAmount)
            if (amountNum <= 0) throw new Error("Nominal harus > 0")
            if (amountNum > danaTercairkan) throw new Error(`Nominal melebihi batas (Maks: ${fmt(danaTercairkan)})`)

            await supabase.from('mengantar_withdrawals').insert([{
                amount: amountNum, 
                target_bank: withdrawTargetBank, 
                withdraw_date: new Date(withdrawDate).toISOString()
            }])

            await supabase.from('transfers').insert([{
                date: new Date(withdrawDate).toISOString().substring(0, 10),
                from_account: 'Mengantar',
                to_account: withdrawTargetBank,
                amount: amountNum,
                note: `Pencairan Dana Mengantar ke ${withdrawTargetBank || 'Bank'}`
            }])

            setImportResult({ success: true, berhasil: 0, duplikat: 0, message: `Berhasil mencairkan dana ${fmt(amountNum)} ke ${withdrawTargetBank}` })
            setShowWithdrawModal(false)
            setWithdrawTargetBank('')
            fetchData()
        } catch (err) {
            setError(err.message)
        } finally {
            setWithdrawing(false)
        }
    }

    const handleExport = () => {
        if (!filtered || filtered.length === 0) return alert('Tidak ada data')
        const exportData = filtered.map((item, index) => ({
            'No': index + 1,
            'Tanggal': item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-',
            'Tracking ID': item.tracking_id,
            'Penerima': item.customer_name,
            'Ekspedisi': item.courier,
            'Pencairan': item.total
        }))
        const worksheet = utils.json_to_sheet(exportData)
        const workbook = utils.book_new()
        utils.book_append_sheet(workbook, worksheet, "Keuangan Mengantar")
        writeFile(workbook, `Keuangan_Mengantar_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    const fmt = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num || 0)
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID') : '-'

    const totalSettlement = filtered.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
    const danaTercairkan = Math.max(0, totalSettlement - accumulatedWithdrawals - totalBiayaRtS)

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
    const paginatedData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    return (
        <div className="page-container" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                        💳 Keuangan Mengantar
                    </h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
                        Kelola data pencairan dan tarik dana (Withdraw) berdasarkan tabel Mutasi Keuangan
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" onClick={handleOpenWithdraw} disabled={importing || withdrawing || !withdrawalsTableExists} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {withdrawing ? 'Wait...' : <><span>💸</span> Withdraw</>}
                    </button>
                    <button className="btn btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📤</span> Export Excel
                    </button>
                    <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} />
                    <button className="btn btn-primary" onClick={handleImportClick} disabled={importing} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {importing ? 'Mengimpor...' : <><span>📥</span> Import Mutasi</>}
                    </button>
                </div>
            </div>

            {/* ERROR / RESULTS ALERTS */}
            {error && <div className="alert alert-danger" style={{ marginBottom: '20px' }}><strong>⚠️ Error:</strong> {error}</div>}
            
            {showConfirmModal && importStats && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h2>📋 Konfirmasi Import Data</h2>
                            <button className="modal-close" onClick={cancelImport}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Hasil validasi data file mutasi Mengantar:</p>
                            <div style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px' }}>
                                    <span style={{ fontSize: '13px' }}>✅ Data Baru</span>
                                    <span style={{ fontWeight: 700, color: '#10b981' }}>{importStats.berhasil}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(107, 114, 128, 0.08)', borderRadius: '8px' }}>
                                    <span style={{ fontSize: '13px' }}>🔄 Duplikat (Diabaikan)</span>
                                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{importStats.duplikat}</span>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={cancelImport}>Batal</button>
                            {importStats.berhasil > 0 && <button className="btn btn-primary" onClick={confirmImport}>✅ Ya, Import Sekarang</button>}
                        </div>
                    </div>
                </div>
            )}

            {importResult && (
                <div className="alert alert-success" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        {importResult.message || `Berhasil import ${importResult.berhasil} data baru.`}
                    </div>
                    <button className="btn-close" onClick={() => setImportResult(null)}>×</button>
                </div>
            )}

            {showWithdrawModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h2>💸 Penarikan Dana (Withdraw)</h2>
                            <button className="modal-close" onClick={() => setShowWithdrawModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleWithdrawSubmit}>
                            <div className="modal-body">
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Dana akan ditarik dari perhitungan total settlement / pencairan Mengantar.</p>
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label>Saldo Tersedia</label>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{fmt(danaTercairkan)}</div>
                                </div>
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label>Nominal Penarikan</label>
                                    <input type="number" className="form-input" required max={danaTercairkan} min="1" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
                                    <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Masukkan jumlah uang yang dicairkan</small>
                                </div>
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label>Tujuan Pencairan (Kas/Bank)</label>
                                    <select className="form-select" required value={withdrawTargetBank} onChange={e => setWithdrawTargetBank(e.target.value)}>
                                        <option value="">-- Pilih Akun Bank --</option>
                                        {bankAccounts.map(b => <option key={b.bank_name} value={b.bank_name}>{b.bank_name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Tanggal Pencairan</label>
                                    <input type="date" className="form-input" required value={withdrawDate} onChange={e => setWithdrawDate(e.target.value)} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowWithdrawModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary" disabled={withdrawing}>Tarik Dana</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DASHBOARD */}
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>💵</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Total Mutasi</p>
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
                        <div className="stat-card-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>💸</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Total Ditarik (Withdraw)</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(accumulatedWithdrawals)}</h3>
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>📦</div>
                        <div>
                            <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Total Biaya RTS</p>
                            <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(totalBiayaRtS)}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABLE */}
            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-search">
                        🔍
                        <input type="text" placeholder="Cari Tracking ID, Penerima, Ekspedisi..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="filter-group">
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
                                <span>-</span>
                                <input type="date" className="filter-date-input" value={customRange.end} onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="table-wrapper">
                    {loading ? (
                        <div className="empty-state"><div className="spinner"></div><p>Memuat data...</p></div>
                    ) : paginatedData.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">📭</div><p>Tidak ada data keuangan</p></div>
                    ) : (
                        <table className="tiktok-table">
                            <thead>
                                <tr>
                                    <th>No.</th>
                                    <th>Info Order</th>
                                    <th>Penerima</th>
                                    <th>Produk</th>
                                    <th>Qty</th>
                                    <th>Pencairan</th>
                                    <th>Pengiriman</th>
                                    <th>Update</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((item, idx) => {
                                    return (
                                        <tr key={item.id}>
                                            <td>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                            <td>
                                                <div className="cell-date">{fmtDate(item.date)}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{item.customer_name || '-'}</div>
                                            </td>
                                            <td>
                                                <div style={{ maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px' }}>
                                                    {item.goods_description || '-'}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{item.quantity || 1}</div>
                                            </td>
                                            <td>
                                                <div className="cell-currency" style={{ fontWeight: 600, color: 'var(--success)' }}>{fmt(item.total)}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500, fontSize: '13px' }}>{item.courier || '-'}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.tracking_id}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    Dibuat: {fmtDate(item.created_at)}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="pagination" style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
                    <button className="btn-page" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Prev</button>
                    <span className="page-info" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>Halaman {currentPage} dari {totalPages || 1}</span>
                    <button className="btn-page" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</button>
                </div>
            </div>
        </div>
    )
}
