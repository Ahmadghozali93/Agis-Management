import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import CrudPage from '../../components/CrudPage'

export default function PemasukanPage() {
    const [categories, setCategories] = useState([])
    const [paymentAccounts, setPaymentAccounts] = useState([])
    const [activeCategory, setActiveCategory] = useState('')

    useEffect(() => {
        async function loadOptions() {
            const [catRes, payRes] = await Promise.all([
                supabase.from('coa').select('id, code, name, parent_id').in('type', ['income', 'equity', 'liability', 'payable']).is('parent_id', null).order('code').order('name'),
                supabase.from('coa').select('id, code, name, description').eq('account_group', 'Kas/Bank').order('code').order('name')
            ])
            if (catRes.data) setCategories(catRes.data)
            if (payRes.data) setPaymentAccounts(payRes.data)
        }
        loadOptions()
    }, [])

    const categoryOptions = categories.map(c => {
        const label = c.code ? `[${c.code}] ${c.name}` : c.name
        return { value: label, label }
    })
    const paymentOptions = paymentAccounts.map(a => {
        let label = a.code ? `[${a.code}] ${a.name}` : a.name
        if (a.description) label += ` - ${a.description}`
        return { value: a.code ? `[${a.code}] ${a.name}` : a.name, label }
    })

    function handleFormChange(name, value) {
        if (name === 'category') {
            setActiveCategory(value || '')
        }
    }

    async function handleDeleteIncome(item) {
        // Jika pencairan TikTok dihapus, hapus juga data withdraw di tiktok_withdrawals
        if (item.category && item.category.includes('Pencairan TikTok') && item.sub_category) {
            console.log('Deleting associated withdraw for store:', item.sub_category, 'amount:', item.amount, 'target_bank:', item.payment_method)
            await supabase.from('tiktok_withdrawals')
                .delete()
                .eq('store', item.sub_category)
                .eq('amount', item.amount)
                .eq('target_bank', item.payment_method || '')
        }
    }

    return (
        <CrudPage
            tableName="incomes"
            title="Pemasukan"
            icon="💰"
            columns={[
                { key: 'date', label: 'Tanggal', format: 'date' },
                { key: 'category', label: 'Kategori' },
                { key: 'amount', label: 'Jumlah', format: 'currency' },
                { key: 'payment_method', label: 'Metode Pembayaran' },
                { key: 'note', label: 'Catatan' }
            ]}
            formFields={[
                { name: 'date', label: 'Tanggal', type: 'date' },
                { name: 'category', label: 'Kategori Pendapatan', type: 'select', options: categoryOptions },
                { name: 'amount', label: 'Jumlah Uang', type: 'number', placeholder: '0' },
                { name: 'payment_method', label: 'Akun Kas/Bank (Masuk Ke)', type: 'select', options: paymentOptions },
                { name: 'note', label: 'Keterangan / Catatan', type: 'textarea', placeholder: 'Catatan tambahan', required: false }
            ]}
            onFormChange={handleFormChange}
            onDelete={handleDeleteIncome}
        />
    )
}
