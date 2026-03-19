import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { getAverageHpp } from '../../lib/stockUtils'

function fmtDate(d) {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtCurrency(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0)
}

const ITEMS_PER_PAGE = 20

export default function StokMutationPage() {
    const [mutations, setMutations] = useState([])
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [error, setError] = useState(null)

    // Filters
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState('all')
    const [filterDateStart, setFilterDateStart] = useState('')
    const [filterDateEnd, setFilterDateEnd] = useState('')

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)

    // Form State
    const [id, setId] = useState('')
    const [productName, setProductName] = useState('')
    const [productSku, setProductSku] = useState('')
    const [type, setType] = useState('in')
    const [qty, setQty] = useState('')
    const [hpp, setHpp] = useState('')
    const [referenceId, setReferenceId] = useState('')
    const [note, setNote] = useState('')
    const [date, setDate] = useState(new Date().toISOString().substring(0, 10))

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        const [mutRes, prodRes, purRes] = await Promise.all([
            supabase.from('stock_mutations').select('*').order('created_at', { ascending: false }),
            supabase.from('products').select('*').order('name'),
            supabase.from('purchases').select('items, status').neq('status', 'batal')
        ])

        let allPurchasedItems = []
        if (purRes?.data) {
            purRes.data.forEach(p => {
                let pItems = p.items
                if (typeof pItems === 'string') {
                    try { pItems = JSON.parse(pItems) } catch (e) { pItems = [] }
                }
                if (Array.isArray(pItems)) {
                    allPurchasedItems.push(...pItems)
                }
            })
        }

        const computedProducts = (prodRes?.data || []).map(p => {
            const baseHpp = Number(p.hpp) || 0
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
            const avgHpp = purchaseHpp > 0 ? purchaseHpp : baseHpp

            return { ...p, avg_hpp: avgHpp }
        })

        if (mutRes?.data) {
            const mappedMutations = mutRes.data.map(m => {
                const prod = computedProducts.find(p => (m.sku && p.sku === m.sku) || p.name === m.product_name)
                // Mutasi Masuk (termasuk dari Pembelian) harus menampilkan Harga Satuan asli (m.hpp).
                // Mutasi Keluar (penjualan/retur) menggunakan HPP Rata-rata dinamis.
                const isMasuk = m.type === 'in'
                const displayHpp = isMasuk ? m.hpp : (prod ? prod.avg_hpp : m.hpp)
                return { ...m, display_hpp: displayHpp }
            })
            setMutations(mappedMutations)
        }
        setProducts(computedProducts)
        setLoading(false)
    }

    async function syncProductStock(skuToSync) {
        if (!skuToSync) return
        const { data: mutRes } = await supabase.from('stock_mutations').select('type, qty').eq('sku', skuToSync)
        if (!mutRes) return
        const newStock = mutRes.reduce((acc, curr) => {
            const q = Number(curr.qty) || 0
            return curr.type === 'in' ? acc + q : acc - q
        }, 0)
        await supabase.from('products').update({ stock: newStock }).eq('sku', skuToSync)
    }

    const openCreate = () => {
        setId(''); setProductName(''); setProductSku(''); setType('in')
        setQty(''); setHpp(''); setReferenceId(''); setNote('')
        setDate(new Date().toISOString().substring(0, 10))
        setShowForm(true)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setError(null)
        try {
            let finalHpp = type === 'in' ? (Number(hpp) || 0) : null
            if (!finalHpp) finalHpp = await getAverageHpp(productSku, productName)
            const payload = { product_name: productName, sku: productSku, type, qty: Number(qty), hpp: finalHpp, reference_id: referenceId, note, date }
            if (id) {
                const { error } = await supabase.from('stock_mutations').update(payload).eq('id', id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('stock_mutations').insert([payload])
                if (error) throw error
            }
            await syncProductStock(productSku)
            setShowForm(false)
            loadData()
        } catch (err) {
            setError(err.message)
        }
    }

    // --- Filtering + Pagination ---
    const filtered = useMemo(() => {
        let data = [...mutations]
        if (search.trim()) {
            const q = search.toLowerCase()
            data = data.filter(m =>
                (m.product_name || '').toLowerCase().includes(q) ||
                (m.sku || '').toLowerCase().includes(q) ||
                (m.reference_id || '').toLowerCase().includes(q) ||
                (m.note || '').toLowerCase().includes(q)
            )
        }
        if (filterType !== 'all') data = data.filter(m => m.type === filterType)
        if (filterDateStart) data = data.filter(m => m.date >= filterDateStart)
        if (filterDateEnd) data = data.filter(m => m.date <= filterDateEnd)
        return data
    }, [mutations, search, filterType, filterDateStart, filterDateEnd])

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    const totalIn = filtered.filter(m => m.type === 'in').reduce((s, m) => s + (Number(m.qty) || 0), 0)
    const totalOut = filtered.filter(m => m.type === 'out').reduce((s, m) => s + (Number(m.qty) || 0), 0)

    const resetFilters = () => {
        setSearch(''); setFilterType('all'); setFilterDateStart(''); setFilterDateEnd('')
        setCurrentPage(1)
    }

    return (
        <div className="page-container" style={{ padding: '20px' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>🔄 Stok Mutasi</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manajemen barang masuk dan barang keluar.</p>
                </div>
                {!showForm && (
                    <button className="btn btn-primary" onClick={openCreate}>+ Catat Mutasi</button>
                )}
            </div>

            {showForm ? (
                <div className="card">
                    <form onSubmit={handleSave}>
                        <h3 style={{ marginBottom: '20px' }}>{id ? 'Edit Mutasi' : 'Catat Mutasi Baru'}</h3>
                        {error && <div className="alert alert-danger" style={{ marginBottom: '20px' }}>{error}</div>}

                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label>Produk</label>
                            <select className="form-input" value={productSku}
                                onChange={e => { const val = e.target.value; setProductSku(val); const prod = products.find(p => p.sku === val); if (prod) setProductName(prod.name); }}
                                required>
                                <option value="">-- Pilih Produk --</option>
                                {products.map(p => (
                                    <option key={p.sku || p.name} value={p.sku}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: type === 'in' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div className="form-group">
                                <label>Tipe Mutasi</label>
                                <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
                                    <option value="in">Masuk (In)</option>
                                    <option value="out">Keluar (Out)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Jumlah</label>
                                <input type="number" className="form-input" value={qty} onChange={e => setQty(e.target.value)} required min="1" />
                            </div>
                            {type === 'in' && (
                                <div className="form-group">
                                    <label>HPP / Unit</label>
                                    <input type="number" className="form-input" value={hpp} onChange={e => setHpp(e.target.value)} placeholder="Harga pokok per unit" min="0" />
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            <div className="form-group">
                                <label>ID / No. Order</label>
                                <input type="text" className="form-input" value={referenceId} onChange={e => setReferenceId(e.target.value)} placeholder="Misal: INV-001" />
                            </div>
                            <div className="form-group">
                                <label>Catatan</label>
                                <input type="text" className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Alasan mutasi..." />
                            </div>
                            <div className="form-group">
                                <label>Tanggal</label>
                                <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
                            <button type="submit" className="btn btn-primary">Simpan Mutasi</button>
                        </div>
                    </form>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                        <div className="stat-card">
                            <div className="stat-card-label">Total Data</div>
                            <div className="stat-card-value">{filtered.length} mutasi</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-label" style={{ color: 'var(--success)' }}>Total Masuk</div>
                            <div className="stat-card-value" style={{ color: 'var(--success)' }}>+{totalIn} pcs</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-label" style={{ color: 'var(--danger)' }}>Total Keluar</div>
                            <div className="stat-card-value" style={{ color: 'var(--danger)' }}>-{totalOut} pcs</div>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="🔍 Cari produk, SKU, referensi, catatan..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                                style={{ flex: '1', minWidth: '200px' }}
                            />
                            <select className="form-input" value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1) }} style={{ width: '140px' }}>
                                <option value="all">Semua Tipe</option>
                                <option value="in">Masuk (In)</option>
                                <option value="out">Keluar (Out)</option>
                            </select>
                            <input type="date" className="form-input" value={filterDateStart}
                                onChange={e => { setFilterDateStart(e.target.value); setCurrentPage(1) }}
                                style={{ width: '145px' }} title="Filter dari tanggal"
                            />
                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>s/d</span>
                            <input type="date" className="form-input" value={filterDateEnd}
                                onChange={e => { setFilterDateEnd(e.target.value); setCurrentPage(1) }}
                                style={{ width: '145px' }} title="Filter sampai tanggal"
                            />
                            {(search || filterType !== 'all' || filterDateStart || filterDateEnd) && (
                                <button className="btn btn-secondary" onClick={resetFilters} style={{ whiteSpace: 'nowrap' }}>✕ Reset</button>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-responsive">
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                    <tr>
                                        <th style={{ padding: '16px', textAlign: 'left' }}>Tanggal</th>
                                        <th style={{ padding: '16px', textAlign: 'left' }}>Produk</th>
                                        <th style={{ padding: '16px', textAlign: 'left' }}>Ref ID</th>
                                        <th style={{ padding: '16px', textAlign: 'center' }}>Tipe</th>
                                        <th style={{ padding: '16px', textAlign: 'center' }}>Jumlah</th>
                                        <th style={{ padding: '16px', textAlign: 'right' }}>HPP/Unit</th>
                                        <th style={{ padding: '16px', textAlign: 'left' }}>Catatan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></td></tr>
                                    ) : paginated.length === 0 ? (
                                        <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            {filtered.length === 0 && mutations.length > 0 ? 'Tidak ada data yang cocok dengan filter.' : 'Belum ada data mutasi stok'}
                                        </td></tr>
                                    ) : (
                                        paginated.map(m => (
                                            <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '16px' }}>{fmtDate(m.date)}</td>
                                                <td style={{ padding: '16px', fontWeight: 600 }}>
                                                    {m.product_name}
                                                    {m.sku && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.sku}</div>}
                                                </td>
                                                <td style={{ padding: '16px', fontSize: '12px', fontFamily: 'monospace' }}>{m.reference_id || '-'}</td>
                                                <td style={{ padding: '16px', textAlign: 'center' }}>
                                                    <span className={`badge ${m.type === 'in' ? 'badge-success' : 'badge-danger'}`}>
                                                        {m.type === 'in' ? 'Masuk' : 'Keluar'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold', color: m.type === 'in' ? 'var(--success)' : 'var(--danger)' }}>
                                                    {m.type === 'in' ? '+' : '-'}{m.qty}
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'right', color: 'var(--text-primary)' }}>
                                                    {m.display_hpp !== null && m.display_hpp !== undefined ? fmtCurrency(m.display_hpp) : '-'}
                                                </td>
                                                <td style={{ padding: '16px' }}>{m.note || '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    Halaman {currentPage} dari {totalPages} ({filtered.length} data)
                                </span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹ Prev</button>
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let page = i + 1
                                        if (totalPages > 5) {
                                            if (currentPage <= 3) page = i + 1
                                            else if (currentPage >= totalPages - 2) page = totalPages - 4 + i
                                            else page = currentPage - 2 + i
                                        }
                                        return (
                                            <button key={page} className={`btn ${currentPage === page ? 'btn-primary' : 'btn-secondary'}`}
                                                style={{ padding: '6px 10px', fontSize: '12px', minWidth: '32px' }}
                                                onClick={() => setCurrentPage(page)}>{page}</button>
                                        )
                                    })}
                                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next ›</button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
