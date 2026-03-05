import CrudPage from '../../components/CrudPage'

export default function KategoriPage() {
    return (
        <CrudPage
            tableName="categories"
            title="Kategori"
            icon="🏷️"
            columns={[
                { key: 'name', label: 'Nama Kategori' },
                { key: 'description', label: 'Deskripsi' },
                { key: 'created_at', label: 'Dibuat', format: 'date' }
            ]}
            formFields={[
                { name: 'name', label: 'Nama Kategori', placeholder: 'Masukkan nama kategori' },
                { name: 'description', label: 'Deskripsi', type: 'textarea', placeholder: 'Deskripsi kategori', required: false }
            ]}
        />
    )
}
