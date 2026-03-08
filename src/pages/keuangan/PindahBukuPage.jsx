import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import CrudPage from '../../components/CrudPage'

export default function PindahBukuPage() {
    const [kasBankOptions, setKasBankOptions] = useState([])
    const [fromAccount, setFromAccount] = useState('')
    const [toAccount, setToAccount] = useState('')

    useEffect(() => {
        async function loadOptions() {
            // Load only Kas/Bank accounts from COA
            const { data } = await supabase
                .from('coa')
                .select('id, code, name, description')
                .eq('account_group', 'Kas/Bank')
                .order('code')
                .order('name')

            if (data) {
                const options = data.map(a => {
                    let label = a.code ? `[${a.code}] ${a.name}` : a.name
                    if (a.description) label += ` - ${a.description}`
                    return { value: a.code ? `[${a.code}] ${a.name}` : a.name, label }
                })
                setKasBankOptions(options)
            }
        }
        loadOptions()
    }, [])

    function handleFormChange(name, value) {
        if (name === 'from_account') setFromAccount(value || '')
        if (name === 'to_account') setToAccount(value || '')
    }

    // Custom validation logic to ensure from != to and both are selected
    const customValidation = (formData) => {
        if (!formData.from_account) return "Sumber Dana harus diisi"
        if (!formData.to_account) return "Tujuan Dana harus diisi"
        if (formData.from_account === formData.to_account) return "Sumber dan Tujuan Dana tidak boleh sama"
        if (!formData.amount || formData.amount <= 0) return "Jumlah harus lebih dari 0"
        return null
    }

    return (
        <CrudPage
            tableName="transfers"
            title="Pindah Buku"
            icon="🔀"
            columns={[
                { key: 'date', label: 'Tanggal', format: 'date' },
                { key: 'from_account', label: 'Dari Rekening' },
                { key: 'to_account', label: 'Ke Rekening' },
                { key: 'amount', label: 'Jumlah', format: 'currency' },
                { key: 'note', label: 'Keterangan' }
            ]}
            formFields={[
                { name: 'date', label: 'Tanggal', type: 'date', required: true },
                {
                    name: 'from_account',
                    label: 'Sumber Dana (Dari)',
                    type: 'select',
                    options: kasBankOptions,
                    required: true
                },
                {
                    name: 'to_account',
                    label: 'Tujuan Dana (Ke)',
                    type: 'select',
                    options: kasBankOptions,
                    required: true
                },
                { name: 'amount', label: 'Jumlah Nominal', type: 'number', required: true },
                { name: 'note', label: 'Keterangan / Catatan', type: 'textarea' }
            ]}
            onFormChange={handleFormChange}
            customValidation={customValidation}
        />
    )
}
