import CrudPage from '../../components/CrudPage'

export default function LaporanLivePage() {
    return (
        <CrudPage
            tableName="live_reports"
            title="Laporan Live"
            icon="🔴"
            columns={[
                { key: 'title', label: 'Judul Live' },
                { key: 'platform', label: 'Platform' },
                { key: 'viewers', label: 'Viewers', format: 'number' },
                { key: 'duration', label: 'Durasi (menit)', format: 'number' },
                { key: 'revenue', label: 'Revenue', format: 'currency' },
                { key: 'products_sold', label: 'Produk Terjual', format: 'number' },
                { key: 'date', label: 'Tanggal', format: 'date' }
            ]}
            formFields={[
                { name: 'title', label: 'Judul Live', placeholder: 'Judul sesi live' },
                {
                    name: 'platform', label: 'Platform', type: 'select', options: [
                        { value: 'TikTok', label: 'TikTok' },
                        { value: 'Shopee Live', label: 'Shopee Live' },
                        { value: 'Instagram', label: 'Instagram Live' },
                        { value: 'YouTube', label: 'YouTube Live' }
                    ]
                },
                { name: 'viewers', label: 'Jumlah Viewers', type: 'number', placeholder: '0' },
                { name: 'duration', label: 'Durasi (menit)', type: 'number', placeholder: '0' },
                { name: 'revenue', label: 'Revenue', type: 'number', placeholder: '0' },
                { name: 'products_sold', label: 'Produk Terjual', type: 'number', placeholder: '0' },
                { name: 'date', label: 'Tanggal', type: 'date' }
            ]}
        />
    )
}
