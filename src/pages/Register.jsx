import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'host'
    })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)
    const { register } = useAuth()

    function handleChange(e) {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')

        if (formData.password !== formData.confirmPassword) {
            setError('Password dan konfirmasi password tidak cocok')
            return
        }

        if (formData.password.length < 6) {
            setError('Password minimal 6 karakter')
            return
        }

        setLoading(true)
        try {
            await register(formData.email, formData.password, formData.fullName, formData.role)
            setSuccess(true)
        } catch (err) {
            setError(err.message || 'Registrasi gagal. Coba lagi.')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-logo">
                        <h1>✅ Registrasi Berhasil</h1>
                        <p>Akun Anda sedang menunggu persetujuan</p>
                    </div>
                    <div className="alert alert-warning">
                        ⏳ Akun Anda dalam status <strong>Pending Approval</strong>. Admin atau Owner akan menyetujui akun Anda. Silakan coba login setelah disetujui.
                    </div>
                    <Link to="/login" className="btn btn-primary btn-full">
                        🔑 Ke Halaman Login
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <h1>🛍️ Olshop Manager</h1>
                    <p>Buat akun baru</p>
                </div>

                {error && <div className="alert alert-error">⚠️ {error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nama Lengkap</label>
                        <input
                            type="text"
                            className="form-input"
                            name="fullName"
                            placeholder="Masukkan nama lengkap"
                            value={formData.fullName}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            className="form-input"
                            name="email"
                            placeholder="email@contoh.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Role yang Diminta</label>
                        <select
                            className="form-select"
                            name="role"
                            value={formData.role}
                            onChange={handleChange}
                        >
                            <option value="host">Host</option>
                            <option value="creator">Creator</option>
                            <option value="spv">SPV (Supervisor)</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            className="form-input"
                            name="password"
                            placeholder="Minimal 6 karakter"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Konfirmasi Password</label>
                        <input
                            type="password"
                            className="form-input"
                            name="confirmPassword"
                            placeholder="Ketik ulang password"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                        {loading ? '⏳ Memproses...' : '📝 Daftar'}
                    </button>
                </form>

                <div className="auth-footer">
                    Sudah punya akun? <Link to="/login">Masuk disini</Link>
                </div>
            </div>
        </div>
    )
}
