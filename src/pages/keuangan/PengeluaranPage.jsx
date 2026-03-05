import CrudPage from '../../components/CrudPage'

export default function PengeluaranPage() {
    return (
        <CrudPage
            tableName="expenses"
            title="Pengeluaran"
            icon="💸"
            columns={[
                { key: 'category', label: 'Kategori' },
                { key: 'amount', label: 'Jumlah', format: 'currency' },
                { key: 'note', label: 'Catatan' },
                { key: 'date', label: 'Tanggal', format: 'date' }
            ]}
            formFields={[
                {
                    name: 'category', label: 'Kategori', type: 'select', options: [
                        { value: 'Operasional', label: 'Operasional' },
                        { value: 'Gaji', label: 'Gaji' },
                        { value: 'Marketing', label: 'Marketing' },
                        { value: 'Packaging', label: 'Packaging' },
                        { value: 'Ongkir', label: 'Ongkir' },
                        { value: 'Lainnya', label: 'Lainnya' }
                    ]
                },
                { name: 'amount', label: 'Jumlah', type: 'number', placeholder: '0' },
                { name: 'note', label: 'Catatan', type: 'textarea', placeholder: 'Catatan pengeluaran', required: false },
                { name: 'date', label: 'Tanggal', type: 'date' }
            ]}
        />
    )
}
