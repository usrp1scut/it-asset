import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Spin } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth, type CurrentUser } from '../stores/auth'

export default function ProtectedRoute() {
  const { token, user, setUser, logout } = useAuth()

  const { data, isLoading, isError } = useQuery<{ user: CurrentUser }>({
    queryKey: ['me'],
    queryFn: async () => (await api.get('/auth/me')).data,
    enabled: !!token && !user,
    retry: false,
  })

  useEffect(() => {
    if (data?.user) setUser(data.user)
    if (isError) logout()
  }, [data, isError, setUser, logout])

  if (!token) return <Navigate to="/login" replace />
  if (isLoading && !user)
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <Spin />
      </div>
    )
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
