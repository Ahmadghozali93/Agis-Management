import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function fmt(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0)
}

export default function StokOverviewPage() {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => { loadProducts() }, [])

    async function loadProducts() {
        try {
            const [prodRes, mutRes, purRes, fcRes, retRes, salesRes, shippedRes] = await Promise.all([
                supabase.from('products').select('*').order('name'),
                supabase.from('stock_mutations').select('product_name, sku, type, qty'),
                supabase.from('purchases').select('items, status').neq('status', 'batal'),
                supabase.from('tiktok_failed_cod').select('order_id, return_status'),
                supabase.from('tiktok_returns').select('order_id, status'),
                supabase.from('tiktok_sales')
                    .select('order_id, order_status, product_name, seller_sku, quantity')
                    .or('order_status.ilike.%RTS%,order_status.ilike.%Failed%,order_status.ilike.%Gagal%,order_status.ilike.%Return%,order_status.ilike.%Retur%'),
                supabase.from('tiktok_sales')
                    .select('product_name, seller_sku, quantity, order_status')
                    .or('order_status.ilike.%Dikirim%,order_status.ilike.%Shipping%,order_status.ilike.%In Transit%,order_status.ilike.%Shipped%,order_status.ilike.%Dalam Pengiriman%')
            ])
            if (prodRes.error) throw prodRes.error
            if (mutRes.error) throw mutRes.error

            const mutations = mutRes.data || []
            const shippedSales = shippedRes?.data || []

            // Extract all purchased items for HPP calculation
            const allPurchasedItems = []
                ; (purRes.data || []).forEach(p => {
                    let pItems = p.items
                    if (typeof pItems === 'string') {
                        try { pItems = JSON.parse(pItems) } catch (e) { pItems = [] }
                    }
                    if (Array.isArray(pItems)) {
                        allPurchasedItems.push(...pItems)
                    }
                })

            const fcMap = new Map()
                ; (fcRes?.data || []).forEach(f => fcMap.set(f.order_id, (f.return_status || '').toLowerCase()))

            const retMap = new Map()
                ; (retRes?.data || []).forEach(r => retMap.set(r.order_id, (r.status || '').toLowerCase()))

            const isDone = s => ['selesai', 'completed', 'done', 'selesai otomatis'].includes(s)

            const activeReturnSales = (salesRes?.data || []).filter(s => {
                const fcStatus = fcMap.get(s.order_id)
                const retStatus = retMap.get(s.order_id)
                if (fcStatus && isDone(fcStatus)) return false
                if (retStatus && isDone(retStatus)) return false
                return true
            })

            const computedProducts = (prodRes.data || []).map(p => {
                // Calculate dynamic stock
                const prodMutations = mutations.filter(m => m.sku ? m.sku === p.sku : m.product_name === p.name)
                const computedStock = prodMutations.reduce((sum, m) => {
                    const q = Number(m.qty) || 0
                    return m.type === 'in' ? sum + q : sum - q
                }, 0)

                // Calculate HPP: (HPP produk + HPP rata2 pembelian) / 2
                const baseHpp = p.hpp || 0
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
                // Jika ada pembelian: rata-rata dari HPP produk dan HPP pembelian
                // Jika belum ada pembelian: pakai HPP produk
                const avgHpp = purchaseHpp > 0 ? Math.round((baseHpp + purchaseHpp) / 2) : baseHpp

                // Calculate Return in process
                const prodReturns = activeReturnSales.filter(s => s.seller_sku ? s.seller_sku === p.sku : s.product_name === p.name)
                const returnQty = prodReturns.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)

                const endingStock = computedStock + returnQty
                const stockValue = endingStock * avgHpp

                // Calculate shipped qty
                const prodShipped = shippedSales.filter(s => s.seller_sku ? s.seller_sku === p.sku : s.product_name === p.name)
                const shippedQty = prodShipped.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)

                return {
                    ...p,
                    stock: computedStock,
                    avg_hpp: avgHpp,
                    return_qty: returnQty,
                    shipped_qty: shippedQty,
                    ending_stock: endingStock,
                    stock_value: stockValue
                }
            })

            setProducts(computedProducts)
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
                <div className="stat-card" style={{ gridColumn: 'span 2', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <div className="stat-card-header">
                        <span className="stat-card-label" style={{ fontWeight: 'bold' }}>Total Valuasi Stok (Ending x HPP)</span>
                        <div className="stat-card-icon" style={{ background: 'var(--primary-color)', color: 'white' }}>💎</div>
                    </div>
                    <div className="stat-card-value">{fmt(filtered.reduce((sum, p) => sum + (p.stock_value || 0), 0))}</div>
                </div>
                <div className="stat-card" style={{ gridColumn: 'span 2', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <div className="stat-card-header">
                        <span className="stat-card-label" style={{ fontWeight: 'bold' }}>Total Stok Return (Qty)</span>
                        <div className="stat-card-icon" style={{ background: 'var(--warning-color, #f59e0b)', color: 'white' }}>🔁</div>
                    </div>
                    <div className="stat-card-value">{(filtered.reduce((sum, p) => sum + (p.return_qty || 0), 0)).toLocaleString('id-ID')}</div>
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
                                    <th>Produk & SKU</th>
                                    <th style={{ textAlign: 'right' }}>HPP Rata-rata</th>
                                    <th style={{ textAlign: 'right' }}>Stok Gudang</th>
                                    <th style={{ textAlign: 'right' }}>Dikirim</th>
                                    <th style={{ textAlign: 'right' }}>Return (Proses)</th>
                                    <th style={{ textAlign: 'right' }}>Ending Stock</th>
                                    <th style={{ textAlign: 'right' }}>Total Valuasi</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((p, i) => (
                                    <tr key={p.id}>
                                        <td>{i + 1}</td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>{p.sku || '-'}</div>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(p.avg_hpp)}</td>
                                        <td style={{ fontWeight: 700, textAlign: 'right' }}>{(p.stock || 0).toLocaleString('id-ID')}</td>
                                        <td style={{ fontWeight: 600, textAlign: 'right', color: 'var(--info, #3b82f6)' }}>{(p.shipped_qty || 0).toLocaleString('id-ID')}</td>
                                        <td style={{ fontWeight: 600, textAlign: 'right', color: 'var(--text-warning)' }}>{(p.return_qty || 0).toLocaleString('id-ID')}</td>
                                        <td style={{ fontWeight: 700, textAlign: 'right', color: 'var(--primary-color)' }}>{(p.ending_stock || 0).toLocaleString('id-ID')}</td>
                                        <td style={{ fontWeight: 600, textAlign: 'right' }}>{fmt(p.stock_value)}</td>
                                        <td>{getStockStatus(p.ending_stock)}</td>
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
