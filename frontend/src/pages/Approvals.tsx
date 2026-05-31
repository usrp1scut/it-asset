import { useMemo, useState } from 'react'
import { Button, Checkbox, Drawer, Input, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'
import Icon, { type IconName } from '../components/Icon'

type Status = 'pending' | 'approved' | 'rejected' | 'fulfilled'
type ReqType = 'consumable' | 'asset'

interface Item {
  sku_id: number
  sku_code: string | null
  name: string | null
  spec: string | null
  unit: string | null
  qty: number
}
interface Approval {
  id: number
  request_no: string
  request_type: ReqType
  requester_id: number
  requester_name: string | null
  approver_id: number | null
  approver_name: string | null
  status: Status
  payload_json: { reason?: string; urgency?: string; deliver_to?: string }
  items: Item[]
  decision_note: string | null
  decided_at: string | null
  created_at: string
}

const TYPE_META: Record<ReqType, { label: string; icon: IconName; color: string; bg: string }> = {
  consumable: { label: '耗材 / 配件领用', icon: 'box', color: '#FF8800', bg: '#FFF7E8' },
  asset: { label: '固定资产领用', icon: 'assets', color: '#3370FF', bg: '#E8F1FF' },
}
const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  pending: { label: '待审批', color: '#A66200', bg: '#FFF7E8' },
  approved: { label: '待发放', color: '#1A5BD0', bg: '#E8F1FF' },
  rejected: { label: '已驳回', color: '#A8261D', bg: '#FFECE8' },
  fulfilled: { label: '已完成', color: '#00863C', bg: '#E8FFEA' },
}

const AVATAR_COLORS = ['#3370FF', '#00B42A', '#FF8800', '#7E5EE5', '#F53F3F', '#00B2C7', '#D4380D']
function colorFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function fmt(d: string | null): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return d
  }
}
function itemsText(a: Approval): string {
  return a.items.map((i) => `${i.name ?? `#${i.sku_id}`} ×${i.qty}`).join('、')
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: colorFor(name), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 500, flexShrink: 0 }}>
      {name.slice(0, 1)}
    </div>
  )
}

