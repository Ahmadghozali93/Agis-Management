import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import CrudPage from '../../components/CrudPage'

export default function PengeluaranPage() {
    const [expenseAccounts, setExpenseAccounts] = useState([])
    const [paymentAccounts, setPaymentAccounts] = useState([])

    useEffect(() => {
        async function loadOptions() {
            const [expRes, payRes] = await Promise.all([
                supabase.from('coa').select('id, code, name').in('type', ['expense', 'liability', 'payable', 'equity']).order('code').order('name'),
                supabase.from('coa').select('id, code, name, description').eq('account_group', 'Kas/Bank').order('code').order('name')
            ])
            if (expRes.data) setExpenseAccounts(expRes.data)
            if (payRes.data) setPaymentAccounts(payRes.data)
        }
        loadOptions()
    }, [])

    const expOptions = expenseAccounts.map(c => ({ value: c.code ? `[${c.code}] ${c.name}` : c.name, label: c.code ? `[${c.code}] ${c.name}` : c.name }))
    const paymentOptions = paymentAccounts.map(a => {
        let label = a.code ? `[${a.code}] ${a.name}` : a.name
        if (a.description) label += ` - ${a.description}`
        return { value: a.code ? `[${a.code}] ${a.name}` : a.name, label }
    })

    return (
        <CrudPage
            tableName="expenses"
            title="Pengeluaran"
            icon="💸"
            columns={[
                { key: 'date', label: 'Tanggal', format: 'date' },
                { key: 'category', label: 'Akun Beban' },
                { key: 'amount', label: 'Jumlah', format: 'currency' },
                { key: 'payment_method', label: 'Dibayar Dari' },
                { key: 'note', label: 'Catatan' }
            ]}
            formFields={[
                { name: 'date', label: 'Tanggal', type: 'date' },
                { name: 'category', label: 'Akun Beban (COA)', type: 'select', options: expOptions },
                { name: 'amount', label: 'Jumlah Uang', type: 'number', placeholder: '0' },
                { name: 'payment_method', label: 'Dibayar Dari (Akun Kas/Bank)', type: 'select', options: paymentOptions },
                { name: 'note', label: 'Catatan', type: 'textarea', placeholder: 'Catatan pengeluaran', required: false }
            ]}
        />
    )
}
