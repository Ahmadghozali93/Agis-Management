import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function NeracaPage() {
    const [data, setData] = useState({ incomes: 0, expenses: 0, purchases: 0, sales: 0 })
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [inc, exp, pur, sal] = await Promise.all([
                supabase.from('incomes').select('amount'),
                supabase.from('expenses').select('amount'),
                supabase.from('purchases').select('total'),
                supabase.from('tiktok_sales').select('total'),
            ])

            setData({
                incomes: (inc.data || []).reduce((s, i) => s + (i.amount || 0), 0),
                expenses: (exp.data || []).reduce((s, e) => s + (e.amount || 0), 0),
                purchases: (pur.data || []).reduce((s, p) => s + (p.total || 0), 0),
                sales: (sal.data || []).reduce((s, s2) => s + (s2.total || 0), 0),
            })
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    function fmt(v) { return 'Rp ' + (v || 0).toLocaleString('id-ID') }

    const totalAset = data.incomes + data.sales
    const totalKewajiban = data.expenses + data.purchases
    const modal = totalAset - totalKewajiban

    return (
        <div>
            <div className="page-header">
                <h1>📋 Neraca Keuangan</h1>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner"></div><p>Memuat...</p></div>
            ) : (
                <>
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
                            <div className="finance-card-label">Modal/Ekuitas</div>
                            <div className={`finance-card-value ${modal >= 0 ? 'profit' : 'expense'}`}>{fmt(Math.abs(modal))}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="settings-section">
                            <h3 style={{ color: 'var(--success)' }}>📥 Aset (Aktiva)</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                    <span>Pemasukan</span>
                                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(data.incomes)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                    <span>Penjualan</span>
                                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(data.sales)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 12px', borderTop: '2px solid var(--border-light)', fontWeight: 800 }}>
                                    <span>Total Aset</span>
                                    <span style={{ color: 'var(--success)' }}>{fmt(totalAset)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="settings-section">
                            <h3 style={{ color: 'var(--danger)' }}>📤 Kewajiban (Pasiva)</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                    <span>Pengeluaran</span>
                                    <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(data.expenses)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                    <span>Pembelian</span>
                                    <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(data.purchases)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 12px', borderTop: '2px solid var(--border-light)', fontWeight: 800 }}>
                                    <span>Total Kewajiban</span>
                                    <span style={{ color: 'var(--danger)' }}>{fmt(totalKewajiban)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
