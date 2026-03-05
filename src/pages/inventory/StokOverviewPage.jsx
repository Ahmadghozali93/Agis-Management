import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function StokOverviewPage() {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => { loadProducts() }, [])

    async function loadProducts() {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name')
            if (error) throw error
            setProducts(data || [])
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    const filtered = products.filter(p =>
        !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
    )

    function getStockStatus(stock) {
        if (stock <= 0) return <span className="badge badge-danger">Habis</span>
        if (stock <= 10) return <span className="badge badge-warning">Rendah</span>
        return <span className="badge badge-success">Tersedia</span>
    }

    return (
        <div>
            <div className="page-header">
                <h1>📊 Stok Overview</h1>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">Total Produk</span>
                        <div className="stat-card-icon purple">📦</div>
                    </div>
                    <div className="stat-card-value">{products.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">Stok Tersedia</span>
                        <div className="stat-card-icon green">✅</div>
                    </div>
                    <div className="stat-card-value">{products.filter(p => p.stock > 10).length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">Stok Rendah</span>
                        <div className="stat-card-icon orange">⚠️</div>
                    </div>
                    <div className="stat-card-value">{products.filter(p => p.stock > 0 && p.stock <= 10).length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label">Stok Habis</span>
                        <div className="stat-card-icon red">🚫</div>
                    </div>
                    <div className="stat-card-value">{products.filter(p => p.stock <= 0).length}</div>
                </div>
            </div>

            <div className="table-container">
                <div className="table-toolbar">
                    <div className="table-search">
                        🔍
                        <input placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{filtered.length} produk</span>
                </div>
                <div className="table-wrapper">
                    {loading ? (
                        <div className="empty-state"><div className="spinner"></div><p>Memuat...</p></div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">📭</div><p>Belum ada produk</p></div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>Produk</th>
                                    <th>SKU</th>
                                    <th>Stok</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((p, i) => (
                                    <tr key={p.id}>
                                        <td>{i + 1}</td>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                                        <td>{p.sku || '-'}</td>
                                        <td style={{ fontWeight: 700 }}>{(p.stock || 0).toLocaleString('id-ID')}</td>
                                        <td>{getStockStatus(p.stock)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
