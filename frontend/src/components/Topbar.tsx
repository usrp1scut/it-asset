import { Avatar, Dropdown, Layout, Typography } from 'antd'
import { useAuth } from '../stores/auth'

const ROLE_LABEL: Record<string, string> = {
  employee: '普通员工',
  manager: '部门负责人',
  it_admin: 'IT 管理员',
  procurement: '行政/采购',
  finance: '财务',
  sys_admin: '系统管理员',
}

export default function Topbar() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <Layout.Header
      style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingInline: 24,
        height: 56,
        lineHeight: '56px',
      }}
    >
      <Typography.Text strong>IT 资产管理</Typography.Text>
      <Dropdown
        menu={{ items: [{ key: 'logout', label: '退出登录', onClick: logout }] }}
        placement="bottomRight"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <Avatar style={{ background: 'var(--lark-blue)' }} size={28}>
            {user.name.slice(0, 1)}
          </Avatar>
          <span>
            {user.name}
            <span style={{ color: 'var(--text-3)', marginLeft: 6, fontSize: 12 }}>
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
          </span>
        </div>
      </Dropdown>
    </Layout.Header>
  )
}
