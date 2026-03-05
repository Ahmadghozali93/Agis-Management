import CrudPage from '../../components/CrudPage'

export default function LaporanKontenPage() {
    return (
        <CrudPage
            tableName="content_reports"
            title="Laporan Konten"
            icon="📝"
            columns={[
                { key: 'title', label: 'Judul Konten' },
                { key: 'platform', label: 'Platform' },
                { key: 'type', label: 'Tipe', format: 'badge', badgeMap: { 'video': 'badge-purple', 'image': 'badge-info', 'story': 'badge-warning' } },
                { key: 'views', label: 'Views', format: 'number' },
                { key: 'likes', label: 'Likes', format: 'number' },
                { key: 'comments', label: 'Comments', format: 'number' },
                { key: 'date', label: 'Tanggal', format: 'date' }
            ]}
            formFields={[
                { name: 'title', label: 'Judul Konten', placeholder: 'Judul konten' },
                {
                    name: 'platform', label: 'Platform', type: 'select', options: [
                        { value: 'TikTok', label: 'TikTok' },
                        { value: 'Instagram', label: 'Instagram' },
                        { value: 'YouTube', label: 'YouTube' },
                        { value: 'Facebook', label: 'Facebook' }
                    ]
                },
                {
                    name: 'type', label: 'Tipe', type: 'select', options: [
                        { value: 'video', label: 'Video' },
                        { value: 'image', label: 'Image' },
                        { value: 'story', label: 'Story' }
                    ]
                },
                { name: 'views', label: 'Views', type: 'number', placeholder: '0' },
                { name: 'likes', label: 'Likes', type: 'number', placeholder: '0' },
                { name: 'comments', label: 'Comments', type: 'number', placeholder: '0' },
                { name: 'date', label: 'Tanggal', type: 'date' }
            ]}
        />
    )
}
