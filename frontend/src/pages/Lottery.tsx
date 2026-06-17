import { useState } from 'react'
import { Button, Card, Empty, Input, InputNumber, Select, Tag, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

interface Winner {
  user_id: number
  name: string
}
interface Draw {
  id: number
  name: string
  winner_count: number
  prize_sku_id: number | null
  prize_name: string | null
  created_at: string
  winners: Winner[]
}
interface SkuOpt {
  id: number
  name: string
  sku_code: string
}

const CHIP_COLORS = ['#3370FF', '#00B42A', '#FF8800', '#7E5EE5', '#F53F3F', '#00B2C7', '#D4380D']

export default function Lottery() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [count, setCount] = useState(1)
  const [prize, setPrize] = useState<number | undefined>(undefined)
  const [result, setResult] = useState<Draw | null>(null)

  const { data: elig } = useQuery<{ count: number }>({
    queryKey: ['lottery-eligible'],
    queryFn: async () => (await api.get('/lottery/eligible-count')).data,
  })
  const { data: skus } = useQuery<{ items: SkuOpt[] }>({
    queryKey: ['skus-lottery'],
    queryFn: async () => (await api.get('/skus')).data,
  })
  const { data: history } = useQuery<Draw[]>({
    queryKey: ['lottery-draws'],
    queryFn: async () => (await api.get('/lottery/draws')).data,
  })

  const pool = elig?.count ?? 0

  const drawMut = useMutation({
    mutationFn: async () =>
      (
        await api.post('/lottery/draws', {
          name,
          winner_count: count,
          prize_sku_id: prize ?? null,
        })
      ).data as Draw,
    onSuccess: (d) => {
      setResult(d)
      message.success(`🎉 抽出 ${d.winners.length} 位中奖者`)
      qc.invalidateQueries({ queryKey: ['lottery-draws'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '抽奖失败'),
  })

  return (
    <div style={{ padding: 24, maxWidth: 920 }}>
      <h2 style={{ marginTop: 0 }}>抽奖</h2>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
              活动名称(同名只能抽一次,防重抽)
            </div>
            <Input
              placeholder="如 2026 年会一等奖"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
              中奖人数(可抽在职 Lark 员工 {pool} 人)
            </div>
            <InputNumber
              min={1}
              max={Math.max(1, pool)}
              value={count}
              onChange={(v) => setCount(v ?? 1)}
              style={{ width: 160 }}
            />
          </div>
          <div style={{ flex: '1 1 240px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
              关联奖品(库存物品，可选)
            </div>
            <Select
              allowClear
              showSearch
              placeholder="选择奖品 SKU"
              optionFilterProp="label"
              style={{ width: '100%' }}
              value={prize}
              onChange={(v) => setPrize(v)}
              options={(skus?.items ?? []).map((s) => ({
                value: s.id,
                label: `${s.name} · ${s.sku_code}`,
              }))}
            />
          </div>
          <Button
            type="primary"
            size="large"
            loading={drawMut.isPending}
            disabled={pool === 0 || !name.trim()}
            onClick={() => drawMut.mutate()}
          >
            🎲 开始抽奖
          </Button>
        </div>
        {pool === 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--lark-red, #F53F3F)' }}>
            当前没有可抽的在职 Lark 员工(本地 / 密码账号不参与抽奖)。
          </div>
        )}
      </Card>

      {result && (
        <Card
          style={{
            marginBottom: 24,
            background: 'linear-gradient(135deg, #FFF7E8 0%, #F5F9FF 100%)',
            border: '1px solid #FFE3A3',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            🎉 {result.name} · 中奖名单
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
            {result.prize_name ? `奖品:${result.prize_name} · ` : ''}
            共 {result.winners.length} 位
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {result.winners.map((w, i) => (
              <span
                key={w.user_id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 24,
                  background: '#fff',
                  border: `1.5px solid ${CHIP_COLORS[i % CHIP_COLORS.length]}`,
                  fontSize: 15,
                  fontWeight: 600,
                  color: CHIP_COLORS[i % CHIP_COLORS.length],
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                {w.name}
              </span>
            ))}
          </div>
        </Card>
      )}

      <h3 style={{ fontSize: 15 }}>历史记录</h3>
      <Card styles={{ body: { padding: 0 } }}>
        {(history?.length ?? 0) === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无抽奖记录" style={{ padding: 32 }} />
        ) : (
          (history ?? []).map((d, i) => (
            <div
              key={d.id}
              style={{
                padding: '12px 16px',
                borderTop: i > 0 ? '0.5px solid var(--divider, #f0f0f0)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{d.name}</span>
                <Tag>{d.winner_count} 人</Tag>
                {d.prize_name && <Tag color="gold">{d.prize_name}</Tag>}
                <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
                  {new Date(d.created_at).toLocaleString('zh-CN')}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                {d.winners.map((w) => w.name).join('、')}
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}
