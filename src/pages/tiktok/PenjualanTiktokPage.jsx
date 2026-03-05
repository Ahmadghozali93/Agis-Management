import CrudPage from '../../components/CrudPage'

export default function PenjualanTiktokPage() {
    return (
        <CrudPage
            tableName="tiktok_sales"
            title="Penjualan TikTok"
            icon="🎵"
            columns={[
                { key: 'order_id', label: 'Order ID' },
                { key: 'product_name', label: 'Produk' },
                { key: 'qty', label: 'Qty', format: 'number' },
                { key: 'total', label: 'Total', format: 'currency' },
                { key: 'status', label: 'Status', format: 'badge', badgeMap: { 'selesai': 'badge-success', 'proses': 'badge-warning', 'batal': 'badge-danger' } },
                { key: 'date', label: 'Tanggal', format: 'date' }
            ]}
            formFields={[
                { name: 'order_id', label: 'Order ID', placeholder: 'TT-001' },
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
