import CrudPage from '../../components/CrudPage'

export default function KategoriPage() {
    return (
        <CrudPage
            tableName="categories"
            title="Kategori"
            icon="🏷️"
            columns={[
                { key: 'id', label: 'ID', format: 'shortId' },
                { key: 'name', label: 'Name' },
                { key: 'description', label: 'Description' },
                { key: 'created_at', label: 'Created At', format: 'date' }
            ]}
            formFields={[
                { name: 'name', label: 'Name', placeholder: 'Masukkan nama kategori' },
                { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Deskripsi kategori', required: false }
            ]}
        />
    )
}
