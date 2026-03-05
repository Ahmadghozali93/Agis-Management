import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const menuItems = [
    {
        key: 'dashboard',
        label: 'Dashboard',
        icon: '📊',
        path: '/dashboard',
        roles: ['admin', 'owner', 'spv', 'host', 'creator']
    },
    {
        key: 'master',
        label: 'Master Produk',
        icon: '📦',
        roles: ['admin', 'owner', 'spv'],
        children: [
            { key: 'kategori', label: 'Kategori', path: '/master/kategori' },
            { key: 'supplier', label: 'Data Supplier', path: '/master/supplier' },
            { key: 'produk', label: 'Produk', path: '/master/produk' }
        ]
    },
    {
        key: 'tiktok',
        label: 'Penjualan TikTok',
        icon: '🎵',
        roles: ['admin', 'owner', 'spv', 'host'],
        children: [
            { key: 'penjualan-tt', label: 'Penjualan', path: '/tiktok/penjualan' },
            { key: 'keuangan-tt', label: 'Keuangan', path: '/tiktok/keuangan' },
            { key: 'return', label: 'Return', path: '/tiktok/return' },
            { key: 'failed-cod', label: 'Failed COD', path: '/tiktok/failed-cod' }
        ]
    },
    {
        key: 'agregator',
        label: 'Penjualan Agregator',
        icon: '🛒',
        path: '/agregator',
        roles: ['admin', 'owner', 'spv']
    },
    {
        key: 'konten',
        label: 'Konten',
        icon: '🎬',
        roles: ['admin', 'owner', 'spv', 'host', 'creator'],
        children: [
            { key: 'data-akun', label: 'Data Akun', path: '/konten/data-akun' },
            { key: 'laporan-konten', label: 'Laporan Konten', path: '/konten/laporan-konten' },
            { key: 'laporan-live', label: 'Laporan Live', path: '/konten/laporan-live' }
        ]
    },
    {
        key: 'inventory',
        label: 'Inventory',
        icon: '🏪',
        roles: ['admin', 'owner', 'spv'],
        children: [
            { key: 'stok-overview', label: 'Stok Overview', path: '/inventory/stok-overview' },
            { key: 'stok-mutation', label: 'Stok Mutation', path: '/inventory/stok-mutation' }
        ]
    },
    {
        key: 'keuangan',
        label: 'Keuangan',
        icon: '💰',
        roles: ['admin', 'owner', 'spv'],
        children: [
            { key: 'pembelian', label: 'Pembelian', path: '/keuangan/pembelian' },
            { key: 'pembayaran', label: 'Pembayaran', path: '/keuangan/pembayaran' },
            { key: 'pemasukan', label: 'Pemasukan', path: '/keuangan/pemasukan' },
            { key: 'pengeluaran', label: 'Pengeluaran', path: '/keuangan/pengeluaran' },
            { key: 'laba-rugi', label: 'Laba Rugi', path: '/keuangan/laba-rugi' },
            { key: 'neraca', label: 'Neraca', path: '/keuangan/neraca' }
        ]
    },
    {
        key: 'users',
        label: 'Management User',
        icon: '👥',
        path: '/users',
        roles: ['admin', 'owner']
    },
    {
        key: 'pengaturan',
        label: 'Pengaturan',
        icon: '⚙️',
        roles: ['admin', 'owner'],
        children: [
            { key: 'general', label: 'General', path: '/pengaturan/general' },
            { key: 'akun-bank', label: 'Akun Bank', path: '/pengaturan/akun-bank' }
        ]
    }
]

export default function Sidebar({ collapsed, onClose }) {
    const [openMenu, setOpenMenu] = useState(null)
    const location = useLocation()
    const navigate = useNavigate()
    const { profile } = useAuth()

    const userRole = profile?.role || ''

    const filteredMenu = menuItems.filter(item => item.roles.includes(userRole))

    function handleMenuClick(item) {
        if (item.children) {
            setOpenMenu(openMenu === item.key ? null : item.key)
        } else {
            navigate(item.path)
            setOpenMenu(null)
            if (window.innerWidth <= 768) onClose?.()
        }
    }

    function handleSubClick(sub) {
        navigate(sub.path)
        if (window.innerWidth <= 768) onClose?.()
    }

    function isActive(path) {
        return location.pathname === path
    }

    function isParentActive(item) {
        if (item.path) return isActive(item.path)
        return item.children?.some(c => location.pathname.startsWith(c.path))
    }

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${!collapsed ? 'mobile-open' : ''}`}>
            <div className="sidebar-brand">
                <div className="sidebar-brand-icon">OS</div>
                <div className="sidebar-brand-text">
                    <h2>Olshop Manager</h2>
                    <span>Management System</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-section">
                    <div className="sidebar-section-title">Menu</div>
                    {filteredMenu.map(item => (
                        <div key={item.key} className="sidebar-section">
                            <button
                                className={`nav-item ${isParentActive(item) ? 'active' : ''}`}
                                onClick={() => handleMenuClick(item)}
                            >
                                <span className="nav-item-icon">{item.icon}</span>
                                <span className="nav-item-text">{item.label}</span>
                                {item.children && (
                                    <span className={`nav-item-arrow ${openMenu === item.key ? 'open' : ''}`}>▼</span>
                                )}
                            </button>

                            {item.children && (
                                <div className={`nav-submenu ${openMenu === item.key ? 'open' : ''}`}>
                                    {item.children.map(sub => (
                                        <button
                                            key={sub.key}
                                            className={`nav-item ${isActive(sub.path) ? 'active' : ''}`}
                                            onClick={() => handleSubClick(sub)}
                                        >
                                            <span className="nav-item-text">{sub.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="sidebar-user-avatar">
                        {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{profile?.full_name || 'User'}</div>
                        <div className="sidebar-user-role">{profile?.role || 'N/A'}</div>
                    </div>
                </div>
            </div>
        </aside>
    )
}