/** ⭐ Signature: mock of the Lark bot approval card the requester's manager sees. */
function LarkCardPreview({ a }: { a: Approval }) {
  const tm = TYPE_META[a.request_type]
  return (
    <div style={{ width: 320, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: '#fff', boxShadow: '0 2px 12px rgba(31,35,41,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#F7F8FA', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--lark-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>IT</div>
        <span style={{ fontSize: 13, fontWeight: 600 }}>IT 资产管理</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>{fmt(a.created_at)}</span>
      </div>
      <div style={{ height: 4, background: tm.color }} />
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{tm.label}</div>
        {[
          ['申请人', a.requester_name ?? `#${a.requester_id}`],
          ['物品', itemsText(a) || '—'],
          ['事由', a.payload_json?.reason ?? '—'],
          ['紧急', a.payload_json?.urgency === 'urgent' ? '加急' : '普通'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-3)', width: 40, flexShrink: 0 }}>{k}</span>
            <span style={{ color: 'var(--text-1)' }}>{v}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 12, color: 'var(--text-2)' }}>查看详情</div>
          <div style={{ flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 6, border: '1px solid #FFD8C8', fontSize: 12, color: '#F53F3F' }}>拒绝</div>
          <div style={{ flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 6, background: 'var(--lark-blue)', fontSize: 12, color: '#fff' }}>同意</div>
        </div>
      </div>
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--divider)', fontSize: 11, color: 'var(--text-3)' }}>
        {a.status === 'pending'
          ? `已通过 Lark 推送给 ${a.approver_name ?? '审批人'},等待处理`
          : `已${STATUS_META[a.status].label} · ${a.approver_name ?? ''}`}
      </div>
    </div>
  )
}

const TABS = [
  { key: 'mine', label: '待我处理' },
  { key: 'others', label: '待他人处理' },
  { key: 'approved', label: '待发放' },
  { key: 'fulfilled', label: '已完成' },
  { key: 'rejected', label: '已驳回' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default function Approvals() {
  const qc = useQueryClient()
  const me = useAuth((s) => s.user)
  const [tab, setTab] = useState<TabKey>('mine')
  const [openId, setOpenId] = useState<number | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [note, setNote] = useState('')

  const { data } = useQuery<Approval[]>({
    queryKey: ['approvals-all'],
    queryFn: async () => (await api.get('/approvals', { params: { scope: 'all' } })).data,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['approvals-all'] })

  const act = useMutation({
    mutationFn: async (v: { id: number; op: 'approve' | 'reject' | 'fulfill'; note?: string }) =>
      (await api.post(`/approvals/${v.id}/${v.op}`, v.op === 'fulfill' ? {} : { note: v.note })).data,
    onSuccess: (_d, v) => {
      message.success(v.op === 'approve' ? '已通过' : v.op === 'reject' ? '已驳回' : '已发放')
      invalidate()
      qc.invalidateQueries({ queryKey: ['assets'] })
      setOpenId(null)
      setNote('')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '操作失败'),
  })

  const batch = useMutation({
    mutationFn: async (v: { action: 'approve' | 'reject' }) =>
      (await api.post('/approvals/batch', { ids: selected, action: v.action })).data,
    onSuccess: (r: { done: number; skipped: number }) => {
      message.success(`批量${r.done} 条已处理${r.skipped ? `,跳过 ${r.skipped}` : ''}`)
      invalidate()
      setSelected([])
    },
    onError: () => message.error('批量操作失败'),
  })

  const all = useMemo(() => data ?? [], [data])
  const buckets = useMemo(() => {
    const mine: Approval[] = [], others: Approval[] = [], approved: Approval[] = [], fulfilled: Approval[] = [], rejected: Approval[] = []
    for (const r of all) {
      if (r.status === 'pending') (r.approver_id === me?.id ? mine : others).push(r)
      else if (r.status === 'approved') approved.push(r)
      else if (r.status === 'fulfilled') fulfilled.push(r)
      else if (r.status === 'rejected') rejected.push(r)
    }
    return { mine, others, approved, fulfilled, rejected }
  }, [all, me])

  const monthDecided = all.filter((r) => {
    if (!r.decided_at) return false
    const d = new Date(r.decided_at), n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
  }).length

  const cards = buckets[tab]
  const detail = openId != null ? all.find((r) => r.id === openId) ?? null : null
  const canDecide = (r: Approval) => r.status === 'pending'

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>审批中心</h2>

      {/* KPI */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {([
          ['待我处理', buckets.mine.length, '#A66200', '#FFF7E8'],
          ['待他人处理', buckets.others.length, '#1A5BD0', '#E8F1FF'],
          ['待发放', buckets.approved.length, '#7E5EE5', '#F1ECFF'],
          ['本月已审批', monthDecided, '#00863C', '#E8FFEA'],
        ] as const).map(([label, val, color, bg]) => (
          <div key={label} style={{ flex: 1, padding: '14px 18px', borderRadius: 10, background: bg }}>
            <div style={{ fontSize: 24, fontWeight: 600, color }}>{val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelected([]) }}
            style={{ padding: '5px 14px', borderRadius: 16, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, background: tab === t.key ? 'var(--lark-blue)' : '#fff', color: tab === t.key ? '#fff' : 'var(--text-2)' }}
          >
            {t.label} {buckets[t.key].length}
          </button>
        ))}
      </div>

      {/* Batch bar */}
      {tab === 'mine' && selected.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', marginBottom: 12, borderRadius: 8, background: 'var(--lark-blue-bg)', border: '1px solid var(--lark-blue-bg-strong, #BCD3FF)' }}>
          <span style={{ fontSize: 13 }}>已选 {selected.length} 条</span>
          <Button size="small" type="primary" loading={batch.isPending} onClick={() => batch.mutate({ action: 'approve' })}>批量通过</Button>
          <Button size="small" danger loading={batch.isPending} onClick={() => batch.mutate({ action: 'reject' })}>批量驳回</Button>
          <Button size="small" type="text" onClick={() => setSelected([])}>取消</Button>
        </div>
      )}

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cards.length === 0 && <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>暂无申请</div>}
        {cards.map((r) => {
          const tm = TYPE_META[r.request_type]
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', borderRadius: 10, border: '1px solid var(--border)', padding: 16 }}>
              {tab === 'mine' && (
                <Checkbox
                  checked={selected.includes(r.id)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))}
                />
              )}
              <div role="button" onClick={() => { setOpenId(r.id); setNote('') }} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: tm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={tm.icon} size={20} color={tm.color} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{tm.label}</span>
                    {r.payload_json?.urgency === 'urgent' && <span style={{ fontSize: 11, color: '#F53F3F', background: '#FFECE8', padding: '1px 6px', borderRadius: 8 }}>加急</span>}
                    <span className="text-mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.request_no}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.requester_name ?? `#${r.requester_id}`} · {itemsText(r) || r.payload_json?.reason || '—'}
                  </div>
                </div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: STATUS_META[r.status].bg, color: STATUS_META[r.status].color, flexShrink: 0 }}>
                  {STATUS_META[r.status].label}
                </span>
              </div>
              <div style={{ flexShrink: 0 }}>
                {canDecide(r) ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button size="small" onClick={() => act.mutate({ id: r.id, op: 'reject' })}>驳回</Button>
                    <Button size="small" type="primary" onClick={() => act.mutate({ id: r.id, op: 'approve' })}>通过</Button>
                  </div>
                ) : r.status === 'approved' ? (
                  <Button size="small" type="primary" onClick={() => act.mutate({ id: r.id, op: 'fulfill' })}>发放</Button>
                ) : (
                  <Button size="small" type="link" onClick={() => setOpenId(r.id)}>详情</Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail drawer */}
      <Drawer open={detail !== null} onClose={() => setOpenId(null)} width={820} title="审批详情">
        {detail && (
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Hero */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 10, background: TYPE_META[detail.request_type].bg, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={TYPE_META[detail.request_type].icon} size={22} color={TYPE_META[detail.request_type].color} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{TYPE_META[detail.request_type].label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }} className="text-mono">{detail.request_no}</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 12, padding: '2px 10px', borderRadius: 10, background: '#fff', color: STATUS_META[detail.status].color }}>
                  {STATUS_META[detail.status].label}
                </span>
              </div>

              {/* Request details */}
              <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
                {[
                  ['申请人', detail.requester_name ?? `#${detail.requester_id}`],
                  ['事由', detail.payload_json?.reason || '—'],
                  ['紧急程度', detail.payload_json?.urgency === 'urgent' ? '加急' : '普通'],
                  ['交付方式', detail.payload_json?.deliver_to === 'self_desk' ? '送到工位' : (detail.payload_json?.deliver_to || '—')],
                  ['提交时间', fmt(detail.created_at)],
                ].map(([k, v], i, arr) => (
                  <div key={k} style={{ display: 'flex', padding: '10px 14px', borderBottom: i < arr.length - 1 ? '0.5px solid var(--divider)' : 'none' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', width: 80 }}>{k}</span>
                    <span style={{ fontSize: 13 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Items */}
              {detail.items.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, borderBottom: '0.5px solid var(--divider)' }}>申请物品</div>
                  {detail.items.map((it, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: 13 }}>
                      <span>{it.name ?? `#${it.sku_id}`}{it.spec ? ` · ${it.spec}` : ''}</span>
                      <span>×{it.qty} {it.unit ?? ''}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Approval flow */}
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>审批流程</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={detail.requester_name ?? '?'} />
                  <div style={{ fontSize: 13 }}>{detail.requester_name ?? `#${detail.requester_id}`} 提交申请</div>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)' }}>{fmt(detail.created_at)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={detail.approver_name ?? (detail.status === 'pending' ? '待' : '?')} />
                  <div style={{ fontSize: 13 }}>
                    {detail.status === 'pending' ? '等待审批' : `${detail.approver_name ?? ''} ${STATUS_META[detail.status].label}`}
                    {detail.decision_note && <span style={{ color: 'var(--text-3)' }}> · {detail.decision_note}</span>}
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)' }}>{fmt(detail.decided_at)}</span>
                </div>
              </div>

              {/* Actions */}
              {canDecide(detail) && (
                <div style={{ marginTop: 20 }}>
                  <Input.TextArea rows={2} placeholder="审批意见(可选)" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginBottom: 10 }} />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Button danger onClick={() => act.mutate({ id: detail.id, op: 'reject', note })}>驳回</Button>
                    <Button type="primary" onClick={() => act.mutate({ id: detail.id, op: 'approve', note })}>通过</Button>
                  </div>
                </div>
              )}
              {detail.status === 'approved' && (
                <Button type="primary" style={{ marginTop: 20 }} onClick={() => act.mutate({ id: detail.id, op: 'fulfill' })}>确认发放</Button>
              )}
            </div>

            {/* Lark card preview */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-2)' }}>Lark 卡片预览</div>
              <LarkCardPreview a={detail} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
