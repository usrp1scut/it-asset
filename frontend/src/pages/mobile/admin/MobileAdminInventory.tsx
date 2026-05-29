import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '../../../api/client'
import type { Sku, SkuListResponse, StockLevel } from '../../../features/inventory/types'
import Icon from '../../../components/Icon'

// Mobile-native inventory (SKU) view for the IT-admin console. Same /api/skus
// the desktop page uses; presented as cards with a stock-level bar so an admin
// can answer "什么时候有货" on the spot.

const wrap: React.CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  minHeight: '100dvh',
  background: '#F4F5F7',
  paddingBottom: 24,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
}

const LEVEL: Record<StockLevel, { color: string; bg: string; label: string }> = {
  normal: { color: '#00B42A', bg: '#E8FFEA', label: '正常' },
  warn: { color: '#FF8800', bg: '#FFF7E8', label: '偏低' },
  low: { color: '#F53F3F', bg: '#FFECE8', label: '紧缺' },
}

const TABS = [
  { key: '', label: '全部' },
  { key: 'warn', label: '库存预警' },
]

function SkuCard({ s }: { s: Sku }) {
  const lv = LEVEL[s.level] ?? LEVEL.normal
  // Bar capacity mirrors the desktop heuristic so the safety-line lands sanely
  // even when max_stock isn't set.
  const cap = s.max_stock ?? Math.max(s.safety_stock * 2, s.available, 1)
  const fillPct = Math.min(100, (s.available / cap) * 100)
  const safetyPct = s.safety_stock > 0 ? Math.min(100, (s.safety_stock / cap) * 100) : null

  return (
    <div style={{ padding: 14, borderRadius: 12, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: '#1F2329',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {s.name}
          </div>
          <div style={{ fontSize: 12, color: '#86909C', marginTop: 2 }}>
            {[s.brand, s.spec, s.sku_code].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: lv.color, letterSpacing: '-0.02em' }}>
              {s.available}
            </span>
            <span style={{ fontSize: 11, color: '#86909C' }}>{s.unit}</span>
          </div>
          <span
            style={{
              fontSize: 10,
              padding: '1px 7px',
              borderRadius: 8,
              background: lv.bg,
              color: lv.color,
              fontWeight: 500,
            }}
          >
            {lv.label}
          </span>
        </div>
      </div>

      {/* Stock bar with safety-line marker */}
      <div style={{ marginTop: 12, position: 'relative', height: 6, borderRadius: 3, background: '#F2F3F5' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${fillPct}%`,
            borderRadius: 3,
            background: lv.color,
          }}
        />
        {safetyPct != null && (
          <div
            style={{
              position: 'absolute',
              top: -2,
              bottom: -2,
              left: `${safetyPct}%`,
              width: 2,
              background: '#4E5969',
              borderRadius: 1,
            }}
          />
        )}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: '#86909C' }}>
        安全库存 {s.safety_stock}
        {s.max_stock != null ? ` · 上限 ${s.max_stock}` : ''}
        {s.monthly_use != null ? ` · 月均用量 ${s.monthly_use}` : ''}
      </div>
    </div>
  )
}

export default function MobileAdminInventory() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('')
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')

  const warningOnly = tab === 'warn'
  const { data, isLoading } = useQuery<SkuListResponse>({
    queryKey: ['m-admin-skus', warningOnly, q],
    queryFn: async () =>
      (
        await api.get('/skus', {
          params: { warning_only: warningOnly || undefined, q: q || undefined },
        })
      ).data,
    placeholderData: keepPreviousData,
  })

  const items = data?.items ?? []

  return (
    <div style={wrap}>
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
          库存物品
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* Search */}
      <div style={{ padding: '12px 16px 8px', background: '#1F2329' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: '8px 12px',
          }}
        >
          <Icon name="search" size={16} color="rgba(255,255,255,0.6)" />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQ(qInput.trim())
            }}
            placeholder="搜索物品名 / 编码 / 品牌"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: '#fff',
              fontSize: 14,
            }}
          />
          {qInput && (
            <button
              onClick={() => {
                setQInput('')
                setQ('')
              }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              aria-label="清除"
            >
              <Icon name="close" size={15} color="rgba(255,255,255,0.6)" />
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', background: '#1F2329' }}>
        {TABS.map((t) => {
          const active = t.key === tab
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
            </button>
          )
        })}
      </div>

      <div style={{ padding: '12px 16px 4px', fontSize: 12, color: '#86909C' }}>
        {isLoading ? '加载中…' : `共 ${data?.total ?? 0} 项`}
      </div>

      <div style={{ padding: '4px 12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((s) => (
          <SkuCard key={s.sku_code} s={s} />
        ))}
        {!isLoading && items.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: '#86909C', fontSize: 13 }}>
            <Icon name="box" size={36} color="#C9CDD4" />
            <div style={{ marginTop: 10 }}>
              {warningOnly ? '当前没有库存预警' : '没有匹配的物品'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
