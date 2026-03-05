import CrudPage from '../../components/CrudPage'

export default function AkunBankPage() {
    return (
        <CrudPage
            tableName="bank_accounts"
            title="Akun Bank"
            icon="🏦"
            columns={[
                { key: 'bank_name', label: 'Nama Bank' },
                { key: 'account_number', label: 'No Rekening' },
                { key: 'account_name', label: 'Atas Nama' },
                { key: 'created_at', label: 'Dibuat', format: 'date' }
            ]}
            formFields={[
                {
                    name: 'bank_name', label: 'Nama Bank', type: 'select', options: [
                        { value: 'BCA', label: 'BCA' },
                        { value: 'BRI', label: 'BRI' },
                        { value: 'BNI', label: 'BNI' },
                        { value: 'Mandiri', label: 'Mandiri' },
                        { value: 'BSI', label: 'BSI' },
                        { value: 'CIMB', label: 'CIMB Niaga' },
                        { value: 'Permata', label: 'Permata' },
                        { value: 'Dana', label: 'Dana' },
                        { value: 'OVO', label: 'OVO' },
                        { value: 'GoPay', label: 'GoPay' },
                        { value: 'ShopeePay', label: 'ShopeePay' },
                        { value: 'Lainnya', label: 'Lainnya' }
                    ]
                },
                { name: 'account_number', label: 'Nomor Rekening', placeholder: '1234567890' },
                { name: 'account_name', label: 'Atas Nama', placeholder: 'Nama pemilik rekening' }
            ]}
        />
    )
}
