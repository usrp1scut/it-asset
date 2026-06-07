import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import CameraScanner from '../features/scanner/CameraScanner'

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
  expected_owner_id: number | null
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

// ── kanban helpers ───────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#3370FF', '#00B42A', '#FF8800', '#7E5EE5',
  '#F53F3F', '#00B2C7', '#D4380D', '#52C41A',
]
function colorFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function CircleProgress({ percent, size = 38, color }: { percent: number; size?: number; color: string }) {
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F2F3F5" strokeWidth="3" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (percent / 100) * c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.4s' }}
      />
    </svg>
  )
}

const ITEM_DOT: Record<ConfirmStatus, { dot: string; bg: string }> = {
  pending: { dot: '#86909C', bg: '#FAFBFC' },
  ok: { dot: '#00B42A', bg: '#fff' },
  mismatch: { dot: '#F53F3F', bg: '#FFF7F5' },
}

const CONFIRM_LABEL: Record<ConfirmStatus, string> = {
  pending: '待确认',
  ok: '已确认',
  mismatch: '差异',
}

interface OwnerBucket {
  key: string
  name: string
  isUnassigned: boolean
  items: ItemRow[]
  ok: number
  mismatch: number
  pending: number
}

function bucketByOwner(items: ItemRow[]): OwnerBucket[] {
  const map = new Map<string, OwnerBucket>()
  for (const it of items) {
    const unassigned = it.expected_owner_id == null && !it.owner_name
    const key = it.expected_owner_id != null ? `u${it.expected_owner_id}` : `n:${it.owner_name ?? '__'}`
    let b = map.get(key)
    if (!b) {
      b = {
        key,
        name: it.owner_name ?? '未分配 / 基础设施',
        isUnassigned: unassigned,
        items: [],
        ok: 0,
        mismatch: 0,
        pending: 0,
      }
      map.set(key, b)
    }
    b.items.push(it)
    b[it.confirm_status] += 1
  }
  // pending groups first, then mismatch, then done; stable-ish by name.
  const rank = (b: OwnerBucket) => (b.pending > 0 ? 0 : b.mismatch > 0 ? 1 : 2)
  return [...map.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

function OwnerGroup({
  bucket,
  filter,
  onOpen,
}: {
  bucket: OwnerBucket
  filter: 'all' | ConfirmStatus
  onOpen: (code: string) => void
}) {
  const shown = filter === 'all' ? bucket.items : bucket.items.filter((i) => i.confirm_status === filter)
  if (shown.length === 0) return null

  const total = bucket.items.length
  const completion = total ? Math.round(((bucket.ok + bucket.mismatch) / total) * 100) : 0
  const state = bucket.pending > 0 ? 'pending' : bucket.mismatch > 0 ? 'mismatch' : 'done'
  const banner = {
    pending: { bg: '#FFF7E8', accent: '#FF8800', text: '待确认' },
    mismatch: { bg: '#FFECE8', accent: '#F53F3F', text: '存在差异' },
    done: { bg: '#E8FFEA', accent: '#00B42A', text: '已全部确认' },
  }[state]
  const avColor = bucket.isUnassigned ? '#86909C' : colorFor(bucket.name)

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 18px',
          borderLeft: `3px solid ${banner.accent}`,
          background: banner.bg,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: avColor,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {bucket.isUnassigned ? '—' : bucket.name.slice(0, 1)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{bucket.name}</span>
            <span
              style={{
                fontSize: 11,
                padding: '1px 8px',
                borderRadius: 3,
                background: '#fff',
                color: banner.accent,
                fontWeight: 500,
              }}
            >
              {banner.text}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
            共 {total} 件 · 已确认 {bucket.ok} · 差异 {bucket.mismatch} · 待确认 {bucket.pending}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CircleProgress percent={completion} color={banner.accent} />
          <span style={{ fontSize: 13, fontWeight: 600, color: banner.accent }}>{completion}%</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {shown.map((it) => {
          const s = ITEM_DOT[it.confirm_status]
          return (
            <button
              key={it.asset_code}
              onClick={() => onOpen(it.asset_code)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 16px',
                borderTop: '1px solid var(--divider)',
                borderRight: '1px solid var(--divider)',
                background: s.bg,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: s.dot,
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="text-mono" style={{ fontSize: 12, color: 'var(--lark-blue)' }}>
                    {it.asset_code}
                  </span>
                  <span style={{ fontSize: 11, color: ITEM_DOT[it.confirm_status].dot }}>
                    {CONFIRM_LABEL[it.confirm_status]}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-1)',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {it.brand_model ?? '(未填型号)'}
                </div>
                {it.confirm_status === 'mismatch' && it.remark && (
                  <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 2 }}>
                    差异:{it.remark}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Inspections() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [scope, setScope] = useState('personal_in_use')
  const [createForm] = Form.useForm()
  const [scanCode, setScanCode] = useState('')
  const [scanRemark, setScanRemark] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
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
    if (selectedId !== null) qc.invalidateQueries({ queryKey: ['inspection', selectedId] })
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
      api.post(`/inspections/${selectedId}/items/${v.code}/confirm`, {
        status: v.status,
        remark: v.remark || null,
      }),
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

  const remindMut = useMutation({
    mutationFn: async (id: number) => (await api.post(`/inspections/${id}/remind`)).data,
    onSuccess: (r: {
      reminded: number
      assets: number
      targets: number
      not_sent: number
      ownerless_pending: number
      lark_configured: boolean
    }) => {
      if (!r.lark_configured) {
        message.warning(`Lark 未配置,未实际发送(待提醒 ${r.targets} 位责任人)`)
      } else {
        const extra = [
          r.not_sent ? `${r.not_sent} 人无 Lark 账号未送` : '',
          r.ownerless_pending ? `${r.ownerless_pending} 件无责任人` : '',
        ].filter(Boolean)
        message.success(
          `已催办 ${r.reminded} 位 · ${r.assets} 件${extra.length ? ' · ' + extra.join(' · ') : ''}`,
        )
      }
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '催办失败'),
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
    {
      title: '开始时间',
      dataIndex: 'started_at',
      render: (v) => (v ? v.slice(0, 19).replace('T', ' ') : '—'),
    },
  ]

  const items = useMemo(() => detail?.items ?? [], [detail])
  const buckets = useMemo(() => bucketByOwner(items), [items])
  const visibleBuckets = buckets.filter(
    (b) => tab === 'all' || b.items.some((i) => i.confirm_status === tab),
  )

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
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
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
              <Space>
                <Button
                  loading={remindMut.isPending}
                  disabled={detail.progress.pending === 0}
                  onClick={() => remindMut.mutate(detail.id)}
                >
                  催办待核{detail.progress.pending ? ` (${detail.progress.pending})` : ''}
                </Button>
                <Popconfirm
                  title="关闭该盘点任务?"
                  onConfirm={() => closeMut.mutate(detail.id)}
                  okText="关闭"
                  cancelText="取消"
                >
                  <Button>关闭任务</Button>
                </Popconfirm>
              </Space>
            )}
          </div>

          {/* KPI summary */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            {([
              ['已确认', detail.progress.ok, '#00B42A', '#E8FFEA'],
              ['差异', detail.progress.mismatch, '#F53F3F', '#FFECE8'],
              ['待确认', detail.progress.pending, '#FF8800', '#FFF7E8'],
            ] as const).map(([label, val, color, bg]) => (
              <div key={label} style={{ flex: 1, padding: '12px 16px', borderRadius: 8, background: bg }}>
                <div style={{ fontSize: 22, fontWeight: 600, color }}>{val}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</div>
              </div>
            ))}
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
                onPressEnter={() => scanCode && confirmMut.mutate({ code: scanCode, status: 'ok' })}
                style={{ flex: 1 }}
              />
              <Button onClick={() => setScannerOpen(true)}>扫码</Button>
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

          <Segmented
            value={tab}
            onChange={(k) => setTab(k as 'all' | ConfirmStatus)}
            options={[
              { value: 'all', label: `全部 ${items.length}` },
              { value: 'pending', label: `待核 ${detail.progress.pending}` },
              { value: 'ok', label: `已确认 ${detail.progress.ok}` },
              { value: 'mismatch', label: `差异 ${detail.progress.mismatch}` },
            ]}
            style={{ marginBottom: 16 }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visibleBuckets.map((b) => (
              <OwnerGroup
                key={b.key}
                bucket={b}
                filter={tab}
                onOpen={(code) => navigate(`/assets?code=${encodeURIComponent(code)}`)}
              />
            ))}
            {visibleBuckets.length === 0 && (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>
                该筛选下暂无资产
              </div>
            )}
          </div>
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
          说明:扫码/输入编号 → 选 OK 或差异;点资产卡可在「资产台账」打开抽屉做转移/报修等处置。
        </span>
      </Space>

      <CameraScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCode={(c) => {
          setScanCode(c)
          setScannerOpen(false)
        }}
      />
    </div>
  )
}
