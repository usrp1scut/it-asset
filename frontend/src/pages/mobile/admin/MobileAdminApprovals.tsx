import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import Icon, { type IconName } from '../../../components/Icon'

// Mobile approval centre for the IT-admin cockpit. Same /api/approvals the
// desktop uses (scope=for_me returns pending + approved). Cards expose the
// one-tap actions; "详情" opens a bottom sheet with the full request.

interface Approval {
  id: number
  request_no: string
  request_type: string
  requester_id: number
  requester_name: string | null
  approver_id: number | null
  status: string
  payload_json: {
    items?: { sku_id: number; qty: number }[]
    reason?: string
    urgency?: string
    deliver_to?: string
  }
  created_at: string
}

const wrap: React.CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  minHeight: '100dvh',
  background: '#F4F5F7',
  paddingBottom: 24,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
}

const TYPE_META: Record<
  string,
  { label: string; icon: IconName; color: string; bg: string }
> = {
  asset_assign: { label: '资产领用', icon: 'assets', color: '#3370FF', bg: '#E8F1FF' },
  asset_return: { label: '资产归还', icon: 'assets', color: '#00863C', bg: '#E8FFEA' },
  asset_scrap: { label: '资产报废', icon: 'warning', color: '#F53F3F', bg: '#FFECE8' },
  consumable: { label: '耗材申请', icon: 'box', color: '#FF8800', bg: '#FFF7E8' },
  accessory: { label: '配件申请', icon: 'link', color: '#7E5EE5', bg: '#F1ECFF' },
  repair: { label: '维修工单', icon: 'repair', color: '#FF8800', bg: '#FFF7E8' },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待审批', color: '#FF8800', bg: '#FFF7E8' },
  approved: { label: '待发放', color: '#3370FF', bg: '#E8F1FF' },
  rejected: { label: '已拒绝', color: '#86909C', bg: '#F2F3F5' },
  fulfilled: { label: '已完成', color: '#00B42A', bg: '#E8FFEA' },
}

const TABS = [
  { key: 'pending', label: '待审批' },
  { key: 'approved', label: '待发放' },
]

function typeMeta(t: string) {
  return TYPE_META[t] ?? { label: t, icon: 'approval' as IconName, color: '#86909C', bg: '#F2F3F5' }
}

function fmtTime(s: string): string {
  try {
    return new Date(s).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return s
  }
}

function itemsText(a: Approval): string {
  const items = a.payload_json?.items ?? []
  if (!items.length) return ''
  return items.map((i) => `#${i.sku_id} ×${i.qty}`).join('、')
}

