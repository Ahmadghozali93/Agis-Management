import CrudPage from '../../components/CrudPage'

export default function FailedCodPage() {
    return (
        <CrudPage
            tableName="tiktok_failed_cod"
            title="Failed COD"
            icon="❌"
            columns={[
                { key: 'order_id', label: 'Order ID' },
                { key: 'product_name', label: 'Produk' },
                { key: 'customer_name', label: 'Pelanggan' },
                { key: 'reason', label: 'Alasan' },
                { key: 'total', label: 'Total', format: 'currency' },
                { key: 'status', label: 'Status', format: 'badge', badgeMap: { 'pending': 'badge-warning', 'resolved': 'badge-success', 'loss': 'badge-danger' } },
                { key: 'date', label: 'Tanggal', format: 'date' }
            ]}
            formFields={[
                { name: 'order_id', label: 'Order ID', placeholder: 'TT-001' },
                { name: 'product_name', label: 'Nama Produk', placeholder: 'Nama produk' },
                { name: 'customer_name', label: 'Nama Pelanggan', placeholder: 'Nama pelanggan' },
                { name: 'reason', label: 'Alasan Gagal', type: 'textarea', placeholder: 'Alasan COD gagal' },
                { name: 'total', label: 'Total', type: 'number', placeholder: '0' },
                {
                    name: 'status', label: 'Status', type: 'select', options: [
                        { value: 'pending', label: 'Pending' },
                        { value: 'resolved', label: 'Resolved' },
                        { value: 'loss', label: 'Loss' }
                    ]
                },
                { name: 'date', label: 'Tanggal', type: 'date' }
            ]}
        />
    )
}
