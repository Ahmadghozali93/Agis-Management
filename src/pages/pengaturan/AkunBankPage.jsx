import { useState } from 'react'
import CrudPage from '../../components/CrudPage'

const BANK_OPTIONS = [
    { value: 'BCA', label: 'BCA' },
    { value: 'BRI', label: 'BRI' },
    { value: 'BNI', label: 'BNI' },
    { value: 'Mandiri', label: 'Mandiri' },
    { value: 'BSI', label: 'BSI' },
    { value: 'CIMB', label: 'CIMB Niaga' },
    { value: 'Permata', label: 'Permata' },
    { value: 'Lainnya', label: 'Lainnya' }
]

const EWALLET_OPTIONS = [
    { value: 'Dana', label: 'Dana' },
    { value: 'OVO', label: 'OVO' },
    { value: 'GoPay', label: 'GoPay' },
    { value: 'ShopeePay', label: 'ShopeePay' },
    { value: 'Lainnya', label: 'Lainnya' }
]

export default function AkunBankPage() {
    const [accountType, setAccountType] = useState('Bank')

    function handleFormChange(name, value) {
        if (name === 'account_type') {
            setAccountType(value || 'Bank')
        }
    }

    // Build bank_name field dynamically based on account_type
    const bankNameField = accountType === 'Kas'
        ? { name: 'bank_name', label: 'Nama Kas', type: 'text', placeholder: 'Contoh: Kas Besar, Kas Kecil' }
        : {
            name: 'bank_name',
            label: accountType === 'E-Wallet' ? 'Nama E-Wallet' : 'Nama Bank',
            type: 'select',
            options: accountType === 'E-Wallet' ? EWALLET_OPTIONS : BANK_OPTIONS
        }

    return (
        <CrudPage
            tableName="bank_accounts"
            title="Akun Bank"
            icon="🏦"
            columns={[
                { key: 'bank_name', label: 'Nama Bank' },
                { key: 'account_number', label: 'No Rekening' },
                { key: 'account_name', label: 'Atas Nama' },
                { key: 'account_type', label: 'Jenis Akun' },
                { key: 'coa', label: 'COA' },
                { key: 'created_at', label: 'Dibuat', format: 'date' }
            ]}
            formFields={[
                {
                    name: 'account_type', label: 'Jenis Akun', type: 'select', options: [
                        { value: 'Bank', label: 'Bank' },
                        { value: 'Kas', label: 'Kas' },
                        { value: 'E-Wallet', label: 'E-Wallet' }
                    ]
                },
                bankNameField,
                { name: 'account_number', label: 'Nomor Rekening', placeholder: '1234567890', required: accountType !== 'Kas' },
                { name: 'account_name', label: 'Atas Nama', placeholder: 'Nama pemilik rekening' },
                { name: 'coa', label: 'Nomor COA', placeholder: 'Contoh: 1-10020', required: false }
            ]}
            onFormChange={handleFormChange}
        />
    )
}
