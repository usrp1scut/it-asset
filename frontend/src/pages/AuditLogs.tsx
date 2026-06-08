import { useMemo, useState } from 'react'
import { Pagination } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import Icon, { type IconName } from '../components/Icon'

interface AuditItem {
  id: number
  actor_user_id: number | null
  actor_name: string | null
  action: string
  resource_type: string
  resource_id: string | null
  ip: string | null
  ua: string | null
  created_at: string
}

type Category = 'create' | 'done' | 'request' | 'reject' | 'system'

const CAT_META: Record<Category, { color: string; bg: string; icon: IconName }> = {
  create: { color: '#1A5BD0', bg: '#E8F1FF', icon: 'box' },
  done: { color: '#00863C', bg: '#E8FFEA', icon: 'check' },
  request: { color: '#A66200', bg: '#FFF7E8', icon: 'clock' },
  reject: { color: '#A8261D', bg: '#FFECE8', icon: 'close' },
  system: { color: '#4E5969', bg: '#F2F3F5', icon: 'settings' },
}

function categorize(action: string): Category {
  if (/^(celery|lark)\./.test(action)) return 'system'
  if (/\.(approve|complete|confirm|fulfill|dispose|set_status)$/.test(action)) return 'done'
  if (/\.(reject|cancel|delete)$/.test(action)) return 'reject'
  if (/(request|repair\.open|scrap\.(submit|request)|\.import)/.test(action)) return 'request'
  return 'create' // asset.* / inventory.* / user.* / asset_type.* …
}

// Friendly labels for the common actions; unknown actions fall back to raw.
const ACTION_CN: Record<string, string> = {
  'asset.create': '新建资产',
  'asset.update': '更新资产',
  'asset.assign': '分配资产',
  'asset.return': '归还入库',
  'asset.transfer': '转移资产',
  'asset.repair': '报修',
  'asset.scrap': '报废',
  'asset.delete': '删除资产',
  'asset.import': '导入资产',
  'asset.change_type': '更改类型',
  'asset.set_status': '更改状态',
  'asset_type.create': '新建类型',
  'asset_type.update': '更新类型',
  'asset_type.delete': '删除类型',
  'asset_type.backfill': '回填类型',
  'repair.open': '维修开单',
  'repair.update': '维修更新',
  'repair.complete': '维修完结',
  'repair.cancel': '维修取消',
  'scrap.submit': '报废申请',
  'scrap.request': '报废申请',
  'scrap.approve': '报废批准',
  'scrap.reject': '报废拒绝',
  'scrap.dispose': '报废处置',
  'user.role_change': '角色变更',
  'users.sync': '通讯录同步',
}

const AVATAR_COLORS = ['#3370FF', '#00B42A', '#FF8800', '#7E5EE5', '#F53F3F', '#00B2C7', '#D4380D']
function colorFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function dayLabel(date: string): string {
  const today = new Date()
  const d = new Date(date + 'T00:00:00')
  const diff = Math.round((today.setHours(0, 0, 0, 0) - d.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  return date
}

export default function AuditLogs() {
  const [page, setPage] = useState(1)
  const size = 40
  const { data, isLoading } = useQuery<{ total: number; items: AuditItem[] }>({
    queryKey: ['audit-logs', page],
    queryFn: async () => (await api.get('/audit-logs', { params: { page, size } })).data,
  })

  const groups = useMemo(() => {
    const items = data?.items ?? []
    const byDay = new Map<string, AuditItem[]>()
    for (const it of items) {
      const day = it.created_at.slice(0, 10)
      const arr = byDay.get(day) ?? []
      arr.push(it)
      byDay.set(day, arr)
    }
    return [...byDay.entries()] // already in created_at desc order from the API
  }, [data])

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>操作日志</h2>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {(Object.keys(CAT_META) as Category[]).map((c) => (
          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_META[c].color }} />
            {c === 'create' ? '变更' : c === 'done' ? '完成' : c === 'request' ? '申请/导入' : c === 'reject' ? '驳回/删除' : '系统'}
          </span>
        ))}
      </div>

      {isLoading && <div style={{ color: 'var(--text-3)', padding: 24 }}>加载中…</div>}

      {groups.map(([day, items]) => (
        <div key={day} style={{ marginBottom: 8 }}>
          <div
            style={{
              position: 'sticky',
              top: 0,
              background: 'var(--bg-2, #F4F5F7)',
              padding: '8px 4px',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-2)',
              zIndex: 1,
            }}
          >
            {dayLabel(day)} <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>· {items.length} 条</span>
          </div>
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {items.map((it, i) => {
              const cat = categorize(it.action)
              const m = CAT_META[cat]
              const isSystem = !it.actor_user_id && !it.actor_name
              const actor = it.actor_name ?? (it.actor_user_id ? `#${it.actor_user_id}` : '系统')
              return (
                <div
                  key={it.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 16px',
                    borderTop: i > 0 ? '0.5px solid var(--divider)' : 'none',
                  }}
                >
                  <span
                    className="text-mono"
                    style={{ fontSize: 12, color: 'var(--text-3)', width: 64, flexShrink: 0 }}
                  >
                    {it.created_at.slice(11, 19)}
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 12,
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: m.bg,
                      color: m.color,
                      flexShrink: 0,
                      minWidth: 96,
                    }}
                  >
                    <Icon name={m.icon} size={12} color={m.color} />
                    {ACTION_CN[it.action] ?? it.action}
                  </span>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: isSystem ? '#E5E6EB' : colorFor(actor),
                      color: isSystem ? '#86909C' : '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {isSystem ? '系' : actor.slice(0, 1)}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-1)', flexShrink: 0 }}>{actor}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {it.resource_type}
                    {it.resource_id && (
                      <span className="text-mono" style={{ color: 'var(--lark-blue)', marginLeft: 6 }}>
                        {it.resource_id}
                      </span>
                    )}
                  </span>
                  <span
                    className="text-mono"
                    title={it.ua ?? undefined}
                    style={{
                      fontSize: 11,
                      color: 'var(--text-3)',
                      width: 116,
                      textAlign: 'right',
                      flexShrink: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {it.ip ?? '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {!isLoading && groups.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>暂无日志</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Pagination
          current={page}
          pageSize={size}
          total={data?.total ?? 0}
          onChange={setPage}
          showSizeChanger={false}
          showTotal={(t) => `共 ${t} 条`}
        />
      </div>
    </div>
  )
}
