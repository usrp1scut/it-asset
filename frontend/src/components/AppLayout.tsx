import { Layout, Menu } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Topbar from './Topbar'
import { useAuth } from '../stores/auth'

const ITEMS = [
  { key: '/', label: '工作台' },
  { key: '/assets', label: '资产台账' },
  { key: '/inventory', label: '库存物品' },
  { key: '/approvals', label: '审批中心' },
  { key: '/inspections', label: '资产盘点', adminOnly: true },
  { key: '/scrap', label: '资产报废', adminOnly: true },
  { key: '/users', label: '用户管理', adminOnly: true },
  { key: '/logs', label: '操作日志' },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const role = useAuth((s) => s.user?.role)
  const isAdmin = role === 'it_admin' || role === 'sys_admin'
  const items = ITEMS.filter((i) => !i.adminOnly || isAdmin).map(
    ({ key, label }) => ({ key, label }),
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Topbar />
      <Layout>
        <Layout.Sider theme="light" width={200}>
          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            items={items}
            onClick={({ key }) => navigate(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Layout.Sider>
        <Layout.Content style={{ background: 'var(--bg-canvas)' }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
