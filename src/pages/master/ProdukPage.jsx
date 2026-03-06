import { useState, useEffect } from 'react'
import CrudPage from '../../components/CrudPage'
import { supabase } from '../../lib/supabase'

export default function ProdukPage() {
    const [categories, setCategories] = useState([])

    useEffect(() => {
        loadCategories()
    }, [])

    async function loadCategories() {
        const { data } = await supabase.from('categories').select('id, name').order('name')
        setCategories(data || [])
    }

    const handleValidate = async (dataToSave, editItem) => {
        if (!dataToSave.sku) return 'SKU tidak boleh kosong.'

        let query = supabase.from('products').select('id').eq('sku', dataToSave.sku)
        if (editItem) {
            query = query.neq('id', editItem.id) // allow same SKU on same item during edit
        }

        const { data: existing } = await query
        if (existing && existing.length > 0) {
            return `SKU '${dataToSave.sku}' sudah digunakan produk lain. Harap gunakan SKU unik.`
        }
        return null // No errors
    }

    return (
        <CrudPage
            tableName="products"
            title="Produk"
            icon="📦"
            onValidate={handleValidate}
            columns={[
                { key: 'sku', label: 'SKU' },
                { key: 'name', label: 'Name' },
                { key: 'variant', label: 'Variant' },
                { key: 'category', label: 'Category' },
                { key: 'hpp', label: 'HPP', format: 'currency' },
                { key: 'price', label: 'Price', format: 'currency' },
                { key: 'created_at', label: 'Created At', format: 'date' }
            ]}
            formFields={[
                { name: 'sku', label: 'SKU', placeholder: 'SKU-001' },
                { name: 'name', label: 'Name', placeholder: 'Nama produk' },
                { name: 'variant', label: 'Variant', placeholder: 'Warna, ukuran, dll', required: false },
                { name: 'category', label: 'Category', type: 'select', options: categories.map(c => ({ value: c.name, label: c.name })) },
                { name: 'hpp', label: 'HPP (Harga Pokok)', type: 'number', placeholder: '0' },
                { name: 'price', label: 'Price (Harga Jual)', type: 'number', placeholder: '0' },
            ]}
        />
    )
}
