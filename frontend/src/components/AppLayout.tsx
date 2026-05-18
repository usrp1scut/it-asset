import { Layout, Menu } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Topbar from './Topbar'

const ITEMS = [
  { key: '/', label: '工作台' },
  { key: '/assets', label: '资产台账' },
  { key: '/inventory', label: '库存物品' },
  { key: '/logs', label: '操作日志' },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Topbar />
      <Layout>
        <Layout.Sider theme="light" width={200}>
          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            items={ITEMS}
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
