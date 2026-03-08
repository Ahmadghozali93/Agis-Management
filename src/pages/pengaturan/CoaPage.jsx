import { useState, useEffect, Fragment } from 'react'
import { supabase } from '../../lib/supabase'

const ACCOUNT_TYPES = [
    { value: 'asset', label: 'Asset', group: 'Aset', color: 'badge-success' },
    { value: 'fixed_asset', label: 'Fixed Asset', group: 'Aset', color: 'badge-success' },
    { value: 'receivable', label: 'Receivable', group: 'Aset', color: 'badge-success' },
    { value: 'liability', label: 'Liability', group: 'Kewajiban', color: 'badge-danger' },
    { value: 'payable', label: 'Payable', group: 'Kewajiban', color: 'badge-danger' },
    { value: 'equity', label: 'Equity', group: 'Ekuitas', color: 'badge-info' },
    { value: 'income', label: 'Income', group: 'Pendapatan', color: 'badge-warning' },
    { value: 'expense', label: 'Expense', group: 'Beban', color: 'badge-secondary' }
]

const ACCOUNT_GROUPS = ['Kas/Bank', 'Aset Lancar', 'Aset Tetap', 'Kewajiban Lancar', 'Kewajiban Jangka Panjang', 'Ekuitas', 'Pendapatan', 'HPP', 'Beban']

function getTypeBadge(type) {
    const t = ACCOUNT_TYPES.find(a => a.value === type)
    return t ? <span className={`badge ${t.color}`}>{t.label}</span> : <span className="badge">{type}</span>
}

