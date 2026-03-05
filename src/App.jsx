import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
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
import AgregatorPage from './pages/AgregatorPage'
import DataAkunPage from './pages/konten/DataAkunPage'
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
import ManagementUserPage from './pages/users/ManagementUserPage'
import GeneralPage from './pages/pengaturan/GeneralPage'
import AkunBankPage from './pages/pengaturan/AkunBankPage'

function ProtectedRoute({ children, allowedRoles }) {
    const { profile, loading } = useAuth()

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

    if (allowedRoles && !allowedRoles.includes(profile.role)) {
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

const ALL = ['admin', 'owner', 'spv', 'host', 'creator']
const ADMIN_OWNER = ['admin', 'owner']
const MANAGEMENT = ['admin', 'owner', 'spv']
const SALES = ['admin', 'owner', 'spv', 'host']

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<ProtectedRoute allowedRoles={ALL}><Dashboard /></ProtectedRoute>} />

                {/* Master Produk */}
                <Route path="master/kategori" element={<ProtectedRoute allowedRoles={MANAGEMENT}><KategoriPage /></ProtectedRoute>} />
                <Route path="master/supplier" element={<ProtectedRoute allowedRoles={MANAGEMENT}><SupplierPage /></ProtectedRoute>} />
                <Route path="master/produk" element={<ProtectedRoute allowedRoles={MANAGEMENT}><ProdukPage /></ProtectedRoute>} />

                {/* Penjualan TikTok */}
                <Route path="tiktok/penjualan" element={<ProtectedRoute allowedRoles={SALES}><PenjualanTiktokPage /></ProtectedRoute>} />
                <Route path="tiktok/keuangan" element={<ProtectedRoute allowedRoles={SALES}><KeuanganTiktokPage /></ProtectedRoute>} />
                <Route path="tiktok/return" element={<ProtectedRoute allowedRoles={SALES}><ReturnPage /></ProtectedRoute>} />
                <Route path="tiktok/failed-cod" element={<ProtectedRoute allowedRoles={SALES}><FailedCodPage /></ProtectedRoute>} />

                {/* Agregator */}
                <Route path="agregator" element={<ProtectedRoute allowedRoles={MANAGEMENT}><AgregatorPage /></ProtectedRoute>} />

                {/* Konten */}
                <Route path="konten/data-akun" element={<ProtectedRoute allowedRoles={ALL}><DataAkunPage /></ProtectedRoute>} />
                <Route path="konten/laporan-konten" element={<ProtectedRoute allowedRoles={ALL}><LaporanKontenPage /></ProtectedRoute>} />
                <Route path="konten/laporan-live" element={<ProtectedRoute allowedRoles={ALL}><LaporanLivePage /></ProtectedRoute>} />

                {/* Inventory */}
                <Route path="inventory/stok-overview" element={<ProtectedRoute allowedRoles={MANAGEMENT}><StokOverviewPage /></ProtectedRoute>} />
                <Route path="inventory/stok-mutation" element={<ProtectedRoute allowedRoles={MANAGEMENT}><StokMutationPage /></ProtectedRoute>} />

                {/* Keuangan */}
                <Route path="keuangan/pembelian" element={<ProtectedRoute allowedRoles={MANAGEMENT}><PembelianPage /></ProtectedRoute>} />
                <Route path="keuangan/pembayaran" element={<ProtectedRoute allowedRoles={MANAGEMENT}><PembayaranPage /></ProtectedRoute>} />
                <Route path="keuangan/pemasukan" element={<ProtectedRoute allowedRoles={MANAGEMENT}><PemasukanPage /></ProtectedRoute>} />
                <Route path="keuangan/pengeluaran" element={<ProtectedRoute allowedRoles={MANAGEMENT}><PengeluaranPage /></ProtectedRoute>} />
                <Route path="keuangan/laba-rugi" element={<ProtectedRoute allowedRoles={MANAGEMENT}><LabaRugiPage /></ProtectedRoute>} />
                <Route path="keuangan/neraca" element={<ProtectedRoute allowedRoles={MANAGEMENT}><NeracaPage /></ProtectedRoute>} />

                {/* Management User */}
                <Route path="users" element={<ProtectedRoute allowedRoles={ADMIN_OWNER}><ManagementUserPage /></ProtectedRoute>} />

                {/* Pengaturan */}
                <Route path="pengaturan/general" element={<ProtectedRoute allowedRoles={ADMIN_OWNER}><GeneralPage /></ProtectedRoute>} />
                <Route path="pengaturan/akun-bank" element={<ProtectedRoute allowedRoles={ADMIN_OWNER}><AkunBankPage /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    )
}
