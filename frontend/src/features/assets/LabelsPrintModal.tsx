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
  const [startOffset, setStartOffset] = useState(0)
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
  const perPage = layout?.per_page ?? 0
  // Clamp the start slot to one page so it always fits the chosen grid.
  const offset = perPage ? Math.min(startOffset, perPage - 1) : 0
  const pages = layout && codes.length
    ? Math.ceil((offset + codes.length) / layout.per_page)
    : 0
  // Reset the start slot whenever the layout (grid shape) changes.
  useEffect(() => {
    setStartOffset(0)
  }, [layoutId])

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
        { codes, layout: layoutId, start_offset: offset },
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
  }, [open, codes, layoutId, offset])

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

        {layout && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <span style={{ color: 'var(--text-3)', fontSize: 13 }}>
                起始位置(复用余纸)· 第 {offset + 1} 格起
              </span>
              {offset > 0 && (
                <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setStartOffset(0)}>
                  重置 · 从第 1 格
                </Button>
              )}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                gap: 4,
                maxWidth: layout.cols <= 2 ? 220 : layout.cols === 3 ? 300 : 380,
              }}
            >
              {Array.from({ length: layout.per_page }, (_, idx) => {
                const printing = idx >= offset && idx < offset + codes.length
                const skipped = idx < offset
                return (
                  <div
                    key={idx}
                    onClick={() => setStartOffset(idx)}
                    title={`第 ${idx + 1} 格${skipped ? ' · 跳过(留空)' : ''}`}
                    style={{
                      height: 28,
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 11,
                      userSelect: 'none',
                      border: '1px solid',
                      borderStyle: skipped ? 'dashed' : 'solid',
                      borderColor: printing ? 'var(--lark-blue)' : 'var(--border)',
                      background: printing ? 'var(--lark-blue)' : skipped ? '#F2F3F5' : '#fff',
                      color: printing ? '#fff' : '#C9CDD4',
                    }}
                  >
                    {printing ? idx - offset + 1 : ''}
                  </div>
                )
              })}
            </div>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, display: 'block', marginTop: 6 }}
            >
              点选起始格,跳过左上角已撕掉的位置(虚线灰格留空不打印),复用余下的标签纸。
            </Typography.Text>
          </div>
        )}

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
