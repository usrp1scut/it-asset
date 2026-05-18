import type { AssetStatus } from './types'

// PRD v0.2 §5.1 / design_handoff README §5.6 — 4 states only.
const MAP: Record<AssetStatus, { label: string; bg: string; fg: string; dot: string }> = {
  in_use: { label: '在用', bg: '#E8F1FF', fg: '#1A5BD0', dot: '#3370FF' },
  idle: { label: '闲置', bg: '#E8FFEA', fg: '#00863C', dot: '#00B42A' },
  maintenance: { label: '维修中', bg: '#FFF7E8', fg: '#A66200', dot: '#FF8800' },
  scrapped: { label: '已报废', bg: '#E5E6EB', fg: '#4E5969', dot: '#4E5969' },
}

export default function StatusBadge({ status }: { status: AssetStatus }) {
  const s = MAP[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 4,
        background: s.bg,
        color: s.fg,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }}
      />
      {s.label}
    </span>
  )
}
