import { useState } from 'react'
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'

type Status = 'pending' | 'approved' | 'rejected' | 'disposed'
type DispositionMethod = 'recycle' | 'resale' | 'writeoff' | 'exchange' | 'other'

interface ScrapRow {
  id: number
  asset_id: number
  asset_code: string
  brand_model: string | null
  proposer_id: number
  proposer_name: string | null
  reason: string
  status: Status
  approver_id: number | null
  approver_name: string | null
  approved_at: string | null
  approve_remark: string | null
  disposition_method: DispositionMethod | null
  residual_value: string | null
  disposed_at: string | null
  disposal_remark: string | null
  created_at: string
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  pending: { label: '待审批', color: 'gold' },
  approved: { label: '已批准·待处置', color: 'blue' },
  rejected: { label: '已拒绝', color: 'default' },
  disposed: { label: '已处置', color: 'green' },
}

const METHOD_LABEL: Record<DispositionMethod, string> = {
  recycle: '回收',
  resale: '转售',
  writeoff: '报销/核销',
  exchange: '换货抵扣',
  other: '其他',
}

export default function ScrapApprovals() {
  const qc = useQueryClient()
  const me = useAuth((s) => s.user)
  const [tab, setTab] = useState<Status>('pending')
  const [acting, setActing] = useState<{ kind: 'approve' | 'reject' | 'dispose'; row: ScrapRow } | null>(null)
  const [actForm] = Form.useForm()

  const { data, isLoading } = useQuery<ScrapRow[]>({
    queryKey: ['scrap-requests', tab],
    queryFn: async () =>
      (await api.get('/scrap-requests', { params: { status_: tab } })).data,
  })

  const mut = useMutation({
    mutationFn: async (v: { path: 'approve' | 'reject' | 'dispose'; id: number; body: object }) =>
      (await api.post(`/scrap-requests/${v.id}/${v.path}`, v.body)).data,
    onSuccess: () => {
      message.success('操作成功')
      qc.invalidateQueries({ queryKey: ['scrap-requests'] })
      setActing(null)
      actForm.resetFields()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '操作失败'),
  })

  const cols: ColumnsType<ScrapRow> = [
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
      title: '申请理由',
      dataIndex: 'reason',
      render: (v: string) => <span style={{ whiteSpace: 'pre-wrap' }}>{v}</span>,
    },
    { title: '申请人', dataIndex: 'proposer_name', render: (v) => v ?? '—' },
    {
      title: '审批人 / 审批备注',
      render: (_, r) =>
        r.approver_id == null ? '—' : (
          <div>
            <div>{r.approver_name ?? `#${r.approver_id}`}</div>
            {r.approve_remark && (
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.approve_remark}</div>
            )}
          </div>
        ),
    },
    {
      title: '处置',
      render: (_, r) =>
        r.disposition_method ? (
          <div>
            <Tag color="green">{METHOD_LABEL[r.disposition_method]}</Tag>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              残值 {r.residual_value ? `¥ ${Number(r.residual_value).toLocaleString()}` : '—'}
            </span>
            {r.disposal_remark && (
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.disposal_remark}</div>
            )}
          </div>
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
      render: (_, r) => {
        const isProposer = r.proposer_id === me?.id
        if (r.status === 'pending') {
          if (isProposer)
            return <span style={{ fontSize: 12, color: 'var(--text-3)' }}>需另一管理员审</span>
          return (
            <Space size={4}>
              <Button size="small" type="primary" onClick={() => setActing({ kind: 'approve', row: r })}>
                批准
              </Button>
              <Button size="small" danger onClick={() => setActing({ kind: 'reject', row: r })}>
                拒绝
              </Button>
            </Space>
          )
        }
        if (r.status === 'approved')
          return (
            <Button size="small" type="primary" onClick={() => setActing({ kind: 'dispose', row: r })}>
              录入处置
            </Button>
          )
        return '—'
      },
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>资产报废处置</h2>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
        申请由 IT/财务/采购任一人发起,审批必须由另一位管理员完成(不能自批);批准后录入处置方式与残值,资产才真正报废。
      </div>
      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as Status)}
        items={(Object.keys(STATUS_META) as Status[]).map((s) => ({
          key: s,
          label: STATUS_META[s].label,
        }))}
      />
      <Table<ScrapRow>
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
            ? `${acting.kind === 'approve' ? '批准' : acting.kind === 'reject' ? '拒绝' : '录入处置'} · ${acting.row.asset_code}`
            : ''
        }
        onCancel={() => setActing(null)}
        onOk={() => actForm.submit()}
        confirmLoading={mut.isPending}
        destroyOnClose
      >
        <Form
          form={actForm}
          layout="vertical"
          onFinish={(v: Record<string, unknown>) => {
            if (!acting) return
            mut.mutate({ path: acting.kind, id: acting.row.id, body: v })
          }}
        >
          {acting?.kind === 'reject' && (
            <Form.Item name="remark" label="拒绝原因" rules={[{ required: true }]}>
              <Input.TextArea rows={3} placeholder="必填" />
            </Form.Item>
          )}
          {acting?.kind === 'approve' && (
            <Form.Item name="remark" label="审批备注(可选)">
              <Input.TextArea rows={2} />
            </Form.Item>
          )}
          {acting?.kind === 'dispose' && (
            <>
              <Form.Item name="disposition_method" label="处置方式" rules={[{ required: true }]}>
                <Select
                  options={(Object.keys(METHOD_LABEL) as DispositionMethod[]).map((k) => ({
                    value: k,
                    label: METHOD_LABEL[k],
                  }))}
                />
              </Form.Item>
              <Form.Item name="residual_value" label="残值(¥,可空)">
                <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
              </Form.Item>
              <Form.Item name="remark" label="处置备注">
                <Input.TextArea rows={2} placeholder="如二手平台单号、回收方名称等" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}
