import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Spin } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth, type CurrentUser } from '../stores/auth'

export default function ProtectedRoute() {
  const { token, user, setUser, logout } = useAuth()

  const { data, isError } = useQuery<{ user: CurrentUser }>({
    queryKey: ['me'],
    queryFn: async () => (await api.get('/auth/me')).data,
    enabled: !!token && !user,
    retry: false,
  })

  // Sync the resolved profile into the store for the rest of the app.
  useEffect(() => {
    if (data?.user) setUser(data.user)
    if (isError) logout()
  }, [data, isError, setUser, logout])

  if (!token) return <Navigate to="/login" replace />

  // Derive auth from query data directly so we never redirect in the render
  // gap between the response arriving and the effect committing the user.
  const currentUser = user ?? data?.user
  if (currentUser) return <Outlet />
  if (isError) return <Navigate to="/login" replace />

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <Spin />
    </div>
  )
}
