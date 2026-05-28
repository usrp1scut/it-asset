import { Avatar, Dropdown, Layout, Typography } from 'antd'
import { useAuth } from '../stores/auth'
import Icon from './Icon'

const ROLE_LABEL: Record<string, string> = {
  employee: '普通员工',
  manager: '部门负责人',
  it_admin: 'IT 管理员',
  procurement: '行政/采购',
  finance: '财务',
  sys_admin: '系统管理员',
}

/** Square brand mark — gradient tile containing an inset "assets" icon.
 * Matches the prototype's compact-logo treatment in the sidebar header. */
function BrandLogo() {
  return (
    <div
      aria-hidden
      style={{
        width: 28,
        height: 28,
        borderRadius: 7,
        background: 'linear-gradient(135deg, #3370FF, #5B92FF)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(51,112,255,0.3)',
      }}
    >
      <Icon name="assets" size={16} color="#fff" />
    </div>
  )
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
        lineHeight: 'normal',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BrandLogo />
        <Typography.Text strong style={{ fontSize: 15 }}>
          资产与耗材管理系统
        </Typography.Text>
      </div>
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
