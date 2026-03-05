import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function GeneralPage() {
    const [settings, setSettings] = useState({ store_name: '', logo_url: '' })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)

    useEffect(() => { loadSettings() }, [])

    async function loadSettings() {
        try {
            const { data } = await supabase.from('settings').select('*').limit(1).single()
            if (data) setSettings(data)
        } catch (err) {
            console.log('No settings yet')
        } finally {
            setLoading(false)
        }
    }

    async function handleSave(e) {
        e.preventDefault()
        setSaving(true)
        setSuccess(false)
        try {
            if (settings.id) {
                const { error } = await supabase.from('settings').update({
                    store_name: settings.store_name,
                    logo_url: settings.logo_url
                }).eq('id', settings.id)
                if (error) throw error
            } else {
                const { data, error } = await supabase.from('settings').insert([{
                    store_name: settings.store_name,
                    logo_url: settings.logo_url
                }]).select().single()
                if (error) throw error
                setSettings(data)
            }
            setSuccess(true)
            setTimeout(() => setSuccess(false), 3000)
        } catch (err) {
            console.error('Save error:', err)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="empty-state"><div className="spinner"></div><p>Memuat...</p></div>

    return (
        <div>
            <div className="page-header">
                <h1>⚙️ Pengaturan General</h1>
            </div>

            {success && <div className="alert alert-success">✅ Pengaturan berhasil disimpan!</div>}

            <form onSubmit={handleSave}>
                <div className="settings-section">
                    <h3>🏪 Informasi Toko</h3>

                    <div className="form-group">
                        <label>Logo Toko</label>
                        <div className="logo-preview">
                            {settings.logo_url ? (
                                <img src={settings.logo_url} alt="Logo" />
                            ) : '🛍️'}
                        </div>
                        <input
                            type="url"
                            className="form-input"
                            placeholder="URL logo (https://...)"
                            value={settings.logo_url || ''}
                            onChange={e => setSettings({ ...settings, logo_url: e.target.value })}
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Masukkan URL gambar logo</small>
                    </div>

                    <div className="form-group">
                        <label>Nama Toko</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Nama toko Anda"
                            value={settings.store_name || ''}
                            onChange={e => setSettings({ ...settings, store_name: e.target.value })}
                        />
                    </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? '⏳ Menyimpan...' : '💾 Simpan Pengaturan'}
                </button>
            </form>
        </div>
    )
}
