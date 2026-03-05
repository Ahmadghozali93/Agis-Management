import CrudPage from '../../components/CrudPage'

export default function PembayaranPage() {
    return (
        <CrudPage
            tableName="payments"
            title="Pembayaran"
            icon="💳"
            columns={[
                { key: 'description', label: 'Keterangan' },
                { key: 'amount', label: 'Jumlah', format: 'currency' },
                { key: 'method', label: 'Metode', format: 'badge', badgeMap: { 'transfer': 'badge-info', 'cash': 'badge-success', 'ewallet': 'badge-purple' } },
                { key: 'date', label: 'Tanggal', format: 'date' }
            ]}
            formFields={[
                { name: 'description', label: 'Keterangan', placeholder: 'Keterangan pembayaran' },
                { name: 'amount', label: 'Jumlah', type: 'number', placeholder: '0' },
                {
                    name: 'method', label: 'Metode', type: 'select', options: [
                        { value: 'transfer', label: 'Transfer Bank' },
                        { value: 'cash', label: 'Cash' },
                        { value: 'ewallet', label: 'E-Wallet' }
                    ]
                },
                { name: 'date', label: 'Tanggal', type: 'date' }
            ]}
        />
    )
}
