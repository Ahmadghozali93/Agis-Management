import CrudPage from '../../components/CrudPage'

export default function DataAkunPage() {
    return (
        <CrudPage
            tableName="content_accounts"
            title="Data Akun"
            icon="📱"
            columns={[
                { key: 'platform', label: 'Platform' },
                { key: 'username', label: 'Username' },
                { key: 'followers', label: 'Followers', format: 'number' },
                { key: 'status', label: 'Status', format: 'badge', badgeMap: { 'active': 'badge-success', 'inactive': 'badge-danger' } },
                { key: 'created_at', label: 'Dibuat', format: 'date' }
            ]}
            formFields={[
                {
                    name: 'platform', label: 'Platform', type: 'select', options: [
                        { value: 'TikTok', label: 'TikTok' },
                        { value: 'Instagram', label: 'Instagram' },
                        { value: 'YouTube', label: 'YouTube' },
                        { value: 'Facebook', label: 'Facebook' },
                        { value: 'Shopee Live', label: 'Shopee Live' }
                    ]
                },
                { name: 'username', label: 'Username', placeholder: '@username' },
                { name: 'followers', label: 'Followers', type: 'number', placeholder: '0' },
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
