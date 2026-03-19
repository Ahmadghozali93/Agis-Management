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
            const [prodRes, mutRes, fcRes, retRes, salesRes, mengantarRes, mengantarRetRes] = await Promise.all([
                supabase.from('products').select('*').order('name'),
                supabase.from('stock_mutations').select('product_name, sku, type, qty, hpp, reference_id, note'),
                supabase.from('tiktok_failed_cod').select('order_id, return_status'),
                supabase.from('tiktok_returns').select('order_id, status'),
                supabase.from('tiktok_sales').select('order_id, order_status, product_name, seller_sku, quantity'),
                supabase.from('mengantar_sales').select('tracking_id, order_id, last_status, goods_description, quantity, product_id'),
                supabase.from('mengantar_returns').select('tracking_id, return_status')
            ])
            if (prodRes.error) throw prodRes.error
            if (mutRes.error) throw mutRes.error

            const mutations = mutRes.data || []
            const sales = salesRes.data || []
            const mengantarSales = mengantarRes.data || []

            // Build mengantar return map: tracking_id → return_status (lowercase)
            const mengantarReturnMap = new Map()
            ;(mengantarRetRes?.data || []).forEach(r => mengantarReturnMap.set(r.tracking_id, (r.return_status || '').toLowerCase()))


            // Extract all purchased items for HPP calculation
            // Removed: Average HPP is now calculated from stock_mutations (type: 'in')

            const fcMap = new Map()
                ; (fcRes?.data || []).forEach(f => fcMap.set(f.order_id, (f.return_status || '').toLowerCase()))

            const retMap = new Map()
                ; (retRes?.data || []).forEach(r => retMap.set(r.order_id, (r.status || '').toLowerCase()))

            const isResolutionDone = s => ['selesai', 'completed', 'done', 'selesai otomatis'].includes(s)

            const isCompleted = os => ['completed', 'delivered', 'done', 'selesai', 'selesai otomatis'].includes((os || '').toLowerCase())
            const isFailedCod = os => {
                const lower = (os || '').toLowerCase()
                return lower === 'rts' || lower === 'failed cod' || lower.includes('gagal') || lower === 'delivery failed'
            }
            const isReturn = os => {
                const lower = (os || '').toLowerCase()
                return lower === 'return' || lower === 'retur' || lower === 'returned'
            }
            const isBatal = os => {
                const lower = (os || '').toLowerCase()
                return lower === 'batal' || lower === 'cancelled' || lower === 'canceled' || lower === 'unpaid' || lower === 'belum dibayar' || lower === 'awaiting payment'
            }

            const computedProducts = (prodRes.data || []).map(p => {
                // 1. Total Raw Mutations
                const prodMutations = mutations.filter(m => m.sku ? m.sku === p.sku : m.product_name === p.name)
                const totalMutasi = prodMutations.reduce((sum, m) => {
                    const q = Number(m.qty) || 0
                    return m.type === 'in' ? sum + q : sum - q
                }, 0)

                // 2. Tally Sales
                const prodSales = sales.filter(s => s.seller_sku ? s.seller_sku === p.sku : s.product_name === p.name)

                let dikirimQty = 0
                let rtsProsesQty = 0
                let dynamicDeductionsQty = 0

                prodSales.forEach(s => {
                    if (isBatal(s.order_status)) return // Ignored completely, stock never moved

                    const qty = Number(s.quantity) || 0
                    const isFC = isFailedCod(s.order_status)
                    const isRet = isReturn(s.order_status)

                    const hasOutMutation = prodMutations.some(m =>
                        m.type === 'out' && ((m.reference_id && m.reference_id === s.order_id) || (m.note && m.note.includes(s.order_id)))
                    )
                    const hasInMutation = prodMutations.some(m =>
                        m.type === 'in' && ((m.reference_id && m.reference_id === s.order_id) || (m.note && m.note.includes(s.order_id)))
                    )

                    if (isFC) {
                        const rStatus = (fcMap.get(s.order_id) || 'diproses').toLowerCase()
                        if (rStatus === 'diproses') {
                            rtsProsesQty += qty // processing RTS
                        } else if (rStatus === 'diterima') {
                            if (hasInMutation) dynamicDeductionsQty += qty // Cancel out the explicit 'in' mutation to balance warehouse stock
                        } else if (rStatus === 'hilang') {
                            if (!hasOutMutation) dynamicDeductionsQty += qty // Item lost, needs dynamic deduction if no explicit out
                        } else if (isCompleted(s.order_status)) {
                            if (!hasOutMutation) dynamicDeductionsQty += qty
                        }
                    } else if (isRet) {
                        const rStatus = (retMap.get(s.order_id) || 'diproses').toLowerCase()
                        if (rStatus === 'diproses') {
                            rtsProsesQty += qty // in transit back to warehouse
                        } else if (rStatus === 'diterima') {
                            if (hasInMutation) dynamicDeductionsQty += qty
                        } else if (rStatus === 'hilang') {
                            if (!hasOutMutation) dynamicDeductionsQty += qty
                        }
                    } else if (isCompleted(s.order_status)) {
                        if (!hasOutMutation) dynamicDeductionsQty += qty // Order completely sold but no DB mutation yet
                    } else {
                        dikirimQty += qty // Processing, To Ship, Shipped, In Transit (active orders)
                    }
                })

                // 2b. Tally Mengantar Sales
                // Match by product_id (SKU) first, fallback to goods_description (name)
                const prodMengantarSales = mengantarSales.filter(s => {
                    if (s.product_id && p.sku) {
                        return s.product_id.toLowerCase().trim() === p.sku.toLowerCase().trim()
                    }
                    if (s.goods_description && p.name) {
                        return s.goods_description.toLowerCase().trim() === p.name.toLowerCase().trim()
                    }
                    return false
                })

                prodMengantarSales.forEach(s => {
                    const qty = Number(s.quantity) || 0
                    const status = (s.last_status || '').toLowerCase()
                    const refId = s.tracking_id || s.order_id

                    const hasOutMutation = prodMutations.some(m =>
                        m.type === 'out' &&
                        ((m.reference_id && m.reference_id === refId) || (m.note && refId && m.note.includes(refId)))
                    )
                    const hasInMutation = prodMutations.some(m =>
                        m.type === 'in' &&
                        ((m.reference_id && m.reference_id === refId) || (m.note && refId && m.note.includes(refId)))
                    )

                    if (status === 'selesai' || status === 'completed' || status === 'done') {
                        // Selesai: deduct from stock (if DB trigger hasn't already recorded it)
                        if (!hasOutMutation) dynamicDeductionsQty += qty

                    } else if (status === 'rts') {
                        // RTS: check return resolution status
                        const rStatus = mengantarReturnMap.get(s.tracking_id) || 'diproses'

                        if (rStatus === 'diproses') {
                            // Still in RTS processing → show in 'RTS Proses' column
                            rtsProsesQty += qty
                        } else if (rStatus === 'diterima') {
                            // Cancel out the explicit 'in' mutation to balance warehouse stock
                            if (hasInMutation) dynamicDeductionsQty += qty
                        } else if (rStatus === 'hilang') {
                            // Lost during return → permanent stock out
                            if (!hasOutMutation) dynamicDeductionsQty += qty
                        }

                    } else if (status === 'dibatalkan' || status === 'batal' || status === 'cancelled') {
                        // Cancelled: ignore, stock never moved
                        return
                    } else {
                        // Any active status (Dikirim, proses, etc.): stock is in transit
                        dikirimQty += qty
                    }
                })


                // 3. Current physical inventory in warehouse
                const stokGudang = totalMutasi - dynamicDeductionsQty - dikirimQty - rtsProsesQty

                // 4. Total overall inventory we own (Warehouse + Transit + Back to us)
                const endingStock = stokGudang + dikirimQty + rtsProsesQty

                // 5. Calculate HPP
                const baseHpp = Number(p.hpp) || 0
                const inMutations = prodMutations.filter(m => {
                    if (m.type !== 'in') return false
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

                const stockValue = endingStock * avgHpp

                return {
                    ...p,
                    stock: stokGudang,
                    avg_hpp: avgHpp,
                    return_qty: rtsProsesQty,
                    shipped_qty: dikirimQty,
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
                        <span className="stat-card-label" style={{ fontWeight: 'bold' }}>Valuasi Stok</span>
                        <div className="stat-card-icon purple">💎</div>
                    </div>
                    <div className="stat-card-value">{fmt(filtered.reduce((sum, p) => sum + (p.stock_value || 0), 0))}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label" style={{ fontWeight: 'bold' }}>Stok Gudang</span>
                        <div className="stat-card-icon green">🏕️</div>
                    </div>
                    <div className="stat-card-value">{(filtered.reduce((sum, p) => sum + (p.stock || 0), 0)).toLocaleString('id-ID')}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label" style={{ fontWeight: 'bold' }}>Dikirim</span>
                        <div className="stat-card-icon" style={{ background: 'var(--info-bg, rgba(59, 130, 246, 0.1))', color: '#3b82f6' }}>🚚</div>
                    </div>
                    <div className="stat-card-value">{(filtered.reduce((sum, p) => sum + (p.shipped_qty || 0), 0)).toLocaleString('id-ID')}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-card-label" style={{ fontWeight: 'bold' }}>Return (Proses)</span>
                        <div className="stat-card-icon orange" style={{ background: 'var(--warning-color, #f59e0b)', color: 'white' }}>🔁</div>
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
