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
    const [bankAccounts, setBankAccounts] = useState([])
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
        const [payRes, purRes, bankRes] = await Promise.all([
            supabase.from('payments').select('*').order('created_at', { ascending: false }),
            supabase.from('purchases').select('*').in('status', ['belum_lunas', 'pending']).order('created_at', { ascending: false }),
            supabase.from('bank_accounts').select('*').order('bank_name')
        ])

        if (payRes.data) setPayments(payRes.data)
        if (purRes.data) setPendingPurchases(purRes.data)
        if (bankRes.data) setBankAccounts(bankRes.data)
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
        const bank = bankAccounts.find(x => x.id === accountId)
        if (!pur || !bank) return setError("Data tidak valid.")

        try {
            // 1. Catat di tabel payments
            const { error: err1 } = await supabase.from('payments').insert([{
                description,
                amount: Number(amount),
                method: `${bank.bank_name} - ${bank.account_number}`,
                date
            }])
            if (err1) throw err1

            // 2. Ubah status pembelian jadi lunas
            const { error: err2 } = await supabase.from('purchases').update({ status: 'lunas' }).eq('id', selectedPurchaseId)
            if (err2) throw err2



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
                                    <option value="">-- Pilih Bank --</option>
                                    {bankAccounts.map(b => (
                                        <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number} ({b.account_name})</option>
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
