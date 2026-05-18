import { createBrowserRouter } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Assets from './pages/Assets'
import Inventory from './pages/Inventory'
import AuditLogs from './pages/AuditLogs'

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/assets', element: <Assets /> },
          { path: '/inventory', element: <Inventory /> },
          { path: '/logs', element: <AuditLogs /> },
        ],
      },
    ],
  },
])
