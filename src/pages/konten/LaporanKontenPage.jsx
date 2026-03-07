import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import CrudPage from '../../components/CrudPage'

export default function LaporanKontenPage() {
    const [accounts, setAccounts] = useState([])
    const [users, setUsers] = useState([])

    useEffect(() => {
        async function loadOptions() {
            const [accRes, userRes] = await Promise.all([
                supabase.from('content_accounts').select('id, account_name, username, platform').order('account_name'),
                supabase.from('profiles').select('id, full_name, role').eq('role', 'creator').order('full_name')
            ])
            if (accRes.data) setAccounts(accRes.data)
            if (userRes.data) setUsers(userRes.data)
        }
        loadOptions()
    }, [])

    const accountOptions = accounts.map(a => ({
        value: a.account_name || a.username,
        label: `${a.account_name || a.username} (${a.platform})`
    }))

    const creatorOptions = users.map(u => ({ value: u.full_name, label: `${u.full_name} (${u.role})` }))

    const platformOptions = [...new Set(accounts.map(a => a.platform))].filter(Boolean).map(p => ({ value: p, label: p }))
    if (platformOptions.length === 0) {
        ;['TikTok', 'Instagram', 'YouTube', 'Facebook', 'Shopee'].forEach(p => platformOptions.push({ value: p, label: p }))
    }

    return (
        <CrudPage
            tableName="content_reports"
            title="Laporan Konten"
            icon="📝"
            columns={[
                { key: 'date', label: 'Tanggal', format: 'date' },
                { key: 'creator', label: 'Kreator' },
                {
                    key: 'platform', label: 'Platform', format: 'badge', badgeMap: {
                        'TikTok': 'badge-purple', 'Instagram': 'badge-warning',
                        'YouTube': 'badge-danger', 'Facebook': 'badge-info', 'Shopee': 'badge-success'
                    }
                },
                { key: 'account_name', label: 'Nama Akun' },
                { key: 'title', label: 'Judul' },
                { key: 'concept', label: 'Konsep' },
                { key: 'link', label: 'Link' },
                {
                    key: 'validation_status', label: 'Validasi', format: 'badge', badgeMap: {
                        'pending': 'badge-warning', 'approved': 'badge-success', 'rejected': 'badge-danger'
                    }
                }
            ]}
            formFields={[
                { name: 'date', label: 'Tanggal', type: 'date' },
                { name: 'creator', label: 'Kreator', type: 'select', options: creatorOptions },
                { name: 'platform', label: 'Platform', type: 'select', options: platformOptions },
                { name: 'account_name', label: 'Nama Akun', type: 'select', options: accountOptions },
                { name: 'title', label: 'Judul Konten', placeholder: 'Judul konten' },
                { name: 'concept', label: 'Konsep', placeholder: 'Deskripsi konsep konten' },
                { name: 'link', label: 'Link', placeholder: 'https://...', required: false },
                {
                    name: 'validation_status', label: 'Status Validasi (Admin)', type: 'select', options: [
                        { value: 'pending', label: '⏳ Pending' },
                        { value: 'approved', label: '✅ Approved' },
                        { value: 'rejected', label: '❌ Rejected' }
                    ]
                }
            ]}
        />
    )
}
