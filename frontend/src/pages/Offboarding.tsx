import { useState } from 'react'
import {
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  message,
} from 'antd'
import type { Dayjs } from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import Icon from '../components/Icon'
import EmployeeSelect from '../features/users/EmployeeSelect'

type CaseStatus = 'in_progress' | 'overdue' | 'completed'
type ItemStatus = 'return_pending' | 'returned' | 'lost'

interface Item {
  id: number
  asset_code: string
  brand_model: string | null
  snapshot_value: string | null
  status: ItemStatus
  condition: 'good' | 'damaged' | null
  returned_at: string | null
  remark: string | null
}
interface CaseBase {
  id: number
  case_no: string
  user_id: number
  user_name: string | null
  department_name: string | null
  last_day: string | null
  reason: string | null
  hr_channel: string
  status: CaseStatus
  notified_at: string | null
  completed_at: string | null
  created_at: string
  total_items: number
  returned_items: number
  lost_items: number
  pending_items: number
  total_value: string
  pending_value: string
}
interface CaseDetail extends CaseBase {
  items: Item[]
}

const CASE_META: Record<CaseStatus, { label: string; color: string; bg: string }> = {
  in_progress: { label: '进行中', color: '#1A5BD0', bg: '#E8F1FF' },
  overdue: { label: '已逾期', color: '#A8261D', bg: '#FFECE8' },
  completed: { label: '已完成', color: '#00863C', bg: '#E8FFEA' },
}
const ITEM_META: Record<ItemStatus, { label: string; color: string; bg: string }> = {
  return_pending: { label: '待归还', color: '#86909C', bg: '#F2F3F5' },
  returned: { label: '已归还', color: '#00863C', bg: '#E8FFEA' },
  lost: { label: '丢失登记', color: '#A8261D', bg: '#FFECE8' },
}

const AVATAR_COLORS = ['#3370FF', '#00B42A', '#FF8800', '#7E5EE5', '#F53F3F', '#00B2C7', '#D4380D']
function colorFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function yuan(v: string | null): string {
  return v ? `¥${Number(v).toLocaleString()}` : '¥0'
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: colorFor(name),
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 500,
        flexShrink: 0,
      }}
    >
      {name.slice(0, 1)}
    </div>
  )
}

