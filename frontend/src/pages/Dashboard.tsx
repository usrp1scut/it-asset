import { useEffect, useRef } from 'react'
import { Card, Col, Empty, List, Row, Statistic, Table, Tag } from 'antd'
import ReactECharts from 'echarts-for-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

// ECharts measures its container on mount; inside the antd flex/Card grid
// that width is briefly 0, collapsing the chart. A ResizeObserver re-sizes
// it the moment the real layout width is known (and on every later resize).
function Chart({ option, height }: { option: object; height: number }) {
  const ref = useRef<ReactECharts>(null)
  useEffect(() => {
    const inst = ref.current?.getEchartsInstance()
    const el = inst?.getDom()?.parentElement
    if (!el) return
    const ro = new ResizeObserver(() => inst?.resize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <ReactECharts ref={ref} option={option} notMerge style={{ height, width: '100%' }} />
  )
}

interface Overview {
  stats: {
    total_assets: number
    total_value: number
    pending_approvals: number
    low_stock_count: number
    in_use_count: number
    idle_count: number
    maintenance_count: number
    scrapped_count: number
    needs_review_count: number
  }
  status_distribution: { status: string; count: number }[]
  trends: { assignment: number[]; return: number[]; repair: number[] }
  dept_distribution: { department_id: number; name: string; count: number }[]
  low_stock_skus: { sku_code: string; name: string; available: number; safety: number }[]
  recent_assignments: {
    action: string
    to_status: string | null
    created_at: string
    asset_code: string
    brand_model: string | null
  }[]
}

const STATUS_LABEL: Record<string, string> = {
  in_use: '在用',
  idle: '闲置',
  maintenance: '维修中',
  scrapped: '已报废',
}
const STATUS_COLOR: Record<string, string> = {
  in_use: '#3370FF',
  idle: '#00B42A',
  maintenance: '#FF8800',
  scrapped: '#86909C',
}
const ACTION_LABEL: Record<string, string> = {
  create: '入库',
  assign: '分配',
  return: '归还',
  repair: '报修',
  scrap: '报废',
  bind_accessory: '配件绑定',
  update: '更新',
}

export default function Dashboard() {
  const { data } = useQuery<Overview>({
    queryKey: ['overview'],
    queryFn: async () => (await api.get('/dashboard/overview')).data,
  })

  if (!data) return null
  const s = data.stats

  const donut = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        data: data.status_distribution.map((d) => ({
          name: STATUS_LABEL[d.status] ?? d.status,
          value: d.count,
          itemStyle: { color: STATUS_COLOR[d.status] },
        })),
      },
    ],
  }

  const weeks = data.trends.assignment.map((_, i) => `W${i + 1}`)
  const line = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['领用', '归还', '维修'], bottom: 0 },
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: weeks },
    yAxis: { type: 'value' },
    series: [
      { name: '领用', type: 'line', smooth: true, data: data.trends.assignment },
      { name: '归还', type: 'line', smooth: true, data: data.trends.return },
      { name: '维修', type: 'line', smooth: true, data: data.trends.repair },
    ],
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>工作台</h2>
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="资产总数" value={s.total_assets} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="资产总值"
              value={s.total_value}
              precision={0}
              prefix="¥"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="待审批" value={s.pending_approvals} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="库存预警"
              value={s.low_stock_count}
              valueStyle={{ color: s.low_stock_count ? 'var(--danger)' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={8}>
          <Card title="资产状态分布" size="small">
            <Chart option={donut} height={260} />
          </Card>
        </Col>
        <Col span={16}>
          <Card title="近 12 周资产流转趋势" size="small">
            <Chart option={line} height={260} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={8}>
          <Card title="待我审批" size="small" style={{ height: 280 }}>
            <Empty description="审批模块待 Sprint 4 上线" />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="部门资产分布" size="small" style={{ height: 280, overflow: 'auto' }}>
            <List
              size="small"
              dataSource={data.dept_distribution}
              locale={{ emptyText: '暂无' }}
              renderItem={(d) => (
                <List.Item>
                  <span>{d.name}</span>
                  <Tag>{d.count}</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="库存预警" size="small" style={{ height: 280, overflow: 'auto' }}>
            <List
              size="small"
              dataSource={data.low_stock_skus}
              locale={{ emptyText: '无预警' }}
              renderItem={(k) => (
                <List.Item>
                  <span>{k.name}</span>
                  <Tag color="error">
                    {k.available}/{k.safety}
                  </Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title="最近资产流转" size="small" style={{ marginTop: 16 }}>
        <Table
          rowKey={(r) => r.asset_code + r.created_at}
          size="small"
          pagination={false}
          dataSource={data.recent_assignments}
          columns={[
            { title: '资产编号', dataIndex: 'asset_code' },
            { title: '名称', dataIndex: 'brand_model', render: (v) => v ?? '—' },
            {
              title: '动作',
              dataIndex: 'action',
              render: (a: string) => <Tag>{ACTION_LABEL[a] ?? a}</Tag>,
            },
            { title: '结果状态', dataIndex: 'to_status', render: (v) => v ?? '—' },
            {
              title: '时间',
              dataIndex: 'created_at',
              render: (v: string) => new Date(v).toLocaleString('zh-CN'),
            },
          ]}
        />
      </Card>
    </div>
  )
}
