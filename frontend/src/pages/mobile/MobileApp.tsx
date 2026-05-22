import { useState } from 'react'
import { Button, Input, Steps, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'

interface Me {
  user: { id: number; name: string; role: string }
  assets: { asset_code: string; brand_model: string | null; status: string }[]
  issues: { sku_id: number; quantity: number; status: string; created_at: string }[]
  pending_todos: number
}
interface SkuOpt {
  sku_id: number
  sku_code: string
  name: string
  spec: string | null
  available: number
}

const STATUS_CN: Record<string, string> = {
  in_use: '在用',
  idle: '闲置',
  maintenance: '维修中',
  scrapped: '已报废',
}

const wrap: React.CSSProperties = {
  maxWidth: 420,
  margin: '0 auto',
  minHeight: '100vh',
  background: '#F4F5F7',
}

export default function MobileApp() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [view, setView] = useState<'home' | 'request' | 'done'>('home')
  const [step, setStep] = useState(0)
  const [items, setItems] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')

  const { data: me } = useQuery<Me>({
    queryKey: ['m-me'],
    queryFn: async () => (await api.get('/m/me')).data,
  })
  const { data: skus } = useQuery<SkuOpt[]>({
    queryKey: ['m-skus'],
    queryFn: async () => (await api.get('/m/skus')).data,
    enabled: view === 'request',
  })

  const submit = useMutation({
    mutationFn: async () =>
      (
        await api.post('/m/requests', {
          request_type: 'consumable',
          items: Object.entries(items).map(([sku_id, qty]) => ({
            sku_id: Number(sku_id),
            qty,
          })),
          reason,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['m-me'] })
      setView('done')
    },
    onError: () => message.error('提交失败'),
  })

  const chosen = Object.entries(items).filter(([, q]) => q > 0)

  if (!me) return null

  if (view === 'done') {
    return (
      <div style={{ ...wrap, padding: 24, textAlign: 'center' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: '#E8FFEA',
            margin: '60px auto 16px',
            display: 'grid',
            placeItems: 'center',
            fontSize: 32,
            color: 'var(--success)',
          }}
        >
          ✓
        </div>
        <h3>提交成功</h3>
        <p style={{ color: 'var(--text-3)' }}>已通知审批人,等待部门主管审批</p>
        <Button
          type="primary"
          onClick={() => {
            setItems({})
            setReason('')
            setStep(0)
            setView('home')
          }}
        >
          返回首页
        </Button>
      </div>
    )
  }

  if (view === 'request') {
    return (
      <div style={wrap}>
        <div style={{ background: 'var(--lark-blue)', color: '#fff', padding: '16px 16px 14px' }}>
          <span onClick={() => setView('home')} style={{ cursor: 'pointer' }}>
            ‹ 返回
          </span>
          <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>申请领用</div>
        </div>
        <div style={{ padding: 16 }}>
          <Steps
            size="small"
            current={step}
            items={[{ title: '选物品' }, { title: '填信息' }, { title: '确认' }]}
            style={{ marginBottom: 20 }}
          />

          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(skus ?? []).map((s) => (
                <div
                  key={s.sku_id}
                  style={{
                    background: '#fff',
                    borderRadius: 10,
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {s.spec ?? ''} · 库存 {s.available}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Button
                      size="small"
                      onClick={() =>
                        setItems((p) => ({
                          ...p,
                          [s.sku_id]: Math.max(0, (p[s.sku_id] ?? 0) - 1),
                        }))
                      }
                    >
                      −
                    </Button>
                    <span style={{ minWidth: 18, textAlign: 'center' }}>
                      {items[s.sku_id] ?? 0}
                    </span>
                    <Button
                      size="small"
                      type="primary"
                      onClick={() =>
                        setItems((p) => ({
                          ...p,
                          [s.sku_id]: Math.min(s.available, (p[s.sku_id] ?? 0) + 1),
                        }))
                      }
                    >
                      +
                    </Button>
                  </div>
                </div>
              ))}
              {skus?.length === 0 && (
                <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>
                  暂无可申请物品
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>申请事由(至少 5 字)</div>
              <Input.TextArea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请简要说明用途"
              />
            </div>
          )}

          {step === 2 && (
            <div style={{ background: '#fff', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>申请物品</div>
              {chosen.map(([id, q]) => {
                const s = skus?.find((x) => x.sku_id === Number(id))
                return (
                  <div
                    key={id}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}
                  >
                    <span>{s?.name ?? id}</span>
                    <span style={{ color: 'var(--text-3)' }}>× {q}</span>
                  </div>
                )
              })}
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 10 }}>事由</div>
              <div>{reason}</div>
              <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-3)' }}>审批流</div>
              <div style={{ fontSize: 13 }}>提交人 → 部门主管 → IT 发放</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {step > 0 && <Button onClick={() => setStep(step - 1)}>上一步</Button>}
            {step < 2 ? (
              <Button
                type="primary"
                block
                disabled={
                  (step === 0 && chosen.length === 0) ||
                  (step === 1 && reason.trim().length < 5)
                }
                onClick={() => setStep(step + 1)}
              >
                下一步
              </Button>
            ) : (
              <Button
                type="primary"
                block
                loading={submit.isPending}
                onClick={() => submit.mutate()}
              >
                提交申请
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      {me.user.role !== 'employee' && (
        <div
          onClick={() => navigate('/')}
          style={{
            background: '#fff',
            padding: '8px 16px',
            fontSize: 12,
            color: 'var(--lark-blue)',
            cursor: 'pointer',
            borderBottom: '1px solid var(--border)',
          }}
        >
          ← 返回管理端
        </div>
      )}
      <div
        style={{
          background: 'linear-gradient(180deg, #3370FF 0%, #5B92FF 100%)',
          color: '#fff',
          padding: '24px 16px 28px',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600 }}>{me.user.name}</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>IT 服务 · 自助申请</div>
        <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{me.assets.length}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>名下资产</div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{me.pending_todos}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>待办</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <Button type="primary" block size="large" onClick={() => setView('request')}>
          申请领用耗材 / 配件
        </Button>

        <div style={{ fontSize: 15, fontWeight: 600, margin: '20px 0 10px' }}>我的资产</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {me.assets.map((a) => (
            <div key={a.asset_code} style={{ background: '#fff', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{a.brand_model ?? a.asset_code}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {a.asset_code} · {STATUS_CN[a.status] ?? a.status}
              </div>
            </div>
          ))}
          {me.assets.length === 0 && (
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>暂无名下资产</div>
          )}
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, margin: '20px 0 10px' }}>耗材领用记录</div>
        <div style={{ background: '#fff', borderRadius: 10, padding: 12 }}>
          {me.issues.length === 0 && (
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>暂无记录</div>
          )}
          {me.issues.map((i, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                fontSize: 13,
              }}
            >
              <span>SKU #{i.sku_id}</span>
              <span style={{ color: 'var(--text-3)' }}>
                × {i.quantity} · {new Date(i.created_at).toLocaleDateString('zh-CN')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
