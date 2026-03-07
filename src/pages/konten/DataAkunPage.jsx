import CrudPage from '../../components/CrudPage'

export default function DataAkunPage() {
    return (
        <CrudPage
            tableName="content_accounts"
            title="Data Akun"
            icon="📱"
            columns={[
                { key: 'account_name', label: 'Nama Akun' },
                { key: 'username', label: 'Username' },
                {
                    key: 'platform', label: 'Platform', format: 'badge', badgeMap: {
                        'TikTok': 'badge-purple', 'Instagram': 'badge-warning',
                        'YouTube': 'badge-danger', 'Facebook': 'badge-info', 'Shopee': 'badge-success'
                    }
                },
                { key: 'main_product', label: 'Produk Utama' },
                {
                    key: 'status', label: 'Status', format: 'badge', badgeMap: {
                        'active': 'badge-success', 'inactive': 'badge-danger'
                    }
                }
            ]}
            formFields={[
                { name: 'account_name', label: 'Nama Akun', placeholder: 'Nama akun / toko' },
                { name: 'username', label: 'Username', placeholder: '@username' },
                {
                    name: 'platform', label: 'Platform', type: 'select', options: [
                        { value: 'TikTok', label: 'TikTok' },
                        { value: 'Instagram', label: 'Instagram' },
                        { value: 'YouTube', label: 'YouTube' },
                        { value: 'Facebook', label: 'Facebook' },
                        { value: 'Shopee', label: 'Shopee' }
                    ]
                },
                { name: 'main_product', label: 'Produk Utama', type: 'text', placeholder: 'Nama produk utama' },
                {
                    name: 'status', label: 'Status', type: 'select', options: [
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' }
                    ]
                }
            ]}
        />
    )
}
