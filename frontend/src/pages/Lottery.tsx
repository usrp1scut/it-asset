import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

// ── 年会抽奖大屏 ──
// Three phases turn the plain form into a stage: idle (config) → rolling
// (slot-machine animation) → reveal (winner spotlight + confetti).
// The real winners come from the backend (system-RNG, audited); the rolling
// names are pure front-end theatre — see LOTTERY_DESIGN.md §3.2.

interface Winner {
  user_id: number
  name: string
}
interface Draw {
  id: number
  name: string
  tier: string | null
  winner_count: number
  prize_sku_id: number | null
  prize_name: string | null
  stock_out_at: string | null
  created_at: string
  winners: Winner[]
}
interface PrizeOpt {
  id: number
  name: string
  sku_code: string
  unit: string
  available: number
}

interface Tier {
  id: string
  label: string
  emoji: string
  color: string
  glow: string
}
const TIERS: Tier[] = [
  { id: 'special', label: '特等奖', emoji: '🏆', color: '#FFB31A', glow: 'rgba(255,179,26,0.5)' },
  { id: 'first', label: '一等奖', emoji: '🥇', color: '#FF8800', glow: 'rgba(255,136,0,0.45)' },
  { id: 'second', label: '二等奖', emoji: '🥈', color: '#5B92FF', glow: 'rgba(91,146,255,0.45)' },
  { id: 'third', label: '三等奖', emoji: '🥉', color: '#00B42A', glow: 'rgba(0,180,42,0.4)' },
]

const ROLL_MS = 3200 // minimum suspense before the reveal
const CONFETTI_COLORS = ['#FFB31A', '#FF8800', '#5B92FF', '#00B42A', '#F2729B', '#7E5EE5', '#fff']

function avatarOf(name: string): string {
  return (name || '?').trim().slice(0, 1) || '?'
}

function Confetti() {
  const pieces = Array.from({ length: 80 })
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 30 }}>
      {pieces.map((_, i) => {
        const left = Math.random() * 100
        const delay = Math.random() * 0.8
        const dur = 2.4 + Math.random() * 1.8
        const size = 6 + Math.random() * 8
        const c = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: 0,
              width: size,
              height: size * (Math.random() > 0.5 ? 1 : 0.5),
              background: c,
              borderRadius: Math.random() > 0.6 ? '50%' : 2,
              // Play ONCE (forwards), not infinitely — a perpetual animation
              // behind the glass cards melts down weak-GPU / webview compositors
              // and freezes the page until refresh. The host also unmounts this
              // component a few seconds after reveal so nothing keeps animating.
              animation: `confettiFall ${dur}s linear ${delay}s forwards`,
            }}
          />
        )
      })}
    </div>
  )
}

function IdleStage({ tier, count }: { tier: Tier; count: number }) {
  return (
    <div style={{ textAlign: 'center', animation: 'lotteryFloat 3s ease-in-out infinite' }}>
      <div style={{ fontSize: 88, marginBottom: 12, filter: `drop-shadow(0 8px 24px ${tier.glow})` }}>
        {tier.emoji}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 6 }}>
        准备抽取 {count} 位幸运儿
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
        点击下方按钮开始 · 系统级随机,公平公正
      </div>
    </div>
  )
}

