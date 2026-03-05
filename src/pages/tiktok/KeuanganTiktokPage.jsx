import CrudPage from '../../components/CrudPage'

export default function KeuanganTiktokPage() {
    return (
        <CrudPage
            tableName="tiktok_finance"
            title="Keuangan TikTok"
            icon="💳"
            columns={[
                { key: 'description', label: 'Keterangan' },
                { key: 'type', label: 'Tipe', format: 'badge', badgeMap: { 'masuk': 'badge-success', 'keluar': 'badge-danger' } },
                { key: 'amount', label: 'Jumlah', format: 'currency' },
                { key: 'date', label: 'Tanggal', format: 'date' }
            ]}
            formFields={[
                { name: 'description', label: 'Keterangan', placeholder: 'Keterangan transaksi' },
                {
                    name: 'type', label: 'Tipe', type: 'select', options: [
                        { value: 'masuk', label: 'Masuk' },
                        { value: 'keluar', label: 'Keluar' }
                    ]
                },
                { name: 'amount', label: 'Jumlah', type: 'number', placeholder: '0' },
                { name: 'date', label: 'Tanggal', type: 'date' }
            ]}
        />
    )
}
