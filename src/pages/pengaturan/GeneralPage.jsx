import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function GeneralPage() {
    const { fetchGlobalSettings } = useAuth()
    const [settings, setSettings] = useState({ store_name: '', logo_url: '' })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
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

    async function handleLogoUpload(e) {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            // Check if user is authenticated completely
            const { data: session } = await supabase.auth.getSession()
            if (!session?.session?.user) throw new Error("Anda harus login untuk mengupload file")

            const fileExt = file.name.split('.').pop()
            const fileName = `logo-${Date.now()}.${fileExt}`
            const filePath = `settings/${fileName}`

            // Upload the file to the "assets" bucket
            const { error: uploadError } = await supabase.storage
                .from('assets')
                .upload(filePath, file, { upsert: true })

            if (uploadError) {
                if (uploadError.statusCode === 404 || uploadError.message === 'Bucket not found') {
                    throw new Error('Bucket "assets" belum dibuat di Supabase Storage. Silakan buat bucket publik bernama "assets" terlebih dahulu.')
                }
                throw uploadError
            }

            // Get the public URL
            const { data: publicUrlData } = supabase.storage
                .from('assets')
                .getPublicUrl(filePath)

            setSettings({ ...settings, logo_url: publicUrlData.publicUrl })

        } catch (err) {
            console.error('Upload Error:', err)
            alert(err.message || 'Gagal mengupload logo')
        } finally {
            setUploading(false)
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
            if (fetchGlobalSettings) await fetchGlobalSettings()
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
                                <img src={settings.logo_url} alt="Logo" style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain' }} />
                            ) : '🛍️'}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                            <input
                                type="url"
                                className="form-input"
                                placeholder="URL logo (https://...) atau upload gambar"
                                value={settings.logo_url || ''}
                                onChange={e => setSettings({ ...settings, logo_url: e.target.value })}
                            />
                            <label className="btn btn-secondary" style={{ cursor: 'pointer', opacity: uploading ? 0.7 : 1 }}>
                                {uploading ? '⏳' : 'Pilih File'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    style={{ display: 'none' }}
                                    disabled={uploading}
                                />
                            </label>
                        </div>
                        <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                            Masukkan URL gambar langsung ATAU pilih file dari komputer untuk diupload.
                        </small>
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
