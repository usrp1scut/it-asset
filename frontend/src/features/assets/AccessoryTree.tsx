import type { Accessory, Asset } from './types'

// Signature moment — accessory binding tree (design_handoff README §4.3).
export default function AccessoryTree({
  main,
  accessories,
}: {
  main: Asset
  accessories: Accessory[]
}) {
  return (
    <div>
      <div
        style={{
          padding: '12px 14px',
          background: '#F5F9FF',
          borderRadius: 8,
          border: '1px solid var(--lark-blue-bg-strong)',
          marginBottom: 20,
          fontSize: 12,
          color: 'var(--text-2)',
        }}
      >
        <b style={{ color: 'var(--text-1)' }}>配件绑定</b> · 主资产领用/归还时,绑定的配件一起流转。
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          borderRadius: 8,
          background: 'var(--lark-blue-bg)',
          border: '1.5px solid var(--lark-blue)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div className="text-mono" style={{ fontSize: 11, color: 'var(--lark-blue)', fontWeight: 600 }}>
            {main.asset_code}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{main.brand_model ?? '主资产'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>主资产 · {main.spec ?? '—'}</div>
        </div>
      </div>

      {accessories.length === 0 ? (
        <div
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            color: 'var(--text-3)',
            fontSize: 12,
            border: '1px dashed var(--border)',
            borderRadius: 8,
            marginTop: 16,
          }}
        >
          暂无绑定配件
        </div>
      ) : (
        <div style={{ position: 'relative', marginLeft: 24, marginTop: 8 }}>
          {accessories.map((acc, i) => {
            const last = i === accessories.length - 1
            return (
              <div key={i} style={{ position: 'relative', paddingTop: 12 }}>
                <svg
                  style={{ position: 'absolute', left: -16, top: 0, width: 32, height: '100%', overflow: 'visible' }}
                >
                  <line x1="8" y1="0" x2="8" y2={last ? 38 : '100%'} stroke="#E5E6EB" strokeWidth="1.5" />
                  <line x1="8" y1="38" x2="24" y2="38" stroke="#E5E6EB" strokeWidth="1.5" />
                  <circle cx="8" cy="38" r="3" fill="#fff" stroke="#3370FF" strokeWidth="1.5" />
                </svg>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: '#fff',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      配件 #{acc.asset_accessory_id ?? acc.sku_id ?? '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      数量 {acc.quantity} ·{' '}
                      {acc.binding_type === 'follow' ? '跟随主资产' : '独立'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
