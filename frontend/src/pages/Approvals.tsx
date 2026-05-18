import { Button, Space, Table, Tag, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

interface Approval {
  id: number
  request_no: string
  request_type: string
  requester_id: number
  status: string
  payload_json: { items?: { sku_id: number; qty: number }[]; reason?: string }
  created_at: string
}

const STATUS: Record<string, { color: string; label: string }> = {
  pending: { color: 'processing', label: '待审批' },
  approved: { color: 'warning', label: '待发放' },
  rejected: { color: 'error', label: '已拒绝' },
  fulfilled: { color: 'success', label: '已完成' },
}

export default function Approvals() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Approval[]>({
    queryKey: ['approvals'],
    queryFn: async () => (await api.get('/approvals', { params: { scope: 'for_me' } })).data,
  })

  const act = useMutation({
    mutationFn: async ({ id, op }: { id: number; op: string }) =>
      (await api.post(`/approvals/${id}/${op}`)).data,
    onSuccess: () => {
      message.success('操作成功')
      qc.invalidateQueries({ queryKey: ['approvals'] })
      qc.invalidateQueries({ queryKey: ['overview'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '操作失败'),
  })

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>审批中心</h2>
      <Table<Approval>
        rowKey="id"
        loading={isLoading}
        dataSource={data ?? []}
        pagination={false}
        columns={[
          { title: '单号', dataIndex: 'request_no' },
          {
            title: '类型',
            dataIndex: 'request_type',
            render: (t: string) => (t === 'consumable' ? '耗材/配件' : '固定资产'),
          },
          { title: '申请人', dataIndex: 'requester_id', render: (v) => `#${v}` },
          {
            title: '事由',
            render: (_, r) => r.payload_json?.reason ?? '—',
          },
          {
            title: '物品',
            render: (_, r) =>
              (r.payload_json?.items ?? [])
                .map((i) => `#${i.sku_id}×${i.qty}`)
                .join(', ') || '—',
          },
          {
            title: '状态',
            dataIndex: 'status',
            render: (s: string) => (
              <Tag color={STATUS[s]?.color}>{STATUS[s]?.label ?? s}</Tag>
            ),
          },
          {
            title: '操作',
            render: (_, r) => (
              <Space>
                {r.status === 'pending' && (
                  <>
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => act.mutate({ id: r.id, op: 'approve' })}
                    >
                      同意
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => act.mutate({ id: r.id, op: 'reject' })}
                    >
                      拒绝
                    </Button>
                  </>
                )}
                {r.status === 'approved' && (
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => act.mutate({ id: r.id, op: 'fulfill' })}
                  >
                    发放
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
    </div>
  )
}
