import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useAuth } from '../../../stores/auth'
import CameraScanner from '../../../features/scanner/CameraScanner'
import Icon, { type IconName } from '../../../components/Icon'

interface Overview {
  stats: {
    total_assets: number
    pending_approvals: number
    low_stock_count: number
    in_use_count: number
    idle_count: number
    maintenance_count: number
    needs_review_count: number
    scrap_candidate_count: number
  }
  low_stock_skus: { sku_code: string; name: string; available: number; safety: number }[]
  recent_approvals: {
    request_no: string
    request_type: string
    requester_id: number
    status: string
    created_at: string
  }[]
}

interface Approval {
  id: number
  request_no: string
  request_type: string
  requester_id: number
  requester_name: string | null
  status: string
  created_at: string
}

const wrap: React.CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  minHeight: '100dvh',
  background: '#F4F5F7',
  paddingBottom: 80,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
}

const APPROVAL_TYPE_CN: Record<string, string> = {
  asset_assign: '资产领用',
  asset_return: '资产归还',
  asset_scrap: '资产报废',
  consumable: '耗材申请',
  accessory: '配件申请',
  repair: '维修工单',
}

/** Top status / nav bar — sticks above the hero. */
function NavBar({ title, onClose }: { title: string; onClose?: () => void }) {
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
        onClick={onClose}
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
        aria-label="返回管理端"
      >
        <Icon name="chevronLeft" size={20} />
      </button>
      <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 600 }}>
        {title}
      </div>
      <div style={{ width: 32 }} />
    </div>
  )
}

interface QuickActionProps {
  icon: IconName
  label: string
  color: string
  bg: string
  badge?: number
  onClick: () => void
}
function QuickAction({ icon, label, color, bg, badge, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: 8,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        minHeight: 72,
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
          }}
        >
          <Icon name={icon} size={22} color={color} />
        </div>
        {badge !== undefined && badge > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              borderRadius: 9,
              background: '#F53F3F',
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid #fff',
              lineHeight: 1,
            }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span style={{ fontSize: 12, color: '#1F2329' }}>{label}</span>
    </button>
  )
}

