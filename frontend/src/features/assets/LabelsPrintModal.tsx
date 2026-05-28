import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Modal, Select, Space, Spin, Typography, message } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'

interface Layout {
  id: string
  label: string
  cols: number
  rows: number
  per_page: number
}

/** Modal that lets the user pick a label layout, preview the PDF inline,
 * and download it. Lazily fetches a fresh PDF each time the layout
 * changes — the file is small (<20KB for 30 labels) so re-rendering on
 * the server beats caching every variant on the client. */
export default function LabelsPrintModal({
  open,
  onClose,
  codes,
}: {
  open: boolean
  onClose: () => void
  codes: string[]
}) {
  const [layoutId, setLayoutId] = useState<string>('compact')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const { data: layouts } = useQuery<Layout[]>({
    queryKey: ['label-layouts'],
    queryFn: async () => (await api.get('/assets/labels/layouts')).data,
    staleTime: Infinity,  // server constant, no point refetching
    enabled: open,
  })

  const layout = useMemo(
    () => (layouts ?? []).find((l) => l.id === layoutId),
    [layouts, layoutId],
  )
  const pages = layout && codes.length
    ? Math.ceil(codes.length / layout.per_page)
    : 0

  // Whenever the modal is open and the layout/codes change, re-render
  // the preview PDF server-side and swap the blob URL.
  useEffect(() => {
    if (!open || codes.length === 0) return
    let cancelled = false
    let currentUrl: string | null = null
    setLoading(true)
    setPreviewError(null)
    api
      .post(
        '/assets/labels',
        { codes, layout: layoutId },
        { responseType: 'blob' },
      )
      .then((res) => {
        if (cancelled) return
        currentUrl = URL.createObjectURL(res.data as Blob)
        setPreviewUrl(currentUrl)
      })
      .catch((e: { response?: { data?: { detail?: string } } }) => {
        if (cancelled) return
        setPreviewError(e.response?.data?.detail ?? '生成 PDF 失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [open, codes, layoutId])

  // Drop the in-memory blob when the modal closes so the URL doesn't
  // outlive its DOM consumer.
  useEffect(() => {
    if (!open) setPreviewUrl(null)
  }, [open])

  const download = () => {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = `asset-labels-${layoutId}.pdf`
    a.click()
    message.success('已开始下载')
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`打印资产标签 · ${codes.length} 个`}
      width={920}
      footer={
        <Space>
          <Button onClick={onClose}>关闭</Button>
          <Button
            type="primary"
            onClick={download}
            disabled={!previewUrl || loading}
          >
            下载 PDF
          </Button>
        </Space>
      }
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Space>
          <span style={{ color: 'var(--text-3)', fontSize: 13 }}>标签布局</span>
          <Select
            value={layoutId}
            onChange={setLayoutId}
            style={{ width: 280 }}
            options={(layouts ?? []).map((l) => ({
              value: l.id,
              label: l.label,
            }))}
          />
          {layout && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              共 {pages} 页 · 每页 {layout.per_page} 张
            </Typography.Text>
          )}
        </Space>

        {previewError ? (
          <Alert type="error" message={previewError} showIcon />
        ) : (
          <div
            style={{
              position: 'relative',
              border: '1px solid var(--border)',
              borderRadius: 8,
              overflow: 'hidden',
              background: '#F2F3F5',
              minHeight: 520,
            }}
          >
            {loading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(255,255,255,0.6)',
                  zIndex: 1,
                }}
              >
                <Spin tip="生成预览中…" />
              </div>
            )}
            {previewUrl && (
              <iframe
                title="标签预览"
                src={previewUrl + '#toolbar=0&navpanes=0'}
                style={{
                  width: '100%',
                  height: 600,
                  border: 'none',
                  background: '#F2F3F5',
                }}
              />
            )}
          </div>
        )}

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          打印时请选择「实际大小」(100% 缩放),不要勾选「适合纸张大小」 ——
          否则 QR 会被等比缩小,扫码距离/可读性下降。
        </Typography.Text>
      </Space>
    </Modal>
  )
}
