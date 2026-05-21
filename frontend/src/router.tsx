import { createBrowserRouter } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Assets from './pages/Assets'
import Inventory from './pages/Inventory'
import AuditLogs from './pages/AuditLogs'
import Approvals from './pages/Approvals'
import Users from './pages/Users'
import Inspections from './pages/Inspections'
import ScrapApprovals from './pages/ScrapApprovals'
import MobileApp from './pages/mobile/MobileApp'

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      // Employee H5 — no admin chrome (rendered inside the Lark webview).
      { path: '/m', element: <MobileApp /> },
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/assets', element: <Assets /> },
          { path: '/inventory', element: <Inventory /> },
          { path: '/approvals', element: <Approvals /> },
          { path: '/inspections', element: <Inspections /> },
          { path: '/scrap', element: <ScrapApprovals /> },
          { path: '/users', element: <Users /> },
          { path: '/logs', element: <AuditLogs /> },
        ],
      },
    ],
  },
])