export default function Offboarding() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [newUser, setNewUser] = useState<number | null>(null)
  const [acting, setActing] = useState<{ kind: 'return' | 'lost'; code: string } | null>(null)
  const [actForm] = Form.useForm()

  const { data: cases } = useQuery<CaseBase[]>({
    queryKey: ['offboarding'],
    queryFn: async () => (await api.get('/offboarding')).data,
  })
  const { data: detail } = useQuery<CaseDetail>({
    queryKey: ['offboarding', selectedId],
    queryFn: async () => (await api.get(`/offboarding/${selectedId}`)).data,
    enabled: selectedId !== null,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['offboarding'] })
    if (selectedId !== null) qc.invalidateQueries({ queryKey: ['offboarding', selectedId] })
  }

  const createMut = useMutation({
    mutationFn: async (body: object) => (await api.post('/offboarding', body)).data,
    onSuccess: (c: CaseDetail) => {
      message.success(`已创建 ${c.case_no}(${c.total_items} 件待归还)`)
      invalidate()
      setCreateOpen(false)
      createForm.resetFields()
      setNewUser(null)
      setSelectedId(c.id)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '创建失败'),
  })

  const itemMut = useMutation({
    mutationFn: async (v: { kind: 'return' | 'lost'; code: string; body: object }) =>
      (await api.post(`/offboarding/${selectedId}/items/${v.code}/${v.kind}`, v.body)).data,
    onSuccess: (_d, v) => {
      message.success(v.kind === 'return' ? '已确认归还' : '已登记丢失')
      invalidate()
      qc.invalidateQueries({ queryKey: ['assets'] })
      setActing(null)
      actForm.resetFields()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '操作失败'),
  })

  const closeMut = useMutation({
    mutationFn: async (id: number) => (await api.post(`/offboarding/${id}/close`)).data,
    onSuccess: () => {
      message.success('工单已关闭')
      invalidate()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '关闭失败'),
  })

  const notifyMut = useMutation({
    mutationFn: async (id: number) => (await api.post(`/offboarding/${id}/notify`)).data,
    onSuccess: () => {
      message.success('已通知离职员工与其上级归还资产')
      invalidate()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '通知失败'),
  })

  const returnedValue = (detail?.items ?? [])
    .filter((i) => i.status === 'returned')
    .reduce((s, i) => s + Number(i.snapshot_value ?? 0), 0)
  const handled = detail ? detail.pending_items === 0 : false
  const completion = detail && detail.total_items
    ? Math.round(((detail.returned_items + detail.lost_items) / detail.total_items) * 100)
    : 0

  const steps = detail
    ? [
        { label: 'HR 离职触发', done: true, hint: detail.hr_channel === 'manual' ? '手工建单' : 'Lark 事件' },
        { label: '资产清单核对', done: true, hint: `${detail.total_items} 件 · ${yuan(detail.total_value)}` },
        { label: '通知员工归还', done: detail.notified_at !== null, hint: detail.notified_at ? '已通知' : '待 IT 确认' },
        { label: '资产全部归还/登记', done: handled },
        { label: 'IT 验收入库', done: handled },
        { label: '工单关闭', done: detail.status === 'completed' },
      ]
    : []

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>离职归还</h2>
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          新建离职工单
        </Button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
        建单时自动拉取员工名下「在用」个人资产;逐件确认归还或登记丢失(丢失会挂一张报废申请走核销),全部处理后关闭工单。
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Left: case list */}
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(cases ?? []).map((c) => {
            const m = CASE_META[c.status]
            const pct = c.total_items ? Math.round(((c.returned_items + c.lost_items) / c.total_items) * 100) : 0
            return (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{
                  background: '#fff',
                  borderRadius: 10,
                  border: `1px solid ${c.id === selectedId ? 'var(--lark-blue)' : 'var(--border)'}`,
                  padding: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 12,
                }}
              >
                <Avatar name={c.user_name ?? '?'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{c.user_name ?? `#${c.user_id}`}</span>
                    <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: m.bg, color: m.color }}>
                      {m.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {c.department_name ?? '—'} · 最后工作日 {c.last_day ?? '—'}
                  </div>
                  <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--fill-2,#eee)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: m.color }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    {c.returned_items + c.lost_items}/{c.total_items} 已处理 · 待归还 {c.pending_items}
                  </div>
                </div>
              </div>
            )
          })}
          {(cases ?? []).length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>暂无工单</div>
          )}
        </div>

        {/* Right: detail */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!detail && (
            <div style={{ padding: 64, textAlign: 'center', color: 'var(--text-3)' }}>选择左侧工单查看详情</div>
          )}
          {detail && (
            <div>
              {/* Hero */}
              <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Avatar name={detail.user_name ?? '?'} size={48} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18, fontWeight: 600 }}>{detail.user_name ?? `#${detail.user_id}`}</span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '1px 8px',
                          borderRadius: 3,
                          background: CASE_META[detail.status].bg,
                          color: CASE_META[detail.status].color,
                        }}
                      >
                        {CASE_META[detail.status].label}
                      </span>
                      <span className="text-mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{detail.case_no}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
                      {detail.department_name ?? '—'} · 最后工作日 {detail.last_day ?? '—'}
                      {detail.reason ? ` · ${detail.reason}` : ''}
                    </div>
                  </div>
                </div>
                {/* 4-grid value summary */}
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  {([
                    ['总价值', yuan(detail.total_value), 'var(--text-1)'],
                    ['已回收', yuan(String(returnedValue)), '#00863C'],
                    ['待归还', yuan(detail.pending_value), '#A66200'],
                    ['完成度', `${completion}%`, '#1A5BD0'],
                  ] as const).map(([label, val, color]) => (
                    <div key={label} style={{ flex: 1, background: 'var(--fill-1,#FAFBFC)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 18, fontWeight: 600, color }}>{val}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6-step checklist */}
              <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', padding: '20px 20px 12px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  {steps.map((s, i) => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'flex-start', flex: i < steps.length - 1 ? 1 : '0 0 auto' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 92 }}>
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: s.done ? '#00B42A' : '#fff',
                            border: `2px solid ${s.done ? '#00B42A' : 'var(--border-strong)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: s.done ? '#fff' : 'var(--text-3)',
                            fontSize: 12,
                          }}
                        >
                          {s.done ? <Icon name="check" size={13} color="#fff" /> : i + 1}
                        </div>
                        <span style={{ fontSize: 11, textAlign: 'center', color: s.done ? 'var(--text-1)' : 'var(--text-3)', lineHeight: 1.3 }}>
                          {s.label}
                        </span>
                        {s.hint && <span style={{ fontSize: 10, color: 'var(--text-4)', textAlign: 'center' }}>{s.hint}</span>}
                      </div>
                      {i < steps.length - 1 && (
                        <div style={{ flex: 1, height: 2, background: s.done ? '#00B42A' : 'var(--divider)', marginTop: 13 }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Items */}
              <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)', fontWeight: 600, fontSize: 14 }}>
                  名下资产 ({detail.items.length})
                </div>
                {detail.items.map((it) => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '0.5px solid var(--divider)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="text-mono" style={{ fontSize: 12, color: 'var(--lark-blue)' }}>{it.asset_code}</span>
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: ITEM_META[it.status].bg, color: ITEM_META[it.status].color }}>
                          {ITEM_META[it.status].label}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, marginTop: 2 }}>
                        {it.brand_model ?? '(未填型号)'}
                        <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>{yuan(it.snapshot_value)}</span>
                      </div>
                      {it.remark && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{it.remark}</div>}
                    </div>
                    {it.status === 'return_pending' && detail.status !== 'completed' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button size="small" type="primary" onClick={() => { setActing({ kind: 'return', code: it.asset_code }); actForm.resetFields() }}>
                          确认归还
                        </Button>
                        <Button size="small" danger onClick={() => { setActing({ kind: 'lost', code: it.asset_code }); actForm.resetFields() }}>
                          登记丢失
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Action bar */}
              {detail.status !== 'completed' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {detail.notified_at === null && (
                    <Popconfirm
                      title="确认并通知离职员工?"
                      description="将给该员工与其直属上级发送 Lark 归还提醒。建单时未自动通知,以避免误触发打扰。"
                      onConfirm={() => notifyMut.mutate(detail.id)}
                      okText="确认并通知"
                      cancelText="取消"
                    >
                      <Button type="primary" loading={notifyMut.isPending}>
                        确认并通知员工
                      </Button>
                    </Popconfirm>
                  )}
                  <Popconfirm
                    title="关闭离职工单?"
                    description={detail.pending_items > 0 ? `还有 ${detail.pending_items} 件待归还,需先处理` : '所有资产已处理,确认关闭并通知 HR。'}
                    onConfirm={() => closeMut.mutate(detail.id)}
                    okText="关闭工单"
                    cancelText="取消"
                    disabled={detail.pending_items > 0}
                  >
                    <Button disabled={detail.pending_items > 0} loading={closeMut.isPending}>
                      确认完成 · 关闭工单
                    </Button>
                  </Popconfirm>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      <Modal
        open={createOpen}
        title="新建离职工单"
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMut.isPending}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(v: { last_day?: Dayjs; reason?: string }) => {
            if (!newUser) {
              message.warning('请选择离职员工')
              return
            }
            createMut.mutate({
              user_id: newUser,
              last_day: v.last_day ? v.last_day.format('YYYY-MM-DD') : undefined,
              reason: v.reason || undefined,
            })
          }}
        >
          <Form.Item label="离职员工" required>
            <EmployeeSelect value={newUser} onChange={setNewUser} />
          </Form.Item>
          <Form.Item name="last_day" label="最后工作日">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="离职原因(可选)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Item action modal */}
      <Modal
        open={acting !== null}
        title={acting ? `${acting.kind === 'return' ? '确认归还' : '登记丢失'} · ${acting.code}` : ''}
        onCancel={() => setActing(null)}
        onOk={() => actForm.submit()}
        confirmLoading={itemMut.isPending}
        destroyOnClose
      >
        <Form
          form={actForm}
          layout="vertical"
          onFinish={(v: Record<string, unknown>) => {
            if (!acting) return
            itemMut.mutate({ kind: acting.kind, code: acting.code, body: v })
          }}
        >
          {acting?.kind === 'return' && (
            <Form.Item name="condition" label="资产状况" initialValue="good">
              <Select
                options={[
                  { value: 'good', label: '完好' },
                  { value: 'damaged', label: '有损坏' },
                ]}
              />
            </Form.Item>
          )}
          <Form.Item name="remark" label={acting?.kind === 'lost' ? '丢失说明' : '备注(可选)'} rules={acting?.kind === 'lost' ? [{ required: true, message: '请填写丢失说明' }] : []}>
            <Input.TextArea rows={2} placeholder={acting?.kind === 'lost' ? '丢失会自动挂一张报废申请走财务核销' : ''} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
