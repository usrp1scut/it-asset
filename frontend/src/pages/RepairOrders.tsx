import { useMemo, useState } from 'react'
import {
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Tag,
  message,
} from 'antd'
import type { Dayjs } from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import Icon from '../components/Icon'

type Status = 'open' | 'in_progress' | 'completed' | 'cancelled'
type RepairType = 'in_house' | 'external'

interface RepairOrder {
  id: number
  asset_id: number
  asset_code: string
  brand_model: string | null
  opened_by: number
  opened_by_name: string | null
  reason: string
  repair_type: RepairType
  vendor: string | null
  shipped_at: string | null
  expected_return_at: string | null
  status: Status
  cost: string | null
  warranty_covered: boolean
  warranty_until: string | null
  resolution: string | null
  notes: string | null
  closed_at: string | null
  created_at: string
}

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  open: { label: '已报修', color: '#A66200', bg: '#FFF7E8' },
  in_progress: { label: '维修中', color: '#1A5BD0', bg: '#E8F1FF' },
  completed: { label: '已完结', color: '#00863C', bg: '#E8FFEA' },
  cancelled: { label: '已取消', color: '#4E5969', bg: '#F2F3F5' },
}

const TYPE_LABEL: Record<RepairType, string> = { in_house: '内部修', external: '外送' }

// Honest 3-stage machine (matches the backend's open/in_progress/completed).
const STAGES: { key: Status; label: string; color: string }[] = [
  { key: 'open', label: '已报修', color: '#FF8800' },
  { key: 'in_progress', label: '维修中', color: '#3370FF' },
  { key: 'completed', label: '已完结', color: '#00B42A' },
]
function stageIndex(status: Status): number {
  return status === 'completed' ? 2 : status === 'in_progress' ? 1 : 0
}

function fmt(d: string | null): string {
  if (!d) return '—'
  return d.length > 10 ? d.slice(0, 10) : d
}
function daysLeft(dateStr: string | null): number | null {
  if (!dateStr) return null
  const due = new Date(dateStr).getTime()
  if (Number.isNaN(due)) return null
  return Math.ceil((due - Date.now()) / 86400000)
}

