import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Button,
  DatePicker,
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
import dayjs, { type Dayjs } from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Asset, AssetListResponse, AssetStatus } from '../features/assets/types'
import StatusBadge from '../features/assets/StatusBadge'
import AssetDrawer from '../features/assets/AssetDrawer'
import LabelsPrintModal from '../features/assets/LabelsPrintModal'
import AssetTypeIcon from '../components/AssetTypeIcon'
import Icon from '../components/Icon'
import CameraScanner from '../features/scanner/CameraScanner'

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
  // Treat the search box as a POSIX regex (case-insensitive) instead of a
  // plain substring match.
  const [regex, setRegex] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [snScanOpen, setSnScanOpen] = useState(false)
  // Pre-fill for "copy from existing asset": carries descriptive + procurement
  // fields (model/spec/type/location/supplier/date/price/remark) but NOT the
  // per-unit fields (serial number, owner) which must be unique / reassigned.
  const [copySeed, setCopySeed] = useState<Record<string, unknown> | null>(null)
  const [copyFromCode, setCopyFromCode] = useState<string | null>(null)
  const [form] = Form.useForm()
  const size = 20
  const qc = useQueryClient()

  const openCreateBlank = () => {
    setCopySeed(null)
    setCopyFromCode(null)
    setCreateOpen(true)
  }

  const openCreateFromAsset = (a: Asset) => {
    setOpenCode(null) // close the detail drawer
    setCopySeed({
      asset_type_id: a.asset_type_id ?? undefined,
      brand_model: a.brand_model ?? undefined,
      spec: a.spec ?? undefined,
      location: a.location ?? undefined,
      supplier: a.supplier ?? undefined,
      purchase_date: a.purchase_date ? dayjs(a.purchase_date) : undefined,
      purchase_price: a.purchase_price ? Number(a.purchase_price) : undefined,
      remark: a.remark ?? undefined,
    })
    setCopyFromCode(a.asset_code)
    setCreateOpen(true)
  }

  // Drive the create form whenever it opens (runs after the form commits, so
  // it's deterministic across reopen — AntD won't re-apply initialValues to a
  // persisted form store). Blank first, then layer the copy seed if any.
  useEffect(() => {
    if (!createOpen) return
    form.resetFields()
    if (copySeed) form.setFieldsValue(copySeed)
  }, [createOpen, copySeed, form])

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

  const { data, isLoading, error } = useQuery<AssetListResponse>({
    queryKey: ['assets', status, q, regex, page, needsReview],
    retry: false, // an invalid regex is a 400 — don't hammer it
    queryFn: async () =>
      (
        await api.get('/assets', {
          params: {
            status: status || undefined,
            q: q || undefined,
            regex: regex || undefined,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AssetTypeIcon icon={r.asset_type_icon} color={r.asset_type_color} size={34} />
          <div style={{ minWidth: 0 }}>
            <div>{r.brand_model ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {r.asset_type_name ? `${r.asset_type_name}${r.spec ? ' · ' : ''}` : ''}
              {r.spec ?? ''}
            </div>
          </div>
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
          <Button type="primary" onClick={openCreateBlank}>
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
      <Space style={{ marginBottom: error ? 4 : 16 }}>
        <Input.Search
          placeholder={
            regex
              ? '正则匹配 编号/型号/序列号/责任人(如 ^PC-00\\d{2}$)'
              : '搜索编号 / 型号 / 序列号 / 责任人'
          }
          allowClear
          style={{ width: 360 }}
          onSearch={(v) => {
            setQ(v)
            setPage(1)
          }}
        />
        <Tag.CheckableTag
          checked={regex}
          onChange={(c) => {
            setRegex(c)
            setPage(1)
          }}
          style={{
            border: '1px solid var(--border)',
            padding: '4px 10px',
            fontSize: 13,
          }}
        >
          正则
        </Tag.CheckableTag>
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
      {error && (
        <div style={{ color: '#F53F3F', fontSize: 12, marginBottom: 12 }}>
          {(error as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
            '搜索失败'}
        </div>
      )}
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
        title={copyFromCode ? `新增资产 · 复制自 ${copyFromCode}` : '新增资产'}
        width={620}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending}
        destroyOnClose
      >
        {copyFromCode && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={`已从 ${copyFromCode} 复制型号 / 配置 / 采购信息`}
            description="序列号与责任人未复制(每台需唯一 / 单独分配),请按本台实物填写。"
          />
        )}
        <Form
          form={form}
          layout="vertical"
          onFinish={(v: Record<string, unknown>) => {
            const body: Record<string, unknown> = {}
            for (const [k, val] of Object.entries(v)) {
              if (val === '' || val === undefined || val === null) continue
              body[k] = k === 'purchase_date' ? (val as Dayjs).format('YYYY-MM-DD') : val
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
              <Input
                addonAfter={
                  <span
                    role="button"
                    title="扫描条形码录入"
                    onClick={() => setSnScanOpen(true)}
                    style={{ cursor: 'pointer', display: 'inline-flex' }}
                  >
                    <Icon name="qr" size={16} />
                  </span>
                }
              />
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
            <Form.Item name="purchase_date" label="采购日期" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
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

      <CameraScanner
        open={snScanOpen}
        mode="raw"
        title="扫描序列号条形码"
        hint="将设备序列号条形码对准取景框,识别后自动填入。"
        onClose={() => setSnScanOpen(false)}
        onCode={(_code, raw) => {
          form.setFieldValue('serial_number', raw)
          setSnScanOpen(false)
          message.success('序列号已填入')
        }}
      />
      <AssetDrawer
        code={openCode}
        onClose={() => setOpenCode(null)}
        onCodeChange={(newCode) => setOpenCode(newCode)}
        onCopy={openCreateFromAsset}
      />
      <LabelsPrintModal
        open={labelsOpen}
        onClose={() => setLabelsOpen(false)}
        codes={selectedCodes}
      />
    </div>
  )
}
