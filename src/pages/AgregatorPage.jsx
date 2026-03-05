import CrudPage from '../components/CrudPage'

export default function AgregatorPage() {
    return (
        <CrudPage
            tableName="aggregator_sales"
            title="Penjualan Agregator"
            icon="🛒"
            columns={[
                { key: 'platform', label: 'Platform' },
                { key: 'order_id', label: 'Order ID' },
                { key: 'product_name', label: 'Produk' },
                { key: 'qty', label: 'Qty', format: 'number' },
                { key: 'total', label: 'Total', format: 'currency' },
                { key: 'status', label: 'Status', format: 'badge', badgeMap: { 'selesai': 'badge-success', 'proses': 'badge-warning', 'batal': 'badge-danger' } },
                { key: 'date', label: 'Tanggal', format: 'date' }
            ]}
            formFields={[
                {
                    name: 'platform', label: 'Platform', type: 'select', options: [
                        { value: 'Shopee', label: 'Shopee' },
                        { value: 'Tokopedia', label: 'Tokopedia' },
                        { value: 'Lazada', label: 'Lazada' },
                        { value: 'Bukalapak', label: 'Bukalapak' },
                        { value: 'Blibli', label: 'Blibli' },
                        { value: 'Lainnya', label: 'Lainnya' }
                    ]
                },
                { name: 'order_id', label: 'Order ID', placeholder: 'AGR-001' },
                { name: 'product_name', label: 'Nama Produk', placeholder: 'Nama produk' },
                { name: 'qty', label: 'Qty', type: 'number', placeholder: '1' },
                { name: 'total', label: 'Total', type: 'number', placeholder: '0' },
                {
                    name: 'status', label: 'Status', type: 'select', options: [
                        { value: 'proses', label: 'Proses' },
                        { value: 'selesai', label: 'Selesai' },
                        { value: 'batal', label: 'Batal' }
                    ]
                },
                { name: 'date', label: 'Tanggal', type: 'date' }
            ]}
        />
    )
}
