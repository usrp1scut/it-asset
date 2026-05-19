import { Button, Popconfirm, Upload, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'

interface Attachment {
  key: string
  name: string
  content_type: string
  size: number
  uploaded_at: string
}

function AttachmentThumb({ code, att }: { code: string; att: Attachment }) {
  const isImage = att.content_type.startsWith('image/')
  const { data: url } = useQuery<string>({
    queryKey: ['attachment-blob', att.key],
    enabled: isImage,
    queryFn: async () => {
      const r = await api.get(`/assets/${code}/attachments/raw`, {
        params: { key: att.key },
        responseType: 'blob',
      })
      return URL.createObjectURL(r.data as Blob)
    },
  })

  const download = async () => {
    const r = await api.get(`/assets/${code}/attachments/raw`, {
      params: { key: att.key },
      responseType: 'blob',
    })
    const href = URL.createObjectURL(r.data as Blob)
    const el = document.createElement('a')
    el.href = href
    el.download = att.name
    el.click()
    URL.revokeObjectURL(href)
  }

  return (
    <div
      style={{
        width: 120,
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <div
        style={{
          height: 90,
          display: 'grid',
          placeItems: 'center',
          background: 'var(--fill-2, #f5f5f5)',
          cursor: 'pointer',
        }}
        onClick={download}
      >
        {isImage && url ? (
          <img src={url} alt={att.name} style={{ maxWidth: '100%', maxHeight: 90 }} />
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {att.content_type.includes('pdf') ? 'PDF' : '文件'}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 11,
          padding: '4px 6px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={att.name}
      >
        {att.name}
      </div>
    </div>
  )
}

export default function AssetAttachments({ code }: { code: string }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Attachment[]>({
    queryKey: ['attachments', code],
    queryFn: async () => (await api.get(`/assets/${code}/attachments`)).data,
  })

  const del = useMutation({
    mutationFn: async (key: string) =>
      api.delete(`/assets/${code}/attachments`, { params: { key } }),
    onSuccess: () => {
      message.success('已删除')
      qc.invalidateQueries({ queryKey: ['attachments', code] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '删除失败'),
  })

  const items = data ?? []

  return (
    <div style={{ padding: 16 }}>
      <Upload
        accept="image/*,application/pdf"
        multiple
        showUploadList={false}
        customRequest={async ({ file, onSuccess, onError }) => {
          const fd = new FormData()
          fd.append('file', file as Blob)
          try {
            await api.post(`/assets/${code}/attachments`, fd)
            message.success('上传成功')
            qc.invalidateQueries({ queryKey: ['attachments', code] })
            onSuccess?.({})
          } catch (e) {
            const err = e as { response?: { data?: { detail?: string } } }
            message.error(err.response?.data?.detail ?? '上传失败')
            onError?.(e as Error)
          }
        }}
      >
        <Button type="primary">上传附件 / 照片</Button>
      </Upload>
      <div style={{ fontSize: 12, color: 'var(--text-3)', margin: '8px 0 16px' }}>
        支持 图片 / PDF,单文件 ≤ 10MB
      </div>

      {isLoading ? (
        <span style={{ color: 'var(--text-3)', fontSize: 13 }}>加载中…</span>
      ) : items.length === 0 ? (
        <span style={{ color: 'var(--text-3)', fontSize: 13 }}>暂无附件</span>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {items.map((att) => (
            <div key={att.key} style={{ position: 'relative' }}>
              <AttachmentThumb code={code} att={att} />
              <Popconfirm
                title="删除该附件?"
                onConfirm={() => del.mutate(att.key)}
                okText="删除"
                cancelText="取消"
              >
                <Button
                  size="small"
                  danger
                  style={{ position: 'absolute', top: 4, right: 4, padding: '0 6px' }}
                >
                  ×
                </Button>
              </Popconfirm>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
