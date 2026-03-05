import CrudPage from '../../components/CrudPage'

export default function PemasukanPage() {
    return (
        <CrudPage
            tableName="incomes"
            title="Pemasukan"
            icon="💰"
            columns={[
                { key: 'source', label: 'Sumber' },
                { key: 'amount', label: 'Jumlah', format: 'currency' },
                { key: 'note', label: 'Catatan' },
                { key: 'date', label: 'Tanggal', format: 'date' }
            ]}
            formFields={[
                { name: 'source', label: 'Sumber Pemasukan', placeholder: 'Contoh: Penjualan TikTok' },
                { name: 'amount', label: 'Jumlah', type: 'number', placeholder: '0' },
                { name: 'note', label: 'Catatan', type: 'textarea', placeholder: 'Catatan tambahan', required: false },
                { name: 'date', label: 'Tanggal', type: 'date' }
            ]}
        />
    )
}
