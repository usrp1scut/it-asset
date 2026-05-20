import { useState } from 'react'
import { Button, Input, Modal, Select, Space, Table, Tag, Tooltip, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'

type Role = 'employee' | 'manager' | 'it_admin' | 'finance' | 'procurement' | 'sys_admin'

interface UserRow {
  id: number
  name: string
  email: string | null
  department_name: string | null
  role: Role
  status: string
}

const ROLE_META: Record<Role, { label: string; color: string }> = {
  employee: { label: '员工', color: 'default' },
  manager: { label: '主管', color: 'cyan' },
  it_admin: { label: 'IT 管理员', color: 'blue' },
  finance: { label: '财务', color: 'gold' },
  procurement: { label: '采购', color: 'green' },
  sys_admin: { label: '系统管理员', color: 'purple' },
}

const ASSIGNABLE: Role[] = ['employee', 'manager', 'it_admin', 'finance', 'procurement']

export default function Users() {
  const qc = useQueryClient()
  const me = useAuth((s) => s.user)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [nextRole, setNextRole] = useState<Role>('employee')

  const { data, isLoading } = useQuery<UserRow[]>({
    queryKey: ['users-manage', q],
    queryFn: async () =>
      (await api.get('/users/manage', { params: { q: q || undefined } })).data,
  })

  const mut = useMutation({
    mutationFn: async (v: { id: number; role: Role }) =>
      (await api.patch(`/users/${v.id}/role`, { role: v.role })).data,
    onSuccess: () => {
      message.success('角色已更新')
      qc.invalidateQueries({ queryKey: ['users-manage'] })
      setEditing(null)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '更新失败'),
  })

  const openEdit = (row: UserRow) => {
    setEditing(row)
    setNextRole(ASSIGNABLE.includes(row.role) ? row.role : 'employee')
  }

  const columns: ColumnsType<UserRow> = [
    { title: '姓名', dataIndex: 'name' },
    { title: '邮箱', dataIndex: 'email', render: (v) => v ?? '—' },
    { title: '部门', dataIndex: 'department_name', render: (v) => v ?? '—' },
    {
      title: '角色',
      dataIndex: 'role',
      render: (r: Role) => {
        const m = ROLE_META[r] ?? { label: r, color: 'default' }
        return <Tag color={m.color}>{m.label}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s: string) => (s === 'active' ? '在职' : s),
    },
    {
      title: '操作',
      render: (_, row) => {
        if (row.id === me?.id)
          return (
            <Tooltip title="不能修改自己的角色,请让另一位管理员代为操作">
              <Button size="small" disabled>
                改角色
              </Button>
            </Tooltip>
          )
        if (row.role === 'sys_admin')
          return (
            <Tooltip title="sys_admin 系统级账号不可降级">
              <Button size="small" disabled>
                改角色
              </Button>
            </Tooltip>
          )
        return (
          <Button size="small" type="link" onClick={() => openEdit(row)}>
            改角色
          </Button>
        )
      },
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>用户管理</h2>
        <Space>
          <Input.Search
            placeholder="搜索姓名 / 邮箱"
            allowClear
            style={{ width: 260 }}
            onSearch={setQ}
          />
        </Space>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
        授予「IT 管理员」即给予完整后台读写权限。系统管理员(sys_admin)是引导账号,不在此处授予。
      </div>
      <Table<UserRow>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={data ?? []}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 人` }}
      />

      <Modal
        open={editing !== null}
        title={editing ? `修改角色 · ${editing.name}` : ''}
        onCancel={() => setEditing(null)}
        onOk={() => editing && mut.mutate({ id: editing.id, role: nextRole })}
        confirmLoading={mut.isPending}
        destroyOnClose
      >
        <div style={{ marginBottom: 8, color: 'var(--text-2)' }}>新角色</div>
        <Select
          style={{ width: '100%' }}
          value={nextRole}
          onChange={setNextRole}
          options={ASSIGNABLE.map((r) => ({ value: r, label: ROLE_META[r].label }))}
        />
      </Modal>
    </div>
  )
}