export default function MobileAdminApprovals() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState('pending')
  const [detailId, setDetailId] = useState<number | null>(null)

  const { data, isLoading } = useQuery<Approval[]>({
    queryKey: ['m-admin-approvals'],
    queryFn: async () =>
      (await api.get('/approvals', { params: { scope: 'for_me' } })).data,
  })

  const act = useMutation({
    mutationFn: async ({ id, op }: { id: number; op: 'approve' | 'reject' | 'fulfill' }) =>
      (await api.post(`/approvals/${id}/${op}`)).data,
    onSuccess: (_d, v) => {
      const verb = v.op === 'approve' ? '已通过' : v.op === 'reject' ? '已驳回' : '已发放'
      qc.invalidateQueries({ queryKey: ['m-admin-approvals'] })
      qc.invalidateQueries({ queryKey: ['m-admin-overview'] })
      qc.invalidateQueries({ queryKey: ['m-admin-my-approvals'] })
      message.success(verb)
      setDetailId(null)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '操作失败'),
  })

  const all = data ?? []
  const list = all.filter((a) => a.status === tab)
  const detail = detailId != null ? all.find((a) => a.id === detailId) ?? null : null

  return (
    <div style={wrap}>
      {/* Dark admin nav */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          background: '#1F2329',
          color: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => navigate('/m/admin')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            padding: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            opacity: 0.85,
          }}
          aria-label="返回"
        >
          <Icon name="chevronLeft" size={20} />
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 600 }}>
          审批中心
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', background: '#1F2329' }}>
        {TABS.map((t) => {
          const active = t.key === tab
          const n = all.filter((a) => a.status === t.key).length
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '5px 14px',
                borderRadius: 16,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                background: active ? '#fff' : 'rgba(255,255,255,0.12)',
                color: active ? '#1F2329' : 'rgba(255,255,255,0.75)',
              }}
            >
              {t.label}
              {n > 0 ? ` ${n}` : ''}
            </button>
          )
        })}
      </div>

      {/* Cards */}
      <div style={{ padding: '14px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLoading && (
          <div style={{ padding: 40, textAlign: 'center', color: '#86909C', fontSize: 13 }}>
            加载中…
          </div>
        )}
        {!isLoading &&
          list.map((a) => {
            const tm = typeMeta(a.request_type)
            const items = itemsText(a)
            const busy = act.isPending && act.variables?.id === a.id
            return (
              <div key={a.id} style={{ borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: tm.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={tm.icon} size={20} color={tm.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1F2329' }}>
                        {tm.label}
                      </span>
                      {a.payload_json?.urgency === 'urgent' && (
                        <span
                          style={{
                            fontSize: 10,
                            color: '#F53F3F',
                            background: '#FFECE8',
                            padding: '1px 6px',
                            borderRadius: 8,
                            fontWeight: 500,
                          }}
                        >
                          加急
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#86909C',
                        fontFamily: 'ui-monospace, monospace',
                        marginTop: 2,
                      }}
                    >
                      {a.request_no}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: STATUS_META[a.status]?.bg ?? '#F2F3F5',
                      color: STATUS_META[a.status]?.color ?? '#86909C',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {STATUS_META[a.status]?.label ?? a.status}
                  </span>
                </div>

                {/* Body: requester + reason + items */}
                <div style={{ padding: '0 12px 10px', fontSize: 12, color: '#4E5969' }}>
                  <div>
                    申请人:
                    {a.requester_name ?? `#${a.requester_id}`}
                    <span style={{ color: '#C9CDD4' }}> · {fmtTime(a.created_at)}</span>
                  </div>
                  {a.payload_json?.reason && (
                    <div style={{ marginTop: 2 }}>事由:{a.payload_json.reason}</div>
                  )}
                  {items && <div style={{ marginTop: 2 }}>物品:{items}</div>}
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    padding: 10,
                    borderTop: '0.5px solid #F2F3F5',
                  }}
                >
                  <button
                    onClick={() => setDetailId(a.id)}
                    style={{
                      flex: '0 0 auto',
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid #E5E6EB',
                      background: '#fff',
                      color: '#4E5969',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    详情
                  </button>
                  {a.status === 'pending' ? (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => act.mutate({ id: a.id, op: 'reject' })}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          borderRadius: 8,
                          border: '1px solid #FFD8C8',
                          background: '#fff',
                          color: '#F53F3F',
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        驳回
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => act.mutate({ id: a.id, op: 'approve' })}
                        style={{
                          flex: 2,
                          padding: '8px 0',
                          borderRadius: 8,
                          border: 'none',
                          background: '#3370FF',
                          color: '#fff',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        一键通过
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => act.mutate({ id: a.id, op: 'fulfill' })}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: 8,
                        border: 'none',
                        background: '#00B42A',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      确认发放
                    </button>
                  )}
                </div>
              </div>
            )
          })}

        {!isLoading && list.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: '#86909C', fontSize: 13 }}>
            <Icon name="check" size={36} color="#C9CDD4" />
            <div style={{ marginTop: 10 }}>
              {tab === 'pending' ? '没有待审批的申请' : '没有待发放的申请'}
            </div>
          </div>
        )}
      </div>

      {/* Bottom-sheet detail */}
      {detail && (
        <div
          onClick={() => setDetailId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(31,35,41,0.45)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '85dvh',
              background: '#F4F5F7',
              borderRadius: '16px 16px 0 0',
              overflowY: 'auto',
              paddingBottom: 16,
            }}
          >
            {/* drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E6EB' }} />
            </div>

            {(() => {
              const tm = typeMeta(detail.request_type)
              return (
                <div style={{ padding: '4px 16px 0' }}>
                  {/* Hero */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: tm.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={tm.icon} size={24} color={tm.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#1F2329' }}>
                        {tm.label}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#86909C',
                          fontFamily: 'ui-monospace, monospace',
                        }}
                      >
                        {detail.request_no}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        padding: '2px 10px',
                        borderRadius: 10,
                        background: STATUS_META[detail.status]?.bg ?? '#F2F3F5',
                        color: STATUS_META[detail.status]?.color ?? '#86909C',
                        fontWeight: 500,
                      }}
                    >
                      {STATUS_META[detail.status]?.label ?? detail.status}
                    </span>
                  </div>

                  {/* Fields */}
                  <div style={{ background: '#fff', borderRadius: 12, marginTop: 16, overflow: 'hidden' }}>
                    {[
                      ['申请人', detail.requester_name ?? `#${detail.requester_id}`],
                      ['事由', detail.payload_json?.reason || '—'],
                      ['紧急程度', detail.payload_json?.urgency === 'urgent' ? '加急' : '普通'],
                      ['交付方式', detail.payload_json?.deliver_to === 'self_desk' ? '送到工位' : (detail.payload_json?.deliver_to || '—')],
                      ['提交时间', fmtTime(detail.created_at)],
                    ].map(([label, value], i, arr) => (
                      <div
                        key={label}
                        style={{
                          display: 'flex',
                          gap: 12,
                          padding: '11px 14px',
                          borderBottom: i < arr.length - 1 ? '0.5px solid #F2F3F5' : 'none',
                        }}
                      >
                        <span style={{ fontSize: 12, color: '#86909C', minWidth: 64 }}>{label}</span>
                        <span style={{ fontSize: 13, color: '#1F2329', flex: 1, textAlign: 'right' }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Items */}
                  {(detail.payload_json?.items?.length ?? 0) > 0 && (
                    <div style={{ background: '#fff', borderRadius: 12, marginTop: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px 4px', fontSize: 12, color: '#86909C' }}>
                        申请物品
                      </div>
                      {detail.payload_json!.items!.map((it, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 14px',
                            fontSize: 13,
                            color: '#1F2329',
                          }}
                        >
                          <span style={{ fontFamily: 'ui-monospace, monospace' }}>
                            SKU #{it.sku_id}
                          </span>
                          <span>×{it.qty}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    {detail.status === 'pending' ? (
                      <>
                        <button
                          disabled={act.isPending}
                          onClick={() => act.mutate({ id: detail.id, op: 'reject' })}
                          style={{
                            flex: 1,
                            padding: '12px 0',
                            borderRadius: 10,
                            border: '1px solid #FFD8C8',
                            background: '#fff',
                            color: '#F53F3F',
                            fontSize: 15,
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          驳回
                        </button>
                        <button
                          disabled={act.isPending}
                          onClick={() => act.mutate({ id: detail.id, op: 'approve' })}
                          style={{
                            flex: 2,
                            padding: '12px 0',
                            borderRadius: 10,
                            border: 'none',
                            background: '#3370FF',
                            color: '#fff',
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: 'pointer',
                            opacity: act.isPending ? 0.6 : 1,
                          }}
                        >
                          通过
                        </button>
                      </>
                    ) : (
                      <button
                        disabled={act.isPending}
                        onClick={() => act.mutate({ id: detail.id, op: 'fulfill' })}
                        style={{
                          flex: 1,
                          padding: '12px 0',
                          borderRadius: 10,
                          border: 'none',
                          background: '#00B42A',
                          color: '#fff',
                          fontSize: 15,
                          fontWeight: 600,
                          cursor: 'pointer',
                          opacity: act.isPending ? 0.6 : 1,
                        }}
                      >
                        确认发放
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
