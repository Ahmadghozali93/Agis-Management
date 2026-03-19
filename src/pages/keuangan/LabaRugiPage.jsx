import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function LabaRugiPage() {
    const [incomes, setIncomes] = useState([])
    const [expenses, setExpenses] = useState([])
    const [sales, setSales] = useState([])
    const [outMutations, setOutMutations] = useState([])
    const [allCoas, setAllCoas] = useState([])
    const [tiktokFinance, setTiktokFinance] = useState([])
    const [mengantarFinance, setMengantarFinance] = useState([])
    const [matchedSalesForTikTok, setMatchedSalesForTikTok] = useState(new Set())
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState('month')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [selectedMonth, setSelectedMonth] = useState('')

    useEffect(() => { loadData() }, [period, customStart, customEnd, selectedMonth])

    async function loadData() {
        try {
            setLoading(true)
            let incomeQuery = supabase.from('incomes').select('id, category, amount, date').order('date', { ascending: false })
            let expenseQuery = supabase.from('expenses').select('id, category, amount, date').order('date', { ascending: false })
            let salesQuery = supabase.from('tiktok_sales').select('id, total, settlement_date')
            let mutQuery = supabase.from('stock_mutations').select('qty, hpp, date, product_name, sku').eq('type', 'out')
            let inMutQuery = supabase.from('stock_mutations').select('qty, hpp, product_name, sku, note').eq('type', 'in')
            let tikFinQ = supabase.from('tiktok_finance').select('order_id, pencairan, settlement_date')
            let salForTikQ = supabase.from('tiktok_sales').select('order_id')
            let mengFinQ = supabase.from('mengantar_finance').select('total, date')

            if (period === 'custom' && customStart && customEnd) {
                const start = new Date(customStart).toISOString()
                const end = new Date(customEnd + 'T23:59:59').toISOString()
                incomeQuery = incomeQuery.gte('date', start).lte('date', end)
                expenseQuery = expenseQuery.gte('date', start).lte('date', end)
                salesQuery = salesQuery.gte('settlement_date', start).lte('settlement_date', end)
                mutQuery = mutQuery.gte('date', start).lte('date', end)
                tikFinQ = tikFinQ.gte('settlement_date', start).lte('settlement_date', end)
                mengFinQ = mengFinQ.gte('date', start).lte('date', end)
            } else if (period === 'pickmonth' && selectedMonth) {
                const [year, month] = selectedMonth.split('-').map(Number)
                const start = new Date(year, month - 1, 1).toISOString()
                const end = new Date(year, month, 0, 23, 59, 59).toISOString()
                incomeQuery = incomeQuery.gte('date', start).lte('date', end)
                expenseQuery = expenseQuery.gte('date', start).lte('date', end)
                salesQuery = salesQuery.gte('settlement_date', start).lte('settlement_date', end)
                mutQuery = mutQuery.gte('date', start).lte('date', end)
                tikFinQ = tikFinQ.gte('settlement_date', start).lte('settlement_date', end)
                mengFinQ = mengFinQ.gte('date', start).lte('date', end)
            } else if (period !== 'all') {
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
                    mutQuery = mutQuery.gte('date', startDate)
                    tikFinQ = tikFinQ.gte('settlement_date', startDate)
                    mengFinQ = mengFinQ.gte('date', startDate)
                }
            }

            const [{ data: inc }, { data: exp }, { data: sal }, { data: mutRes }, { data: coaData }, { data: tikFinData }, { data: salTikData }, { data: mengFinData }, { data: prodData }, { data: inMutData }] = await Promise.all([
                incomeQuery,
                expenseQuery,
                salesQuery,
                mutQuery,
                supabase.from('coa').select('code, name, type'),
                tikFinQ,
                salForTikQ,
                mengFinQ,
                supabase.from('products').select('id, name, sku, hpp'),
                inMutQuery
            ])

            setIncomes(inc || [])
            setExpenses(exp || [])
            setSales(sal || [])
            // Removed old purchase items processing logic

            const computedProducts = (prodData || []).map(p => {
                const baseHpp = Number(p.hpp) || 0
                const inMutations = (inMutData || []).filter(m => {
                    if (!((m.sku && p.sku && m.sku === p.sku) || m.product_name === p.name)) return false
                    const n = (m.note || '').toLowerCase()
                    if (n.includes('retur') || n.includes('rts') || n.includes('failed')) return false
                    return true
                })
                let totalCost = 0
                let totalQty = 0
                inMutations.forEach(m => {
                    const q = Number(m.qty) || 0
                    const h = Number(m.hpp) || 0
                    totalCost += (q * h)
                    totalQty += q
                })
                const mutasiHpp = totalQty > 0 ? Math.round(totalCost / totalQty) : 0
                const avgHpp = mutasiHpp > 0 ? mutasiHpp : baseHpp
                return { ...p, avg_hpp: avgHpp }
            })

            const outMutationsData = (mutRes || []).map(m => {
                const prod = computedProducts.find(p => (m.sku && p.sku === m.sku) || p.name === m.product_name)
                return { ...m, computed_hpp: prod ? prod.avg_hpp : (m.hpp || 0) }
            })
            setOutMutations(outMutationsData)
            setAllCoas(coaData || [])
            setTiktokFinance(tikFinData || [])
            setMengantarFinance(mengFinData || [])

            const matchedSalesIds = new Set((salTikData || []).map(s => s.order_id))
            setMatchedSalesForTikTok(matchedSalesIds)
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    function fmt(v) { return 'Rp ' + (v || 0).toLocaleString('id-ID') }

    // Helper to get real COA type
    function getCoaType(categoryLabel) {
        if (!categoryLabel) return null
        const found = allCoas.find(c => {
            const label = c.code ? `[${c.code}] ${c.name}` : c.name
            return label === categoryLabel || c.name === categoryLabel
        })
        return found ? found.type : null
    }

    // Filter to only include real Incomes (exclude liability, payable, equity, and transfers like Pencairan)
    const validIncomes = incomes.filter(i => {
        if (i.category && i.category.toLowerCase().includes('pencairan')) return false
        const type = getCoaType(i.category)
        return type !== 'liability' && type !== 'payable' && type !== 'equity' && type !== 'asset' && type !== 'fixed_asset' && type !== 'receivable'
    })

    // Filter to only include real Expenses (exclude liability, payable, equity)
    const validExpenses = expenses.filter(e => {
        const type = getCoaType(e.category)
        return type !== 'liability' && type !== 'payable' && type !== 'equity' && type !== 'asset' && type !== 'fixed_asset' && type !== 'receivable'
    })

    // Group incomes by category
    const incomeByCategory = {}
    validIncomes.forEach(i => {
        const cat = i.category || 'Lainnya'
        if (!incomeByCategory[cat]) incomeByCategory[cat] = { total: 0, count: 0 }
        incomeByCategory[cat].total += i.amount || 0
        incomeByCategory[cat].count++
    })

    // Group expenses by category
    const expenseByCategory = {}
    validExpenses.forEach(e => {
        const cat = e.category || 'Lainnya'
        if (!expenseByCategory[cat]) expenseByCategory[cat] = { total: 0, count: 0 }
        expenseByCategory[cat].total += e.amount || 0
        expenseByCategory[cat].count++
    })

    // Sales and Fees from TikTok Finance
    const matchedFinanceForCalc = tiktokFinance.filter(f => matchedSalesForTikTok.has(f.order_id))
    const totalSales = matchedFinanceForCalc.reduce((s, x) => s + (Number(x.pencairan) || 0), 0)

    // Sales and RTS Costs from Mengantar
    const totalMengantarPencairan = mengantarFinance.reduce((s, x) => s + (Number(x.total) || 0), 0)
    const totalMengantarSales = totalMengantarPencairan

    // HPP / COGS total
    const totalHpp = outMutations.reduce((s, m) => s + (Number(m.qty || 0) * Number(m.computed_hpp !== undefined ? m.computed_hpp : m.hpp || 0)), 0)

    const totalIncome = validIncomes.reduce((s, i) => s + (i.amount || 0), 0)
    const totalPendapatan = totalIncome + totalSales + totalMengantarSales

    // Total expense includes explicit expenses AND computed HPP AND Biaya RTS
    const explicitExpenses = validExpenses.reduce((s, e) => s + (e.amount || 0), 0)
    const totalExpense = explicitExpenses + totalHpp
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
                                        padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13px'
                                    }}>
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontWeight: 500 }}>Penjualan TikTok</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>({matchedFinanceForCalc.length} trx match)</span>
                                        </span>
                                        <span style={{ fontWeight: 600, color: 'var(--success)', whiteSpace: 'nowrap', textAlign: 'right', minWidth: '120px' }}>{fmt(totalSales)}</span>
                                    </div>
                                )}

                                {/* Penjualan Mengantar */}
                                {totalMengantarSales > 0 && (
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13px'
                                    }}>
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontWeight: 500 }}>Penjualan Mengantar</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>({mengantarFinance.length} mutasi)</span>
                                        </span>
                                        <span style={{ fontWeight: 600, color: 'var(--success)', whiteSpace: 'nowrap', textAlign: 'right', minWidth: '120px' }}>{fmt(totalMengantarSales)}</span>
                                    </div>
                                )}

                                {/* Pemasukan by category */}
                                {Object.entries(incomeByCategory).map(([cat, data]) => (
                                    <div key={cat} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13px'
                                    }}>
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontWeight: 500 }}>{cat}</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>({data.count} trx)</span>
                                        </span>
                                        <span style={{ fontWeight: 600, color: 'var(--success)', whiteSpace: 'nowrap', textAlign: 'right', minWidth: '120px' }}>{fmt(data.total)}</span>
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

                        <div className="settings-section">
                            <h3 style={{ color: 'var(--danger)', marginBottom: '16px' }}>💸 Beban</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

                                {/* HPP */}
                                {totalHpp > 0 && (
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13px'
                                    }}>
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontWeight: 500 }}>Harga Pokok Penjualan (HPP)</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>({outMutations.length} trx)</span>
                                        </span>
                                        <span style={{ fontWeight: 600, color: 'var(--danger)', whiteSpace: 'nowrap', textAlign: 'right', minWidth: '120px' }}>{fmt(totalHpp)}</span>
                                    </div>
                                )}

                                {Object.entries(expenseByCategory).map(([cat, data]) => (
                                    <div key={cat} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13px'
                                    }}>
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontWeight: 500 }}>{cat}</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>({data.count} trx)</span>
                                        </span>
                                        <span style={{ fontWeight: 600, color: 'var(--danger)', whiteSpace: 'nowrap', textAlign: 'right', minWidth: '120px' }}>{fmt(data.total)}</span>
                                    </div>
                                ))}

                                {Object.keys(expenseByCategory).length === 0 && totalHpp === 0 && (
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
