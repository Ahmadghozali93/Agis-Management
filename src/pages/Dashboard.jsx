import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalProducts: 0,
        totalCategories: 0,
        totalSuppliers: 0,
        totalSales: 0,
        totalIncome: 0,
        totalExpense: 0
    })

    useEffect(() => {
        loadStats()
    }, [])

    async function loadStats() {
        try {
            const [products, categories, suppliers, sales, incomes, expenses] = await Promise.all([
                supabase.from('products').select('id', { count: 'exact', head: true }),
                supabase.from('categories').select('id', { count: 'exact', head: true }),
                supabase.from('suppliers').select('id', { count: 'exact', head: true }),
                supabase.from('tiktok_sales').select('total'),
                supabase.from('incomes').select('amount'),
                supabase.from('expenses').select('amount')
            ])

            const totalSales = sales.data?.reduce((sum, s) => sum + (s.total || 0), 0) || 0
            const totalIncome = incomes.data?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0
            const totalExpense = expenses.data?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

            setStats({
                totalProducts: products.count || 0,
                totalCategories: categories.count || 0,
                totalSuppliers: suppliers.count || 0,
                totalSales,
                totalIncome,
                totalExpense
            })
        } catch (err) {
            console.error('Error loading stats:', err)
        }
    }

    function formatCurrency(val) {
        return 'Rp ' + (val || 0).toLocaleString('id-ID')
    }

    const chartHeights = [40, 65, 55, 80, 70, 90, 75, 85, 60, 95, 50, 78]

    return (
        <div>
            <div className="page-header">
                <h1>Dashboard</h1>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">Total Produk</span>
                        <div className="stat-card-icon purple">📦</div>
                    </div>
                    <div className="stat-card-value">{stats.totalProducts}</div>
                    <div className="stat-card-change up">📈 Active</div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">Kategori</span>
                        <div className="stat-card-icon blue">🏷️</div>
                    </div>
                    <div className="stat-card-value">{stats.totalCategories}</div>
                    <div className="stat-card-change up">📊 Categories</div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">Supplier</span>
                        <div className="stat-card-icon cyan">🚚</div>
                    </div>
                    <div className="stat-card-value">{stats.totalSuppliers}</div>
                    <div className="stat-card-change up">🤝 Partners</div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">Total Penjualan</span>
                        <div className="stat-card-icon green">💵</div>
                    </div>
                    <div className="stat-card-value">{formatCurrency(stats.totalSales)}</div>
                    <div className="stat-card-change up">📈 Revenue</div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">Total Pemasukan</span>
                        <div className="stat-card-icon green">💰</div>
                    </div>
                    <div className="stat-card-value">{formatCurrency(stats.totalIncome)}</div>
                    <div className="stat-card-change up">📈 Income</div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">Total Pengeluaran</span>
                        <div className="stat-card-icon red">💸</div>
                    </div>
                    <div className="stat-card-value">{formatCurrency(stats.totalExpense)}</div>
                    <div className="stat-card-change down">📉 Expense</div>
                </div>
            </div>

            <div className="chart-placeholder">
                <h3>📊 Grafik Penjualan Bulanan</h3>
                <div className="chart-bars">
                    {chartHeights.map((h, i) => (
                        <div key={i} className="chart-bar" style={{ height: `${h}%` }} title={`Bulan ${i + 1}`} />
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => (
                        <span key={m}>{m}</span>
                    ))}
                </div>
            </div>
        </div>
    )
}
