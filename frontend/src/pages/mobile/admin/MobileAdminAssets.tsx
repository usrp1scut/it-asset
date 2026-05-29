import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '../../../api/client'
import type { Asset, AssetListResponse, AssetStatus } from '../../../features/assets/types'
import Icon from '../../../components/Icon'
import AssetTypeIcon from '../../../components/AssetTypeIcon'

// Mobile-native asset ledger for the IT-admin console. Same /api/assets the
// desktop ledger uses — only the presentation changes (cards over a table).
// Tapping a card opens the existing mobile asset detail (/m/admin/asset/:code).

const wrap: React.CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  minHeight: '100dvh',
  background: '#F4F5F7',
  paddingBottom: 24,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
}

const STATUS_META: Record<AssetStatus, { label: string; color: string; bg: string }> = {
  in_use: { label: '在用', color: '#00B42A', bg: '#E8FFEA' },
  idle: { label: '闲置', color: '#86909C', bg: '#F2F3F5' },
  maintenance: { label: '维修中', color: '#FF8800', bg: '#FFF7E8' },
  scrapped: { label: '已报废', color: '#86909C', bg: '#F2F3F5' },
}

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: '全部' },
  { key: 'in_use', label: '在用' },
  { key: 'idle', label: '闲置' },
  { key: 'maintenance', label: '维修中' },
  { key: 'scrapped', label: '已报废' },
]

function StatusPill({ status }: { status: AssetStatus }) {
  const m = STATUS_META[status] ?? { label: status, color: '#86909C', bg: '#F2F3F5' }
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 10,
        background: m.bg,
        color: m.color,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {m.label}
    </span>
  )
}

export default function MobileAdminAssets() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')
  const [size, setSize] = useState(20)

  const { data, isLoading, isFetching } = useQuery<AssetListResponse>({
    queryKey: ['m-admin-assets', status, q, size],
    queryFn: async () =>
      (
        await api.get('/assets', {
          params: { status: status || undefined, q: q || undefined, page: 1, size },
        })
      ).data,
    placeholderData: keepPreviousData,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

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
          资产台账
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
              if (e.key === 'Enter') {
                setQ(qInput.trim())
                setSize(20)
              }
            }}
            placeholder="搜索编号 / 型号 / 序列号 / 责任人"
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
                setSize(20)
              }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              aria-label="清除"
            >
              <Icon name="close" size={15} color="rgba(255,255,255,0.6)" />
            </button>
          )}
        </div>
      </div>

      {/* Status filter chips */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 16px',
          overflowX: 'auto',
          background: '#1F2329',
        }}
      >
        {STATUS_TABS.map((t) => {
          const active = t.key === status
          return (
            <button
              key={t.key}
              onClick={() => {
                setStatus(t.key)
                setSize(20)
              }}
              style={{
                flexShrink: 0,
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

      {/* Count */}
      <div style={{ padding: '12px 16px 4px', fontSize: 12, color: '#86909C' }}>
        {isLoading ? '加载中…' : `共 ${total} 件`}
      </div>

      {/* Asset cards */}
      <div style={{ padding: '4px 12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((a: Asset) => (
          <button
            key={a.asset_code}
            onClick={() => navigate(`/m/admin/asset/${encodeURIComponent(a.asset_code)}`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 12,
              background: '#fff',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <AssetTypeIcon icon={a.asset_type_icon} color={a.asset_type_color} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: 'ui-monospace, monospace',
                    color: '#3370FF',
                    flexShrink: 0,
                  }}
                >
                  {a.asset_code}
                </span>
                <StatusPill status={a.status} />
                {a.needs_review && (
                  <span
                    style={{
                      fontSize: 10,
                      color: '#A66200',
                      background: '#FFF7E8',
                      padding: '1px 5px',
                      borderRadius: 3,
                      flexShrink: 0,
                    }}
                  >
                    待核
                  </span>
                )}
              </div>
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
                {a.brand_model || '(未填型号)'}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#86909C',
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {[
                  a.asset_type_name,
                  a.owner_name || (a.owner_user_id ? `#${a.owner_user_id}` : null),
                  a.location,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </div>
            </div>
            <Icon name="chevronRight" size={16} color="#C9CDD4" />
          </button>
        ))}

        {!isLoading && items.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: '#86909C', fontSize: 13 }}>
            <Icon name="box" size={36} color="#C9CDD4" />
            <div style={{ marginTop: 10 }}>没有匹配的资产</div>
          </div>
        )}
      </div>

      {/* Load more */}
      {items.length < total && (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <button
            onClick={() => setSize((s) => s + 20)}
            disabled={isFetching}
            style={{
              padding: '8px 24px',
              borderRadius: 18,
              border: '1px solid #E5E6EB',
              background: '#fff',
              color: '#4E5969',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {isFetching ? '加载中…' : `加载更多(还有 ${total - items.length} 件)`}
          </button>
        </div>
      )}
    </div>
  )
}
