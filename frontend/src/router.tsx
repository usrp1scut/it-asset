import { createBrowserRouter } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Home from './pages/Home'
import Assets from './pages/Assets'
import Inventory from './pages/Inventory'

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/assets', element: <Assets /> },
          { path: '/inventory', element: <Inventory /> },
        ],
      },
    ],
  },
])
