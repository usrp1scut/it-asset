/**
 * Bottom-sheet employee picker for the mobile admin (分配 / 转移).
 *
 * Same data source as the desktop EmployeeSelect (GET /users?q=, active users
 * only, server-side search) but touch-shaped: a sheet with a search box and a
 * tappable list instead of an AntD dropdown, which is unusable on a phone.
 *
 * Pick is two-step (选中 → 确认) rather than tap-to-commit, because 分配 can
 * carry an extra option (发送 Lark 领用确认卡片) that has to be decided before
 * the request fires.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import Icon from '../../../components/Icon'

interface Person {
  id: number
  name: string
  email: string | null
  department_name: string | null
}

export default function EmployeePickerSheet({
  open,
  title,
  confirmLabel,
  extra,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  confirmLabel: string
  /** Extra控件 rendered above the confirm button (e.g. 通知卡片开关). */
  extra?: ReactNode
  pending?: boolean
  onClose: () => void
  onConfirm: (userId: number) => void
}) {
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<number | null>(null)

  // debounce keystrokes so we don't fire a request per character
  useEffect(() => {
    const t = setTimeout(() => setQ(input), 250)
    return () => clearTimeout(t)
  }, [input])

  // 每次打开都从干净状态开始,免得上次选的人 / 搜索词残留下来
  useEffect(() => {
    if (open) {
      setInput('')
      setQ('')
      setSelected(null)
    }
  }, [open])

  const { data, isFetching } = useQuery<Person[]>({
    queryKey: ['user-search', q],
    queryFn: async () => (await api.get('/users', { params: { q: q || undefined } })).data,
    enabled: open,
  })

  if (!open) return null

  const people = data ?? []

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31,35,41,0.45)',
        zIndex: 60,
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
          maxHeight: '80dvh',
          background: '#fff',
          borderRadius: '16px 16px 0 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E6EB' }} />
        </div>
        <div style={{ padding: '4px 16px 10px', fontSize: 14, fontWeight: 600 }}>{title}</div>

        <div style={{ padding: '0 16px 10px' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="搜索姓名 / 邮箱"
            style={{
              width: '100%',
              height: 38,
              borderRadius: 10,
              border: '1px solid #E5E6EB',
              background: '#F7F8FA',
              padding: '0 12px',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 120 }}>
          {isFetching && people.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#86909C', fontSize: 13 }}>
              加载中…
            </div>
          )}
          {!isFetching && people.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#86909C', fontSize: 13 }}>
              没有匹配的员工
            </div>
          )}
          {people.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                background: p.id === selected ? '#F2F7FF' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: '#F2F3F5',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  fontSize: 13,
                  color: '#4E5969',
                }}
              >
                {p.name.slice(0, 1)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: '#1F2329' }}>{p.name}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#86909C',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {[p.department_name, p.email].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              {p.id === selected && <Icon name="check" size={16} color="#3370FF" />}
            </button>
          ))}
        </div>

        <div
          style={{
            padding: '10px 16px',
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
            borderTop: '0.5px solid #E5E6EB',
          }}
        >
          {extra}
          <button
            onClick={() => selected != null && onConfirm(selected)}
            disabled={selected == null || pending}
            style={{
              width: '100%',
              height: 46,
              borderRadius: 12,
              border: 'none',
              background: selected == null ? '#A9C4FF' : '#3370FF',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: selected == null || pending ? 'not-allowed' : 'pointer',
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? '处理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
