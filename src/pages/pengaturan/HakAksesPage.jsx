import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// Define the available menus to manage
const MENUS = [
    { key: 'dashboard', label: 'Dashboard', group: 'General' },

    { key: 'master', label: 'Master Produk (Parent)', group: 'Master Data' },
    { key: 'kategori', label: 'Master Kategori', group: 'Master Data' },
    { key: 'supplier', label: 'Master Supplier', group: 'Master Data' },
    { key: 'produk', label: 'Master Produk', group: 'Master Data' },

    { key: 'tiktok', label: 'Penjualan TikTok (Parent)', group: 'TikTok' },
    { key: 'penjualan-tt', label: 'TikTok Penjualan', group: 'TikTok' },
    { key: 'failed-cod', label: 'TikTok Failed COD', group: 'TikTok' },
    { key: 'return', label: 'TikTok Return', group: 'TikTok' },
    { key: 'keuangan-tt', label: 'TikTok Keuangan', group: 'TikTok' },

    { key: 'konten', label: 'Konten (Parent)', group: 'Konten' },
    { key: 'dashboard-konten', label: 'Dashboard Konten', group: 'Konten' },
    { key: 'data-akun', label: 'Data Akun Konten', group: 'Konten' },
    { key: 'laporan-konten', label: 'Laporan Konten', group: 'Konten' },
    { key: 'laporan-live', label: 'Laporan Live', group: 'Konten' },

    { key: 'inventory', label: 'Inventory (Parent)', group: 'Inventory' },
    { key: 'stok-overview', label: 'Stok Overview', group: 'Inventory' },
    { key: 'stok-mutation', label: 'Stok Mutation', group: 'Inventory' },

    { key: 'keuangan', label: 'Keuangan (Parent)', group: 'Keuangan' },
    { key: 'pembelian', label: 'Keuangan Pembelian', group: 'Keuangan' },
    { key: 'pembayaran', label: 'Keuangan Pembayaran', group: 'Keuangan' },
    { key: 'pemasukan', label: 'Keuangan Pemasukan', group: 'Keuangan' },
    { key: 'pengeluaran', label: 'Keuangan Pengeluaran', group: 'Keuangan' },
    { key: 'pindah-buku', label: 'Keuangan Pindah Buku', group: 'Keuangan' },
    { key: 'laba-rugi', label: 'Laba Rugi', group: 'Keuangan' },
    { key: 'neraca', label: 'Neraca', group: 'Keuangan' },

    { key: 'users', label: 'Management User', group: 'Sistem' },

    { key: 'pengaturan', label: 'Pengaturan (Parent)', group: 'Sistem' },
    { key: 'general', label: 'Pengaturan General', group: 'Sistem' },
    { key: 'coa', label: 'Pengaturan COA', group: 'Sistem' },
    { key: 'hak-akses', label: 'Pengaturan Hak Akses', group: 'Sistem' }
]

const ROLES = ['admin', 'owner', 'spv', 'host', 'creator']

export default function HakAksesPage() {
    const [permissions, setPermissions] = useState({}) // { role: ['menuKey1', 'menuKey2'] }
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        loadPermissions()
    }, [])

    async function loadPermissions() {
        try {
            const { data, error } = await supabase.from('role_permissions').select('*')
            if (error) throw error
            const perms = {}
            if (data) {
                for (const row of Object.values(data)) {
                    perms[row.role] = row.menus || []
                }
            }

            // Ensure all roles have an array
            ROLES.forEach(r => {
                if (!perms[r]) perms[r] = []
            })

            setPermissions(perms)
        } catch (err) {
            console.error('Failed to load permissions:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        setSaving(true)
        setError(null)
        setSuccess(false)
        try {
            const upserts = ROLES.map(role => ({
                role,
                menus: permissions[role]
            }))

            const { error } = await supabase.from('role_permissions').upsert(upserts)
            if (error) throw error

            setSuccess(true)
            setTimeout(() => setSuccess(false), 3000)

            // Reload window to apply new permissions immediately for the current user
            // if they changed their own permissions (optional, but good UX to warn)
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    function togglePermission(role, menuKey) {
        setPermissions(prev => {
            const currentMenus = prev[role] || []
            let newMenus = []

            if (currentMenus.includes(menuKey)) {
                newMenus = currentMenus.filter(k => k !== menuKey)
            } else {
                newMenus = [...currentMenus, menuKey]
            }

            return {
                ...prev,
                [role]: newMenus
            }
        })
    }

    function setAllForRole(role, enable) {
        setPermissions(prev => ({
            ...prev,
            [role]: enable ? MENUS.map(m => m.key) : []
        }))
    }

    if (loading) return <div className="empty-state"><div className="spinner"></div><p>Memuat Pengaturan Hak Akses...</p></div>

    // Group menus for better display
    const groupedMenus = MENUS.reduce((acc, menu) => {
        if (!acc[menu.group]) acc[menu.group] = []
        acc[menu.group].push(menu)
        return acc
    }, {})

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>🔐 Pengaturan Hak Akses</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Atur menu apa saja yang dapat diakses oleh masing-masing Role.
                    </p>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
                    </button>
                </div>
            </div>

            {success && <div className="alert alert-success">✅ Hak Akses berhasil disimpan! Perubahan akan langsung berlaku. Harap muat ulang halaman jika menu belum berubah.</div>}
            {error && <div className="alert alert-error">❌ Gagal menyimpan: {error}</div>}

            <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
                <strong>Peringatan Admin:</strong> Admin secara bawaan dapat mengakses seluruh menu yang diaktifkan. Jangan sampai Anda menghapus akses diri sendiri ke halaman <strong>Pengaturan Hak Akses</strong>.
            </div>

            <div className="settings-section" style={{ overflowX: 'auto', padding: 0 }}>
                <table style={{ minWidth: '800px', margin: 0, borderTop: 'none' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '250px' }}>Menu / Fitur</th>
                            {ROLES.map(role => (
                                <th key={role} style={{ textAlign: 'center', textTransform: 'capitalize' }}>
                                    <div style={{ paddingBottom: '8px' }}>{role}</div>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                        <button className="btn btn-sm btn-secondary" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => setAllForRole(role, true)}>All</button>
                                        <button className="btn btn-sm btn-secondary" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => setAllForRole(role, false)}>None</button>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(groupedMenus).map(([group, menus]) => (
                            <React.Fragment key={group}>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <td colSpan={ROLES.length + 1} style={{ fontWeight: 600, color: 'var(--text-muted)', paddingTop: '16px' }}>
                                        {group}
                                    </td>
                                </tr>
                                {menus.map(menu => (
                                    <tr key={menu.key}>
                                        <td style={{ paddingLeft: menu.label.includes('(Parent)') ? '12px' : '24px', fontWeight: menu.label.includes('(Parent)') ? 600 : 400 }}>
                                            {menu.label}
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}><code>{menu.key}</code></div>
                                        </td>
                                        {ROLES.map(role => (
                                            <td key={role} style={{ textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                    checked={permissions[role]?.includes(menu.key) || false}
                                                    onChange={() => togglePermission(role, menu.key)}
                                                    disabled={role === 'admin' && menu.key === 'hak-akses'} // Prevent admin from locking out of hak-akses
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
                </button>
            </div>
        </div>
    )
}
