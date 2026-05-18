import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Input, Typography, message } from 'antd'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'

// In the Lark webview this screen is bypassed: the JSSDK obtains a login `code`
// and we call POST /auth/lark/callback for silent SSO (Sprint 1 backend ready).
// This dev-login form keeps the app usable in a plain browser before that.
export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuth((s) => s.setAuth)
  const navigate = useNavigate()

  const submit = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/dev-login', { email })
      setAuth(data.token, data.user)
      navigate('/', { replace: true })
    } catch {
      message.error('登录失败,请检查后端是否在 APP_DEBUG 模式')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          IT 资产管理 · 登录
        </Typography.Title>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="开发登录"
          description="生产环境在 Lark 工作台内免登;此表单仅用于浏览器联调。"
        />
        <Input
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onPressEnter={submit}
          style={{ marginBottom: 12 }}
        />
        <Button type="primary" block loading={loading} disabled={!email} onClick={submit}>
          登录
        </Button>
      </Card>
    </div>
  )
}
