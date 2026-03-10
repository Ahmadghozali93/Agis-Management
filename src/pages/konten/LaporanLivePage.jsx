import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import CrudPage from '../../components/CrudPage'

export default function LaporanLivePage() {
    const [accounts, setAccounts] = useState([])
    const [users, setUsers] = useState([])

    useEffect(() => {
        async function loadOptions() {
            const [accRes, userRes] = await Promise.all([
                supabase.from('content_accounts').select('id, account_name, username, platform').order('account_name'),
                supabase.from('profiles').select('id, full_name, role').eq('role', 'host').order('full_name')
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

    const hostOptions = users.map(u => ({ value: u.full_name, label: `${u.full_name} (${u.role})` }))

    const platformOptions = [...new Set(accounts.map(a => a.platform))].filter(Boolean).map(p => ({ value: p, label: p }))
    if (platformOptions.length === 0) {
        ;['TikTok', 'Instagram', 'YouTube', 'Shopee Live'].forEach(p => platformOptions.push({ value: p, label: p }))
    }

    const handleValidate = async (item, status, loadData) => {
        try {
            const { error } = await supabase.from('live_reports').update({ validation_status: status }).eq('id', item.id)
            if (error) throw error
            loadData() // Refresh table
        } catch (err) {
            alert('Gagal mengupdate status: ' + err.message)
        }
    }

    const renderCustomActions = (item, loadData) => {
        if (item.validation_status !== 'pending') return null
        return (
            <>
                <button className="btn btn-sm btn-success" onClick={() => handleValidate(item, 'approved', loadData)} title="Approve">✅</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleValidate(item, 'rejected', loadData)} title="Reject">❌</button>
            </>
        )
    }

    return (
        <CrudPage
            tableName="live_reports"
            title="Laporan Live"
            icon="🔴"
            columns={[
                { key: 'date', label: 'Tanggal', format: 'date' },
                { key: 'host', label: 'Host' },
                {
                    key: 'platform', label: 'Platform', format: 'badge', badgeMap: {
                        'TikTok': 'badge-purple', 'Instagram': 'badge-warning',
                        'YouTube': 'badge-danger', 'Shopee Live': 'badge-success'
                    }
                },
                { key: 'account_name', label: 'Nama Akun' },
                { key: 'duration', label: 'Durasi (menit)', format: 'number' },
                { key: 'viewers', label: 'Penonton', format: 'number' },
                { key: 'revenue', label: 'Omzet', format: 'currency' },
                {
                    key: 'validation_status', label: 'Validasi', format: 'badge', badgeMap: {
                        'pending': 'badge-warning', 'approved': 'badge-success', 'rejected': 'badge-danger'
                    }
                }
            ]}
            formFields={[
                { name: 'date', label: 'Tanggal', type: 'date' },
                { name: 'host', label: 'Host', type: 'select', options: hostOptions },
                { name: 'platform', label: 'Platform', type: 'select', options: platformOptions },
                { name: 'account_name', label: 'Nama Akun', type: 'select', options: accountOptions },
                { name: 'duration', label: 'Durasi (menit)', type: 'number', placeholder: '0' },
                { name: 'viewers', label: 'Penonton', type: 'number', placeholder: '0' },
                { name: 'revenue', label: 'Omzet', type: 'number', placeholder: '0' }
            ]}
            customActions={renderCustomActions}
        />
    )
}
