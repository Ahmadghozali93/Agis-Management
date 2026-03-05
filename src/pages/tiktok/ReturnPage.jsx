import CrudPage from '../../components/CrudPage'

export default function ReturnPage() {
    return (
        <CrudPage
            tableName="tiktok_returns"
            title="Return"
            icon="🔄"
            columns={[
                { key: 'order_id', label: 'Order ID' },
                { key: 'product_name', label: 'Produk' },
                { key: 'reason', label: 'Alasan' },
                { key: 'status', label: 'Status', format: 'badge', badgeMap: { 'pending': 'badge-warning', 'disetujui': 'badge-success', 'ditolak': 'badge-danger' } },
                { key: 'date', label: 'Tanggal', format: 'date' }
            ]}
            formFields={[
                { name: 'order_id', label: 'Order ID', placeholder: 'TT-001' },
                { name: 'product_name', label: 'Nama Produk', placeholder: 'Nama produk' },
                { name: 'reason', label: 'Alasan Return', type: 'textarea', placeholder: 'Alasan return' },
                {
                    name: 'status', label: 'Status', type: 'select', options: [
                        { value: 'pending', label: 'Pending' },
                        { value: 'disetujui', label: 'Disetujui' },
                        { value: 'ditolak', label: 'Ditolak' }
                    ]
                },
                { name: 'date', label: 'Tanggal', type: 'date' }
            ]}
        />
    )
}