function RollingStage({ names, tier }: { names: string[]; tier: Tier }) {
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {names.map((nm, i) => (
        <div
          key={i}
          style={{
            padding: '20px 28px',
            borderRadius: 16,
            minWidth: 140,
            textAlign: 'center',
            background: `linear-gradient(135deg, ${tier.color}33, ${tier.color}11)`,
            border: `1.5px solid ${tier.color}55`,
            animation: 'rollBlur 0.15s ease-in-out infinite alternate',
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>
            {nm || '—'}
          </div>
        </div>
      ))}
    </div>
  )
}

function RevealStage({
  winners,
  tier,
  prizeName,
}: {
  winners: Winner[]
  tier: Tier
  prizeName: string | null
}) {
  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: tier.color,
          marginBottom: 4,
          letterSpacing: '0.1em',
        }}
      >
        🎉 恭 喜 中 奖 🎉
      </div>
      {prizeName && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>
          奖品:{prizeName}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          justifyContent: 'center',
          marginTop: prizeName ? 0 : 16,
        }}
      >
        {winners.map((w, i) => (
          <div
            key={w.user_id}
            style={{
              padding: '22px 30px',
              borderRadius: 18,
              minWidth: 150,
              textAlign: 'center',
              position: 'relative',
              background: `linear-gradient(135deg, ${tier.color}, ${tier.color}cc)`,
              boxShadow: `0 12px 36px ${tier.glow}`,
              animation: `winnerPop 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.12}s both`,
            }}
          >
            <div style={{ position: 'absolute', top: -10, right: -8, fontSize: 24 }}>{tier.emoji}</div>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                margin: '0 auto 10px',
                background: 'rgba(255,255,255,0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 700,
                color: tier.color,
              }}
            >
              {avatarOf(w.name)}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>
              {w.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── styled helpers ──
const glassCard: React.CSSProperties = {
  // Solid-ish dark fill instead of a translucent layer + backdrop-filter:blur.
  // backdrop-filter forces the compositor to re-rasterize everything behind the
  // card every frame while the stage animates — on weak-GPU / Lark webviews
  // that pegs the GPU and freezes input until refresh.
  background: 'rgba(22, 30, 58, 0.78)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16,
  padding: 18,
}
const cardTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 14,
  color: 'rgba(255,255,255,0.9)',
}
const glassInput: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'var(--font-sans)',
}
const stepBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  background: 'rgba(255,255,255,0.1)',
  color: '#fff',
  fontSize: 18,
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
function bigBtn(color: string, disabled: boolean): React.CSSProperties {
  return {
    padding: '16px 56px',
    borderRadius: 100,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: '0.08em',
    background: disabled ? 'rgba(255,255,255,0.12)' : `linear-gradient(135deg, ${color}, ${color}cc)`,
    color: disabled ? 'rgba(255,255,255,0.4)' : '#fff',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : `0 8px 32px ${color}77`,
    transition: 'all 0.2s',
  }
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

export default function Lottery() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const rollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const [phase, setPhase] = useState<'idle' | 'rolling' | 'reveal'>('idle')
  const [name, setName] = useState('')
  const [tierId, setTierId] = useState('first')
  const [count, setCount] = useState(1)
  const [prize, setPrize] = useState<number | undefined>(undefined)
  const [rollNames, setRollNames] = useState<string[]>([])
  const [result, setResult] = useState<Draw | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: elig } = useQuery<{ count: number }>({
    queryKey: ['lottery-eligible'],
    queryFn: async () => (await api.get('/lottery/eligible-count')).data,
  })
  const { data: poolNames } = useQuery<{ names: string[] }>({
    queryKey: ['lottery-pool'],
    queryFn: async () => (await api.get('/lottery/pool')).data,
  })
  const { data: prizes } = useQuery<PrizeOpt[]>({
    queryKey: ['lottery-prizes'],
    queryFn: async () => (await api.get('/lottery/prizes')).data,
  })
  const { data: history } = useQuery<Draw[]>({
    queryKey: ['lottery-draws'],
    queryFn: async () => (await api.get('/lottery/draws')).data,
  })

  const pool = elig?.count ?? 0
  const tier = TIERS.find((t) => t.id === tierId) ?? TIERS[1]
  const prizeMeta = prizes?.find((s) => s.id === prize)
  const rollPool = poolNames?.names?.length ? poolNames.names : ['幸运儿', '小伙伴']

  useEffect(
    () => () => {
      if (rollTimer.current) clearInterval(rollTimer.current)
      if (confettiTimer.current) clearTimeout(confettiTimer.current)
    },
    [],
  )

  const canDraw = phase === 'idle' && !!name.trim() && pool > 0 && count >= 1

  const startDraw = async () => {
    if (!canDraw) return
    setPhase('rolling')
    setResult(null)
    // Slot-machine theatre: flash random candidate names while we wait.
    rollTimer.current = setInterval(() => {
      const picks: string[] = []
      for (let i = 0; i < count; i++) {
        picks.push(rollPool[Math.floor(Math.random() * rollPool.length)])
      }
      setRollNames(picks)
    }, 75)

    const started = Date.now()
    try {
      const draw = (
        await api.post('/lottery/draws', {
          name: name.trim(),
          tier: tierId,
          winner_count: count,
          prize_sku_id: prize ?? null,
        })
      ).data as Draw
      // Hold the suspense for at least ROLL_MS even if the API is instant.
      const wait = Math.max(0, ROLL_MS - (Date.now() - started))
      setTimeout(() => {
        if (rollTimer.current) clearInterval(rollTimer.current)
        setResult(draw)
        setPhase('reveal')
        // Confetti plays once, then we unmount it so the reveal becomes a
        // static (cheap) screen — no perpetual animation to choke the GPU.
        setShowConfetti(true)
        if (confettiTimer.current) clearTimeout(confettiTimer.current)
        confettiTimer.current = setTimeout(() => setShowConfetti(false), 5000)
        message.success(`🎉 抽出 ${draw.winners.length} 位中奖者`)
        qc.invalidateQueries({ queryKey: ['lottery-draws'] })
        qc.invalidateQueries({ queryKey: ['lottery-eligible'] })
      }, wait)
    } catch (e) {
      if (rollTimer.current) clearInterval(rollTimer.current)
      setPhase('idle')
      const detail = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
      message.error(detail ?? '抽奖失败')
    }
  }

  const reset = () => {
    setPhase('idle')
    setResult(null)
    setRollNames([])
    setShowConfetti(false)
    if (confettiTimer.current) clearTimeout(confettiTimer.current)
    // Keep the activity name so the year-end-party flow — one event, draw each
    // tier in turn — just needs a tier switch. Only the prize resets, since each
    // tier usually has a different prize.
    setPrize(undefined)
  }

  const refreshHistory = () => {
    qc.invalidateQueries({ queryKey: ['lottery-draws'] })
  }

  const confirmStockOut = async (id: number, prizeName: string, qty: number) => {
    if (!window.confirm(`确认出库奖品「${prizeName}」× ${qty}?确认后将从库存中扣减,不可撤销。`)) {
      return
    }
    try {
      await api.post(`/lottery/draws/${id}/confirm-stock-out`)
      message.success('已确认出库,库存已扣减')
      refreshHistory()
      qc.invalidateQueries({ queryKey: ['lottery-prizes'] })
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
      message.error(detail ?? '出库失败')
    }
  }

  const clearHistory = async () => {
    if (!window.confirm('确定清空全部抽奖记录?此操作不可撤销;清空后这些活动名称可再次抽奖(清空动作会记入审计)。')) {
      return
    }
    try {
      const { deleted } = (await api.delete('/lottery/draws')).data as { deleted: number }
      message.success(`已清空 ${deleted} 条记录`)
      refreshHistory()
    } catch {
      message.error('清空失败')
    }
  }

  const deleteOne = async (id: number, drawName: string) => {
    if (!window.confirm(`删除抽奖记录「${drawName}」?删除后该活动名称可再次抽奖。`)) return
    try {
      await api.delete(`/lottery/draws/${id}`)
      message.success('已删除')
      refreshHistory()
    } catch {
      message.error('删除失败')
    }
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      rootRef.current?.requestFullscreen?.()
    }
  }

  return (
    <div
      ref={rootRef}
      className="lottery-root"
      style={{
        minHeight: '100vh',
        width: '100%',
        background: 'radial-gradient(ellipse at 50% 0%, #1B2A52 0%, #0C1124 55%, #080B18 100%)',
        color: '#fff',
        fontFamily: 'var(--font-sans)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient glows — the top one tracks the current tier color. */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '20%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${tier.glow} 0%, transparent 70%)`,
          filter: 'blur(40px)',
          // Static (no infinite opacity pulse): animating opacity on a large
          // blurred layer re-rasterizes the blur every frame on weak GPUs.
          opacity: 0.8,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-20%',
          right: '10%',
          width: 460,
          height: 460,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(91,146,255,0.25) 0%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />

      {phase === 'reveal' && showConfetti && <Confetti />}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 32px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>🎲</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.02em' }}>抽奖</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              奖池来自在职 Lark 员工 · {pool} 人
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggleFullscreen} style={headerBtn}>
            ⛶ 投屏全屏
          </button>
          <button onClick={() => navigate('/')} style={headerBtn}>
            返回管理台
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 24,
          padding: '8px 32px 32px',
          position: 'relative',
          zIndex: 10,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        {/* Stage */}
        <div style={{ flex: '1 1 520px', minWidth: 0 }}>
          {/* Tier banner */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 24px',
                borderRadius: 100,
                background: `linear-gradient(135deg, ${tier.color}33, ${tier.color}11)`,
                border: `1.5px solid ${tier.color}66`,
              }}
            >
              <span style={{ fontSize: 24 }}>{tier.emoji}</span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: tier.color,
                  letterSpacing: '0.04em',
                }}
              >
                {name.trim() || tier.label}
              </span>
              {prizeMeta && (
                <span
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.7)',
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.1)',
                  }}
                >
                  奖品 · {prizeMeta.name}
                </span>
              )}
            </div>
          </div>

          {/* Stage box */}
          <div
            style={{
              minHeight: 420,
              borderRadius: 24,
              position: 'relative',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
              boxShadow: `inset 0 0 80px ${tier.glow}`,
            }}
          >
            {phase === 'idle' && <IdleStage tier={tier} count={count} />}
            {phase === 'rolling' && <RollingStage names={rollNames} tier={tier} />}
            {phase === 'reveal' && result && (
              <RevealStage winners={result.winners} tier={tier} prizeName={result.prize_name} />
            )}
          </div>

          {/* Big action button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            {phase === 'reveal' ? (
              <button onClick={reset} style={bigBtn('#3370FF', false)}>
                ✨ 再抽一轮
              </button>
            ) : (
              <button onClick={startDraw} disabled={!canDraw} style={bigBtn(tier.color, !canDraw)}>
                {phase === 'rolling' ? '🎲 正在抽取…' : '🎲 开 始 抽 奖'}
              </button>
            )}
          </div>
          {pool === 0 && phase === 'idle' && (
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#FF8F8F' }}>
              当前没有可抽的在职 Lark 员工(本地 / 密码账号不参与抽奖)。
            </div>
          )}
        </div>

        {/* Right rail: config + history */}
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Config card */}
          <div style={glassCard}>
            <div style={cardTitle}>抽奖配置</div>
            <Field label="活动名称">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={phase !== 'idle'}
                placeholder="如 2026 年会一等奖"
                style={glassInput}
              />
            </Field>
            <Field label="奖项等级">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {TIERS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => phase === 'idle' && setTierId(t.id)}
                    style={{
                      padding: '8px 6px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: phase === 'idle' ? 'pointer' : 'default',
                      border: `1.5px solid ${tierId === t.id ? t.color : 'rgba(255,255,255,0.12)'}`,
                      background: tierId === t.id ? `${t.color}22` : 'rgba(255,255,255,0.04)',
                      color: tierId === t.id ? t.color : 'rgba(255,255,255,0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                    }}
                  >
                    <span>{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`中奖人数(奖池 ${pool} 人)`}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  padding: 3,
                  width: 'fit-content',
                }}
              >
                <button
                  onClick={() => phase === 'idle' && setCount(Math.max(1, count - 1))}
                  style={stepBtn}
                >
                  −
                </button>
                <span style={{ minWidth: 48, textAlign: 'center', fontSize: 18, fontWeight: 700 }}>
                  {count}
                </span>
                <button
                  onClick={() => phase === 'idle' && setCount(Math.min(Math.max(1, pool), count + 1))}
                  style={stepBtn}
                >
                  +
                </button>
              </div>
            </Field>
            <Field label="关联奖品(仅「奖品」分类中有库存的物品,可选)">
              <select
                value={prize ?? ''}
                onChange={(e) => setPrize(e.target.value ? +e.target.value : undefined)}
                disabled={phase !== 'idle'}
                style={glassInput}
              >
                <option value="">无</option>
                {(prizes ?? []).map((s) => (
                  <option key={s.id} value={s.id} style={{ color: '#000' }}>
                    {s.name} · 库存 {s.available} {s.unit}
                  </option>
                ))}
              </select>
              {(prizes?.length ?? 0) === 0 && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
                  「奖品」分类下暂无有库存的物品 —— 先在「库存物品」里入库
                </div>
              )}
            </Field>
          </div>

          {/* History */}
          <div style={{ ...glassCard, display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                ...cardTitle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>抽奖记录</span>
              {(history?.length ?? 0) > 0 && (
                <button onClick={clearHistory} style={clearBtn}>
                  清空
                </button>
              )}
            </div>
            <div
              style={{
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                maxHeight: 280,
              }}
            >
              {(history?.length ?? 0) === 0 ? (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '8px 0' }}>
                  暂无抽奖记录
                </div>
              ) : (
                (history ?? []).map((h) => {
                  const hm = TIERS.find((t) => t.id === h.tier) ?? TIERS[3]
                  return (
                    <div
                      key={h.id}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 13 }}>{hm.emoji}</span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            flex: 1,
                            minWidth: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {h.name}
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                          {h.winner_count} 人
                        </span>
                        <button
                          onClick={() => deleteOne(h.id, h.name)}
                          style={rowDelBtn}
                          title="删除此记录"
                        >
                          ×
                        </button>
                      </div>
                      {h.prize_name && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ fontSize: 11, color: hm.color, flex: 1, minWidth: 0 }}>
                            奖品 · {h.prize_name}
                          </span>
                          {h.stock_out_at ? (
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                              ✓ 已出库
                            </span>
                          ) : (
                            <button
                              onClick={() => confirmStockOut(h.id, h.prize_name!, h.winner_count)}
                              style={stockOutBtn}
                            >
                              确认出库
                            </button>
                          )}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                        {h.winners.map((w) => w.name).join('、')}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.35)',
                          marginTop: 4,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {new Date(h.created_at).toLocaleString('zh-CN', { hour12: false })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const headerBtn: React.CSSProperties = {
  fontSize: 13,
  color: 'rgba(255,255,255,0.6)',
  padding: '6px 14px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.12)',
  cursor: 'pointer',
}
const clearBtn: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 400,
  color: 'rgba(255,255,255,0.55)',
  padding: '2px 10px',
  borderRadius: 6,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.12)',
  cursor: 'pointer',
}
const rowDelBtn: React.CSSProperties = {
  width: 18,
  height: 18,
  padding: 0,
  marginLeft: 2,
  lineHeight: '14px',
  textAlign: 'center',
  fontSize: 15,
  color: 'rgba(255,255,255,0.35)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  flexShrink: 0,
}
const stockOutBtn: React.CSSProperties = {
  flexShrink: 0,
  fontSize: 10,
  color: '#FFD08A',
  padding: '2px 8px',
  borderRadius: 5,
  background: 'rgba(255,136,0,0.14)',
  border: '1px solid rgba(255,136,0,0.4)',
  cursor: 'pointer',
}
