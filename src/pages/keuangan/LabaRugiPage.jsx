import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function LabaRugiPage() {
    const [incomes, setIncomes] = useState([])
    const [expenses, setExpenses] = useState([])
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState('month')

    useEffect(() => { loadData() }, [period])

    async function loadData() {
        try {
            setLoading(true)
            let incomeQuery = supabase.from('incomes').select('id, category, amount, date').order('date', { ascending: false })
            let expenseQuery = supabase.from('expenses').select('id, category, amount, date').order('date', { ascending: false })
            let salesQuery = supabase.from('tiktok_sales').select('id, total, settlement_date')

            if (period !== 'all') {
                const now = new Date()
                let startDate
                if (period === 'month') {
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
                } else if (period === 'year') {
                    startDate = new Date(now.getFullYear(), 0, 1).toISOString()
                }
                if (startDate) {
                    incomeQuery = incomeQuery.gte('date', startDate)
                    expenseQuery = expenseQuery.gte('date', startDate)
                    salesQuery = salesQuery.gte('settlement_date', startDate)
                }
            }

            const [{ data: inc }, { data: exp }, { data: sal }] = await Promise.all([incomeQuery, expenseQuery, salesQuery])
            setIncomes(inc || [])
            setExpenses(exp || [])
            setSales(sal || [])
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    function fmt(v) { return 'Rp ' + (v || 0).toLocaleString('id-ID') }

    // Group incomes by category
    const incomeByCategory = {}
    incomes.forEach(i => {
        const cat = i.category || 'Lainnya'
        if (!incomeByCategory[cat]) incomeByCategory[cat] = { total: 0, count: 0 }
        incomeByCategory[cat].total += i.amount || 0
        incomeByCategory[cat].count++
    })

    // Group expenses by category
    const expenseByCategory = {}
    expenses.forEach(e => {
        const cat = e.category || 'Lainnya'
        if (!expenseByCategory[cat]) expenseByCategory[cat] = { total: 0, count: 0 }
        expenseByCategory[cat].total += e.amount || 0
        expenseByCategory[cat].count++
    })

    // Sales total
    const totalSales = sales.reduce((s, x) => s + (x.total || 0), 0)

    const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0)
    const totalPendapatan = totalIncome + totalSales
    const totalExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0)
    const profit = totalPendapatan - totalExpense

    return (
        <div>
            <div className="page-header">
                <h1>📈 Laporan Laba Rugi</h1>
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
                    {/* Summary Cards */}
                    <div className="finance-summary">
                        <div className="finance-card">
                            <div className="finance-card-label">Total Pendapatan</div>
                            <div className="finance-card-value income">{fmt(totalPendapatan)}</div>
                        </div>
                        <div className="finance-card">
                            <div className="finance-card-label">Total Beban</div>
                            <div className="finance-card-value expense">{fmt(totalExpense)}</div>
                        </div>
                        <div className="finance-card">
                            <div className="finance-card-label">{profit >= 0 ? 'Laba Bersih' : 'Rugi Bersih'}</div>
                            <div className={`finance-card-value ${profit >= 0 ? 'profit' : 'expense'}`}>{fmt(Math.abs(profit))}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* PENDAPATAN */}
                        <div className="settings-section">
                            <h3 style={{ color: 'var(--success)', marginBottom: '16px' }}>💰 Pendapatan</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

                                {/* Penjualan TikTok */}
                                {totalSales > 0 && (
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)'
                                    }}>
                                        <span>
                                            <span style={{ fontWeight: 600 }}>Penjualan TikTok</span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>({sales.length} transaksi)</span>
                                        </span>
                                        <span style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(totalSales)}</span>
                                    </div>
                                )}

                                {/* Pemasukan by category */}
                                {Object.entries(incomeByCategory).map(([cat, data]) => (
                                    <div key={cat} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)'
                                    }}>
                                        <span>
                                            <span style={{ fontWeight: 600 }}>{cat}</span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>({data.count} transaksi)</span>
                                        </span>
                                        <span style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(data.total)}</span>
                                    </div>
                                ))}

                                {totalSales === 0 && Object.keys(incomeByCategory).length === 0 && (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>Belum ada pendapatan</p>
                                )}

                                {/* Total */}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    padding: '12px', borderTop: '2px solid var(--border-light)', fontWeight: 800, marginTop: '4px'
                                }}>
                                    <span>Total Pendapatan</span>
                                    <span style={{ color: 'var(--success)' }}>{fmt(totalPendapatan)}</span>
                                </div>
                            </div>
                        </div>

                        {/* BEBAN */}
                        <div className="settings-section">
                            <h3 style={{ color: 'var(--danger)', marginBottom: '16px' }}>💸 Beban</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

                                {Object.entries(expenseByCategory).map(([cat, data]) => (
                                    <div key={cat} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)'
                                    }}>
                                        <span>
                                            <span style={{ fontWeight: 600 }}>{cat}</span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>({data.count} transaksi)</span>
                                        </span>
                                        <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(data.total)}</span>
                                    </div>
                                ))}

                                {Object.keys(expenseByCategory).length === 0 && (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>Belum ada beban</p>
                                )}

                                {/* Total */}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    padding: '12px', borderTop: '2px solid var(--border-light)', fontWeight: 800, marginTop: '4px'
                                }}>
                                    <span>Total Beban</span>
                                    <span style={{ color: 'var(--danger)' }}>{fmt(totalExpense)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Profit / Loss Summary */}
                    <div className="settings-section" style={{ marginTop: '20px' }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '16px', background: profit >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            borderRadius: 'var(--radius-md)', border: `2px solid ${profit >= 0 ? 'var(--success)' : 'var(--danger)'}`
                        }}>
                            <div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                    {profit >= 0 ? '🎉 Laba Bersih' : '⚠️ Rugi Bersih'}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    Pendapatan ({fmt(totalPendapatan)}) - Beban ({fmt(totalExpense)})
                                </div>
                            </div>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {fmt(Math.abs(profit))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
