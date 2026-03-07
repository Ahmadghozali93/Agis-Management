import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function fmt(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0)
}

export default function DashboardKontenPage() {
    const [accounts, setAccounts] = useState([])
    const [contents, setContents] = useState([])
    const [lives, setLives] = useState([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState('month')

    useEffect(() => { loadData() }, [period])

    async function loadData() {
        try {
            setLoading(true)
            let contQuery = supabase.from('content_reports').select('*').order('date', { ascending: false })
            let liveQuery = supabase.from('live_reports').select('*').order('date', { ascending: false })

            if (period !== 'all') {
                const now = new Date()
                let startDate
                if (period === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
                else if (period === 'year') startDate = new Date(now.getFullYear(), 0, 1).toISOString()
                if (startDate) {
                    contQuery = contQuery.gte('date', startDate)
                    liveQuery = liveQuery.gte('date', startDate)
                }
            }

            const [accRes, contRes, liveRes] = await Promise.all([
                supabase.from('content_accounts').select('*').order('account_name'),
                contQuery,
                liveQuery
            ])
            setAccounts(accRes.data || [])
            setContents(contRes.data || [])
            setLives(liveRes.data || [])
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    const activeAccounts = accounts.filter(a => a.status === 'active')
    const totalContents = contents.length
    const approvedContents = contents.filter(c => c.validation_status === 'approved').length
    const pendingContents = contents.filter(c => c.validation_status === 'pending').length
    const totalLives = lives.length
    const approvedLives = lives.filter(l => l.validation_status === 'approved').length
    const pendingLives = lives.filter(l => l.validation_status === 'pending').length
    const totalOmzet = lives.reduce((s, l) => s + (l.revenue || 0), 0)
    const totalViewers = lives.reduce((s, l) => s + (l.viewers || 0), 0)
    const totalDuration = lives.reduce((s, l) => s + (l.duration || 0), 0)

    // Group contents by creator
    const byCreator = {}
    contents.forEach(c => {
        const k = c.creator || 'Unknown'
        if (!byCreator[k]) byCreator[k] = 0
        byCreator[k]++
    })

    // Group lives by host
    const byHost = {}
    lives.forEach(l => {
        const k = l.host || 'Unknown'
        if (!byHost[k]) byHost[k] = { count: 0, omzet: 0, viewers: 0 }
        byHost[k].count++
        byHost[k].omzet += l.revenue || 0
        byHost[k].viewers += l.viewers || 0
    })

    // Group by platform
    const byPlatform = {}
        ;[...contents, ...lives].forEach(item => {
            const p = item.platform || 'Other'
            if (!byPlatform[p]) byPlatform[p] = 0
            byPlatform[p]++
        })

    // Recent contents (5)
    const recentContents = contents.slice(0, 5)
    const recentLives = lives.slice(0, 5)

    return (
        <div>
            <div className="page-header">
                <h1>🎬 Dashboard Konten</h1>
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
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-card-header">
                                <span className="stat-card-label">Akun Aktif</span>
                                <div className="stat-card-icon green">📱</div>
                            </div>
                            <div className="stat-card-value">{activeAccounts.length}</div>
                            <div className="stat-card-desc">dari {accounts.length} total akun</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-header">
                                <span className="stat-card-label">Total Konten</span>
                                <div className="stat-card-icon purple">📝</div>
                            </div>
                            <div className="stat-card-value">{totalContents}</div>
                            <div className="stat-card-desc">✅ {approvedContents} approved · ⏳ {pendingContents} pending</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-header">
                                <span className="stat-card-label">Total Live</span>
                                <div className="stat-card-icon red">🔴</div>
                            </div>
                            <div className="stat-card-value">{totalLives}</div>
                            <div className="stat-card-desc">✅ {approvedLives} approved · ⏳ {pendingLives} pending</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-header">
                                <span className="stat-card-label">Omzet Live</span>
                                <div className="stat-card-icon orange">💰</div>
                            </div>
                            <div className="stat-card-value" style={{ fontSize: '18px' }}>{fmt(totalOmzet)}</div>
                            <div className="stat-card-desc">👁️ {totalViewers.toLocaleString('id-ID')} viewers · ⏱️ {totalDuration} menit</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                        {/* Kreator Ranking */}
                        <div className="settings-section">
                            <h3 style={{ marginBottom: '12px', fontSize: '15px' }}>📝 Konten per Kreator</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {Object.entries(byCreator).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                                    <div key={name} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 12px', fontSize: '13px'
                                    }}>
                                        <span style={{ fontWeight: 500 }}>{name}</span>
                                        <span className="badge badge-purple">{count} konten</span>
                                    </div>
                                ))}
                                {Object.keys(byCreator).length === 0 && (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>Belum ada data</p>
                                )}
                            </div>
                        </div>

                        {/* Host Ranking */}
                        <div className="settings-section">
                            <h3 style={{ marginBottom: '12px', fontSize: '15px' }}>🔴 Performa Host Live</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {Object.entries(byHost).sort((a, b) => b[1].omzet - a[1].omzet).map(([name, data]) => (
                                    <div key={name} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 12px', fontSize: '13px'
                                    }}>
                                        <span>
                                            <span style={{ fontWeight: 500 }}>{name}</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({data.count}x live)</span>
                                        </span>
                                        <span style={{ fontWeight: 600, color: 'var(--success)' }}>{fmt(data.omzet)}</span>
                                    </div>
                                ))}
                                {Object.keys(byHost).length === 0 && (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>Belum ada data</p>
                                )}
                            </div>
                        </div>

                        {/* Recent Konten */}
                        <div className="settings-section">
                            <h3 style={{ marginBottom: '12px', fontSize: '15px' }}>🕐 Konten Terbaru</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {recentContents.map(c => (
                                    <div key={c.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 12px', fontSize: '13px'
                                    }}>
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 500 }}>{c.title || '-'}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {c.creator} · {c.platform} · {c.date ? new Date(c.date).toLocaleDateString('id-ID') : '-'}
                                            </div>
                                        </span>
                                        <span className={`badge ${c.validation_status === 'approved' ? 'badge-success' : c.validation_status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                                            {c.validation_status || 'pending'}
                                        </span>
                                    </div>
                                ))}
                                {recentContents.length === 0 && (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>Belum ada data</p>
                                )}
                            </div>
                        </div>

                        {/* Recent Live */}
                        <div className="settings-section">
                            <h3 style={{ marginBottom: '12px', fontSize: '15px' }}>🕐 Live Terbaru</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {recentLives.map(l => (
                                    <div key={l.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 12px', fontSize: '13px'
                                    }}>
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 500 }}>{l.host || '-'} · {l.account_name || '-'}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {l.platform} · {l.duration || 0} mnt · 👁️ {(l.viewers || 0).toLocaleString('id-ID')} · {l.date ? new Date(l.date).toLocaleDateString('id-ID') : '-'}
                                            </div>
                                        </span>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--success)', fontSize: '12px' }}>{fmt(l.revenue)}</div>
                                            <span className={`badge ${l.validation_status === 'approved' ? 'badge-success' : l.validation_status === 'rejected' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '10px' }}>
                                                {l.validation_status || 'pending'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {recentLives.length === 0 && (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>Belum ada data</p>
                                )}
                            </div>
                        </div>

                        {/* Platform Distribution */}
                        <div className="settings-section" style={{ gridColumn: 'span 2' }}>
                            <h3 style={{ marginBottom: '12px', fontSize: '15px' }}>📊 Distribusi Platform</h3>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).map(([platform, count]) => {
                                    const colorMap = { TikTok: '#fe2c55', Instagram: '#e1306c', YouTube: '#ff0000', Facebook: '#1877f2', Shopee: '#ee4d2d', 'Shopee Live': '#ee4d2d' }
                                    return (
                                        <div key={platform} style={{
                                            padding: '12px 20px', borderRadius: 'var(--radius-md)',
                                            background: `${colorMap[platform] || 'var(--primary)'}15`,
                                            border: `1px solid ${colorMap[platform] || 'var(--primary)'}40`,
                                            textAlign: 'center', minWidth: '120px'
                                        }}>
                                            <div style={{ fontSize: '20px', fontWeight: 800, color: colorMap[platform] || 'var(--primary)' }}>{count}</div>
                                            <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>{platform}</div>
                                        </div>
                                    )
                                })}
                                {Object.keys(byPlatform).length === 0 && (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px' }}>Belum ada data</p>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
