import CrudPage from '../../components/CrudPage'

export default function SupplierPage() {
    return (
        <CrudPage
            tableName="suppliers"
            title="Supplier"
            icon="🚚"
            columns={[
                { key: 'id', label: 'ID', format: 'shortId' },
                { key: 'name', label: 'Name' },
                { key: 'description', label: 'Description' },
                {
                    key: 'status', label: 'Status', format: 'badge', badgeMap: {
                        'active': 'badge-success',
                        'inactive': 'badge-danger'
                    }
                },
                { key: 'created_at', label: 'Created At', format: 'date' }
            ]}
            formFields={[
                { name: 'name', label: 'Name', placeholder: 'Masukkan nama supplier' },
                { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Deskripsi supplier', required: false },
                {
                    name: 'status', label: 'Status', type: 'select', defaultValue: 'active', options: [
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' }
                    ]
                }
            ]}
        />
    )
}