function StageBar({ status }: { status: Status }) {
  const cancelled = status === 'cancelled'
  const idx = stageIndex(status)
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {STAGES.map((s, i) => {
        const reached = !cancelled && i <= idx
        const isCurrent = !cancelled && i === idx && status !== 'completed'
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < STAGES.length - 1 ? 1 : '0 0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: cancelled ? '#F2F3F5' : reached ? s.color : '#fff',
                  border: `2px solid ${cancelled ? '#C9CDD4' : reached ? s.color : 'var(--border-strong)'}`,
                  boxShadow: isCurrent ? `0 0 0 4px ${s.color}33` : 'none',
                }}
              >
                {reached && <Icon name="check" size={11} color="#fff" />}
              </div>
              <span
                style={{
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                  color: reached ? 'var(--text-1)' : 'var(--text-3)',
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  marginTop: -16,
                  background: !cancelled && i < idx ? s.color : 'var(--divider)',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

interface TimelineEvent {
  label: string
  time: string | null
  note?: string | null
  color: string
}
function buildTimeline(o: RepairOrder): TimelineEvent[] {
  const ev: TimelineEvent[] = [
    { label: '报修', time: o.created_at, note: o.reason, color: '#FF8800' },
  ]
  if (o.shipped_at) ev.push({ label: '送修', time: o.shipped_at, note: o.vendor, color: '#3370FF' })
  if (o.status === 'completed') ev.push({ label: '完结', time: o.closed_at, note: o.resolution, color: '#00B42A' })
  if (o.status === 'cancelled') ev.push({ label: '已取消', time: o.closed_at, note: o.resolution, color: '#86909C' })
  return ev
}

export default function RepairOrders() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'active' | 'completed' | 'cancelled'>('active')
  const [openId, setOpenId] = useState<number | null>(null)
  const [acting, setActing] = useState<
    null | { kind: 'update' | 'complete' | 'cancel'; row: RepairOrder }
  >(null)
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery<RepairOrder[]>({
    queryKey: ['repair-orders'],
    queryFn: async () => (await api.get('/repair-orders')).data,
  })

  const mut = useMutation({
    mutationFn: async (v: {
      path: 'update' | 'complete' | 'cancel'
      id: number
      body: Record<string, unknown>
    }) => (await api.post(`/repair-orders/${v.id}/${v.path}`, v.body)).data,
    onSuccess: () => {
      message.success('操作成功')
      qc.invalidateQueries({ queryKey: ['repair-orders'] })
      qc.invalidateQueries({ queryKey: ['assets'] })
      setActing(null)
      form.resetFields()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '操作失败'),
  })

  const orders = useMemo(() => data ?? [], [data])
  const counts = useMemo(() => {
    const c: Record<Status, number> = { open: 0, in_progress: 0, completed: 0, cancelled: 0 }
    for (const o of orders) c[o.status] += 1
    return c
  }, [orders])

  const cards = orders.filter((o) =>
    tab === 'active'
      ? o.status === 'open' || o.status === 'in_progress'
      : tab === 'completed'
        ? o.status === 'completed'
        : o.status === 'cancelled',
  )
  const detail = openId != null ? orders.find((o) => o.id === openId) ?? null : null

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>维修中心</h2>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
        报修在资产抽屉里发起;开单后资产置「维修中」,完结/取消时回到「闲置」。
      </div>

      {/* Funnel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
        {(['open', 'in_progress', 'completed'] as Status[]).map((s, i, arr) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < arr.length - 1 ? 1 : '0 0 auto' }}>
            <div
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: STATUS_META[s].bg,
                minWidth: 120,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 600, color: STATUS_META[s].color }}>
                {counts[s]}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{STATUS_META[s].label}</div>
            </div>
            {i < arr.length - 1 && (
              <Icon name="chevronRight" size={18} color="var(--text-4)" style={{ margin: '0 4px' }} />
            )}
          </div>
        ))}
        {counts.cancelled > 0 && (
          <div style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-3)' }}>
            已取消 {counts.cancelled}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([
          ['active', `进行中 ${counts.open + counts.in_progress}`],
          ['completed', `已完结 ${counts.completed}`],
          ['cancelled', `已取消 ${counts.cancelled}`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: '5px 14px',
              borderRadius: 16,
              border: '1px solid var(--border)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: tab === k ? 600 : 400,
              background: tab === k ? 'var(--lark-blue)' : '#fff',
              color: tab === k ? '#fff' : 'var(--text-2)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isLoading && <div style={{ color: 'var(--text-3)', padding: 24 }}>加载中…</div>}
        {!isLoading && cards.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>暂无工单</div>
        )}
        {cards.map((o) => {
          const dl = daysLeft(o.expected_return_at)
          const isActive = o.status === 'open' || o.status === 'in_progress'
          return (
            <div
              key={o.id}
              style={{
                background: '#fff',
                borderRadius: 10,
                border: '1px solid var(--border)',
                padding: 16,
                display: 'flex',
                gap: 16,
                alignItems: 'center',
              }}
            >
              {/* left: asset + status */}
              <div
                role="button"
                onClick={() => setOpenId(o.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: 220, cursor: 'pointer', flexShrink: 0 }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: '#FFF7E8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="repair" size={20} color="#FF8800" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="text-mono" style={{ fontSize: 12, color: 'var(--lark-blue)' }}>
                      {o.asset_code}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: STATUS_META[o.status].bg,
                        color: STATUS_META[o.status].color,
                      }}
                    >
                      {STATUS_META[o.status].label}
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
                    {o.brand_model ?? '(未填型号)'} · #{o.id}
                  </div>
                </div>
              </div>

              {/* middle: stage bar + reason */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <StageBar status={o.status} />
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-3)',
                    marginTop: 8,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Tag>{TYPE_LABEL[o.repair_type]}</Tag>
                  {o.repair_type === 'external' && o.vendor ? `${o.vendor} · ` : ''}
                  {o.reason}
                </div>
              </div>

              {/* right: due + actions */}
              <div style={{ width: 200, flexShrink: 0, textAlign: 'right' }}>
                {isActive && o.expected_return_at && (
                  <div style={{ fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-3)' }}>预计回 {fmt(o.expected_return_at)} · </span>
                    {dl != null && (
                      <span style={{ color: dl < 0 ? 'var(--danger)' : 'var(--text-2)', fontWeight: 500 }}>
                        {dl < 0 ? `超期 ${-dl} 天` : `剩 ${dl} 天`}
                      </span>
                    )}
                  </div>
                )}
                {o.status === 'completed' && (
                  <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-2)' }}>
                    费用 {o.cost ? `¥${Number(o.cost).toLocaleString()}` : '—'}
                    {o.warranty_covered && <Tag color="green" style={{ marginLeft: 6 }}>保修</Tag>}
                  </div>
                )}
                {isActive ? (
                  <Space size={4}>
                    <Button size="small" onClick={() => setActing({ kind: 'update', row: o })}>
                      更新
                    </Button>
                    <Button size="small" type="primary" onClick={() => setActing({ kind: 'complete', row: o })}>
                      完结
                    </Button>
                    <Button size="small" danger onClick={() => setActing({ kind: 'cancel', row: o })}>
                      取消
                    </Button>
                  </Space>
                ) : (
                  <Button size="small" type="link" onClick={() => setOpenId(o.id)}>
                    查看详情
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail drawer */}
      <Drawer
        open={detail !== null}
        onClose={() => setOpenId(null)}
        width={560}
        title="维修工单"
      >
        {detail && (
          <>
            <div
              style={{
                padding: 16,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #FFFaf2 0%, #FAFBFC 100%)',
                border: '1px solid var(--border)',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="text-mono" style={{ fontSize: 12, color: 'var(--lark-blue)' }}>
                  {detail.asset_code}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: '1px 8px',
                    borderRadius: 3,
                    background: STATUS_META[detail.status].bg,
                    color: STATUS_META[detail.status].color,
                  }}
                >
                  {STATUS_META[detail.status].label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>工单 #{detail.id}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{detail.brand_model ?? detail.asset_code}</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
                {TYPE_LABEL[detail.repair_type]}
                {detail.repair_type === 'external' && detail.vendor ? ` · ${detail.vendor}` : ''}
                {detail.opened_by_name ? ` · 报修人 ${detail.opened_by_name}` : ''}
              </div>
            </div>

            <div
              style={{
                padding: 12,
                background: '#FFF7E8',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
                color: 'var(--text-1)',
              }}
            >
              <span style={{ color: '#A66200', fontWeight: 500 }}>问题:</span> {detail.reason}
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>维修进度</div>
            <div style={{ paddingLeft: 4 }}>
              {buildTimeline(detail).map((e, i, arr) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: e.color,
                        marginTop: 3,
                      }}
                    />
                    {i < arr.length - 1 && (
                      <div style={{ width: 2, flex: 1, background: 'var(--divider)', minHeight: 24 }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: 16, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{e.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmt(e.time)}</span>
                    </div>
                    {e.note && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{e.note}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {detail.status === 'completed' && (
              <div
                style={{
                  marginTop: 8,
                  padding: 12,
                  background: '#E8FFEA',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <div>
                  费用 {detail.cost ? `¥${Number(detail.cost).toLocaleString()}` : '—'}
                  {detail.warranty_covered && <Tag color="green" style={{ marginLeft: 6 }}>保修内</Tag>}
                  {detail.warranty_until && <span style={{ marginLeft: 8, color: 'var(--text-3)' }}>新保修至 {detail.warranty_until}</span>}
                </div>
              </div>
            )}

            {(detail.status === 'open' || detail.status === 'in_progress') && (
              <Space style={{ marginTop: 16 }}>
                <Button onClick={() => setActing({ kind: 'update', row: detail })}>更新</Button>
                <Button type="primary" onClick={() => setActing({ kind: 'complete', row: detail })}>
                  完结
                </Button>
                <Button danger onClick={() => setActing({ kind: 'cancel', row: detail })}>
                  取消
                </Button>
              </Space>
            )}
          </>
        )}
      </Drawer>

      <Modal
        open={acting !== null}
        title={
          acting
            ? `${acting.kind === 'update' ? '更新' : acting.kind === 'complete' ? '完结' : '取消'} · ${acting.row.asset_code}`
            : ''
        }
        onCancel={() => setActing(null)}
        onOk={() => form.submit()}
        confirmLoading={mut.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v: Record<string, unknown>) => {
            if (!acting) return
            const body: Record<string, unknown> = { ...v }
            for (const k of ['shipped_at', 'expected_return_at', 'warranty_until']) {
              if (body[k]) body[k] = (body[k] as Dayjs).format('YYYY-MM-DD')
            }
            mut.mutate({ path: acting.kind, id: acting.row.id, body })
          }}
        >
          {acting?.kind === 'update' && (
            <>
              <Form.Item name="vendor" label="维修商(可改)">
                <Input />
              </Form.Item>
              <Form.Item name="shipped_at" label="送修日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="expected_return_at" label="预计回">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="note" label="备注">
                <Input.TextArea rows={2} />
              </Form.Item>
            </>
          )}
          {acting?.kind === 'complete' && (
            <>
              <Form.Item name="resolution" label="解决说明" rules={[{ required: true }]}>
                <Input.TextArea rows={2} placeholder="如:更换键盘模组,清灰" />
              </Form.Item>
              <Form.Item name="cost" label="费用(¥,可空)">
                <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
              </Form.Item>
              <Form.Item name="warranty_covered" label="保修内" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="warranty_until" label="新保修截止">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}
          {acting?.kind === 'cancel' && (
            <Form.Item name="reason" label="取消原因" rules={[{ required: true }]}>
              <Input.TextArea rows={3} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
