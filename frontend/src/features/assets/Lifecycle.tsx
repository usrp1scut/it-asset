import type { ChangeLog } from './types'

// Signature moment — lifecycle timeline (design_handoff README §4.3).
const ACTION: Record<string, { label: string; en: string; color: string; bg: string }> = {
  create: { label: '资产入库', en: 'Inbound', color: '#3370FF', bg: '#E8F1FF' },
  assign: { label: '已分配', en: 'Assigned', color: '#3370FF', bg: '#E8F1FF' },
  return: { label: '归还入库', en: 'Returned', color: '#00B42A', bg: '#E8FFEA' },
  repair: { label: '报修', en: 'Repair', color: '#FF8800', bg: '#FFF7E8' },
  scrap: { label: '报废', en: 'Scrapped', color: '#4E5969', bg: '#E5E6EB' },
  bind_accessory: { label: '配件绑定', en: 'Bound', color: '#00B2C7', bg: '#E0F7FA' },
  update: { label: '信息更新', en: 'Updated', color: '#7E5EE5', bg: '#F1ECFF' },
}

export default function Lifecycle({
  events,
  receipt,
}: {
  events: ChangeLog[]
  // Current holder's 领用确认 — shown on the latest 已分配 event only.
  receipt?: { state: '' | 'pending' | 'acknowledged'; at: string | null }
}) {
  if (events.length === 0)
    return <div style={{ color: 'var(--text-3)', fontSize: 13 }}>暂无生命周期记录</div>

  return (
    <div style={{ paddingLeft: 8 }}>
      {events.map((e, i) => {
        const a = ACTION[e.action] ?? ACTION.update
        const last = i === events.length - 1
        return (
          <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: last ? 0 : 24, position: 'relative' }}>
            {!last && (
              <div
                style={{ position: 'absolute', left: 15, top: 32, bottom: 0, width: 2, background: 'var(--divider)' }}
              />
            )}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: a.bg,
                border: i === 0 ? `2px solid ${a.color}` : '2px solid transparent',
                flexShrink: 0,
                zIndex: 1,
              }}
            />
            <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{a.label}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-3)',
                    padding: '1px 6px',
                    background: 'var(--bg-canvas)',
                    borderRadius: 3,
                  }}
                >
                  {a.en}
                </span>
                {i === 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--success)',
                      padding: '1px 6px',
                      background: 'var(--success-bg)',
                      borderRadius: 3,
                      fontWeight: 500,
                    }}
                  >
                    最新
                  </span>
                )}
                {i === 0 && e.action === 'assign' && receipt?.state === 'acknowledged' && (
                  <span
                    title={receipt.at ? new Date(receipt.at).toLocaleString('zh-CN') : undefined}
                    style={{
                      fontSize: 11,
                      color: 'var(--success)',
                      padding: '1px 6px',
                      background: 'var(--success-bg)',
                      borderRadius: 3,
                      fontWeight: 500,
                    }}
                  >
                    ✅ 已确认领取
                  </span>
                )}
                {i === 0 && e.action === 'assign' && receipt?.state === 'pending' && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--warning)',
                      padding: '1px 6px',
                      background: 'var(--warning-bg)',
                      borderRadius: 3,
                      fontWeight: 500,
                    }}
                  >
                    待确认
                  </span>
                )}
              </div>
              {e.reason && (
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>{e.reason}</div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-3)' }} className="text-mono">
                {new Date(e.created_at).toLocaleString('zh-CN')}
                {e.from_status && e.to_status ? ` · ${e.from_status} → ${e.to_status}` : ''}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
