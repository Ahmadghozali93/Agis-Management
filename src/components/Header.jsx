import { useAuth } from '../context/AuthContext'

export default function Header({ sidebarCollapsed, onToggleSidebar, title }) {
    const { profile, logout } = useAuth()

    return (
        <header className={`header ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <div className="header-left">
                <button className="header-toggle" onClick={onToggleSidebar} title="Toggle Sidebar">
                    ☰
                </button>
                <h1 className="header-title">{title}</h1>
            </div>
            <div className="header-right">
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
