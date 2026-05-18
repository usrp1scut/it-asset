import { useState } from 'react'
import { Input, Table, Tabs, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Asset, AssetListResponse, AssetStatus } from '../features/assets/types'
import StatusBadge from '../features/assets/StatusBadge'
import AssetDrawer from '../features/assets/AssetDrawer'

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: '全部' },
  { key: 'in_use', label: '在用' },
  { key: 'idle', label: '闲置' },
  { key: 'maintenance', label: '维修中' },
  { key: 'scrapped', label: '已报废' },
]

export default function Assets() {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [openCode, setOpenCode] = useState<string | null>(null)
  const size = 20

  const { data, isLoading } = useQuery<AssetListResponse>({
    queryKey: ['assets', status, q, page],
    queryFn: async () =>
      (
        await api.get('/assets', {
          params: { status: status || undefined, q: q || undefined, page, size },
        })
      ).data,
  })

  const columns: ColumnsType<Asset> = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      render: (v: string, r) => (
        <span>
          <a style={{ color: 'var(--lark-blue)' }} className="text-mono">
            {v}
          </a>
          {r.legacy_code && (
            <Tag style={{ marginLeft: 6 }} color="default">
              {r.legacy_code}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: '名称 / 配置',
      render: (_, r) => (
        <div>
          <div>{r.brand_model ?? '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.spec ?? ''}</div>
        </div>
      ),
    },
    { title: '状态', dataIndex: 'status', render: (s: AssetStatus) => <StatusBadge status={s} /> },
    {
      title: '责任人',
      render: (_, r) => r.owner_name ?? (r.owner_user_id ? `#${r.owner_user_id}` : '—'),
    },
    { title: '地点', dataIndex: 'location', render: (v) => v ?? '—' },
    {
      title: '采购价',
      dataIndex: 'purchase_price',
      render: (v: string | null) => (v ? `¥ ${Number(v).toLocaleString()}` : '—'),
    },
    { title: '保修至', dataIndex: 'warranty_expire_date', render: (v) => v ?? '—' },
    {
      title: '标记',
      render: (_, r) => (
        <>
          {r.scrap_candidate && <Tag color="error">报废候选</Tag>}
          {r.needs_review && <Tag color="warning">待核</Tag>}
        </>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>资产台账</h2>
      <Tabs
        activeKey={status}
        onChange={(k) => {
          setStatus(k)
          setPage(1)
        }}
        items={STATUS_TABS.map((t) => ({ key: t.key, label: t.label }))}
      />
      <Input.Search
        placeholder="搜索编号 / 型号 / 序列号 / 责任人"
        allowClear
        style={{ maxWidth: 360, marginBottom: 16 }}
        onSearch={(v) => {
          setQ(v)
          setPage(1)
        }}
      />
      <Table<Asset>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={data?.items ?? []}
        onRow={(r) => ({ onClick: () => setOpenCode(r.asset_code), style: { cursor: 'pointer' } })}
        pagination={{
          current: page,
          pageSize: size,
          total: data?.total ?? 0,
          onChange: setPage,
          showTotal: (t) => `共 ${t} 条`,
        }}
      />
      <AssetDrawer code={openCode} onClose={() => setOpenCode(null)} />
    </div>
  )
}
