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
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  message,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { ItemCategory, Location, Sku, SkuListResponse } from '../features/inventory/types'

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

const UNCATEGORIZED = -1

export default function Inventory() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState<null | 'sku' | 'loc' | { kind: 'in' | 'out'; sku: Sku }>(null)
  const [catModal, setCatModal] = useState<null | 'new' | ItemCategory>(null)
  const [form] = Form.useForm()
  const [catForm] = Form.useForm()

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

  const { data: categories } = useQuery<ItemCategory[]>({
    queryKey: ['item-categories'],
    queryFn: async () => (await api.get('/item-categories')).data,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['skus'] })
    qc.invalidateQueries({ queryKey: ['locations'] })
    qc.invalidateQueries({ queryKey: ['item-categories'] })
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

  const catMut = useMutation({
    mutationFn: async (v: { name: string; code: string }) => {
      if (catModal === 'new') return (await api.post('/item-categories', v)).data
      return (await api.put(`/item-categories/${(catModal as ItemCategory).id}`, v)).data
    },
    onSuccess: () => {
      message.success(catModal === 'new' ? '分类已创建' : '分类已更新')
      invalidate()
      setCatModal(null)
      catForm.resetFields()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '操作失败'),
  })

  const catDelMut = useMutation({
    mutationFn: async (id: number) => api.delete(`/item-categories/${id}`),
    onSuccess: () => {
      message.success('分类已删除')
      invalidate()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '删除失败'),
  })

  const skuDelMut = useMutation({
    mutationFn: async (code: string) => api.delete(`/skus/${code}`),
    onSuccess: () => {
      message.success('物品已删除')
      invalidate()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '删除失败'),
  })

  const items = data?.items ?? []
  const warnCount = items.filter((s) => s.level !== 'normal').length

  // group SKUs under their category (uncategorized → bucket)
  const cats = categories ?? []
  // When filtering, only show categories with matches; on the default
  // unfiltered view show every category (incl. empty) so they stay
  // manageable (edit/delete) even with no items.
  const filtering = !!q || !!mode || warningOnly
  const groups: { cat: ItemCategory | null; skus: Sku[] }[] = []
  for (const c of cats) {
    const gs = items.filter((s) => s.category_id === c.id)
    if (gs.length || !filtering) groups.push({ cat: c, skus: gs })
  }
  const orphan = items.filter((s) => s.category_id == null)
  if (orphan.length) groups.push({ cat: null, skus: orphan })

  const renderSku = (s: Sku) => {
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
              <div style={{ fontSize: 24, fontWeight: 700, color: lv.color }}>{s.available}</div>
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
              style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: lv.color }}
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
              <Button size="small" type="primary" onClick={() => setModal({ kind: 'out', sku: s })}>
                发放
              </Button>
              <Popconfirm
                title={`删除物品「${s.name}」?`}
                description="仅在无库存、无出入库记录时可删除"
                onConfirm={() => skuDelMut.mutate(s.sku_code)}
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" type="text" danger>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          </div>
        </Card>
      </Col>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>库存物品</h2>
        <Space>
          <Button onClick={() => setCatModal('new')}>新建分类</Button>
          <Button onClick={() => setModal('loc')}>新建库位</Button>
          <Button
            type="primary"
            onClick={() => {
              if (!cats.length) {
                message.warning('请先新建分类,物品需归属分类')
                return
              }
              setModal('sku')
            }}
          >
            新建物品
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
            <Statistic title="分类数" value={cats.length} />
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

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
      />
      <Input.Search
        placeholder="搜索名称 / SKU 编码"
        allowClear
        style={{ maxWidth: 320, marginBottom: 16 }}
        onSearch={setQ}
      />

      {groups.map(({ cat, skus }) => (
        <div key={cat?.id ?? UNCATEGORIZED} style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: '4px 0 12px',
              borderLeft: '3px solid var(--lark-blue)',
              paddingLeft: 10,
            }}
          >
            {cat ? (
              <>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{cat.name}</span>
                <Tag className="text-mono" color="blue">
                  {cat.code}
                </Tag>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{skus.length} 项</span>
                <Button
                  size="small"
                  type="link"
                  onClick={() => {
                    setCatModal(cat)
                    catForm.setFieldsValue({ name: cat.name, code: cat.code })
                  }}
                >
                  编辑
                </Button>
                {cat.sku_count === 0 ? (
                  <Popconfirm
                    title={`删除分类「${cat.name}」?`}
                    onConfirm={() => catDelMut.mutate(cat.id)}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button size="small" type="link" danger>
                      删除
                    </Button>
                  </Popconfirm>
                ) : (
                  <Button
                    size="small"
                    type="link"
                    danger
                    onClick={() =>
                      message.warning(
                        `该分类下还有 ${cat.sku_count} 个物品,请先转走再删除`,
                      )
                    }
                  >
                    删除
                  </Button>
                )}
              </>
            ) : (
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-3)' }}>
                未分类 · {skus.length} 项
              </span>
            )}
          </div>
          <Row gutter={[16, 16]}>{skus.map(renderSku)}</Row>
        </div>
      ))}
      {!isLoading && groups.length === 0 && (
        <Card style={{ textAlign: 'center', color: 'var(--text-3)' }}>暂无数据</Card>
      )}

      {/* New / edit category */}
      <Modal
        open={catModal !== null}
        title={catModal === 'new' ? '新建分类' : '编辑分类'}
        onCancel={() => {
          setCatModal(null)
          catForm.resetFields()
        }}
        onOk={() => catForm.submit()}
        confirmLoading={catMut.isPending}
        destroyOnClose
      >
        <Form
          form={catForm}
          layout="vertical"
          onFinish={(v: { name: string; code: string }) => catMut.mutate(v)}
        >
          <Form.Item name="name" label="分类名称" rules={[{ required: true }]}>
            <Input placeholder="如 鼠标" />
          </Form.Item>
          <Form.Item
            name="code"
            label="分类简码(物品编码前缀,如 MS → MS-001)"
            rules={[
              { required: true },
              { pattern: /^[A-Za-z0-9]{1,16}$/, message: '1-16 位字母或数字' },
            ]}
          >
            <Input placeholder="MS" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* New location */}
      <Modal
        open={modal === 'loc'}
        title="新建库位"
        onCancel={() => setModal(null)}
        onOk={() => form.submit()}
        confirmLoading={mut.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => mut.mutate({ url: '/inventory/locations', body: v })}
        >
          <Form.Item name="name" label="库位名称" rules={[{ required: true }]}>
            <Input placeholder="如 IT 仓库·B 区" />
          </Form.Item>
        </Form>
      </Modal>

      {/* New SKU */}
      <Modal
        open={modal === 'sku'}
        title="新建物品"
        onCancel={() => setModal(null)}
        onOk={() => form.submit()}
        confirmLoading={mut.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => mut.mutate({ url: '/skus', body: v })}>
          <Form.Item name="category_id" label="所属分类" rules={[{ required: true }]}>
            <Select
              placeholder="选择分类(物品编码按分类简码自动生成)"
              options={cats.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
            />
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
              <Select
                style={{ width: 160 }}
                placeholder="选择库位"
                options={locations?.map((l) => ({ value: l.id, label: l.name })) ?? []}
              />
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
        onCancel={() => {
          setModal(null)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        confirmLoading={mut.isPending}
        destroyOnClose
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
