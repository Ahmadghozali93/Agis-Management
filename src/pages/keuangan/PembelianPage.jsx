import { useState, useEffect, Fragment } from 'react'
import { supabase } from '../../lib/supabase'

function fmt(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num || 0)
}

function fmtDate(d) {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PembelianPage() {
    const [purchases, setPurchases] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [error, setError] = useState(null)

    // Form states
    const [editingId, setEditingId] = useState(null)
    const [purchaseNo, setPurchaseNo] = useState('')
    const [supplierName, setSupplierName] = useState('')
    const [status, setStatus] = useState('belum_lunas')
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().substring(0, 10))
    const [items, setItems] = useState([]) // { product_id, name, sku, qty, price, subtotal }

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('')
    const [filterSupplier, setFilterSupplier] = useState('')
    const [filterProduct, setFilterProduct] = useState('')

    // Options
    const [suppliers, setSuppliers] = useState([])
    const [products, setProducts] = useState([])

    // Expanded rows
    const [expandedRows, setExpandedRows] = useState(new Set())

    const toggleRow = (id) => {
        const newSet = new Set(expandedRows)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setExpandedRows(newSet)
    }

    useEffect(() => {
        loadData()
        loadOptions()
    }, [])

    async function loadOptions() {
        const [suppRes, prodRes] = await Promise.all([
            supabase.from('suppliers').select('name').order('name'),
            supabase.from('products').select('id, name, sku, hpp').order('name')
        ])
        if (suppRes.data) setSuppliers(suppRes.data)
        if (prodRes.data) setProducts(prodRes.data)
    }

    async function loadData() {
        setLoading(true)
        const { data, error } = await supabase.from('purchases').select('*').order('created_at', { ascending: false })
        if (error) console.error(error)
        else {
            const parsedData = (data || []).map(p => {
                let parsedItems = p.items;
                if (typeof parsedItems === 'string') {
                    try { parsedItems = JSON.parse(parsedItems) } catch (e) { parsedItems = [] }
                }
                return { ...p, items: Array.isArray(parsedItems) ? parsedItems : [] }
            })
            setPurchases(parsedData)
        }
        setLoading(false)
    }

    const handleAddItem = () => {
        setItems([...items, { product_id: '', name: '', sku: '', qty: 1, price: 0, subtotal: 0 }])
    }

    const handleRemoveItem = (idx) => {
        setItems(items.filter((_, i) => i !== idx))
    }

    const handleItemChange = (idx, field, value) => {
        const newItems = [...items]
        if (field === 'product_id') {
            const p = products.find(x => x.id === value)
            if (p) {
                newItems[idx] = { ...newItems[idx], product_id: p.id, name: p.name, sku: p.sku, price: p.hpp || 0 }
            } else {
                newItems[idx] = { ...newItems[idx], product_id: '', name: '', sku: '', price: 0 }
            }
        } else {
            newItems[idx][field] = value
        }

        // Recalculate subtotal
        if (field === 'qty' || field === 'price' || field === 'product_id') {
            newItems[idx].subtotal = Number(newItems[idx].qty) * Number(newItems[idx].price)
        }
        setItems(newItems)
    }

    const totalPurchase = items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0)

    const openCreate = () => {
        setEditingId(null)

        // Generate automatic purchase number (PCH-YYYYMMDD-XXXX)
        const dateStr = new Date().toISOString().substring(0, 10).replace(/-/g, '')
        const randomNum = Math.floor(1000 + Math.random() * 9000)
        setPurchaseNo(`PCH-${dateStr}-${randomNum}`)

        setSupplierName('')
        setStatus('belum_lunas')
        setPurchaseDate(new Date().toISOString().substring(0, 10))
        setItems([{ product_id: '', name: '', sku: '', qty: 1, price: 0, subtotal: 0 }])
        setShowForm(true)
        setError(null)
    }

    const openEdit = (p) => {
        setEditingId(p.id)
        setPurchaseNo(p.purchase_no || '')
        setSupplierName(p.supplier_name || '')
        setStatus(p.status || 'belum_lunas')
        setPurchaseDate(p.date ? p.date.substring(0, 10) : new Date().toISOString().substring(0, 10))
        setItems(p.items || [])
        setShowForm(true)
        setError(null)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        if (items.length === 0) return setError("Minimal pilih 1 item.")
        if (items.some(i => !i.product_id)) return setError("Semua item harus memilih produk.")
        if (items.some(i => i.qty <= 0)) return setError("Quantity tidak boleh 0.")

        try {
            const payload = {
                purchase_no: purchaseNo,
                supplier_name: supplierName,
                items,
                total: totalPurchase,
                status,
                date: purchaseDate
            }

            let savedId = editingId
            let oldStatus = 'belum_lunas'
            let oldItems = []

            if (editingId) {
                // Get old data mainly to check status change
                const oldPurchase = purchases.find(p => p.id === editingId)
                if (oldPurchase) {
                    oldStatus = oldPurchase.status
                    oldItems = oldPurchase.items || []
                }
                const { error } = await supabase.from('purchases').update(payload).eq('id', editingId)
                if (error) throw error
            } else {
                const { data, error } = await supabase.from('purchases').insert([payload]).select()
                if (error) throw error
                savedId = data[0].id
            }

            // --- STOCK & EXPENSE SYNC LOGIC ---
            if (status === 'lunas' && oldStatus !== 'lunas') {
                await syncToStock(items, 'in', `Pembelian dari ${supplierName}`)
                await syncToExpense(payload)
            } else if (status === 'batal' && oldStatus === 'lunas') {
                await syncToStock(oldItems, 'out', `Pembatalan Pembelian dari ${supplierName}`)
            }

            setShowForm(false)
            loadData()
        } catch (err) {
            setError(err.message)
        }
    }

    const handleDelete = async (id, currentStatus, currentItems) => {
        if (!confirm("Yakin ingin menghapus pembelian ini?")) return
        try {
            if (currentStatus === 'lunas') {
                await syncToStock(currentItems, 'out', `Penghapusan Pembelian (revert)`)
            }
            const { error } = await supabase.from('purchases').delete().eq('id', id)
            if (error) throw error
            loadData()
        } catch (err) {
            alert(err.message)
        }
    }

    async function syncToStock(itemsArray, type, reason) {
        if (!itemsArray || itemsArray.length === 0) return

        const mutasiPayload = itemsArray.map(item => ({
            product_name: item.name,
            sku: item.sku,
            type: type,
            qty: item.qty,
            note: reason,
            date: new Date().toISOString()
        }))
        await supabase.from('stock_mutations').insert(mutasiPayload)

        for (const item of itemsArray) {
            const { data: prodData } = await supabase.from('products').select('stock').eq('id', item.product_id).single()
            if (prodData) {
                const currentStock = Number(prodData.stock) || 0
                const diff = type === 'in' ? Number(item.qty) : -Number(item.qty)
                await supabase.from('products').update({ stock: currentStock + diff }).eq('id', item.product_id)
            }
        }
    }

    async function syncToExpense({ supplier_name, total, date }) {
        await supabase.from('expenses').insert([{
            category: 'Pembelian Barang',
            description: `Pembelian stok dari supplier ${supplier_name}`,
            amount: total,
            date: date
        }])
    }

    const getStatusBadge = (s) => {
        if (s === 'lunas') return <span className="badge badge-success">Lunas</span>
        if (s === 'pending') return <span className="badge badge-warning" style={{ background: '#fef08a', color: '#854d0e' }}>Pending (Belum Bayar)</span>
        if (s === 'belum_lunas') return <span className="badge badge-warning">Belum Lunas</span>
        if (s === 'batal') return <span className="badge badge-danger">Batal</span>
        return <span>{s}</span>
    }

    const totalBelumLunas = purchases.filter(p => ['belum_lunas', 'pending'].includes(p.status)).reduce((sum, p) => sum + Number(p.total || 0), 0)

    const handleValidatePurchase = async (p) => {
        if (!confirm(`Validasi pembelian ini? Stok produk akan otomatis bertambah, namun status pembayaran menjadi Pending.\nTotal Pembayaran: ${fmt(p.total)}`)) return

        try {
            const { error } = await supabase.from('purchases').update({ status: 'pending' }).eq('id', p.id)
            if (error) throw error

            await syncToStock(p.items || [], 'in', `Pembelian dari ${p.supplier_name} (${p.purchase_no || ''})`)
            // Hilangkan syncToExpense dari sini, karena expense baru dicatat saat dibayar rill di menu Pembayaran.

            loadData()
        } catch (err) {
            alert(err.message)
        }
    }

    // --- Data Filtering ---
    const filteredPurchases = purchases.filter(p => {
        let match = true

        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            const matchSupplier = p.supplier_name?.toLowerCase().includes(term)
            const matchNo = p.purchase_no?.toLowerCase().includes(term)
            if (!matchSupplier && !matchNo) match = false
        }

        if (filterSupplier && p.supplier_name !== filterSupplier) match = false

        if (filterProduct) {
            const hasProduct = p.items?.some(it => it.product_id === filterProduct || it.name === filterProduct)
            if (!hasProduct) match = false
        }

        return match
    })

    return (
        <div className="page-container" style={{ padding: '20px' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>🛍️ Pembelian Stok</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Kelola data pembelian dan re-stok produk ke supplier</p>
                </div>
                {!showForm && (
                    <button className="btn btn-primary" onClick={openCreate}>+ Tambah Pembelian</button>
                )}
            </div>

            {!showForm && (
                <div className="stats-grid" style={{ marginBottom: '24px' }}>
                    <div className="stat-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="stat-card-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>💳</div>
                            <div>
                                <p className="stat-card-label" style={{ margin: '0 0 2px 0' }}>Total Pembelian Belum Lunas</p>
                                <h3 className="stat-card-value" style={{ margin: 0 }}>{fmt(totalBelumLunas)}</h3>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showForm ? (
                <div className="card">
                    <form onSubmit={handleSave}>
                        <h3 style={{ marginBottom: '20px' }}>{editingId ? 'Edit Pembelian' : 'Buat Pembelian Baru'}</h3>

                        {error && <div className="alert alert-danger" style={{ marginBottom: '20px' }}>{error}</div>}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            <div className="form-group">
                                <label>No Pembelian <small style={{ color: 'var(--text-muted)' }}>(Otomatis)</small></label>
                                <input type="text" className="form-input" style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }} value={purchaseNo} readOnly required />
                            </div>
                            <div className="form-group">
                                <label>Supplier</label>
                                <select className="form-input" value={supplierName} onChange={e => setSupplierName(e.target.value)} required>
                                    <option value="">-- Pilih Supplier --</option>
                                    {(suppliers || []).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Tanggal Pembelian</label>
                                <input type="date" className="form-input" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required />
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <label style={{ fontWeight: 600 }}>Daftar Item / Produk</label>
                                <button type="button" className="btn btn-secondary" onClick={handleAddItem} style={{ padding: '4px 8px', fontSize: '12px' }}>+ Tambah Item</button>
                            </div>

                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <thead style={{ background: 'var(--bg-secondary)' }}>
                                        <tr>
                                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Produk</th>
                                            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid var(--border-color)', width: '100px' }}>Qty</th>
                                            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid var(--border-color)', width: '150px' }}>Harga Satuan</th>
                                            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid var(--border-color)', width: '150px' }}>Subtotal</th>
                                            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', width: '50px' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((it, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '8px 12px' }}>
                                                    <select className="form-input" value={it.product_id} onChange={e => handleItemChange(idx, 'product_id', e.target.value)} required style={{ padding: '6px' }}>
                                                        <option value="">- Pilih -</option>
                                                        {(products || []).map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                                                    </select>
                                                </td>
                                                <td style={{ padding: '8px 12px' }}>
                                                    <input type="number" className="form-input" value={it.qty} onChange={e => handleItemChange(idx, 'qty', e.target.value)} min="1" required style={{ padding: '6px', textAlign: 'right' }} />
                                                </td>
                                                <td style={{ padding: '8px 12px' }}>
                                                    <input type="number" className="form-input" value={it.price} onChange={e => handleItemChange(idx, 'price', e.target.value)} min="0" required style={{ padding: '6px', textAlign: 'right' }} />
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                                                    {fmt(it.subtotal)}
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                    <button type="button" onClick={() => handleRemoveItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--text-danger)', cursor: 'pointer', fontSize: '16px' }}>&times;</button>
                                                </td>
                                            </tr>
                                        ))}
                                        {items.length === 0 && (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada item ditambahkan.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ textAlign: 'right', marginTop: '16px', fontSize: '18px' }}>
                                Total Pembelian: <strong style={{ color: 'var(--primary-color)' }}>{fmt(totalPurchase)}</strong>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
                            <button type="submit" className="btn btn-primary">Simpan Pembelian</button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="data-table-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div className="table-search" style={{ flex: 1, minWidth: '200px' }}>
                            🔍 <input type="text" placeholder="Cari No Pembelian / Supplier..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <select className="filter-select" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
                                <option value="">Semua Supplier</option>
                                {(suppliers || []).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                            </select>
                            <select className="filter-select" value={filterProduct} onChange={e => setFilterProduct(e.target.value)} style={{ maxWidth: '200px' }}>
                                <option value="">Semua Produk</option>
                                {(products || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                <tr>
                                    <th style={{ padding: '16px', textAlign: 'left' }}>No Pembelian</th>
                                    <th style={{ padding: '16px', textAlign: 'left' }}>Tanggal</th>
                                    <th style={{ padding: '16px', textAlign: 'left' }}>Supplier</th>
                                    <th style={{ padding: '16px', textAlign: 'right' }}>Total</th>
                                    <th style={{ padding: '16px', textAlign: 'center' }}>Status</th>
                                    <th style={{ padding: '16px', textAlign: 'right' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></td></tr>
                                ) : filteredPurchases.length === 0 ? (
                                    <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Mungkin pencarian tidak ditemukan atau Belum ada data pembelian</td></tr>
                                ) : (
                                    (filteredPurchases || []).map(p => {
                                        const totalQty = (p.items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0)
                                        const itemNames = (p.items || []).map(it => it.name).join(', ')
                                        const shortNames = itemNames.length > 30 ? itemNames.substring(0, 30) + '...' : itemNames

                                        const isExpanded = expandedRows.has(p.id)

                                        return (
                                            <Fragment key={p.id}>
                                                <tr style={{ borderBottom: '1px solid var(--border-color)', background: isExpanded ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
                                                    <td style={{ padding: '16px', fontFamily: 'monospace', fontWeight: 600 }}>
                                                        <div
                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--primary-color)' }}
                                                            onClick={() => toggleRow(p.id)}
                                                            title="Klik untuk melihat detail produk"
                                                        >
                                                            <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▶</span>
                                                            {p.purchase_no || '-'}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px' }}>{fmtDate(p.date)}</td>
                                                    <td style={{ padding: '16px', fontWeight: 500 }}>{p.supplier_name || '-'}</td>
                                                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600 }}>{fmt(p.total)}</td>
                                                    <td style={{ padding: '16px', textAlign: 'center' }}>{getStatusBadge(p.status)}</td>
                                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                                                            {p.status === 'belum_lunas' ? (
                                                                <>
                                                                    <button title="Validasi" className="btn btn-primary" style={{ padding: '4px 6px', fontSize: '12px', background: '#10b981', borderColor: '#10b981' }} onClick={() => handleValidatePurchase(p)}>✔</button>
                                                                    <button title="Edit" className="btn btn-secondary" style={{ padding: '4px 6px', fontSize: '12px' }} onClick={() => openEdit(p)}>✏️</button>
                                                                    <button title="Hapus" className="btn btn-danger" style={{ padding: '4px 6px', fontSize: '12px' }} onClick={() => handleDelete(p.id, p.status, p.items)}>🗑️</button>
                                                                </>
                                                            ) : (
                                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-block', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>✔ Tervalidasi</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && p.items && p.items.length > 0 && (
                                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                                                        <td colSpan="6" style={{ padding: '16px 32px' }}>
                                                            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>

                                                                    <tbody>
                                                                        {p.items.map((it, idx) => (
                                                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                                                <td style={{ padding: '8px 12px' }}>{it.name} <span style={{ color: 'var(--text-muted)' }}>({it.sku})</span></td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{it.qty}</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(it.price)}</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(it.subtotal)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
