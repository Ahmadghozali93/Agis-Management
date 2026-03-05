import CrudPage from '../../components/CrudPage'

export default function ProdukPage() {
    return (
        <CrudPage
            tableName="products"
            title="Produk"
            icon="📦"
            columns={[
                { key: 'name', label: 'Nama Produk' },
                { key: 'sku', label: 'SKU' },
                { key: 'price', label: 'Harga', format: 'currency' },
                { key: 'stock', label: 'Stok', format: 'number' },
                { key: 'created_at', label: 'Dibuat', format: 'date' }
            ]}
            formFields={[
                { name: 'name', label: 'Nama Produk', placeholder: 'Masukkan nama produk' },
                { name: 'sku', label: 'SKU', placeholder: 'SKU-001' },
                { name: 'price', label: 'Harga', type: 'number', placeholder: '0' },
                { name: 'stock', label: 'Stok', type: 'number', placeholder: '0' },
                { name: 'description', label: 'Deskripsi', type: 'textarea', placeholder: 'Deskripsi produk', required: false }
            ]}
        />
    )
}