export default function CoaPage() {
    const [coas, setCoas] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editItem, setEditItem] = useState(null)
    const [formData, setFormData] = useState({ code: '', name: '', type: 'asset', account_group: '', allow_reconciliation: false, description: '' })
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState('all')

    useEffect(() => { loadCoas() }, [])

    async function loadCoas() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('coa')
                .select('*')
                .order('code', { ascending: true })
                .order('name', { ascending: true })
            if (error) throw error
            setCoas(data || [])
        } catch (err) {
            console.error('Error load COA:', err)
        } finally {
            setLoading(false)
        }
    }

    function openCreate() {
        setFormData({ code: '', name: '', type: 'asset', account_group: '', allow_reconciliation: false, description: '' })
        setEditItem(null)
        setError('')
        setShowModal(true)
    }

    function openEdit(item) {
        setFormData({
            code: item.code || '',
            name: item.name || '',
            type: item.type || 'asset',
            account_group: item.account_group || '',
            allow_reconciliation: item.allow_reconciliation || false,
            description: item.description || ''
        })
        setEditItem(item)
        setError('')
        setShowModal(true)
    }

    async function handleSave(e) {
        e.preventDefault()
        setError('')
        try {
            const payload = {
                code: formData.code || null,
                name: formData.name,
                type: formData.type,
                account_group: formData.account_group || null,
                allow_reconciliation: formData.allow_reconciliation || false,
                description: formData.description || null
            }

            // Validasi kode COA tidak boleh double
            if (payload.code) {
                let query = supabase.from('coa').select('id').eq('code', payload.code)
                if (editItem) query = query.neq('id', editItem.id)
                const { data: existing } = await query
                if (existing && existing.length > 0) {
                    throw new Error(`Kode COA "${payload.code}" sudah digunakan.`)
                }
            }

            if (editItem) {
                const { error } = await supabase.from('coa').update(payload).eq('id', editItem.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('coa').insert([payload])
                if (error) throw error
            }

            setShowModal(false)
            loadCoas()
        } catch (err) {
            setError(err.message)
        }
    }

    async function handleDelete(id) {
        if (!confirm('Yakin ingin menghapus akun ini?')) return
        try {
            // Fetch COA details first to know its labels
            const { data: coa, error: fetchErr } = await supabase.from('coa').select('*').eq('id', id).single()
            if (fetchErr) throw fetchErr

            // Build possible format variations used in transactions
            const formats = [coa.name]
            if (coa.code) formats.push(`[${coa.code}] ${coa.name}`)
            if (coa.code && coa.description) formats.push(`[${coa.code}] ${coa.name} - ${coa.description}`)

            // Check usage in all transaction tables
            const [
                { count: incCat }, { count: incPay },
                { count: expCat }, { count: expPay },
                { count: tfFrom }, { count: tfTo },
                { count: payMeth }
            ] = await Promise.all([
                supabase.from('incomes').select('*', { count: 'exact', head: true }).in('category', formats),
                supabase.from('incomes').select('*', { count: 'exact', head: true }).in('payment_method', formats),
                supabase.from('expenses').select('*', { count: 'exact', head: true }).in('category', formats),
                supabase.from('expenses').select('*', { count: 'exact', head: true }).in('payment_method', formats),
                supabase.from('transfers').select('*', { count: 'exact', head: true }).in('from_account', formats),
                supabase.from('transfers').select('*', { count: 'exact', head: true }).in('to_account', formats),
                supabase.from('payments').select('*', { count: 'exact', head: true }).in('method', formats)
            ])

            const totalUsed = (incCat || 0) + (incPay || 0) + (expCat || 0) + (expPay || 0) + (tfFrom || 0) + (tfTo || 0) + (payMeth || 0)

            if (totalUsed > 0) {
                alert(`Gagal menghapus! COA dipakai pada ${totalUsed} entri transaksi. Anda harus mengubah transaksi tersebut lebih dulu jika ingin menghapus COA ini.`)
                return
            }

            const { error: delErr } = await supabase.from('coa').delete().eq('id', id)
            if (delErr) throw delErr

            loadCoas()
        } catch (err) {
            alert('Gagal menghapus: ' + err.message)
        }
    }

    function handleChange(e) {
        const { name, value, type: inputType, checked } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: inputType === 'checkbox' ? checked : value
        }))
    }

    // Filter
    const filteredCoas = coas.filter(c => {
        if (filterType !== 'all') {
            const typeInfo = ACCOUNT_TYPES.find(t => t.value === filterType)
            if (typeInfo) {
                if (c.type !== filterType) return false
            } else {
                // Filter by group category (Aset, Kewajiban, etc.)
                const matchingTypes = ACCOUNT_TYPES.filter(t => t.group === filterType).map(t => t.value)
                if (!matchingTypes.includes(c.type)) return false
            }
        }
        if (search) {
            const s = search.toLowerCase()
            return (c.code || '').toLowerCase().includes(s) || c.name.toLowerCase().includes(s) || (c.account_group || '').toLowerCase().includes(s)
        }
        return true
    })

    // Group by account_group for display
    const groups = {}
    filteredCoas.forEach(c => {
        const g = c.account_group || 'Lainnya'
        if (!groups[g]) groups[g] = []
        groups[g].push(c)
    })

    // Auto-suggest group based on type
    function suggestGroup(type) {
        const info = ACCOUNT_TYPES.find(t => t.value === type)
        if (!info) return ''
        const groupMap = {
            'Aset': 'Aset Lancar',
            'Kewajiban': 'Kewajiban Lancar',
            'Ekuitas': 'Ekuitas',
            'Pendapatan': 'Pendapatan',
            'Beban': 'Beban'
        }
        return groupMap[info.group] || ''
    }

    return (
        <div>
            <div className="page-header">
                <h1>📑 Chart of Accounts (COA)</h1>
                <div className="page-header-actions">
                    <button className="btn btn-primary" onClick={openCreate}>+ Tambah Akun</button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="tabs" style={{ marginBottom: '16px', flexWrap: 'wrap' }}>
                <button className={`tab ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>Semua</button>
                <button className={`tab ${filterType === 'Aset' ? 'active' : ''}`} onClick={() => setFilterType('Aset')}>🏦 Aset</button>
                <button className={`tab ${filterType === 'Kewajiban' ? 'active' : ''}`} onClick={() => setFilterType('Kewajiban')}>📤 Kewajiban</button>
                <button className={`tab ${filterType === 'Ekuitas' ? 'active' : ''}`} onClick={() => setFilterType('Ekuitas')}>🏛️ Ekuitas</button>
                <button className={`tab ${filterType === 'Pendapatan' ? 'active' : ''}`} onClick={() => setFilterType('Pendapatan')}>💰 Pendapatan</button>
                <button className={`tab ${filterType === 'Beban' ? 'active' : ''}`} onClick={() => setFilterType('Beban')}>💸 Beban</button>
            </div>

            <div className="table-container desktop-table">
                <div className="table-toolbar">
                    <div className="table-search">
                        🔍
                        <input type="text" placeholder="Cari kode / nama akun..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{filteredCoas.length} akun</span>
                </div>

                <div className="table-wrapper">
                    {loading ? (
                        <div className="empty-state"><div className="spinner"></div><p>Memuat...</p></div>
                    ) : filteredCoas.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">📭</div><p>Belum ada akun COA</p></div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: '80px' }}>Kode</th>
                                    <th>Nama Akun</th>
                                    <th>Tipe</th>
                                    <th>Group</th>
                                    <th>Keterangan</th>
                                    <th style={{ width: '60px' }}>Rekon</th>
                                    <th style={{ width: '100px' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(groups).map(([groupName, items]) => (
                                    <Fragment key={groupName}>
                                        <tr>
                                            <td colSpan={7} style={{
                                                background: 'var(--bg-secondary)', fontWeight: 800,
                                                fontSize: '13px', color: 'var(--text-primary)', padding: '10px 16px',
                                                borderLeft: '4px solid var(--primary)', letterSpacing: '0.5px'
                                            }}>
                                                {groupName}
                                            </td>
                                        </tr>
                                        {items.map(item => (
                                            <tr key={item.id}>
                                                <td><code style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>{item.code || '-'}</code></td>
                                                <td style={{ fontWeight: 500 }}>{item.name}</td>
                                                <td>{getTypeBadge(item.type)}</td>
                                                <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.account_group || '-'}</td>
                                                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.description || '-'}</td>
                                                <td style={{ textAlign: 'center' }}>{item.allow_reconciliation ? '✅' : ''}</td>
                                                <td>
                                                    <div className="table-actions">
                                                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>✏️</button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="mobile-cards">
                <div className="table-toolbar" style={{ borderRadius: 'var(--radius-lg)', marginBottom: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <div className="table-search">
                        🔍
                        <input type="text" placeholder="Cari akun..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{filteredCoas.length} akun</span>
                </div>

                {loading ? (
                    <div className="empty-state"><div className="spinner"></div><p>Memuat...</p></div>
                ) : filteredCoas.length === 0 ? (
                    <div className="empty-state"><div className="empty-state-icon">📭</div><p>Belum ada akun COA</p></div>
                ) : (
                    <div className="cards-list">
                        {filteredCoas.map(item => (
                            <div key={item.id} className="data-card">
                                <div className="data-card-header">
                                    <span className="data-card-number">
                                        <code style={{ color: 'var(--primary)', fontWeight: 700 }}>{item.code || '-'}</code>
                                    </span>
                                    <div className="data-card-actions">
                                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>✏️</button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>🗑️</button>
                                    </div>
                                </div>
                                <div className="data-card-body">
                                    <div className="data-card-row"><span className="data-card-label">Nama</span><span className="data-card-value" style={{ fontWeight: 600 }}>{item.name}</span></div>
                                    <div className="data-card-row"><span className="data-card-label">Tipe</span><span className="data-card-value">{getTypeBadge(item.type)}</span></div>
                                    <div className="data-card-row"><span className="data-card-label">Group</span><span className="data-card-value">{item.account_group || '-'}</span></div>
                                    {item.description && <div className="data-card-row"><span className="data-card-label">Keterangan</span><span className="data-card-value" style={{ fontSize: '12px' }}>{item.description}</span></div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '480px' }}>
                        <div className="modal-header">
                            <h2>{editItem ? 'Edit' : 'Tambah'} Akun</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                {error && <div className="alert alert-error">⚠️ {error}</div>}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label>Kode Akun</label>
                                        <input type="text" className="form-input" name="code" value={formData.code}
                                            onChange={handleChange} placeholder="1000" required style={{ fontFamily: 'monospace', fontWeight: 600 }} />
                                    </div>
                                    <div className="form-group">
                                        <label>Nama Akun</label>
                                        <input type="text" className="form-input" name="name" value={formData.name}
                                            onChange={handleChange} placeholder="Kas" required />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label>Tipe Akun</label>
                                        <select className="form-select" name="type" value={formData.type}
                                            onChange={e => {
                                                handleChange(e)
                                                // Auto-suggest group
                                                const suggested = suggestGroup(e.target.value)
                                                if (suggested && !formData.account_group) {
                                                    setFormData(prev => ({ ...prev, type: e.target.value, account_group: suggested }))
                                                }
                                            }} required>
                                            {ACCOUNT_TYPES.map(t => (
                                                <option key={t.value} value={t.value}>{t.label} ({t.group})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Group</label>
                                        <select className="form-select" name="account_group" value={formData.account_group}
                                            onChange={handleChange}>
                                            <option value="">-- Pilih Group --</option>
                                            {ACCOUNT_GROUPS.map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" id="allow_recon" name="allow_reconciliation"
                                        checked={formData.allow_reconciliation} onChange={handleChange} />
                                    <label htmlFor="allow_recon" style={{ marginBottom: 0 }}>Allow Reconciliation (untuk Piutang/Utang)</label>
                                </div>

                                <div className="form-group">
                                    <label>Keterangan</label>
                                    <textarea className="form-input" name="description" value={formData.description}
                                        onChange={handleChange} placeholder="Deskripsi atau catatan akun" rows={2}
                                        style={{ resize: 'vertical' }} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary">
                                    {editItem ? '💾 Simpan' : '➕ Tambah'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
