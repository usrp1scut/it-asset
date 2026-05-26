import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

type ConfirmStatus = 'pending' | 'ok' | 'mismatch'
interface TaskRow {
  id: number
  name: string
  scope_type: string
  status: 'open' | 'closed'
  started_at: string | null
  ended_at: string | null
  progress: Record<ConfirmStatus, number>
}

const SCOPE_CN: Record<string, string> = {
  personal_in_use: '个人在用',
  personal_all: '所有个人资产',
  infrastructure: '基础设施',
  by_location: '按地点',
  by_department: '按部门',
}

const wrap: React.CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  minHeight: '100dvh',
  background: '#F4F5F7',
  paddingBottom: 32,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
}

function NavBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
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
        onClick={onBack}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#fff',
          fontSize: 22,
          padding: 6,
          cursor: 'pointer',
          opacity: 0.85,
        }}
        aria-label="返回"
      >
        ‹
      </button>
      <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 600 }}>
        {title}
      </div>
      <div style={{ width: 32 }} />
    </div>
  )
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div
      style={{
        height: 6,
        borderRadius: 3,
        background: '#F2F3F5',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
          transition: 'width 200ms ease',
        }}
      />
    </div>
  )
}

export default function MobileAdminInspections() {
  const navigate = useNavigate()
  const { data: tasks, isLoading } = useQuery<TaskRow[]>({
    queryKey: ['m-admin-inspections'],
    queryFn: async () => (await api.get('/inspections')).data,
  })

  const open = (tasks ?? []).filter((t) => t.status === 'open')
  const closed = (tasks ?? []).filter((t) => t.status === 'closed')

  return (
    <div style={wrap}>
      <NavBar title="资产盘点" onBack={() => navigate('/m/admin')} />

      {isLoading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#86909C', fontSize: 13 }}>
          加载中…
        </div>
      )}

      {!isLoading && tasks && tasks.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#86909C' }}>
          <div style={{ fontSize: 32, color: '#C9CDD4', marginBottom: 8 }}>—</div>
          <div style={{ fontSize: 13 }}>暂无盘点任务</div>
          <div style={{ fontSize: 11, marginTop: 6 }}>请在 PC 端创建新任务</div>
        </div>
      )}

      {open.length > 0 && (
        <div style={{ padding: '16px 16px 0' }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, color: '#1F2329', marginBottom: 10 }}
          >
            进行中 ({open.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {open.map((t) => (
              <TaskCard
                key={t.id}
                t={t}
                onClick={() => navigate(`/m/admin/inspections/${t.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {closed.length > 0 && (
        <div style={{ padding: '20px 16px 0' }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, color: '#1F2329', marginBottom: 10 }}
          >
            已关闭 ({closed.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {closed.slice(0, 10).map((t) => (
              <TaskCard
                key={t.id}
                t={t}
                onClick={() => navigate(`/m/admin/inspections/${t.id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TaskCard({ t, onClick }: { t: TaskRow; onClick: () => void }) {
  const total = t.progress.pending + t.progress.ok + t.progress.mismatch
  const done = t.progress.ok + t.progress.mismatch
  const pct = total ? Math.round((done / total) * 100) : 0
  const isOpen = t.status === 'open'
  const hasMismatch = t.progress.mismatch > 0

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 14,
        boxShadow: '0 1px 4px rgba(31,35,41,0.04)',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#1F2329',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {t.name}
          </div>
          <div style={{ fontSize: 11, color: '#86909C', marginTop: 4 }}>
            {SCOPE_CN[t.scope_type] ?? t.scope_type}
            {t.started_at && (
              <>
                {' · '}
                {new Date(t.started_at).toLocaleDateString('zh-CN')}
              </>
            )}
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 10,
            background: isOpen ? '#E8F1FF' : '#F2F3F5',
            color: isOpen ? '#3370FF' : '#86909C',
            fontWeight: 500,
            marginLeft: 8,
            flexShrink: 0,
          }}
        >
          {isOpen ? '进行中' : '已关闭'}
        </span>
      </div>

      <ProgressBar pct={pct} color={isOpen ? '#3370FF' : '#86909C'} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 8,
          fontSize: 11,
          color: '#86909C',
        }}
      >
        <span style={{ color: '#1F2329', fontWeight: 500 }}>
          {pct}% · {done}/{total}
        </span>
        <span>已核 {t.progress.ok}</span>
        {hasMismatch && (
          <span style={{ color: '#F53F3F', fontWeight: 500 }}>
            差异 {t.progress.mismatch}
          </span>
        )}
        <span style={{ color: '#C9CDD4' }}>待核 {t.progress.pending}</span>
        <span style={{ marginLeft: 'auto', color: '#C9CDD4' }}>›</span>
      </div>
    </div>
  )
}
