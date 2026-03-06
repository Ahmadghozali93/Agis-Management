import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function Header({ sidebarCollapsed, onToggleSidebar, title }) {
    const { profile, logout } = useAuth()
    const { theme, toggleTheme } = useTheme()

    return (
        <header className={`header ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <div className="header-left">
                <button className="header-toggle" onClick={onToggleSidebar} title="Toggle Sidebar">
                    ☰
                </button>
                <h1 className="header-title">{title}</h1>
            </div>
            <div className="header-right">
                <button
                    className="theme-toggle"
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
                >
                    <div className={`theme-toggle-track ${theme === 'light' ? 'light' : ''}`}>
                        <span className="theme-toggle-icon sun">☀️</span>
                        <span className="theme-toggle-icon moon">🌙</span>
                        <div className="theme-toggle-thumb" />
                    </div>
                </button>
                <span className="badge badge-purple" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                    {profile?.role}
                </span>
                <button className="header-logout" onClick={logout}>
                    🚪 Logout
                </button>
            </div>
        </header>
    )
}
