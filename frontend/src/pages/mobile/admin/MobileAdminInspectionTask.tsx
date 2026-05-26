import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import CameraScanner from '../../../features/scanner/CameraScanner'

type ConfirmStatus = 'pending' | 'ok' | 'mismatch'

interface ItemRow {
  asset_code: string
  brand_model: string | null
  owner_name: string | null
  asset_status: string | null
  location: string | null
  confirm_status: ConfirmStatus
  remark: string | null
}

interface TaskDetail {
  id: number
  name: string
  scope_type: string
  status: 'open' | 'closed'
  started_at: string | null
  ended_at: string | null
  progress: Record<ConfirmStatus, number>
  items: ItemRow[]
}

const SCOPE_CN: Record<string, string> = {
  personal_in_use: '个人在用',
  personal_all: '所有个人资产',
  infrastructure: '基础设施',
  by_location: '按地点',
  by_department: '按部门',
}

const CONFIRM_META: Record<ConfirmStatus, { label: string; color: string; bg: string }> = {
  pending: { label: '待核', color: '#86909C', bg: '#F2F3F5' },
  ok: { label: '已确认', color: '#00B42A', bg: '#E8FFEA' },
  mismatch: { label: '差异', color: '#F53F3F', bg: '#FFECE8' },
}

const wrap: React.CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  minHeight: '100dvh',
  background: '#F4F5F7',
  paddingBottom: 96,
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

interface BannerState {
  kind: 'ok' | 'err' | 'info'
  code: string
  text: string
}

