import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function NeracaPage() {
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState('all')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [selectedMonth, setSelectedMonth] = useState('')

    const [allCoas, setAllCoas] = useState([])
    const [asetCoas, setAsetCoas] = useState([])
    const [kewajibanCoas, setKewajibanCoas] = useState([])
    const [ekuitasCoas, setEkuitasCoas] = useState([])

    // Transaction data
    const [incomes, setIncomes] = useState([])
    const [expenses, setExpenses] = useState([])
    const [sales, setSales] = useState([])
    const [outMutations, setOutMutations] = useState([])
    const [purchases, setPurchases] = useState([])
    const [payments, setPayments] = useState([])
    const [transfers, setTransfers] = useState([])
    const [tiktokFinance, setTiktokFinance] = useState([])
    const [tiktokWithdrawals, setTiktokWithdrawals] = useState([])
    const [mengantarFinance, setMengantarFinance] = useState([])
    const [mengantarWithdrawals, setMengantarWithdrawals] = useState([])
    const [matchedSalesForTikTok, setMatchedSalesForTikTok] = useState(new Set())

    useEffect(() => { loadData() }, [period, customStart, customEnd, selectedMonth])

    async function loadData() {
        try {
            setLoading(true)

            // Date filter
            let dateFilter = null
            if (period !== 'all') {
                const now = new Date()
                if (period === 'month') dateFilter = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
                else if (period === 'year') dateFilter = new Date(now.getFullYear(), 0, 1).toISOString()
            }

            // Queries
            let incQ = supabase.from('incomes').select('amount, payment_method, category, date')
            let expQ = supabase.from('expenses').select('amount, payment_method, category, date')
            let salQ = supabase.from('tiktok_sales').select('total, settlement_date')
            let purQ = supabase.from('purchases').select('total, status, date')
            let payQ = supabase.from('payments').select('amount, method, date')
            let transQ = supabase.from('transfers').select('amount, from_account, to_account, date')
            let mutQ = supabase.from('stock_mutations').select('qty, hpp, date, product_name, sku').eq('type', 'out')
            let tikFinQ = supabase.from('tiktok_finance').select('order_id, pencairan, settlement_date, harga_jual, platform_fee')
            let tikWithQ = supabase.from('tiktok_withdrawals').select('amount, withdraw_date')
            let mengFinQ = supabase.from('mengantar_finance').select('total, date')
            let mengWithQ = supabase.from('mengantar_withdrawals').select('amount, withdraw_date')
            // Don't filter sales by date when matching settlements, as old sales can be settled later
            let salForTikQ = supabase.from('tiktok_sales').select('order_id')

            if (period === 'custom' && customStart && customEnd) {
                const start = new Date(customStart).toISOString()
                const end = new Date(customEnd + 'T23:59:59').toISOString()
                incQ = incQ.gte('date', start).lte('date', end)
                expQ = expQ.gte('date', start).lte('date', end)
                salQ = salQ.gte('settlement_date', start).lte('settlement_date', end)
                purQ = purQ.gte('date', start).lte('date', end)
                payQ = payQ.gte('date', start).lte('date', end)
                transQ = transQ.gte('date', start).lte('date', end)
                mutQ = mutQ.gte('date', start).lte('date', end)
                tikFinQ = tikFinQ.gte('settlement_date', start).lte('settlement_date', end)
                tikWithQ = tikWithQ.gte('withdraw_date', start).lte('withdraw_date', end)
                mengFinQ = mengFinQ.gte('date', start).lte('date', end)
                mengWithQ = mengWithQ.gte('withdraw_date', start).lte('withdraw_date', end)
            } else if (period === 'pickmonth' && selectedMonth) {
                const [year, month] = selectedMonth.split('-').map(Number)
                const start = new Date(year, month - 1, 1).toISOString()
                const end = new Date(year, month, 0, 23, 59, 59).toISOString()
                incQ = incQ.gte('date', start).lte('date', end)
                expQ = expQ.gte('date', start).lte('date', end)
                salQ = salQ.gte('settlement_date', start).lte('settlement_date', end)
                purQ = purQ.gte('date', start).lte('date', end)
                payQ = payQ.gte('date', start).lte('date', end)
                transQ = transQ.gte('date', start).lte('date', end)
                mutQ = mutQ.gte('date', start).lte('date', end)
                tikFinQ = tikFinQ.gte('settlement_date', start).lte('settlement_date', end)
                tikWithQ = tikWithQ.gte('withdraw_date', start).lte('withdraw_date', end)
                mengFinQ = mengFinQ.gte('date', start).lte('date', end)
                mengWithQ = mengWithQ.gte('withdraw_date', start).lte('withdraw_date', end)
            } else if (dateFilter) {
                incQ = incQ.gte('date', dateFilter)
                expQ = expQ.gte('date', dateFilter)
                salQ = salQ.gte('settlement_date', dateFilter)
                purQ = purQ.gte('date', dateFilter)
                payQ = payQ.gte('date', dateFilter)
                transQ = transQ.gte('date', dateFilter)
                mutQ = mutQ.gte('date', dateFilter)
                tikFinQ = tikFinQ.gte('settlement_date', dateFilter)
                tikWithQ = tikWithQ.gte('withdraw_date', dateFilter)
                mengFinQ = mengFinQ.gte('date', dateFilter)
                mengWithQ = mengWithQ.gte('withdraw_date', dateFilter)
            }

            const results = await Promise.all([
                supabase.from('coa').select('id, code, name, type, account_group').order('code'),
                incQ, expQ, salQ, purQ, payQ, transQ, mutQ, tikFinQ, tikWithQ, salForTikQ, mengFinQ, mengWithQ,
                supabase.from('products').select('id, name, sku, hpp'),
                supabase.from('purchases').select('items, status').in('status', ['lunas', 'pending'])
            ])

            const [allCoasRes, incRes, expRes, salRes, purRes, payRes, transRes, mutRes, tikFinRes, tikWithRes, salTikRes, mengFinRes, mengWithRes, prodRes, purAllRes] = results

            const coas = allCoasRes?.data || []
            setAllCoas(coas)
            setAsetCoas(coas.filter(c => ['asset', 'fixed_asset', 'receivable'].includes(c.type)))
            setKewajibanCoas(coas.filter(c => ['liability', 'payable'].includes(c.type)))
            setEkuitasCoas(coas.filter(c => c.type === 'equity'))

            setIncomes(incRes?.data || [])
            setExpenses(expRes?.data || [])
            setSales(salRes?.data || [])
            setPurchases(purRes?.data || [])
            setPayments(payRes?.data || [])
            setTransfers(transRes?.data || [])
            // Dynamic Average HPP logic
            let allPurchasedItems = []
            if (purAllRes?.data) {
                purAllRes.data.forEach(p => {
                    let pItems = p.items
                    if (typeof pItems === 'string') {
                        try { pItems = JSON.parse(pItems) } catch (e) { pItems = [] }
                    }
                    if (Array.isArray(pItems)) {
                        allPurchasedItems.push(...pItems)
                    }
                })
            }

            const computedProducts = (prodRes?.data || []).map(p => {
                const baseHpp = Number(p.hpp) || 0
                const pItems = allPurchasedItems.filter(it => it.product_id === p.id || (it.sku && p.sku && it.sku === p.sku) || it.name === p.name)
                let totalCost = 0
                let totalQty = 0
                pItems.forEach(it => {
                    const q = Number(it.qty) || 0
                    const price = Number(it.price) || 0
                    totalCost += (q * price)
                    totalQty += q
                })
                const purchaseHpp = totalQty > 0 ? Math.round(totalCost / totalQty) : 0
                const avgHpp = purchaseHpp > 0 ? purchaseHpp : baseHpp
                return { ...p, avg_hpp: avgHpp }
            })

            const outMutationsData = (mutRes?.data || []).map(m => {
                const prod = computedProducts.find(p => (m.sku && p.sku === m.sku) || p.name === m.product_name)
                return { ...m, computed_hpp: prod ? prod.avg_hpp : (m.hpp || 0) }
            })
            setOutMutations(outMutationsData)
            setTiktokFinance(tikFinRes?.data || [])
            setTiktokWithdrawals(tikWithRes?.data || [])
            setMengantarFinance(mengFinRes?.data || [])
            setMengantarWithdrawals(mengWithRes?.data || [])

            // For TikTok matching
            const matchedSalesIds = new Set((salTikRes?.data || []).map(s => s.order_id))
            setMatchedSalesForTikTok(matchedSalesIds)
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    function fmt(v) { return 'Rp ' + (v || 0).toLocaleString('id-ID') }

    const totalHpp = outMutations.reduce((s, m) => s + (Number(m.qty || 0) * Number(m.computed_hpp !== undefined ? m.computed_hpp : m.hpp || 0)), 0)

    // Calculate asset balances from transactions
    function getAssetBalance(coa) {
        const label = coa.code ? `[${coa.code}] ${coa.name}` : coa.name

        // Helper to check if a method string matches this COA
        const isMatch = (methodStr) => {
            if (!methodStr) return false
            // KeuanganTiktok/Pemasukan might append description: "[1010] Bank BCA - Tabungan"
            return methodStr.startsWith(label) || methodStr.startsWith(coa.name)
        }

        // Money IN = incomes where payment_method matches this asset
        const moneyIn = incomes
            .filter(i => isMatch(i.payment_method))
            .reduce((s, i) => s + (i.amount || 0), 0)

        // Money OUT = expenses where payment_method matches this asset
        const moneyOut = expenses
            .filter(e => isMatch(e.payment_method))
            .reduce((s, e) => s + (e.amount || 0), 0)

        // Payments (purchases paid from this account)
        const paidOut = payments
            .filter(p => isMatch(p.method))
            .reduce((s, p) => s + (p.amount || 0), 0)

        // Transfer IN = `to_account` is this asset
        const transferIn = transfers
            .filter(t => isMatch(t.to_account))
            .reduce((s, t) => s + (t.amount || 0), 0)

        // Transfer OUT = `from_account` is this asset
        const transferOut = transfers
            .filter(t => isMatch(t.from_account))
            .reduce((s, t) => s + (t.amount || 0), 0)

        // Pembelian menambah aset Persediaan (Inventory), kecuali yang batal
        let persediaanIn = 0
        let persediaanOut = 0
        if ((coa.name || '').toLowerCase().includes('persediaan')) {
            // Hanya pembelian yang valid ('pending' atau 'lunas') yang masuk persediaan gudang.
            // 'belum_lunas' belum divalidasi jadi belum masuk mutasi stok.
            persediaanIn = purchases.filter(p => p.status === 'pending' || p.status === 'lunas').reduce((s, p) => s + (p.total || 0), 0)
            persediaanOut = totalHpp
        }

        // TikTokShop COA handling (Case insensitive, handle "Tiktok Shop", "TikTokShop", etc)
        let tiktokBalance = 0
        const coaNameLower = (coa.name || '').toLowerCase().replace(/\s/g, '')
        const isTiktokShop = coaNameLower === 'tiktokshop' || coaNameLower.includes('tiktokshop')

        if (isTiktokShop) {
            const matchedFinance = tiktokFinance.filter(f => matchedSalesForTikTok.has(f.order_id))
            const totalSettlement = matchedFinance.reduce((s, f) => s + (Number(f.pencairan) || 0), 0)
            const totalWithdrawn = tiktokWithdrawals.reduce((s, w) => s + (Number(w.amount) || 0), 0)
            tiktokBalance = totalSettlement - totalWithdrawn
        }

        let mengantarBalance = 0
        const isMengantar = coaNameLower === 'mengantar' || coaNameLower.includes('mengantar')
        if (isMengantar) {
            const totalSettlementMengantar = mengantarFinance.reduce((s, f) => s + (Number(f.total) || 0), 0)
            const totalWithdrawnMengantar = mengantarWithdrawals.reduce((s, w) => s + (Number(w.amount) || 0), 0)
            mengantarBalance = totalSettlementMengantar - totalWithdrawnMengantar
        }

        return moneyIn - moneyOut - paidOut + transferIn - transferOut + persediaanIn - persediaanOut + tiktokBalance + mengantarBalance
    }

    // Get real type of a category label
    function getCoaType(categoryLabel) {
        if (!categoryLabel) return null
        const found = allCoas.find(c => {
            const label = c.code ? `[${c.code}] ${c.name}` : c.name
            return label === categoryLabel || c.name === categoryLabel
        })
        return found ? found.type : null
    }

    // Kewajiban balance from Pemasukan & Pengeluaran
    function getKewajibanBalance(coa) {
        const label = coa.code ? `[${coa.code}] ${coa.name}` : coa.name
        const moneyIn = incomes.filter(i => i.category === label || i.category === coa.name).reduce((s, i) => s + (i.amount || 0), 0)
        const moneyOut = expenses.filter(e => e.category === label || e.category === coa.name).reduce((s, e) => s + (e.amount || 0), 0)

        // Pembelian yang belum lunas otomatis masuk ke Utang Usaha
        let utangPembelian = 0
        if (coa.code === '2000' || (coa.name || '').toLowerCase().includes('utang usaha')) {
            // Hanya order yang sudah divalidasi (pending) atau lunas yang masuk ke Utang Usaha.
            // belum_lunas belum diakui sebagai utang/aset.
            const validPurchases = purchases.filter(p => p.status === 'pending' || p.status === 'lunas')
            const totalP = validPurchases.reduce((s, p) => s + (p.total || 0), 0)
            const totalPay = payments.reduce((s, p) => s + (p.amount || 0), 0)
            utangPembelian = totalP - totalPay
        }

        return moneyIn - moneyOut + utangPembelian
    }

    // Ekuitas balance from Pemasukan & Pengeluaran
    function getEkuitasBalance(coa) {
        if (coa.name === 'Laba Ditahan') return labaDitahan // Handled separately
        const label = coa.code ? `[${coa.code}] ${coa.name}` : coa.name
        const moneyIn = incomes.filter(i => i.category === label || i.category === coa.name).reduce((s, i) => s + (i.amount || 0), 0)
        const moneyOut = expenses.filter(e => e.category === label || e.category === coa.name).reduce((s, e) => s + (e.amount || 0), 0)
        return moneyIn - moneyOut
    }

    // Sisa fitur: LabaDitahan, dll (dihapus perhitungan hardcoded utangPembelian)

    // Total calculations (sum incomes/expenses. If COA type is not explicitly liability/equity/asset, treat as income/expense)
    // Replace older sales logic with accurate TikTok Finance data (Pencairan as Net Revenue)
    const matchedFinanceForCalc = tiktokFinance.filter(f => matchedSalesForTikTok.has(f.order_id))
    const totalSales = matchedFinanceForCalc.reduce((s, x) => s + (Number(x.pencairan) || 0), 0)

    const totalMengantarPencairan = mengantarFinance.reduce((s, x) => s + (Number(x.total) || 0), 0)
    const totalMengantarSales = totalMengantarPencairan

    // For Pemasukan, we count it as income unless it's explicitly liability, equity, or asset
    const totalIncome = incomes.filter(i => {
        if (i.category && i.category.toLowerCase().includes('pencairan')) return false
        const type = getCoaType(i.category)
        return type === 'income' || type === 'expense' || type === null
    }).reduce((s, i) => s + (i.amount || 0), 0)

    // For Pengeluaran, we count it as expense unless it's explicitly liability, equity, or asset
    const totalExpense = expenses.filter(e => {
        const type = getCoaType(e.category)
        return type === 'income' || type === 'expense' || type === null
    }).reduce((s, e) => s + (e.amount || 0), 0)

    const labaDitahan = totalIncome + totalSales + totalMengantarSales - (totalExpense + totalHpp)

    const totalAset = asetCoas.reduce((s, c) => s + getAssetBalance(c), 0)
    const totalKewajiban = kewajibanCoas.reduce((s, c) => s + getKewajibanBalance(c), 0)
    const totalEkuitas = labaDitahan + ekuitasCoas.filter(c => c.name !== 'Laba Ditahan').reduce((s, c) => s + getEkuitasBalance(c), 0)

    const balance = totalAset - (totalKewajiban + totalEkuitas)

    return (
        <div>
            <div className="page-header">
                <h1>📋 Neraca Keuangan</h1>
                <div className="page-header-actions">
                    <div className="tabs" style={{ margin: 0 }}>
                        <button className={`tab ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')}>Bulan Ini</button>
                        <button className={`tab ${period === 'year' ? 'active' : ''}`} onClick={() => setPeriod('year')}>Tahun Ini</button>
                        <button className={`tab ${period === 'all' ? 'active' : ''}`} onClick={() => setPeriod('all')}>Semua</button>
                        <button className={`tab ${period === 'pickmonth' ? 'active' : ''}`} onClick={() => setPeriod('pickmonth')}>Pilih Bulan</button>
                        <button className={`tab ${period === 'custom' ? 'active' : ''}`} onClick={() => setPeriod('custom')}>Kustom</button>
                    </div>
                    {period === 'pickmonth' && (
                        <input type="month" value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', marginTop: '8px' }}
                        />
                    )}
                    {period === 'custom' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                            />
                            <span style={{ color: 'var(--text-muted)' }}>s/d</span>
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner"></div><p>Memuat...</p></div>
            ) : (
                <>
                    {/* Summary */}
                    <div className="finance-summary">
                        <div className="finance-card">
                            <div className="finance-card-label">Total Aset</div>
                            <div className="finance-card-value income">{fmt(totalAset)}</div>
                        </div>
                        <div className="finance-card">
                            <div className="finance-card-label">Total Kewajiban</div>
                            <div className="finance-card-value expense">{fmt(totalKewajiban)}</div>
                        </div>
                        <div className="finance-card">
                            <div className="finance-card-label">Ekuitas (Laba Ditahan)</div>
                            <div className="finance-card-value profit">{fmt(totalEkuitas)}</div>
                        </div>
                        <div className="finance-card">
                            <div className="finance-card-label">Balance Check</div>
                            <div className={`finance-card-value ${balance === 0 ? 'profit' : 'expense'}`}>
                                {balance === 0 ? '✅ Seimbang' : `⚠️ Selisih ${fmt(Math.abs(balance))}`}
                            </div>
                        </div>
                    </div>

                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', textAlign: 'center' }}>
                        <strong>Total Aktiva (Aset) = Total Pasiva (Kewajiban + Ekuitas)</strong> — Data dihitung otomatis dari transaksi
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
                        {/* ASET (AKTIVA) */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid var(--border-color)' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Aktiva</h2>
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--success)' }}>{fmt(totalAset)}</h2>
                            </div>
                            <div className="settings-section">
                                <h3 style={{ color: 'var(--success)', marginBottom: '12px', fontSize: '15px' }}>📥 Aset</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {asetCoas.map(coa => {
                                        const bal = getAssetBalance(coa)
                                        return (
                                            <div key={coa.id} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                                fontSize: '13px'
                                            }}>
                                                <span style={{ flex: 1, minWidth: 0 }}>
                                                    {coa.code && <code style={{ color: 'var(--primary)', marginRight: '10px', fontSize: '12px', fontWeight: 600, display: 'inline-block', width: '40px' }}>{coa.code}</code>}
                                                    <span style={{ fontWeight: 500 }}>{coa.name}</span>
                                                </span>
                                                <span style={{ fontWeight: 600, fontSize: '13px', color: bal >= 0 ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap', textAlign: 'right', minWidth: '120px' }}>{fmt(bal)}</span>
                                            </div>
                                        )
                                    })}
                                    {asetCoas.length === 0 && (
                                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                                            Belum ada akun Aset di COA
                                        </p>
                                    )}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between',
                                        padding: '10px 12px', borderTop: '2px solid var(--border-light)', fontWeight: 700, fontSize: '13px', marginTop: '4px'
                                    }}>
                                        <span>Total Aset</span>
                                        <span style={{ color: 'var(--success)', minWidth: '120px', textAlign: 'right' }}>{fmt(totalAset)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* KEWAJIBAN + EKUITAS (PASIVA) */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid var(--border-color)' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Pasiva</h2>
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--danger)' }}>{fmt(totalKewajiban + totalEkuitas)}</h2>
                            </div>
                            {/* Kewajiban */}
                            <div className="settings-section" style={{ marginBottom: '20px' }}>
                                <h3 style={{ color: 'var(--danger)', marginBottom: '12px', fontSize: '15px' }}>📤 Kewajiban</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {kewajibanCoas.map(coa => {
                                        const bal = getKewajibanBalance(coa)
                                        return (
                                            <div key={coa.id} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                                fontSize: '13px'
                                            }}>
                                                <span style={{ flex: 1 }}>
                                                    {coa.code && <code style={{ color: 'var(--primary)', marginRight: '10px', fontSize: '12px', fontWeight: 600, display: 'inline-block', width: '40px' }}>{coa.code}</code>}
                                                    <span style={{ fontWeight: 500 }}>{coa.name}</span>
                                                </span>
                                                <span style={{ fontWeight: 600, fontSize: '13px', color: bal > 0 ? 'var(--danger)' : 'var(--text-muted)', minWidth: '120px', textAlign: 'right' }}>{fmt(bal)}</span>
                                            </div>
                                        )
                                    })}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between',
                                        padding: '10px 12px', borderTop: '2px solid var(--border-light)', fontWeight: 700, fontSize: '13px', marginTop: '4px'
                                    }}>
                                        <span>Total Kewajiban</span>
                                        <span style={{ color: 'var(--danger)', minWidth: '120px', textAlign: 'right' }}>{fmt(totalKewajiban)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Ekuitas */}
                            <div className="settings-section">
                                <h3 style={{ color: 'var(--primary)', marginBottom: '12px', fontSize: '15px' }}>🏛️ Ekuitas</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {ekuitasCoas.map(coa => {
                                        if (coa.name === 'Laba Ditahan') {
                                            return (
                                                <div key={coa.id} style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                                    fontSize: '13px'
                                                }}>
                                                    <span>
                                                        {coa.code && <code style={{ color: 'var(--primary)', marginRight: '10px', fontSize: '12px', fontWeight: 600, display: 'inline-block', width: '40px' }}>{coa.code}</code>}
                                                        <span style={{ fontWeight: 500 }}>Laba Ditahan</span>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>(Pendapatan − Beban)</span>
                                                    </span>
                                                    <span style={{ fontWeight: 600, fontSize: '13px', color: labaDitahan >= 0 ? 'var(--success)' : 'var(--danger)', minWidth: '120px', textAlign: 'right' }}>{fmt(labaDitahan)}</span>
                                                </div>
                                            )
                                        }

                                        const bal = getEkuitasBalance(coa)
                                        return (
                                            <div key={coa.id} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                                fontSize: '13px'
                                            }}>
                                                <span>
                                                    {coa.code && <code style={{ color: 'var(--primary)', marginRight: '10px', fontSize: '12px', fontWeight: 600, display: 'inline-block', width: '40px' }}>{coa.code}</code>}
                                                    <span style={{ fontWeight: 500 }}>{coa.name}</span>
                                                </span>
                                                <span style={{ fontWeight: 600, fontSize: '13px', color: bal >= 0 ? 'var(--success)' : 'var(--danger)', minWidth: '120px', textAlign: 'right' }}>{fmt(bal)}</span>
                                            </div>
                                        )
                                    })}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between',
                                        padding: '10px 12px', borderTop: '2px solid var(--border-light)', fontWeight: 700, fontSize: '13px', marginTop: '4px'
                                    }}>
                                        <span>Total Ekuitas</span>
                                        <span style={{ color: 'var(--primary)', minWidth: '120px', textAlign: 'right' }}>{fmt(totalEkuitas)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
