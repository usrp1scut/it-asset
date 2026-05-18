import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Statistic,
  Tabs,
  Tag,
  message,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Location, Sku, SkuListResponse } from '../features/inventory/types'

const LEVEL: Record<string, { color: string; label: string }> = {
  normal: { color: 'var(--success)', label: '正常' },
  warn: { color: 'var(--warning)', label: '偏低' },
  low: { color: 'var(--danger)', label: '紧缺' },
}

const TABS = [
  { key: '', label: '全部 SKU' },
  { key: 'warn', label: '库存预警' },
  { key: 'inventory', label: '配件' },
  { key: 'consumable', label: '耗材' },
]

export default function Inventory() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState<null | 'sku' | 'loc' | { kind: 'in' | 'out'; sku: Sku }>(null)
  const [form] = Form.useForm()

  const warningOnly = tab === 'warn'
  const mode = tab === 'inventory' || tab === 'consumable' ? tab : undefined

  const { data, isLoading } = useQuery<SkuListResponse>({
    queryKey: ['skus', tab, q],
    queryFn: async () =>
      (
        await api.get('/skus', {
          params: { warning_only: warningOnly || undefined, mode, q: q || undefined },
        })
      ).data,
  })

  const { data: locations } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: async () => (await api.get('/inventory/locations')).data,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['skus'] })
    qc.invalidateQueries({ queryKey: ['locations'] })
  }

  const mut = useMutation({
    mutationFn: async ({ url, body }: { url: string; body: object }) =>
      (await api.post(url, body)).data,
    onSuccess: () => {
      message.success('操作成功')
      invalidate()
      setModal(null)
      form.resetFields()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '操作失败'),
  })

  const items = data?.items ?? []
  const warnCount = items.filter((s) => s.level !== 'normal').length

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>库存物品</h2>
        <Space>
          <Button onClick={() => setModal('loc')}>新建库位</Button>
          <Button type="primary" onClick={() => setModal('sku')}>
            新建 SKU
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="SKU 总数" value={data?.total ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="预警 SKU"
              value={warnCount}
              valueStyle={{ color: warnCount ? 'var(--danger)' : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="库位数" value={locations?.length ?? 0} />
          </Card>
        </Col>
      </Row>

      {warnCount > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`有 ${warnCount} 个 SKU 库存低于安全线,请及时补货`}
        />
      )}

      <Tabs activeKey={tab} onChange={setTab} items={TABS.map((t) => ({ key: t.key, label: t.label }))} />
      <Input.Search
        placeholder="搜索名称 / SKU 编码"
        allowClear
        style={{ maxWidth: 320, marginBottom: 16 }}
        onSearch={setQ}
      />

      <Row gutter={[16, 16]}>
        {items.map((s) => {
          const lv = LEVEL[s.level]
          const cap = s.max_stock ?? Math.max(s.safety_stock * 2, s.available, 1)
          const pct = Math.min(100, (s.available / cap) * 100)
          return (
            <Col key={s.id} xs={24} sm={12} lg={8}>
              <Card
                size="small"
                style={{
                  borderLeft: `3px solid ${lv.color}`,
                  boxShadow: s.level === 'low' ? '0 0 0 2px var(--danger-bg)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <span className="text-mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {s.sku_code}
                    </span>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {[s.brand, s.spec].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: lv.color }}>
                      {s.available}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.unit}</div>
                  </div>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: 'var(--divider)',
                    margin: '10px 0 6px',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      borderRadius: 3,
                      background: lv.color,
                    }}
                  />
                  {s.safety_stock > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${Math.min(100, (s.safety_stock / cap) * 100)}%`,
                        top: -2,
                        width: 2,
                        height: 10,
                        background: 'var(--text-2)',
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 12,
                    color: 'var(--text-3)',
                  }}
                >
                  <span>
                    安全 {s.safety_stock} · <Tag color={lv.color}>{lv.label}</Tag>
                  </span>
                  <Space size={4}>
                    <Button size="small" onClick={() => setModal({ kind: 'in', sku: s })}>
                      入库
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => setModal({ kind: 'out', sku: s })}
                    >
                      发放
                    </Button>
                  </Space>
                </div>
              </Card>
            </Col>
          )
        })}
        {!isLoading && items.length === 0 && (
          <Col span={24}>
            <Card style={{ textAlign: 'center', color: 'var(--text-3)' }}>暂无数据</Card>
          </Col>
        )}
      </Row>

      {/* New location */}
      <Modal
        open={modal === 'loc'}
        title="新建库位"
        onCancel={() => setModal(null)}
        onOk={() => form.submit()}
        confirmLoading={mut.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(v) => mut.mutate({ url: '/inventory/locations', body: v })}>
          <Form.Item name="name" label="库位名称" rules={[{ required: true }]}>
            <Input placeholder="如 IT 仓库·B 区" />
          </Form.Item>
        </Form>
      </Modal>

      {/* New SKU */}
      <Modal
        open={modal === 'sku'}
        title="新建 SKU"
        onCancel={() => setModal(null)}
        onOk={() => form.submit()}
        confirmLoading={mut.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(v) => mut.mutate({ url: '/skus', body: v })}>
          <Form.Item name="sku_code" label="SKU 编码" rules={[{ required: true }]}>
            <Input placeholder="SKU-MS-001" />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="罗技 M185 鼠标" />
          </Form.Item>
          <Space>
            <Form.Item name="unit" label="单位" initialValue="个">
              <Input style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="safety_stock" label="安全库存" initialValue={5}>
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="default_location_id" label="默认库位" rules={[{ required: true }]}>
              <select style={{ height: 32 }}>
                <option value="">选择库位</option>
                {locations?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* Receive / Issue */}
      <Modal
        open={typeof modal === 'object' && modal !== null}
        title={
          typeof modal === 'object' && modal
            ? `${modal.kind === 'in' ? '入库' : '发放'} · ${modal.sku.name}`
            : ''
        }
        onCancel={() => setModal(null)}
        onOk={() => form.submit()}
        confirmLoading={mut.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => {
            if (typeof modal !== 'object' || !modal) return
            if (modal.kind === 'in') {
              mut.mutate({ url: '/inventory/receive', body: { sku_id: modal.sku.id, ...v } })
            } else {
              mut.mutate({ url: '/inventory/issue', body: { sku_id: modal.sku.id, ...v } })
            }
          }}
        >
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          {typeof modal === 'object' && modal?.kind === 'out' && (
            <Form.Item name="user_id" label="领用人用户 ID" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
