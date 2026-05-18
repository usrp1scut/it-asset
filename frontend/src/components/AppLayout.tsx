import { Layout } from 'antd'
import { Outlet } from 'react-router-dom'
import Topbar from './Topbar'

export default function AppLayout() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Topbar />
      <Layout.Content style={{ background: 'var(--bg-canvas)' }}>
        <Outlet />
      </Layout.Content>
    </Layout>
  )
}
