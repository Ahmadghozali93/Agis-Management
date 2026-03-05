import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function LabaRugiPage() {
    const [incomes, setIncomes] = useState([])
    const [expenses, setExpenses] = useState([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState('all')

    useEffect(() => { loadData() }, [period])

    async function loadData() {
        try {
            setLoading(true)
            let incomeQuery = supabase.from('incomes').select('*').order('date', { ascending: false })
            let expenseQuery = supabase.from('expenses').select('*').order('date', { ascending: false })

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
                }
            }

            const [{ data: inc }, { data: exp }] = await Promise.all([incomeQuery, expenseQuery])
            setIncomes(inc || [])
            setExpenses(exp || [])
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0)
    const totalExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0)
    const profit = totalIncome - totalExpense

    function fmt(v) { return 'Rp ' + (v || 0).toLocaleString('id-ID') }

    return (
        <div>
            <div className="page-header">
                <h1>📈 Laba Rugi</h1>
                <div className="page-header-actions">
                    <div className="tabs" style={{ margin: 0 }}>
                        <button className={`tab ${period === 'all' ? 'active' : ''}`} onClick={() => setPeriod('all')}>Semua</button>
                        <button className={`tab ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')}>Bulan Ini</button>
                        <button className={`tab ${period === 'year' ? 'active' : ''}`} onClick={() => setPeriod('year')}>Tahun Ini</button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner"></div><p>Memuat...</p></div>
            ) : (
                <>
                    <div className="finance-summary">
                        <div className="finance-card">
                            <div className="finance-card-label">Total Pemasukan</div>
                            <div className="finance-card-value income">{fmt(totalIncome)}</div>
                        </div>
                        <div className="finance-card">
                            <div className="finance-card-label">Total Pengeluaran</div>
                            <div className="finance-card-value expense">{fmt(totalExpense)}</div>
                        </div>
                        <div className="finance-card">
                            <div className="finance-card-label">{profit >= 0 ? 'Laba Bersih' : 'Rugi Bersih'}</div>
                            <div className={`finance-card-value ${profit >= 0 ? 'profit' : 'expense'}`}>{fmt(Math.abs(profit))}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="table-container">
                            <div className="table-toolbar" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success)' }}>💰 Pemasukan</h3>
                                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{incomes.length} data</span>
                            </div>
                            <div className="table-wrapper">
                                <table>
                                    <thead><tr><th>Sumber</th><th>Jumlah</th><th>Tanggal</th></tr></thead>
                                    <tbody>
                                        {incomes.map(i => (
                                            <tr key={i.id}>
                                                <td>{i.source}</td>
                                                <td style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(i.amount)}</td>
                                                <td>{i.date ? new Date(i.date).toLocaleDateString('id-ID') : '-'}</td>
                                            </tr>
                                        ))}
                                        {incomes.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada data</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="table-container">
                            <div className="table-toolbar" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--danger)' }}>💸 Pengeluaran</h3>
                                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{expenses.length} data</span>
                            </div>
                            <div className="table-wrapper">
                                <table>
                                    <thead><tr><th>Kategori</th><th>Jumlah</th><th>Tanggal</th></tr></thead>
                                    <tbody>
                                        {expenses.map(e => (
                                            <tr key={e.id}>
                                                <td>{e.category}</td>
                                                <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(e.amount)}</td>
                                                <td>{e.date ? new Date(e.date).toLocaleDateString('id-ID') : '-'}</td>
                                            </tr>
                                        ))}
                                        {expenses.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada data</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