interface SnapshotRowProps {
  icon: IconName
  iconColor: string
  iconBg: string
  label: string
  value: number | string
  suffix?: string
  hint?: string
  last?: boolean
  onClick?: () => void
}
function SnapshotRow({
  icon,
  iconColor,
  iconBg,
  label,
  value,
  suffix,
  hint,
  last,
  onClick,
}: SnapshotRowProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderBottom: last ? 'none' : '0.5px solid #F2F3F5',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={18} color={iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#1F2329', fontWeight: 500 }}>{label}</div>
        {hint && (
          <div style={{ fontSize: 11, color: '#86909C', marginTop: 2 }}>{hint}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>
          {value}
        </span>
        {suffix && <span style={{ fontSize: 11, color: '#86909C' }}>{suffix}</span>}
      </div>
      {onClick && (
        <Icon name="chevronRight" size={14} color="#C9CDD4" style={{ marginLeft: 2 }} />
      )}
    </div>
  )
}

interface TabBarProps {
  active: 'home' | 'scan'
  onNav: (id: 'home' | 'scan') => void
}
/** Bottom tab bar with center "floating" scan FAB.
 * 首页 / 扫码 / 库存 stay inside the mobile cockpit; 审批 / 我的 still hop to
 * the desktop routes (no mobile screen for those yet). */
function TabBar({ active, onNav }: TabBarProps) {
  const navigate = useNavigate()
  type Tab = {
    id: string
    icon: IconName
    label: string
    special?: boolean
    onClick: () => void
  }
  const tabs: Tab[] = [
    { id: 'home', icon: 'home', label: '首页', onClick: () => onNav('home') },
    {
      id: 'approvals',
      icon: 'approval',
      label: '审批',
      onClick: () => navigate('/approvals'),
    },
    { id: 'scan', icon: 'qr', label: '扫码', special: true, onClick: () => onNav('scan') },
    {
      id: 'lowstock',
      icon: 'inventory',
      label: '库存',
      onClick: () => navigate('/m/admin/inventory'),
    },
    { id: 'me', icon: 'user', label: '我的', onClick: () => navigate('/') },
  ]

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        background: '#fff',
        borderTop: '0.5px solid #E5E6EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        maxWidth: 480,
        margin: '0 auto',
        zIndex: 20,
      }}
    >
      {tabs.map((tab) => {
        if (tab.special) {
          return (
            <button
              key={tab.id}
              onClick={tab.onClick}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                marginTop: -16,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
              aria-label="扫码"
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3370FF, #5B92FF)',
                  boxShadow: '0 4px 14px rgba(51,112,255,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '3px solid #fff',
                }}
              >
                <Icon name={tab.icon} size={22} color="#fff" />
              </div>
              <span style={{ fontSize: 10, color: '#3370FF', fontWeight: 500, marginTop: 2 }}>
                {tab.label}
              </span>
            </button>
          )
        }
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={tab.onClick}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? '#3370FF' : '#86909C',
            }}
          >
            <Icon
              name={tab.icon}
              size={20}
              color={isActive ? '#3370FF' : '#86909C'}
            />
            <span style={{ fontSize: 10, fontWeight: isActive ? 500 : 400 }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function MobileAdminHome() {
  const navigate = useNavigate()
  const me = useAuth((s) => s.user)
  const role = me?.role ?? ''
  const [scanOpen, setScanOpen] = useState(false)

  const { data: overview } = useQuery<Overview>({
    queryKey: ['m-admin-overview'],
    queryFn: async () => (await api.get('/dashboard/overview')).data,
  })
  const { data: myApprovals } = useQuery<Approval[]>({
    queryKey: ['m-admin-my-approvals'],
    queryFn: async () =>
      (await api.get('/approvals', { params: { scope: 'for_me' } })).data,
  })

  const stats = overview?.stats
  const pendingForMe = (myApprovals ?? []).filter((a) => a.status === 'pending')
  const urgent = pendingForMe.slice(0, 2)

  const fmtValue = (v: number | undefined) => (v == null ? '—' : v.toLocaleString())

  return (
    <div style={wrap}>
      <NavBar title="IT 管理台" onClose={() => navigate('/')} />

      {/* Dark Hero — admin identity */}
      <div
        style={{
          padding: '20px 16px 32px',
          background: 'linear-gradient(180deg, #1F2329 0%, #2E3440 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'rgba(51,112,255,0.18)',
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            {(me?.name ?? '?').slice(0, 1)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{me?.name ?? '管理员'}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{role}</div>
          </div>
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 10,
              background: 'rgba(51,112,255,0.25)',
              color: '#9DC1FF',
              fontWeight: 500,
              letterSpacing: '0.04em',
            }}
          >
            ADMIN
          </span>
        </div>

        <div style={{ marginTop: 18, position: 'relative' }}>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>今日待办</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {pendingForMe.length}
            </span>
            <span style={{ fontSize: 13, opacity: 0.7 }}>项需处理</span>
          </div>
        </div>
      </div>

      {/* Quick action grid — floats over the hero edge */}
      <div
        style={{
          margin: '-18px 12px 0',
          padding: '14px 8px',
          borderRadius: 14,
          background: '#fff',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 0,
          position: 'relative',
          boxShadow: '0 2px 12px rgba(31,35,41,0.08)',
        }}
      >
        <QuickAction
          icon="qr"
          label="扫码查询"
          color="#3370FF"
          bg="#E8F1FF"
          onClick={() => setScanOpen(true)}
        />
        <QuickAction
          icon="approval"
          label="审批"
          color="#FF8800"
          bg="#FFF7E8"
          badge={pendingForMe.length}
          onClick={() => navigate('/approvals')}
        />
        <QuickAction
          icon="warning"
          label="库存预警"
          color="#F53F3F"
          bg="#FFECE8"
          badge={stats?.low_stock_count}
          onClick={() => navigate('/m/admin/inventory')}
        />
        <QuickAction
          icon="inspect"
          label="盘点核对"
          color="#7E5EE5"
          bg="#F1ECFF"
          onClick={() => navigate('/m/admin/inspections')}
        />
      </div>

      {/* Urgent items (待我审批 top 2) */}
      {urgent.length > 0 && (
        <div style={{ margin: '20px 16px 0' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1F2329' }}>
              🔥 待我审批
            </span>
            <span
              onClick={() => navigate('/approvals')}
              style={{
                fontSize: 12,
                color: '#3370FF',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              全部 {pendingForMe.length} 项
              <Icon name="chevronRight" size={12} color="#3370FF" />
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {urgent.map((a) => (
              <div
                key={a.id}
                onClick={() => navigate('/approvals')}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: '#fff',
                  border: '1px solid #FFD8C8',
                  boxShadow: '0 0 0 3px rgba(245,63,63,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: '#FFF7E8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="clock" size={18} color="#FF8800" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#1F2329',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {APPROVAL_TYPE_CN[a.request_type] ?? a.request_type}
                    <span style={{ color: '#86909C', fontWeight: 400, fontSize: 12 }}>
                      · {a.request_no}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#86909C',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.requester_name ?? `#${a.requester_id}`} ·{' '}
                    {new Date(a.created_at).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <Icon name="chevronRight" size={14} color="#C9CDD4" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System snapshot */}
      <div style={{ margin: '20px 16px 0' }}>
        <div
          style={{ fontSize: 14, fontWeight: 600, color: '#1F2329', marginBottom: 10 }}
        >
          系统概况
        </div>
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden' }}>
          <SnapshotRow
            icon="assets"
            iconColor="#3370FF"
            iconBg="#E8F1FF"
            label="资产总数"
            value={fmtValue(stats?.total_assets)}
            suffix="件"
            hint={`在用 ${fmtValue(stats?.in_use_count)} · 闲置 ${fmtValue(stats?.idle_count)}`}
            onClick={() => navigate('/m/admin/assets')}
          />
          <SnapshotRow
            icon="repair"
            iconColor="#FF8800"
            iconBg="#FFF7E8"
            label="维修中"
            value={fmtValue(stats?.maintenance_count)}
            suffix="件"
            onClick={() => navigate('/repair')}
          />
          <SnapshotRow
            icon="warning"
            iconColor="#F53F3F"
            iconBg="#FFECE8"
            label="库存预警"
            value={fmtValue(stats?.low_stock_count)}
            suffix="项"
            hint={
              overview && overview.low_stock_skus.length > 0
                ? overview.low_stock_skus
                    .slice(0, 2)
                    .map((s) => s.name)
                    .join('、')
                : undefined
            }
            onClick={() => navigate('/m/admin/inventory')}
          />
          <SnapshotRow
            icon="verify"
            iconColor="#7E5EE5"
            iconBg="#F1ECFF"
            label="需复核 / 待报废"
            value={`${stats?.needs_review_count ?? '—'}/${stats?.scrap_candidate_count ?? '—'}`}
            onClick={() => navigate('/m/admin/assets')}
            last
          />
        </div>
      </div>

      {/* Recent approvals — compact list */}
      {overview && overview.recent_approvals.length > 0 && (
        <div style={{ margin: '20px 16px 0' }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#1F2329',
              marginBottom: 10,
            }}
          >
            最近审批
          </div>
          <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden' }}>
            {overview.recent_approvals.slice(0, 5).map((r, i, arr) => (
              <div
                key={r.request_no}
                onClick={() => navigate('/approvals')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  borderBottom: i < arr.length - 1 ? '0.5px solid #F2F3F5' : 'none',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background:
                      r.status === 'approved'
                        ? '#00B42A'
                        : r.status === 'pending'
                          ? '#FF8800'
                          : '#86909C',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: '#1F2329',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {APPROVAL_TYPE_CN[r.request_type] ?? r.request_type} · {r.request_no}
                  </div>
                  <div style={{ fontSize: 11, color: '#86909C', marginTop: 2 }}>
                    {new Date(r.created_at).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color:
                      r.status === 'approved'
                        ? '#00B42A'
                        : r.status === 'pending'
                          ? '#FF8800'
                          : '#86909C',
                  }}
                >
                  {r.status === 'approved'
                    ? '已通过'
                    : r.status === 'pending'
                      ? '待审批'
                      : r.status === 'rejected'
                        ? '已驳回'
                        : r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <TabBar
        active="home"
        onNav={(id) => {
          if (id === 'scan') setScanOpen(true)
          else if (id === 'home') {
            // already here; scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
        }}
      />

      {/* Scanner overlay */}
      <CameraScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onCode={(code, raw) => {
          setScanOpen(false)
          // Pass the raw scan payload via state so the result page can
          // show both "we scanned X, looked up Y" if the lookup misses.
          navigate(`/m/admin/asset/${encodeURIComponent(code)}`, {
            state: { raw },
          })
        }}
      />
    </div>
  )
}
