import { useState } from 'react'
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

type ConfirmStatus = 'pending' | 'ok' | 'mismatch'
type InspStatus = 'open' | 'closed'

interface TaskListRow {
  id: number
  name: string
  scope_type: string
  status: InspStatus
  started_at: string | null
  ended_at: string | null
  progress: Record<ConfirmStatus, number>
}

interface ItemRow {
  asset_code: string
  brand_model: string | null
  owner_name: string | null
  asset_status: string | null
  location: string | null
  confirm_status: ConfirmStatus
  remark: string | null
}

interface TaskDetail extends TaskListRow {
  items: ItemRow[]
}

const SCOPES: { value: string; label: string }[] = [
  { value: 'personal_in_use', label: '个人在用资产' },
  { value: 'personal_all', label: '所有个人资产(不含报废)' },
  { value: 'infrastructure', label: '所有基础设施' },
  { value: 'by_location', label: '按存放地点' },
  { value: 'by_department', label: '按部门 ID' },
]

const CONFIRM_META: Record<ConfirmStatus, { label: string; color: string }> = {
  pending: { label: '待核', color: 'default' },
  ok: { label: '已确认', color: 'green' },
  mismatch: { label: '差异', color: 'red' },
}

export default function Inspections() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [scope, setScope] = useState('personal_in_use')
  const [createForm] = Form.useForm()
  const [scanCode, setScanCode] = useState('')
  const [scanRemark, setScanRemark] = useState('')
  const [tab, setTab] = useState<'all' | ConfirmStatus>('all')

  const { data: tasks } = useQuery<TaskListRow[]>({
    queryKey: ['inspections'],
    queryFn: async () => (await api.get('/inspections')).data,
  })

  const { data: detail } = useQuery<TaskDetail>({
    queryKey: ['inspection', selectedId],
    queryFn: async () => (await api.get(`/inspections/${selectedId}`)).data,
    enabled: selectedId !== null,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inspections'] })
    if (selectedId !== null)
      qc.invalidateQueries({ queryKey: ['inspection', selectedId] })
  }

  const createMut = useMutation({
    mutationFn: async (body: object) => (await api.post('/inspections', body)).data,
    onSuccess: (t: { id: number; item_count: number }) => {
      message.success(`已创建盘点任务(${t.item_count} 项)`)
      invalidate()
      setCreateOpen(false)
      createForm.resetFields()
      setSelectedId(t.id)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '创建失败'),
  })

  const confirmMut = useMutation({
    mutationFn: async (v: { code: string; status: ConfirmStatus; remark?: string }) =>
      api.post(
        `/inspections/${selectedId}/items/${v.code}/confirm`,
        { status: v.status, remark: v.remark || null },
      ),
    onSuccess: (_d, v) => {
      message.success(v.status === 'ok' ? '已确认' : '已记差异')
      setScanCode('')
      setScanRemark('')
      invalidate()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '操作失败'),
  })

  const closeMut = useMutation({
    mutationFn: async (id: number) => api.post(`/inspections/${id}/close`),
    onSuccess: () => {
      message.success('任务已关闭')
      invalidate()
    },
  })

  const taskCols: ColumnsType<TaskListRow> = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '范围',
      dataIndex: 'scope_type',
      render: (s) => SCOPES.find((x) => x.value === s)?.label ?? s,
    },
    {
      title: '进度',
      render: (_, r) => {
        const total = r.progress.pending + r.progress.ok + r.progress.mismatch
        const done = r.progress.ok + r.progress.mismatch
        const pct = total ? Math.round((done / total) * 100) : 0
        return (
          <div style={{ minWidth: 180 }}>
            <Progress percent={pct} size="small" />
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              共 {total} · OK {r.progress.ok} · 差异 {r.progress.mismatch}
            </span>
          </div>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s: InspStatus) => (
        <Tag color={s === 'open' ? 'blue' : 'default'}>{s === 'open' ? '进行中' : '已关闭'}</Tag>
      ),
    },
    { title: '开始时间', dataIndex: 'started_at', render: (v) => (v ? v.slice(0, 19).replace('T', ' ') : '—') },
  ]

  const itemCols: ColumnsType<ItemRow> = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      render: (v) => <span className="text-mono">{v}</span>,
    },
    {
      title: '名称',
      render: (_, r) => (
        <div>
          <div>{r.brand_model ?? '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {r.owner_name ?? '—'} · {r.location ?? '—'}
          </div>
        </div>
      ),
    },
    {
      title: '核对状态',
      dataIndex: 'confirm_status',
      render: (s: ConfirmStatus) => {
        const m = CONFIRM_META[s]
        return <Tag color={m.color}>{m.label}</Tag>
      },
    },
    { title: '备注', dataIndex: 'remark', render: (v) => v ?? '—' },
  ]

  const items = detail?.items ?? []
  const filtered = tab === 'all' ? items : items.filter((i) => i.confirm_status === tab)

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>资产盘点</h2>
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          新建盘点任务
        </Button>
      </div>

      <Table<TaskListRow>
        rowKey="id"
        columns={taskCols}
        dataSource={tasks ?? []}
        size="small"
        onRow={(r) => ({ onClick: () => setSelectedId(r.id), style: { cursor: 'pointer' } })}
        rowClassName={(r) => (r.id === selectedId ? 'ant-table-row-selected' : '')}
        pagination={{ pageSize: 8 }}
      />

      {detail && (
        <div style={{ marginTop: 24, padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{detail.name}</span>
              <Tag style={{ marginLeft: 8 }} color={detail.status === 'open' ? 'blue' : 'default'}>
                {detail.status === 'open' ? '进行中' : '已关闭'}
              </Tag>
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-3)' }}>
                {SCOPES.find((x) => x.value === detail.scope_type)?.label ?? detail.scope_type}
              </span>
            </div>
            {detail.status === 'open' && (
              <Popconfirm
                title="关闭该盘点任务?"
                onConfirm={() => closeMut.mutate(detail.id)}
                okText="关闭"
                cancelText="取消"
              >
                <Button>关闭任务</Button>
              </Popconfirm>
            )}
          </div>

          {detail.status === 'open' && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 16,
                padding: 12,
                background: 'var(--fill-2, #f5f5f5)',
                borderRadius: 6,
              }}
            >
              <Input
                placeholder="输入或扫描资产编号(如 PC-0001)"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value.trim())}
                onPressEnter={() =>
                  scanCode &&
                  confirmMut.mutate({ code: scanCode, status: 'ok' })
                }
                style={{ flex: 1 }}
              />
              <Input
                placeholder="差异备注(标差异时必填)"
                value={scanRemark}
                onChange={(e) => setScanRemark(e.target.value)}
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                disabled={!scanCode}
                onClick={() => confirmMut.mutate({ code: scanCode, status: 'ok' })}
              >
                确认 OK
              </Button>
              <Button
                danger
                disabled={!scanCode || !scanRemark}
                onClick={() =>
                  confirmMut.mutate({ code: scanCode, status: 'mismatch', remark: scanRemark })
                }
              >
                标差异
              </Button>
            </div>
          )}

          <Tabs
            activeKey={tab}
            onChange={(k) => setTab(k as 'all' | ConfirmStatus)}
            items={[
              { key: 'all', label: `全部 (${items.length})` },
              { key: 'pending', label: `待核 (${detail.progress.pending})` },
              { key: 'ok', label: `已确认 (${detail.progress.ok})` },
              { key: 'mismatch', label: `差异 (${detail.progress.mismatch})` },
            ]}
          />
          <Table<ItemRow>
            rowKey="asset_code"
            columns={itemCols}
            dataSource={filtered}
            size="small"
            pagination={{ pageSize: 10 }}
          />
        </div>
      )}

      <Modal
        open={createOpen}
        title="新建盘点任务"
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMut.isPending}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ scope_type: 'personal_in_use' }}
          onFinish={(v: Record<string, unknown>) => {
            const body: Record<string, unknown> = { name: v.name, scope_type: v.scope_type }
            if (v.scope_type === 'by_location') body.location = v.location
            if (v.scope_type === 'by_department') body.department_id = v.department_id
            createMut.mutate(body)
          }}
        >
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
            <Input placeholder="如 2026 Q2 全员盘点" />
          </Form.Item>
          <Form.Item name="scope_type" label="盘点范围" rules={[{ required: true }]}>
            <Select options={SCOPES} onChange={(v) => setScope(v)} />
          </Form.Item>
          {scope === 'by_location' && (
            <Form.Item name="location" label="存放地点" rules={[{ required: true }]}>
              <Input placeholder="如 上海·张江" />
            </Form.Item>
          )}
          {scope === 'by_department' && (
            <Form.Item name="department_id" label="部门 ID" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Space style={{ marginTop: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          说明:扫码/输入编号 → 选 OK 或差异;差异行可在「资产台账」打开抽屉做转移/报修等处置。
        </span>
      </Space>
    </div>
  )
}
