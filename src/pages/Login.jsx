import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const { login, profile } = useAuth()

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await login(email, password)
            // Wait a moment for profile to load
            setTimeout(() => {
                navigate('/dashboard')
            }, 500)
        } catch (err) {
            setError(err.message || 'Login gagal. Periksa email dan password.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <h1>🛍️ Olshop Manager</h1>
                    <p>Masuk ke akun Anda</p>
                </div>

                {error && <div className="alert alert-error">⚠️ {error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="email@contoh.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="Masukkan password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                        {loading ? '⏳ Memproses...' : '🔑 Masuk'}
                    </button>
                </form>

                <div className="auth-footer">
                    Belum punya akun? <Link to="/register">Daftar disini</Link>
                </div>
            </div>
        </div>
    )
}
