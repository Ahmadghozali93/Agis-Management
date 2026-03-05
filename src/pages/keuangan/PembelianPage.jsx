import CrudPage from '../../components/CrudPage'

export default function PembelianPage() {
    return (
        <CrudPage
            tableName="purchases"
            title="Pembelian"
            icon="🛍️"
            columns={[
                { key: 'supplier_name', label: 'Supplier' },
                { key: 'items', label: 'Item' },
                { key: 'total', label: 'Total', format: 'currency' },
                { key: 'status', label: 'Status', format: 'badge', badgeMap: { 'lunas': 'badge-success', 'belum_lunas': 'badge-warning', 'batal': 'badge-danger' } },
                { key: 'date', label: 'Tanggal', format: 'date' }
            ]}
            formFields={[
                { name: 'supplier_name', label: 'Nama Supplier', placeholder: 'Nama supplier' },
                { name: 'items', label: 'Item/Keterangan', type: 'textarea', placeholder: 'Detail item' },
                { name: 'total', label: 'Total', type: 'number', placeholder: '0' },
                {
                    name: 'status', label: 'Status', type: 'select', options: [
                        { value: 'belum_lunas', label: 'Belum Lunas' },
                        { value: 'lunas', label: 'Lunas' },
                        { value: 'batal', label: 'Batal' }
                    ]
                },
                { name: 'date', label: 'Tanggal', type: 'date' }
            ]}
        />
    )
}
