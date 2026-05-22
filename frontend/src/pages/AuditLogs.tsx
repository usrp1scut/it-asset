import { useState } from 'react'
import { Table, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

interface AuditItem {
  id: number
  actor_user_id: number | null
  actor_name: string | null
  action: string
  resource_type: string
  resource_id: string | null
  created_at: string
}

export default function AuditLogs() {
  const [page, setPage] = useState(1)
  const size = 30
  const { data, isLoading } = useQuery<{ total: number; items: AuditItem[] }>({
    queryKey: ['audit-logs', page],
    queryFn: async () =>
      (await api.get('/audit-logs', { params: { page, size } })).data,
  })

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>操作日志</h2>
      <Table<AuditItem>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.items ?? []}
        pagination={{
          current: page,
          pageSize: size,
          total: data?.total ?? 0,
          onChange: setPage,
          showTotal: (t) => `共 ${t} 条`,
        }}
        columns={[
          { title: '时间', dataIndex: 'created_at',
            render: (v: string) => new Date(v).toLocaleString('zh-CN') },
          {
            title: '操作人',
            dataIndex: 'actor_name',
            render: (v: string | null, r) =>
              v ?? (r.actor_user_id ? `#${r.actor_user_id}` : '系统'),
          },
          { title: '动作', dataIndex: 'action', render: (a: string) => <Tag>{a}</Tag> },
          { title: '资源', dataIndex: 'resource_type' },
          { title: '资源 ID', dataIndex: 'resource_id', render: (v) => v ?? '—' },
        ]}
      />
    </div>
  )
}
