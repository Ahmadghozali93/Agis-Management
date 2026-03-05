import CrudPage from '../../components/CrudPage'

export default function SupplierPage() {
    return (
        <CrudPage
            tableName="suppliers"
            title="Supplier"
            icon="🚚"
            columns={[
                { key: 'name', label: 'Nama Supplier' },
                { key: 'phone', label: 'Telepon' },
                { key: 'address', label: 'Alamat' },
                { key: 'created_at', label: 'Dibuat', format: 'date' }
            ]}
            formFields={[
                { name: 'name', label: 'Nama Supplier', placeholder: 'Masukkan nama supplier' },
                { name: 'phone', label: 'Telepon', placeholder: '08xxxxxxxxxx' },
                { name: 'address', label: 'Alamat', type: 'textarea', placeholder: 'Alamat supplier', required: false }
            ]}
        />
    )
}
