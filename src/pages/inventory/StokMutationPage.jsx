import CrudPage from '../../components/CrudPage'

export default function StokMutationPage() {
    return (
        <CrudPage
            tableName="stock_mutations"
            title="Stok Mutation"
            icon="🔄"
            columns={[
                { key: 'product_name', label: 'Produk' },
                { key: 'type', label: 'Tipe', format: 'badge', badgeMap: { 'in': 'badge-success', 'out': 'badge-danger' } },
                { key: 'qty', label: 'Jumlah', format: 'number' },
                { key: 'note', label: 'Catatan' },
                { key: 'date', label: 'Tanggal', format: 'date' }
            ]}
            formFields={[
                { name: 'product_name', label: 'Nama Produk', placeholder: 'Nama produk' },
                {
                    name: 'type', label: 'Tipe', type: 'select', options: [
                        { value: 'in', label: 'Masuk (In)' },
                        { value: 'out', label: 'Keluar (Out)' }
                    ]
                },
                { name: 'qty', label: 'Jumlah', type: 'number', placeholder: '0' },
                { name: 'note', label: 'Catatan', type: 'textarea', placeholder: 'Catatan mutasi stok', required: false },
                { name: 'date', label: 'Tanggal', type: 'date' }
            ]}
        />
    )
}
