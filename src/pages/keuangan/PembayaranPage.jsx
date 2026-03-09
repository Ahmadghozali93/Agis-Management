import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function fmt(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num || 0)
}

function fmtDate(d) {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PembayaranPage() {
    const [payments, setPayments] = useState([])
    const [pendingPurchases, setPendingPurchases] = useState([])
    const [kasAccounts, setKasAccounts] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [error, setError] = useState(null)

    // Form
    const [selectedPurchaseId, setSelectedPurchaseId] = useState('')
    const [accountId, setAccountId] = useState('')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')
    const [date, setDate] = useState(new Date().toISOString().substring(0, 10))

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        const [payRes, purRes, kasRes] = await Promise.all([
            supabase.from('payments').select('*').order('created_at', { ascending: false }),
            supabase.from('purchases').select('*').in('status', ['belum_lunas', 'pending']).order('created_at', { ascending: false }),
            supabase.from('coa').select('id, code, name, description').eq('account_group', 'Kas/Bank').order('code').order('name')
        ])

        if (payRes.data) setPayments(payRes.data)
        if (purRes.data) setPendingPurchases(purRes.data)
        if (kasRes.data) setKasAccounts(kasRes.data)
        setLoading(false)
    }

    const handleSelectPurchase = (id) => {
        setSelectedPurchaseId(id)
        const p = pendingPurchases.find(x => x.id === id)
        if (p) {
            setAmount(p.total)
            setDescription(`Pelunasan Pembelian No: ${p.purchase_no || '-'} (${p.supplier_name})`)
        } else {
            setAmount('')
            setDescription('')
        }
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setError(null)
        if (!selectedPurchaseId) return setError("Pilih Pembelian yang akan di bayar.")
        if (!accountId) return setError("Pilih Akun Kas/Bank untuk pembayaran.")

        const pur = pendingPurchases.find(x => x.id === selectedPurchaseId)
        const kas = kasAccounts.find(x => x.id === accountId)
        if (!pur || !kas) return setError("Data tidak valid.")

        try {
            // 1. Catat di tabel payments
            const { error: err1 } = await supabase.from('payments').insert([{
                description,
                amount: Number(amount),
                method: kas.code ? `[${kas.code}] ${kas.name}` : kas.name,
                date
            }])
            if (err1) throw err1

            // 2. Ubah status pembelian jadi lunas
            const { error: err2 } = await supabase.from('purchases').update({ status: 'lunas' }).eq('id', selectedPurchaseId)
            if (err2) throw err2

            // 3. Mutasi stok JIKA status sebelumnya 'belum_lunas'
            // Jika status sebelumnya 'pending', stok sudah masuk saat divalidasi.
            if (pur.status === 'belum_lunas') {
                let itemsArray = pur.items
                if (typeof itemsArray === 'string') {
                    try { itemsArray = JSON.parse(itemsArray) } catch (e) { itemsArray = [] }
                }
                if (Array.isArray(itemsArray) && itemsArray.length > 0) {
                    const mutasiPayload = itemsArray.map(item => ({
                        product_name: item.name,
                        sku: item.sku,
                        type: 'in',
                        qty: item.qty,
                        hpp: (Number(item.qty) > 0) ? (Number(item.subtotal) / Number(item.qty)) : 0,
                        reference_id: pur.purchase_no,
                        note: `Pembayaran Lunas Pembelian dari ${pur.supplier_name}`,
                        date: date
                    }))

                    const { error: mutErr } = await supabase.from('stock_mutations').insert(mutasiPayload)
                    if (mutErr) {
                        console.error('Mutation Error:', mutErr)
                        throw new Error('Gagal mencatat mutasi stok: ' + mutErr.message)
                    }

                    for (const item of itemsArray) {
                        const { data: prodData } = await supabase.from('products').select('stock').eq('id', item.product_id).single()
                        if (prodData) {
                            const currentStock = Number(prodData.stock) || 0
                            await supabase.from('products').update({ stock: currentStock + Number(item.qty) }).eq('id', item.product_id)
                        }
                    }
                }
            }
            setShowForm(false)
            setSelectedPurchaseId('')
            setAccountId('')
            setAmount('')
            setDescription('')
            loadData()
        } catch (err) {
            setError(err.message)
        }
    }

    return (
        <div className="page-container" style={{ padding: '20px' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>💳 Pembayaran Tagihan</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Mencatat pelunasan pembelian dari Supplier</p>
                </div>
                {!showForm && (
                    <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Buat Pembayaran</button>
                )}
            </div>

            {showForm ? (
                <div className="card">
                    <form onSubmit={handleSave}>
                        <h3 style={{ marginBottom: '20px' }}>Buat Pembayaran Baru</h3>
                        {error && <div className="alert alert-danger" style={{ marginBottom: '20px' }}>{error}</div>}

                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label>Pilih Tagihan Pembelian (Pending Validasi)</label>
                            <select className="form-input" value={selectedPurchaseId} onChange={e => handleSelectPurchase(e.target.value)} required>
                                <option value="">-- Pilih Pembelian --</option>
                                {pendingPurchases.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.purchase_no || '-'} | {p.supplier_name} | {fmtDate(p.date)} | {fmt(p.total)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div className="form-group">
                                <label>Akun Kas / Bank (Sumber Dana)</label>
                                <select className="form-input" value={accountId} onChange={e => setAccountId(e.target.value)} required>
                                    <option value="">-- Pilih Akun Kas/Bank --</option>
                                    {kasAccounts.map(a => (
                                        <option key={a.id} value={a.id}>
                                            {a.code ? `[${a.code}] ${a.name}` : a.name}{a.description ? ` - ${a.description}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Tanggal Pembayaran</label>
                                <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            <div className="form-group">
                                <label>Jumlah Bayar</label>
                                <input type="number" className="form-input" value={amount} readOnly disabled style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed' }} placeholder="Otomatis" />
                            </div>
                            <div className="form-group">
                                <label>Keterangan</label>
                                <input type="text" className="form-input" value={description} onChange={e => setDescription(e.target.value)} required />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
                            <button type="submit" className="btn btn-primary">Simpan Pembayaran</button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-responsive">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                <tr>
                                    <th style={{ padding: '16px', textAlign: 'left' }}>Tanggal</th>
                                    <th style={{ padding: '16px', textAlign: 'left' }}>Keterangan</th>
                                    <th style={{ padding: '16px', textAlign: 'left' }}>Metode / Bank</th>
                                    <th style={{ padding: '16px', textAlign: 'right' }}>Jumlah Dibayar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></td></tr>
                                ) : payments.length === 0 ? (
                                    <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada riwayat pembayaran tagihan</td></tr>
                                ) : (
                                    payments.map(py => (
                                        <tr key={py.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '16px' }}>{fmtDate(py.date)}</td>
                                            <td style={{ padding: '16px', fontWeight: 500 }}>{py.description}</td>
                                            <td style={{ padding: '16px' }}><span className="badge badge-info">{py.method}</span></td>
                                            <td style={{ padding: '16px', textAlign: 'right', fontWeight: 600, color: 'var(--primary-color)' }}>{fmt(py.amount)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