export default function MobileAdminInspectionTask() {
  const { id } = useParams<{ id: string }>()
  const taskId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'pending' | 'ok' | 'mismatch'>('pending')
  const [scanOpen, setScanOpen] = useState(false)
  // True = keep reopening scanner after each confirm (rapid mode).
  const [sequential, setSequential] = useState(true)
  // Inline feedback after a scan-confirm cycle. Clears after a short delay.
  const [banner, setBanner] = useState<BannerState | null>(null)
  const bannerTimerRef = useRef<number | null>(null)
  const reopenTimerRef = useRef<number | null>(null)

  const { data, isLoading } = useQuery<TaskDetail>({
    queryKey: ['m-admin-inspection', taskId],
    queryFn: async () => (await api.get(`/inspections/${taskId}`)).data,
    enabled: !Number.isNaN(taskId),
  })

  const confirmMut = useMutation({
    mutationFn: async (v: {
      code: string
      status: ConfirmStatus
      remark?: string | null
    }) =>
      (
        await api.post(`/inspections/${taskId}/items/${v.code}/confirm`, {
          status: v.status,
          remark: v.remark ?? null,
        })
      ).data,
  })

  const closeMut = useMutation({
    mutationFn: async () => api.post(`/inspections/${taskId}/close`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['m-admin-inspection', taskId] })
      qc.invalidateQueries({ queryKey: ['m-admin-inspections'] })
    },
  })

  const showBanner = (state: BannerState, ms = 1800) => {
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current)
    setBanner(state)
    bannerTimerRef.current = window.setTimeout(() => setBanner(null), ms)
  }

  // Run a scan-driven confirm against the task. Looks up the item locally
  // first (so we can distinguish "not in this task" from "API error" without
  // a roundtrip), then POSTs.
  const handleScannedCode = async (code: string, raw: string) => {
    if (!data) return
    const normCode = code.toUpperCase().trim()
    const item = data.items.find((i) => i.asset_code.toUpperCase() === normCode)
    if (!item) {
      showBanner({
        kind: 'err',
        code: code || raw,
        text: '不在本次盘点范围',
      })
      return
    }
    if (item.confirm_status === 'ok') {
      showBanner({
        kind: 'info',
        code: item.asset_code,
        text: `${item.brand_model ?? ''} · 之前已确认`,
      })
      return
    }
    try {
      await confirmMut.mutateAsync({ code: item.asset_code, status: 'ok' })
      showBanner({
        kind: 'ok',
        code: item.asset_code,
        text: `${item.brand_model ?? ''} ${item.owner_name ? '· ' + item.owner_name : ''}`,
      })
      qc.invalidateQueries({ queryKey: ['m-admin-inspection', taskId] })
    } catch (e) {
      const msg =
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        '确认失败'
      showBanner({ kind: 'err', code: item.asset_code, text: msg })
    }
  }

  // After a successful scan in sequential mode, briefly close the scanner
  // so the banner is visible, then re-open it for the next asset.
  const closeAndMaybeReopen = () => {
    setScanOpen(false)
    if (!sequential) return
    if (reopenTimerRef.current) window.clearTimeout(reopenTimerRef.current)
    reopenTimerRef.current = window.setTimeout(() => {
      // Only reopen if user hasn't navigated away or toggled off sequential.
      setScanOpen(true)
    }, 900)
  }

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current)
      if (reopenTimerRef.current) window.clearTimeout(reopenTimerRef.current)
    }
  }, [])

  if (Number.isNaN(taskId)) {
    return (
      <div style={wrap}>
        <NavBar title="盘点任务" onBack={() => navigate('/m/admin/inspections')} />
        <div style={{ padding: 24, color: '#86909C' }}>非法任务 ID</div>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div style={wrap}>
        <NavBar title="盘点任务" onBack={() => navigate('/m/admin/inspections')} />
        <div style={{ padding: 40, textAlign: 'center', color: '#86909C', fontSize: 13 }}>
          加载中…
        </div>
      </div>
    )
  }

  const total = data.progress.pending + data.progress.ok + data.progress.mismatch
  const done = data.progress.ok + data.progress.mismatch
  const pct = total ? Math.round((done / total) * 100) : 0
  const filtered = data.items.filter((i) => i.confirm_status === tab)
  const isOpen = data.status === 'open'

  return (
    <div style={wrap}>
      <NavBar
        title={data.name}
        onBack={() => navigate('/m/admin/inspections')}
      />

      {/* Progress hero */}
      <div
        style={{
          background: 'linear-gradient(180deg, #1F2329 0%, #2E3440 100%)',
          color: '#fff',
          padding: '20px 16px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -30,
            right: -40,
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: 'rgba(51,112,255,0.18)',
          }}
        />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, opacity: 0.6 }}>
            {SCOPE_CN[data.scope_type] ?? data.scope_type}
            {' · '}
            {data.started_at
              ? new Date(data.started_at).toLocaleDateString('zh-CN')
              : ''}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              marginTop: 8,
            }}
          >
            <span style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {pct}%
            </span>
            <span style={{ fontSize: 13, opacity: 0.7 }}>
              {done} / {total}
            </span>
            {!isOpen && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.12)',
                  fontWeight: 500,
                }}
              >
                已关闭
              </span>
            )}
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: 'rgba(255,255,255,0.15)',
              marginTop: 12,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background:
                  data.progress.mismatch > 0
                    ? 'linear-gradient(90deg, #3370FF 0%, #FF8800 100%)'
                    : '#3370FF',
                borderRadius: 3,
                transition: 'width 200ms ease',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              marginTop: 12,
              fontSize: 12,
            }}
          >
            <div>
              <span style={{ opacity: 0.6 }}>已核 </span>
              <span style={{ color: '#9DDB94', fontWeight: 500 }}>{data.progress.ok}</span>
            </div>
            <div>
              <span style={{ opacity: 0.6 }}>差异 </span>
              <span style={{ color: '#FF8F8F', fontWeight: 500 }}>
                {data.progress.mismatch}
              </span>
            </div>
            <div>
              <span style={{ opacity: 0.6 }}>待核 </span>
              <span style={{ fontWeight: 500 }}>{data.progress.pending}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '12px 12px 0',
          background: '#F4F5F7',
          position: 'sticky',
          top: 44,
          zIndex: 5,
        }}
      >
        {(['pending', 'ok', 'mismatch'] as const).map((k) => {
          const meta = CONFIRM_META[k]
          const isActive = tab === k
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                background: isActive ? meta.bg : '#fff',
                border: `1px solid ${isActive ? meta.color : '#E5E6EB'}`,
                color: isActive ? meta.color : '#1F2329',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {meta.label} {data.progress[k]}
            </button>
          )
        })}
      </div>

      {/* Item list */}
      <div style={{ padding: '12px 12px 0' }}>
        {filtered.length === 0 && (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: '#86909C',
              fontSize: 13,
              background: '#fff',
              borderRadius: 12,
            }}
          >
            {tab === 'pending'
              ? '全部已核完 🎉'
              : tab === 'ok'
                ? '尚未确认任何资产'
                : '没有差异项'}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((it) => (
            <ItemCard
              key={it.asset_code}
              it={it}
              disabled={!isOpen}
              onConfirm={async () => {
                if (!isOpen) return
                try {
                  await confirmMut.mutateAsync({
                    code: it.asset_code,
                    status: 'ok',
                  })
                  qc.invalidateQueries({
                    queryKey: ['m-admin-inspection', taskId],
                  })
                  showBanner({
                    kind: 'ok',
                    code: it.asset_code,
                    text: it.brand_model ?? '',
                  })
                } catch (e) {
                  const msg =
                    (e as { response?: { data?: { detail?: string } } }).response?.data
                      ?.detail ?? '确认失败'
                  showBanner({ kind: 'err', code: it.asset_code, text: msg })
                }
              }}
              onMismatch={async () => {
                if (!isOpen) return
                const remark = window.prompt(
                  `标记 ${it.asset_code} 为差异。请填写原因(必填):`,
                  it.remark ?? '',
                )
                if (!remark || !remark.trim()) return
                try {
                  await confirmMut.mutateAsync({
                    code: it.asset_code,
                    status: 'mismatch',
                    remark: remark.trim(),
                  })
                  qc.invalidateQueries({
                    queryKey: ['m-admin-inspection', taskId],
                  })
                  showBanner({
                    kind: 'info',
                    code: it.asset_code,
                    text: '已标记差异',
                  })
                } catch (e) {
                  const msg =
                    (e as { response?: { data?: { detail?: string } } }).response?.data
                      ?.detail ?? '操作失败'
                  showBanner({ kind: 'err', code: it.asset_code, text: msg })
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Close-task button (admin only logic on backend; UI is everywhere) */}
      {isOpen && (
        <div style={{ padding: '20px 16px 0' }}>
          <button
            onClick={() => {
              if (window.confirm(`关闭任务「${data.name}」?关闭后不能再继续核对。`)) {
                closeMut.mutate()
              }
            }}
            style={{
              width: '100%',
              height: 40,
              borderRadius: 20,
              background: '#fff',
              border: '1px solid #E5E6EB',
              color: '#86909C',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            关闭任务
          </button>
        </div>
      )}

      {/* Sticky scan FAB at the bottom */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            left: 0,
            right: 0,
            maxWidth: 480,
            margin: '0 auto',
            padding: '0 16px',
            zIndex: 30,
            pointerEvents: 'none',
          }}
        >
          <button
            onClick={() => setScanOpen(true)}
            disabled={confirmMut.isPending}
            style={{
              pointerEvents: 'auto',
              width: '100%',
              height: 52,
              borderRadius: 26,
              background: 'linear-gradient(135deg, #3370FF, #5B92FF)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              border: 'none',
              boxShadow: '0 6px 20px rgba(51,112,255,0.4)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 20 }}>⎚</span>
            扫码核对
          </button>
          <label
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 8,
              fontSize: 11,
              color: '#86909C',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={sequential}
              onChange={(e) => setSequential(e.target.checked)}
              style={{ accentColor: '#3370FF' }}
            />
            扫一次自动开下一次(连续模式)
          </label>
        </div>
      )}

      {/* Inline result banner — sits above the FAB while visible */}
      {banner && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)',
            left: 0,
            right: 0,
            maxWidth: 480,
            margin: '0 auto',
            padding: '0 16px',
            zIndex: 40,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background:
                banner.kind === 'ok'
                  ? '#00B42A'
                  : banner.kind === 'err'
                    ? '#F53F3F'
                    : '#1F2329',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: 10,
              boxShadow: '0 6px 20px rgba(31,35,41,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              animation: 'mai-banner-in 200ms ease-out',
            }}
          >
            <span style={{ fontSize: 18 }}>
              {banner.kind === 'ok' ? '✓' : banner.kind === 'err' ? '✗' : 'ℹ'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{banner.code}</div>
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.9,
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {banner.text}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanner */}
      <CameraScanner
        open={scanOpen}
        onClose={() => {
          setScanOpen(false)
          // User dismissed scanner manually — cancel any pending re-open.
          if (reopenTimerRef.current) window.clearTimeout(reopenTimerRef.current)
        }}
        onCode={async (code, raw) => {
          await handleScannedCode(code, raw)
          closeAndMaybeReopen()
        }}
      />
    </div>
  )
}

interface ItemCardProps {
  it: ItemRow
  disabled: boolean
  onConfirm: () => void
  onMismatch: () => void
}
function ItemCard({ it, disabled, onConfirm, onMismatch }: ItemCardProps) {
  const meta = CONFIRM_META[it.confirm_status]
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 12,
        boxShadow: '0 1px 4px rgba(31,35,41,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              color: '#86909C',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {it.asset_code}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: '#1F2329',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {it.brand_model ?? '(未填型号)'}
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#86909C',
              marginTop: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {it.owner_name ?? '未分配'}
            {it.location && ` · ${it.location}`}
          </div>
          {it.remark && (
            <div style={{ fontSize: 11, color: '#F53F3F', marginTop: 4 }}>
              备注:{it.remark}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 10,
            background: meta.bg,
            color: meta.color,
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {meta.label}
        </span>
      </div>

      {!disabled && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={onMismatch}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 18,
              background: '#fff',
              border: '1px solid #FFC9C0',
              color: '#F53F3F',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            标差异
          </button>
          <button
            onClick={onConfirm}
            disabled={it.confirm_status === 'ok'}
            style={{
              flex: 2,
              height: 36,
              borderRadius: 18,
              background: it.confirm_status === 'ok' ? '#F2F3F5' : '#3370FF',
              border: 'none',
              color: it.confirm_status === 'ok' ? '#86909C' : '#fff',
              fontSize: 12,
              fontWeight: 500,
              cursor: it.confirm_status === 'ok' ? 'default' : 'pointer',
            }}
          >
            {it.confirm_status === 'ok' ? '已确认' : '一键确认'}
          </button>
        </div>
      )}
    </div>
  )
}
