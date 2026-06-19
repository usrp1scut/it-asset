import { useEffect } from 'react'
import { Layout, Menu } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Topbar from './Topbar'
import { useAuth } from '../stores/auth'
import Icon, { type IconName } from './Icon'

interface MenuItemDef {
  key: string
  label: string
  icon: IconName
  adminOnly?: boolean
  roles?: string[]  // extra roles (beyond admin) that may see an adminOnly item
  section?: string  // group label rendered above this item if set
}

// Grouped to match the design prototype's three-section sidebar.
const ITEMS: MenuItemDef[] = [
  { key: '/', label: '工作台', icon: 'dashboard', section: '主要工作' },
  { key: '/assets', label: '资产台账', icon: 'assets' },
  { key: '/asset-types', label: '资产类型', icon: 'tag', adminOnly: true },
  { key: '/inventory', label: '库存物品', icon: 'inventory' },
  { key: '/approvals', label: '审批中心', icon: 'approval' },
  // Phase 2 ops group
  { key: '/inspections', label: '资产盘点', icon: 'inspect', adminOnly: true, section: '流程管理' },
  { key: '/scrap', label: '资产报废', icon: 'warning', adminOnly: true },
  { key: '/repair', label: '维修中心', icon: 'repair', adminOnly: true },
  { key: '/offboarding', label: '离职归还', icon: 'user', adminOnly: true, roles: ['hr'] },
  // Tools / system group
  { key: '/users', label: '用户管理', icon: 'user', adminOnly: true, section: '工具与系统' },
  { key: '/lottery', label: '抽奖', icon: 'box' },
  { key: '/logs', label: '操作日志', icon: 'clock' },
  { key: '/m', label: '员工视图', icon: 'phone', adminOnly: true },
  { key: '/m/admin', label: '移动管理台', icon: 'qr', adminOnly: true },
]

const MOBILE_BREAKPOINT = 768

export default function AppLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const role = useAuth((s) => s.user?.role)
  const isAdmin = role === 'it_admin' || role === 'sys_admin'

  // Employees should never land on the admin desktop chrome — the
  // tables and admin actions are gated server-side anyway, but showing
  // them an empty admin layout is bad UX. Send anyone whose role is
  // 'employee' to /m (the H5 self-service view). Admins / managers /
  // finance / procurement stay on the desktop AppLayout.
  useEffect(() => {
    if (role && role === 'employee') {
      navigate('/m', { replace: true })
    }
  }, [role, navigate])

  // Auto-redirect admins on small screens to the mobile admin cockpit —
  // but only when they hit the dashboard root, so deep links still resolve.
  useEffect(() => {
    if (!isAdmin) return
    if (pathname !== '/') return
    if (typeof window === 'undefined') return
    if (window.innerWidth >= MOBILE_BREAKPOINT) return
    navigate('/m/admin', { replace: true })
  }, [isAdmin, pathname, navigate])

  // Build the AntD Menu tree: section-less items at the top, then each
  // labelled section becomes a `type: 'group'` container holding its
  // members as `children`.
  type LeafItem = { key: string; label: string; icon: React.ReactNode }
  type GroupItem = {
    type: 'group'
    key: string
    label: string
    children: LeafItem[]
  }
  const visible = ITEMS.filter(
    (i) => !i.adminOnly || isAdmin || (!!role && !!i.roles?.includes(role)),
  )
  const items: (LeafItem | GroupItem)[] = []
  let currentGroup: GroupItem | null = null
  for (const it of visible) {
    const leaf: LeafItem = {
      key: it.key,
      label: it.label,
      icon: <Icon name={it.icon} size={16} />,
    }
    if (it.section) {
      // Start a new group whose first member is this item.
      currentGroup = {
        type: 'group',
        key: `__grp_${it.section}`,
        label: it.section,
        children: [leaf],
      }
      items.push(currentGroup)
    } else if (currentGroup) {
      currentGroup.children.push(leaf)
    } else {
      items.push(leaf)
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Topbar />
      <Layout>
        <Layout.Sider theme="light" width={216}>
          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            items={items}
            onClick={({ key }) => {
              if (key.startsWith('__grp_')) return
              navigate(key)
            }}
            style={{
              height: '100%',
              borderRight: 0,
              paddingTop: 8,
              paddingBottom: 16,
              fontSize: 14,
            }}
            className="app-sidebar"
          />
        </Layout.Sider>
        <Layout.Content style={{ background: 'var(--bg-canvas)' }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
