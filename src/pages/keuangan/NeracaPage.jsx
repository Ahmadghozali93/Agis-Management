import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function NeracaPage() {
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState('all')

    // COA accounts
    const [asetCoas, setAsetCoas] = useState([])
    const [kewajibanCoas, setKewajibanCoas] = useState([])
    const [ekuitasCoas, setEkuitasCoas] = useState([])

    // Transaction data
    const [incomes, setIncomes] = useState([])
    const [expenses, setExpenses] = useState([])
    const [sales, setSales] = useState([])
    const [purchases, setPurchases] = useState([])
    const [payments, setPayments] = useState([])

    useEffect(() => { loadData() }, [period])

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
            let incQ = supabase.from('incomes').select('amount, payment_method, date')
            let expQ = supabase.from('expenses').select('amount, payment_method, category, date')
            let salQ = supabase.from('tiktok_sales').select('total, settlement_date')
            let purQ = supabase.from('purchases').select('total, status, date')
            let payQ = supabase.from('payments').select('amount, method, date')

            if (dateFilter) {
                incQ = incQ.gte('date', dateFilter)
                expQ = expQ.gte('date', dateFilter)
                salQ = salQ.gte('settlement_date', dateFilter)
                purQ = purQ.gte('date', dateFilter)
                payQ = payQ.gte('date', dateFilter)
            }

            const [asetRes, kwRes, ekRes, incRes, expRes, salRes, purRes, payRes] = await Promise.all([
                supabase.from('coa').select('id, code, name, type, account_group').in('type', ['asset', 'fixed_asset', 'receivable']).order('code'),
                supabase.from('coa').select('id, code, name, type, account_group').in('type', ['liability', 'payable']).order('code'),
                supabase.from('coa').select('id, code, name, type, account_group').eq('type', 'equity').order('code'),
                incQ, expQ, salQ, purQ, payQ
            ])

            setAsetCoas(asetRes.data || [])
            setKewajibanCoas(kwRes.data || [])
            setEkuitasCoas(ekRes.data || [])
            setIncomes(incRes.data || [])
            setExpenses(expRes.data || [])
            setSales(salRes.data || [])
            setPurchases(purRes.data || [])
            setPayments(payRes.data || [])
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    function fmt(v) { return 'Rp ' + (v || 0).toLocaleString('id-ID') }

    // Calculate asset balances from transactions
    function getAssetBalance(coa) {
        const label = coa.code ? `[${coa.code}] ${coa.name}` : coa.name
        // Money IN = incomes where payment_method matches this asset
        const moneyIn = incomes
            .filter(i => i.payment_method === label)
            .reduce((s, i) => s + (i.amount || 0), 0)
        // Money OUT = expenses where payment_method matches this asset
        const moneyOut = expenses
            .filter(e => e.payment_method === label)
            .reduce((s, e) => s + (e.amount || 0), 0)
        // Payments (purchases paid from this account)
        const paidOut = payments
            .filter(p => p.method === label)
            .reduce((s, p) => s + (p.amount || 0), 0)
        return moneyIn - moneyOut - paidOut
    }

    // Kewajiban: unpaid purchases
    const totalUtang = purchases
        .filter(p => p.status === 'belum_lunas' || p.status === 'pending')
        .reduce((s, p) => s + (p.total || 0), 0)

    // Total calculations
    const totalSales = sales.reduce((s, x) => s + (x.total || 0), 0)
    const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0)
    const totalExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0)
    const labaDitahan = totalIncome + totalSales - totalExpense

    const totalAset = asetCoas.reduce((s, c) => s + getAssetBalance(c), 0)
    const totalKewajiban = totalUtang
    const totalEkuitas = labaDitahan

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
                    </div>
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
                        <strong>Total Aset = Total Kewajiban + Total Ekuitas</strong> — Data dihitung otomatis dari transaksi
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* ASET */}
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

                        {/* KEWAJIBAN + EKUITAS */}
                        <div>
                            {/* Kewajiban */}
                            <div className="settings-section" style={{ marginBottom: '20px' }}>
                                <h3 style={{ color: 'var(--danger)', marginBottom: '12px', fontSize: '15px' }}>📤 Kewajiban</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                        fontSize: '13px'
                                    }}>
                                        <span style={{ fontWeight: 500 }}>Utang Usaha (Pembelian Belum Lunas)</span>
                                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--danger)', minWidth: '120px', textAlign: 'right' }}>{fmt(totalUtang)}</span>
                                    </div>
                                    {kewajibanCoas.map(coa => (
                                        <div key={coa.id} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                            fontSize: '13px'
                                        }}>
                                            <span style={{ flex: 1 }}>
                                                {coa.code && <code style={{ color: 'var(--primary)', marginRight: '10px', fontSize: '12px', fontWeight: 600, display: 'inline-block', width: '40px' }}>{coa.code}</code>}
                                                <span style={{ fontWeight: 500 }}>{coa.name}</span>
                                            </span>
                                            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-muted)', minWidth: '120px', textAlign: 'right' }}>Rp 0</span>
                                        </div>
                                    ))}
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
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                        fontSize: '13px'
                                    }}>
                                        <span>
                                            <span style={{ fontWeight: 500 }}>Laba Ditahan</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>(Pendapatan − Beban)</span>
                                        </span>
                                        <span style={{ fontWeight: 600, fontSize: '13px', color: labaDitahan >= 0 ? 'var(--success)' : 'var(--danger)', minWidth: '120px', textAlign: 'right' }}>{fmt(labaDitahan)}</span>
                                    </div>
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
