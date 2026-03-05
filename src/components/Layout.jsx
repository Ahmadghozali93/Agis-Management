import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

const pageTitles = {
    '/dashboard': 'Dashboard',
    '/master/kategori': 'Kategori Produk',
    '/master/supplier': 'Data Supplier',
    '/master/produk': 'Produk',
    '/tiktok/penjualan': 'Penjualan TikTok',
    '/tiktok/keuangan': 'Keuangan TikTok',
    '/tiktok/return': 'Return',
    '/tiktok/failed-cod': 'Failed COD',
    '/agregator': 'Penjualan Agregator',
    '/konten/data-akun': 'Data Akun',
    '/konten/laporan-konten': 'Laporan Konten',
    '/konten/laporan-live': 'Laporan Live',
    '/inventory/stok-overview': 'Stok Overview',
    '/inventory/stok-mutation': 'Stok Mutation',
    '/keuangan/pembelian': 'Pembelian',
    '/keuangan/pembayaran': 'Pembayaran',
    '/keuangan/pemasukan': 'Pemasukan',
    '/keuangan/pengeluaran': 'Pengeluaran',
    '/keuangan/laba-rugi': 'Laba Rugi',
    '/keuangan/neraca': 'Neraca',
    '/users': 'Management User',
    '/pengaturan/general': 'Pengaturan General',
    '/pengaturan/akun-bank': 'Akun Bank'
}

export default function Layout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const location = useLocation()

    const title = pageTitles[location.pathname] || 'Olshop Manager'

    return (
        <div className="app-layout">
            <Sidebar
                collapsed={sidebarCollapsed}
                onClose={() => setSidebarCollapsed(true)}
            />

            {!sidebarCollapsed && (
                <div
                    className="sidebar-overlay visible"
                    onClick={() => setSidebarCollapsed(true)}
                />
            )}

            <Header
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={title}
            />

            <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <Outlet />
            </main>
        </div>
    )
}
