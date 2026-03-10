import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import KategoriPage from './pages/master/KategoriPage'
import SupplierPage from './pages/master/SupplierPage'
import ProdukPage from './pages/master/ProdukPage'
import PenjualanTiktokPage from './pages/tiktok/PenjualanTiktokPage'
import KeuanganTiktokPage from './pages/tiktok/KeuanganTiktokPage'
import ReturnPage from './pages/tiktok/ReturnPage'
import FailedCodPage from './pages/tiktok/FailedCodPage'

import DataAkunPage from './pages/konten/DataAkunPage'
import DashboardKontenPage from './pages/konten/DashboardKontenPage'
import LaporanKontenPage from './pages/konten/LaporanKontenPage'
import LaporanLivePage from './pages/konten/LaporanLivePage'
import StokOverviewPage from './pages/inventory/StokOverviewPage'
import StokMutationPage from './pages/inventory/StokMutationPage'
import PembelianPage from './pages/keuangan/PembelianPage'
import PembayaranPage from './pages/keuangan/PembayaranPage'
import PemasukanPage from './pages/keuangan/PemasukanPage'
import PengeluaranPage from './pages/keuangan/PengeluaranPage'
import LabaRugiPage from './pages/keuangan/LabaRugiPage'
import NeracaPage from './pages/keuangan/NeracaPage'
import PindahBukuPage from './pages/keuangan/PindahBukuPage'
import ManagementUserPage from './pages/users/ManagementUserPage'
import GeneralPage from './pages/pengaturan/GeneralPage'
import CoaPage from './pages/pengaturan/CoaPage'
import HakAksesPage from './pages/pengaturan/HakAksesPage'

function ProtectedRoute({ children, allowedMenuKey }) {
    const { profile, loading, hasMenuAccess } = useAuth()

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
                <p style={{ color: 'var(--text-secondary)' }}>Memuat...</p>
            </div>
        )
    }

    if (!profile) return <Navigate to="/login" replace />

    if (profile.status !== 'approved') {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-logo">
                        <h1>⏳ Menunggu Persetujuan</h1>
                        <p>Akun Anda belum disetujui</p>
                    </div>
                    <div className="alert alert-warning">
                        Status akun Anda: <strong>{profile.status}</strong>. Silakan hubungi Admin atau Owner untuk persetujuan.
                    </div>
                    <button className="btn btn-secondary btn-full" onClick={() => window.location.href = '/login'}>
                        🔄 Kembali ke Login
                    </button>
                </div>
            </div>
        )
    }

    if (allowedMenuKey && profile.role !== 'admin' && !hasMenuAccess(allowedMenuKey)) {
        return (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
                <h2 style={{ marginBottom: '8px' }}>Akses Ditolak</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Anda tidak memiliki izin untuk mengakses halaman ini.</p>
            </div>
        )
    }

    return children
}

function PublicRoute({ children }) {
    const { profile, loading } = useAuth()

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
                <p style={{ color: 'var(--text-secondary)' }}>Memuat...</p>
            </div>
        )
    }

    if (profile && profile.status === 'approved') return <Navigate to="/dashboard" replace />
    return children
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<ProtectedRoute allowedMenuKey="dashboard"><Dashboard /></ProtectedRoute>} />

                {/* Master Produk */}
                <Route path="master/kategori" element={<ProtectedRoute allowedMenuKey="kategori"><KategoriPage /></ProtectedRoute>} />
                <Route path="master/supplier" element={<ProtectedRoute allowedMenuKey="supplier"><SupplierPage /></ProtectedRoute>} />
                <Route path="master/produk" element={<ProtectedRoute allowedMenuKey="produk"><ProdukPage /></ProtectedRoute>} />

                {/* Penjualan TikTok */}
                <Route path="tiktok/penjualan" element={<ProtectedRoute allowedMenuKey="penjualan-tt"><PenjualanTiktokPage /></ProtectedRoute>} />
                <Route path="tiktok/keuangan" element={<ProtectedRoute allowedMenuKey="keuangan-tt"><KeuanganTiktokPage /></ProtectedRoute>} />
                <Route path="tiktok/return" element={<ProtectedRoute allowedMenuKey="return"><ReturnPage /></ProtectedRoute>} />
                <Route path="tiktok/failed-cod" element={<ProtectedRoute allowedMenuKey="failed-cod"><FailedCodPage /></ProtectedRoute>} />

                {/* Konten */}
                <Route path="konten/dashboard" element={<ProtectedRoute allowedMenuKey="dashboard-konten"><DashboardKontenPage /></ProtectedRoute>} />
                <Route path="konten/data-akun" element={<ProtectedRoute allowedMenuKey="data-akun"><DataAkunPage /></ProtectedRoute>} />
                <Route path="konten/laporan-konten" element={<ProtectedRoute allowedMenuKey="laporan-konten"><LaporanKontenPage /></ProtectedRoute>} />
                <Route path="konten/laporan-live" element={<ProtectedRoute allowedMenuKey="laporan-live"><LaporanLivePage /></ProtectedRoute>} />

                {/* Inventory */}
                <Route path="inventory/stok-overview" element={<ProtectedRoute allowedMenuKey="stok-overview"><StokOverviewPage /></ProtectedRoute>} />
                <Route path="inventory/stok-mutation" element={<ProtectedRoute allowedMenuKey="stok-mutation"><StokMutationPage /></ProtectedRoute>} />

                {/* Keuangan */}
                <Route path="keuangan/pembelian" element={<ProtectedRoute allowedMenuKey="pembelian"><PembelianPage /></ProtectedRoute>} />
                <Route path="keuangan/pembayaran" element={<ProtectedRoute allowedMenuKey="pembayaran"><PembayaranPage /></ProtectedRoute>} />
                <Route path="keuangan/pemasukan" element={<ProtectedRoute allowedMenuKey="pemasukan"><PemasukanPage /></ProtectedRoute>} />
                <Route path="keuangan/pengeluaran" element={<ProtectedRoute allowedMenuKey="pengeluaran"><PengeluaranPage /></ProtectedRoute>} />
                <Route path="keuangan/laba-rugi" element={<ProtectedRoute allowedMenuKey="laba-rugi"><LabaRugiPage /></ProtectedRoute>} />
                <Route path="keuangan/neraca" element={<ProtectedRoute allowedMenuKey="neraca"><NeracaPage /></ProtectedRoute>} />
                <Route path="keuangan/pindah-buku" element={<ProtectedRoute allowedMenuKey="pindah-buku"><PindahBukuPage /></ProtectedRoute>} />

                {/* Management User */}
                <Route path="users" element={<ProtectedRoute allowedMenuKey="users"><ManagementUserPage /></ProtectedRoute>} />

                {/* Pengaturan */}
                <Route path="pengaturan/general" element={<ProtectedRoute allowedMenuKey="general"><GeneralPage /></ProtectedRoute>} />
                <Route path="pengaturan/coa" element={<ProtectedRoute allowedMenuKey="coa"><CoaPage /></ProtectedRoute>} />
                <Route path="pengaturan/hak-akses" element={<ProtectedRoute allowedMenuKey="hak-akses"><HakAksesPage /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    )
}

export default function App() {
    return (
        <ThemeProvider>
            <BrowserRouter>
                <AuthProvider>
                    <AppRoutes />
                </AuthProvider>
            </BrowserRouter>
        </ThemeProvider>
    )
}
