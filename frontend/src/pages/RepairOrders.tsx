import { useState } from 'react'
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd'
import type { Dayjs } from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

type Status = 'open' | 'in_progress' | 'completed' | 'cancelled'
type RepairType = 'in_house' | 'external'

interface RepairOrder {
  id: number
  asset_id: number
  asset_code: string
  brand_model: string | null
  opened_by: number
  opened_by_name: string | null
  reason: string
  repair_type: RepairType
  vendor: string | null
  shipped_at: string | null
  expected_return_at: string | null
  status: Status
  cost: string | null
  warranty_covered: boolean
  warranty_until: string | null
  resolution: string | null
  notes: string | null
  closed_at: string | null
  created_at: string
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  open: { label: '已报修', color: 'gold' },
  in_progress: { label: '维修中', color: 'blue' },
  completed: { label: '已完结', color: 'green' },
  cancelled: { label: '已取消', color: 'default' },
}

const TYPE_LABEL: Record<RepairType, string> = {
  in_house: '内部修',
  external: '外送',
}

export default function RepairOrders() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Status>('open')
  const [acting, setActing] = useState<
    | null
    | { kind: 'update' | 'complete' | 'cancel'; row: RepairOrder }
  >(null)
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery<RepairOrder[]>({
    queryKey: ['repair-orders', tab],
    queryFn: async () =>
      (await api.get('/repair-orders', { params: { status_: tab } })).data,
  })

  const mut = useMutation({
    mutationFn: async (v: {
      path: 'update' | 'complete' | 'cancel'
      id: number
      body: Record<string, unknown>
    }) => (await api.post(`/repair-orders/${v.id}/${v.path}`, v.body)).data,
    onSuccess: () => {
      message.success('操作成功')
      qc.invalidateQueries({ queryKey: ['repair-orders'] })
      qc.invalidateQueries({ queryKey: ['assets'] })
      setActing(null)
      form.resetFields()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '操作失败'),
  })

  const cols: ColumnsType<RepairOrder> = [
    {
      title: '资产',
      render: (_, r) => (
        <div>
          <span className="text-mono">{r.asset_code}</span>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.brand_model ?? '—'}</div>
        </div>
      ),
    },
    {
      title: '原因 / 备注',
      render: (_, r) => (
        <div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{r.reason}</div>
          {r.notes && (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.notes}</div>
          )}
        </div>
      ),
    },
    {
      title: '维修方',
      render: (_, r) => (
        <div>
          <Tag>{TYPE_LABEL[r.repair_type]}</Tag>
          {r.repair_type === 'external' && (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.vendor ?? '—'}</div>
          )}
        </div>
      ),
    },
    {
      title: '送修 / 预计回',
      render: (_, r) =>
        r.shipped_at || r.expected_return_at ? (
          <div style={{ fontSize: 12 }}>
            <div>送修:{r.shipped_at ?? '—'}</div>
            <div>预计:{r.expected_return_at ?? '—'}</div>
          </div>
        ) : '—',
    },
    {
      title: '完结信息',
      render: (_, r) =>
        r.status === 'completed' ? (
          <div style={{ fontSize: 12 }}>
            <div>
              费用 {r.cost ? `¥ ${Number(r.cost).toLocaleString()}` : '—'}
              {r.warranty_covered && <Tag color="green" style={{ marginLeft: 6 }}>保修</Tag>}
            </div>
            {r.warranty_until && <div>保修至 {r.warranty_until}</div>}
            <div style={{ color: 'var(--text-3)' }}>{r.resolution ?? '—'}</div>
          </div>
        ) : r.status === 'cancelled' ? (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>取消:{r.resolution ?? '—'}</span>
        ) : '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s: Status) => {
        const m = STATUS_META[s]
        return <Tag color={m.color}>{m.label}</Tag>
      },
    },
    {
      title: '操作',
      render: (_, r) =>
        r.status === 'open' || r.status === 'in_progress' ? (
          <Space size={4}>
            <Button size="small" onClick={() => setActing({ kind: 'update', row: r })}>
              更新
            </Button>
            <Button size="small" type="primary" onClick={() => setActing({ kind: 'complete', row: r })}>
              完结
            </Button>
            <Button size="small" danger onClick={() => setActing({ kind: 'cancel', row: r })}>
              取消
            </Button>
          </Space>
        ) : '—',
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>维修中心</h2>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
        报修在资产抽屉里发起;开单后资产置「维修中」,完结/取消时回到「闲置」。
      </div>
      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as Status)}
        items={(Object.keys(STATUS_META) as Status[]).map((s) => ({
          key: s,
          label: STATUS_META[s].label,
        }))}
      />
      <Table<RepairOrder>
        rowKey="id"
        loading={isLoading}
        columns={cols}
        dataSource={data ?? []}
        size="small"
        pagination={{ pageSize: 20 }}
      />

      <Modal
        open={acting !== null}
        title={
          acting
            ? `${acting.kind === 'update' ? '更新' : acting.kind === 'complete' ? '完结' : '取消'} · ${acting.row.asset_code}`
            : ''
        }
        onCancel={() => setActing(null)}
        onOk={() => form.submit()}
        confirmLoading={mut.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v: Record<string, unknown>) => {
            if (!acting) return
            const body: Record<string, unknown> = { ...v }
            for (const k of ['shipped_at', 'expected_return_at', 'warranty_until']) {
              if (body[k]) body[k] = (body[k] as Dayjs).format('YYYY-MM-DD')
            }
            mut.mutate({ path: acting.kind, id: acting.row.id, body })
          }}
        >
          {acting?.kind === 'update' && (
            <>
              <Form.Item name="vendor" label="维修商(可改)">
                <Input />
              </Form.Item>
              <Form.Item name="shipped_at" label="送修日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="expected_return_at" label="预计回">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="note" label="备注">
                <Input.TextArea rows={2} />
              </Form.Item>
            </>
          )}
          {acting?.kind === 'complete' && (
            <>
              <Form.Item name="resolution" label="解决说明" rules={[{ required: true }]}>
                <Input.TextArea rows={2} placeholder="如:更换键盘模组,清灰" />
              </Form.Item>
              <Form.Item name="cost" label="费用(¥,可空)">
                <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
              </Form.Item>
              <Form.Item name="warranty_covered" label="保修内" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="warranty_until" label="新保修截止">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}
          {acting?.kind === 'cancel' && (
            <Form.Item name="reason" label="取消原因" rules={[{ required: true }]}>
              <Input.TextArea rows={3} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}

