import { useMemo, useState } from 'react'
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  message,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'
import Icon, { type IconName } from '../components/Icon'

type Status = 'pending' | 'approved' | 'rejected' | 'disposed'
type DispositionMethod = 'recycle' | 'resale' | 'writeoff' | 'exchange' | 'other'

interface ScrapRow {
  id: number
  asset_id: number
  asset_code: string
  brand_model: string | null
  proposer_id: number
  proposer_name: string | null
  reason: string
  status: Status
  approver_id: number | null
  approver_name: string | null
  approved_at: string | null
  approve_remark: string | null
  disposition_method: DispositionMethod | null
  residual_value: string | null
  disposed_at: string | null
  disposal_remark: string | null
  created_at: string
}

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  pending: { label: '待审批', color: '#A66200', bg: '#FFF7E8' },
  approved: { label: '待处置', color: '#1A5BD0', bg: '#E8F1FF' },
  rejected: { label: '已驳回', color: '#A8261D', bg: '#FFECE8' },
  disposed: { label: '已处置', color: '#00863C', bg: '#E8FFEA' },
}

const METHOD_LABEL: Record<DispositionMethod, string> = {
  recycle: '回收',
  resale: '转售',
  writeoff: '报销/核销',
  exchange: '换货抵扣',
  other: '其他',
}

const AVATAR_COLORS = ['#3370FF', '#00B42A', '#FF8800', '#7E5EE5', '#F53F3F', '#00B2C7', '#D4380D']
function colorFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function fmt(d: string | null): string {
  if (!d) return ''
  return d.length > 16 ? d.slice(0, 16).replace('T', ' ') : d
}

type NodeState = 'done' | 'current' | 'rejected' | 'pending'
const NODE_META: Record<NodeState, { ring: string; badge: IconName | null; badgeBg: string }> = {
  done: { ring: '#00B42A', badge: 'check', badgeBg: '#00B42A' },
  current: { ring: '#FF8800', badge: 'clock', badgeBg: '#FF8800' },
  rejected: { ring: '#F53F3F', badge: 'close', badgeBg: '#F53F3F' },
  pending: { ring: '#C9CDD4', badge: null, badgeBg: '#C9CDD4' },
}

interface ChainNode {
  label: string
  name: string | null
  time: string | null
  state: NodeState
  sub: string | null
}
function chainNodes(r: ScrapRow): ChainNode[] {
  const approveState: NodeState =
    r.status === 'pending' ? 'current' : r.status === 'rejected' ? 'rejected' : 'done'
  const disposeState: NodeState =
    r.status === 'disposed' ? 'done' : r.status === 'approved' ? 'current' : 'pending'
  return [
    { label: '申请', name: r.proposer_name, time: r.created_at, state: 'done', sub: r.reason },
    {
      label: '审批',
      name: r.status === 'pending' ? null : r.approver_name,
      time: r.approved_at,
      state: approveState,
      sub: r.approve_remark,
    },
    {
      label: '处置',
      name: r.disposition_method ? METHOD_LABEL[r.disposition_method] : null,
      time: r.disposed_at,
      state: r.status === 'rejected' ? 'pending' : disposeState,
      sub:
        r.status === 'disposed'
          ? `残值 ${r.residual_value ? `¥${Number(r.residual_value).toLocaleString()}` : '—'}`
          : null,
    },
  ]
}

function Avatar({ name, state }: { name: string | null; state: NodeState }) {
  const meta = NODE_META[state]
  const bg = name && state !== 'pending' ? colorFor(name) : '#F2F3F5'
  return (
    <div style={{ position: 'relative', width: 32, height: 32 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: bg,
          color: name && state !== 'pending' ? '#fff' : '#86909C',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 500,
          boxShadow: `0 0 0 2px ${meta.ring}`,
        }}
      >
        {name ? name.slice(0, 1) : '—'}
      </div>
      {meta.badge && (
        <div
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: meta.badgeBg,
            border: '1.5px solid #fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={meta.badge} size={8} color="#fff" />
        </div>
      )}
    </div>
  )
}

