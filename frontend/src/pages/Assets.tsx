import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Upload,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Asset, AssetListResponse, AssetStatus } from '../features/assets/types'
import StatusBadge from '../features/assets/StatusBadge'
import AssetDrawer from '../features/assets/AssetDrawer'
import LabelsPrintModal from '../features/assets/LabelsPrintModal'

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: '全部' },
  { key: 'in_use', label: '在用' },
  { key: 'idle', label: '闲置' },
  { key: 'maintenance', label: '维修中' },
  { key: 'scrapped', label: '已报废' },
]

export default function Assets() {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [openCode, setOpenCode] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  // Deep link from scanned QR: /assets?code=PC-0099 → auto-open the drawer.
  useEffect(() => {
    const c = params.get('code')
    if (c) {
      setOpenCode(c)
      params.delete('code')
      setParams(params, { replace: true })
    }
  }, [params, setParams])
  const [needsReview, setNeedsReview] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [form] = Form.useForm()
  const size = 20
  const qc = useQueryClient()

  const createMut = useMutation({
    mutationFn: async (body: object) => (await api.post('/assets', body)).data,
    onSuccess: (a: { asset_code: string }) => {
      message.success(`已创建 ${a.asset_code}`)
      qc.invalidateQueries({ queryKey: ['assets'] })
      setCreateOpen(false)
      form.resetFields()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '创建失败'),
  })

  const { data, isLoading } = useQuery<AssetListResponse>({
    queryKey: ['assets', status, q, page, needsReview],
    queryFn: async () =>
      (
        await api.get('/assets', {
          params: {
            status: status || undefined,
            q: q || undefined,
            needs_review: needsReview || undefined,
            page,
            size,
          },
        })
      ).data,
  })

  interface AssetTypeOption {
    id: number
    name: string
    code_prefix: string
    asset_class: 'personal' | 'infrastructure'
  }
  const { data: types } = useQuery<AssetTypeOption[]>({
    queryKey: ['asset-types'],
    queryFn: async () => (await api.get('/asset-types')).data,
  })

  const columns: ColumnsType<Asset> = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      render: (v: string, r) => (
        <span>
          <a style={{ color: 'var(--lark-blue)' }} className="text-mono">
            {v}
          </a>
          {r.legacy_code && (
            <Tag style={{ marginLeft: 6 }} color="default">
              {r.legacy_code}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: '名称 / 配置',
      render: (_, r) => (
        <div>
          <div>{r.brand_model ?? '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.spec ?? ''}</div>
        </div>
      ),
    },
    { title: '状态', dataIndex: 'status', render: (s: AssetStatus) => <StatusBadge status={s} /> },
    {
      title: '责任人',
      render: (_, r) => r.owner_name ?? (r.owner_user_id ? `#${r.owner_user_id}` : '—'),
    },
    { title: '地点', dataIndex: 'location', render: (v) => v ?? '—' },
    {
      title: '采购价',
      dataIndex: 'purchase_price',
      render: (v: string | null) => (v ? `¥ ${Number(v).toLocaleString()}` : '—'),
    },
    { title: '保修至', dataIndex: 'warranty_expire_date', render: (v) => v ?? '—' },
    {
      title: '标记',
      render: (_, r) => (
        <>
          {r.scrap_candidate && <Tag color="error">报废候选</Tag>}
          {r.needs_review && <Tag color="warning">待核</Tag>}
        </>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>资产台账</h2>
        <Space>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            新增资产
          </Button>
          <Upload
            accept=".xlsx"
            showUploadList={false}
            customRequest={async ({ file, onSuccess, onError }) => {
              const fd = new FormData()
              fd.append('file', file as Blob)
              try {
                const { data: s } = await api.post('/assets/import', fd)
                message.success(
                  `导入完成:新增 ${s.created} · 更新 ${s.updated} · 待核 ${s.needs_review}`,
                )
                qc.invalidateQueries({ queryKey: ['assets'] })
                onSuccess?.(s)
              } catch (e) {
                message.error('导入失败')
                onError?.(e as Error)
              }
            }}
          >
            <Button>导入云文档 / Excel</Button>
          </Upload>
          <Button
            onClick={async () => {
              const res = await api.get('/assets/export', { responseType: 'blob' })
              const url = URL.createObjectURL(res.data as Blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'assets.xlsx'
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            导出
          </Button>
          <Button
            disabled={!selectedCodes.length}
            onClick={() => setLabelsOpen(true)}
          >
            打印标签{selectedCodes.length ? ` (${selectedCodes.length})` : ''}
          </Button>
        </Space>
      </div>
      <Tabs
        activeKey={status}
        onChange={(k) => {
          setStatus(k)
          setPage(1)
        }}
        items={STATUS_TABS.map((t) => ({ key: t.key, label: t.label }))}
      />
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索编号 / 型号 / 序列号 / 责任人"
          allowClear
          style={{ width: 360 }}
          onSearch={(v) => {
            setQ(v)
            setPage(1)
          }}
        />
        <Tag.CheckableTag
          checked={needsReview}
          onChange={(c) => {
            setNeedsReview(c)
            setPage(1)
          }}
          style={{
            border: '1px solid var(--border)',
            padding: '4px 10px',
            fontSize: 13,
          }}
        >
          仅看待核
        </Tag.CheckableTag>
      </Space>
      <Table<Asset>
        rowKey="asset_code"
        loading={isLoading}
        columns={columns}
        dataSource={data?.items ?? []}
        onRow={(r) => ({ onClick: () => setOpenCode(r.asset_code), style: { cursor: 'pointer' } })}
        rowSelection={{
          selectedRowKeys: selectedCodes,
          preserveSelectedRowKeys: true,
          onChange: (keys) => setSelectedCodes(keys as string[]),
        }}
        pagination={{
          current: page,
          pageSize: size,
          total: data?.total ?? 0,
          onChange: setPage,
          showTotal: (t) => `共 ${t} 条`,
        }}
      />
      <Modal
        open={createOpen}
        title="新增资产"
        width={620}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{}}
          onFinish={(v: Record<string, unknown>) => {
            const body: Record<string, unknown> = {}
            for (const [k, val] of Object.entries(v)) {
              if (val !== '' && val !== undefined) body[k] = val
            }
            createMut.mutate(body)
          }}
        >
          <Form.Item
            name="asset_type_id"
            label="资产类型(决定编号前缀与个人/基础设施类别)"
            rules={[{ required: true }]}
          >
            <Select
              showSearch
              placeholder="选择资产类型(在「资产类型」页可新建)"
              optionFilterProp="label"
              options={(types ?? []).map((t) => ({
                value: t.id,
                label: `${t.name} · ${t.code_prefix} · ${
                  t.asset_class === 'personal' ? '个人发放' : '基础设施'
                }`,
              }))}
            />
          </Form.Item>
          <Form.Item name="brand_model" label="品牌型号">
            <Input placeholder="如 Apple MacBook Pro 14" />
          </Form.Item>
          <Form.Item name="spec" label="配置">
            <Input placeholder="如 M3 Pro-18g-512g" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="serial_number" label="序列号" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="owner_name" label="责任人(文本)" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="location" label="存放地点" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="supplier" label="供应商" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="purchase_date" label="采购日期 (YYYY-MM-DD)" style={{ flex: 1 }}>
              <Input placeholder="2025-01-15" />
            </Form.Item>
            <Form.Item name="purchase_price" label="采购价" style={{ flex: 1 }}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </div>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <AssetDrawer code={openCode} onClose={() => setOpenCode(null)} />
      <LabelsPrintModal
        open={labelsOpen}
        onClose={() => setLabelsOpen(false)}
        codes={selectedCodes}
      />
    </div>
  )
}