/** Compact horizontal chain for cards. */
function ApprovalChain({ nodes }: { nodes: ChainNode[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {nodes.map((n, i) => (
        <div key={n.label} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 56 }}>
            <Avatar name={n.name} state={n.state} />
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{n.label}</span>
          </div>
          {i < nodes.length - 1 && (
            <div style={{ width: 24, height: 2, background: 'var(--divider)', marginTop: -16 }} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function ScrapApprovals() {
  const qc = useQueryClient()
  const me = useAuth((s) => s.user)
  const [tab, setTab] = useState<Status>('pending')
  const [openId, setOpenId] = useState<number | null>(null)
  const [acting, setActing] = useState<{ kind: 'approve' | 'reject' | 'dispose'; row: ScrapRow } | null>(null)
  const [actForm] = Form.useForm()

  const { data, isLoading } = useQuery<ScrapRow[]>({
    queryKey: ['scrap-requests'],
    queryFn: async () => (await api.get('/scrap-requests')).data,
  })

  const mut = useMutation({
    mutationFn: async (v: { path: 'approve' | 'reject' | 'dispose'; id: number; body: object }) =>
      (await api.post(`/scrap-requests/${v.id}/${v.path}`, v.body)).data,
    onSuccess: () => {
      message.success('操作成功')
      qc.invalidateQueries({ queryKey: ['scrap-requests'] })
      setActing(null)
      actForm.resetFields()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '操作失败'),
  })

  const requests = useMemo(() => data ?? [], [data])
  const counts = useMemo(() => {
    const c: Record<Status, number> = { pending: 0, approved: 0, rejected: 0, disposed: 0 }
    for (const r of requests) c[r.status] += 1
    return c
  }, [requests])
  const cards = requests.filter((r) => r.status === tab)
  const detail = openId != null ? requests.find((r) => r.id === openId) ?? null : null

  const actionsFor = (r: ScrapRow, size: 'small' | 'middle' = 'small') => {
    const isProposer = r.proposer_id === me?.id
    if (r.status === 'pending') {
      if (isProposer) return <span style={{ fontSize: 12, color: 'var(--text-3)' }}>需另一管理员审批</span>
      return (
        <Space size={4}>
          <Button size={size} type="primary" onClick={() => setActing({ kind: 'approve', row: r })}>
            批准
          </Button>
          <Button size={size} danger onClick={() => setActing({ kind: 'reject', row: r })}>
            拒绝
          </Button>
        </Space>
      )
    }
    if (r.status === 'approved')
      return (
        <Button size={size} type="primary" onClick={() => setActing({ kind: 'dispose', row: r })}>
          录入处置
        </Button>
      )
    return null
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>资产报废处置</h2>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
        申请由 IT/财务/采购任一人发起,审批必须由另一位管理员完成(不能自批);批准后录入处置方式与残值,资产才真正报废。
      </div>

      {/* Funnel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
        {(['pending', 'approved', 'disposed'] as Status[]).map((s, i, arr) => (
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
              <div style={{ fontSize: 22, fontWeight: 600, color: STATUS_META[s].color }}>{counts[s]}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {s === 'pending' ? '待审批' : s === 'approved' ? '待处置' : '已处置'}
              </div>
            </div>
            {i < arr.length - 1 && (
              <Icon name="chevronRight" size={18} color="var(--text-4)" style={{ margin: '0 4px' }} />
            )}
          </div>
        ))}
        {counts.rejected > 0 && (
          <div style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-3)' }}>已驳回 {counts.rejected}</div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([
          ['pending', `待审批 ${counts.pending}`],
          ['approved', `待处置 ${counts.approved}`],
          ['disposed', `已处置 ${counts.disposed}`],
          ['rejected', `已驳回 ${counts.rejected}`],
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
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>暂无申请</div>
        )}
        {cards.map((r) => (
          <div
            key={r.id}
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
            <div
              role="button"
              onClick={() => setOpenId(r.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: '#FFECE8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="warning" size={20} color="#F53F3F" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="text-mono" style={{ fontSize: 12, color: 'var(--lark-blue)' }}>
                    {r.asset_code}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '1px 6px',
                      borderRadius: 3,
                      background: STATUS_META[r.status].bg,
                      color: STATUS_META[r.status].color,
                    }}
                  >
                    {STATUS_META[r.status].label}
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
                  {r.brand_model ?? '(未填型号)'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.reason}
                </div>
              </div>
            </div>

            <ApprovalChain nodes={chainNodes(r)} />

            <div style={{ width: 160, flexShrink: 0, textAlign: 'right' }}>{actionsFor(r)}</div>
          </div>
        ))}
      </div>

      {/* Detail drawer */}
      <Drawer open={detail !== null} onClose={() => setOpenId(null)} width={560} title="报废申请">
        {detail && (
          <>
            <div
              style={{
                padding: 16,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #FFF5F3 0%, #FAFBFC 100%)',
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
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>申请 #{detail.id}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{detail.brand_model ?? detail.asset_code}</div>
            </div>

            <div style={{ padding: 12, background: '#FFECE8', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              <span style={{ color: '#A8261D', fontWeight: 500 }}>报废原因:</span> {detail.reason}
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>审批流程</div>
            <div style={{ paddingLeft: 2 }}>
              {chainNodes(detail).map((n, i, arr) => (
                <div key={n.label} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Avatar name={n.name} state={n.state} />
                    {i < arr.length - 1 && (
                      <div style={{ width: 2, flex: 1, background: 'var(--divider)', minHeight: 22, margin: '2px 0' }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: 14, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {n.label}
                        {n.name ? ` · ${n.name}` : n.state === 'current' ? ' · 待处理' : ''}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmt(n.time)}</span>
                    </div>
                    {n.sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{n.sub}</div>}
                  </div>
                </div>
              ))}
            </div>

            {detail.status === 'disposed' && (
              <div style={{ marginTop: 8, padding: 12, background: '#E8FFEA', borderRadius: 8, fontSize: 13 }}>
                <div>
                  处置方式 {detail.disposition_method ? METHOD_LABEL[detail.disposition_method] : '—'} · 残值{' '}
                  {detail.residual_value ? `¥${Number(detail.residual_value).toLocaleString()}` : '—'}
                </div>
                {detail.disposal_remark && (
                  <div style={{ color: 'var(--text-3)', marginTop: 2 }}>{detail.disposal_remark}</div>
                )}
              </div>
            )}

            <div style={{ marginTop: 16 }}>{actionsFor(detail, 'middle')}</div>
          </>
        )}
      </Drawer>

      <Modal
        open={acting !== null}
        title={
          acting
            ? `${acting.kind === 'approve' ? '批准' : acting.kind === 'reject' ? '拒绝' : '录入处置'} · ${acting.row.asset_code}`
            : ''
        }
        onCancel={() => setActing(null)}
        onOk={() => actForm.submit()}
        confirmLoading={mut.isPending}
        destroyOnClose
      >
        <Form
          form={actForm}
          layout="vertical"
          onFinish={(v: Record<string, unknown>) => {
            if (!acting) return
            mut.mutate({ path: acting.kind, id: acting.row.id, body: v })
          }}
        >
          {acting?.kind === 'reject' && (
            <Form.Item name="remark" label="拒绝原因" rules={[{ required: true }]}>
              <Input.TextArea rows={3} placeholder="必填" />
            </Form.Item>
          )}
          {acting?.kind === 'approve' && (
            <Form.Item name="remark" label="审批备注(可选)">
              <Input.TextArea rows={2} />
            </Form.Item>
          )}
          {acting?.kind === 'dispose' && (
            <>
              <Form.Item name="disposition_method" label="处置方式" rules={[{ required: true }]}>
                <Select
                  options={(Object.keys(METHOD_LABEL) as DispositionMethod[]).map((k) => ({
                    value: k,
                    label: METHOD_LABEL[k],
                  }))}
                />
              </Form.Item>
              <Form.Item name="residual_value" label="残值(¥,可空)">
                <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
              </Form.Item>
              <Form.Item name="remark" label="处置备注">
                <Input.TextArea rows={2} placeholder="如二手平台单号、回收方名称等" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}
