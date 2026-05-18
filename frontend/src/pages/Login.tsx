import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Divider, Input, Typography, message } from 'antd'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'

// Lark H5 JSSDK (injected by the Lark/Feishu webview container).
declare global {
  interface Window {
    tt?: {
      requestAuthCode?: (opts: {
        appId: string
        success: (res: { code: string }) => void
        fail?: (e: unknown) => void
      }) => void
    }
  }
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [larkBusy, setLarkBusy] = useState(false)
  const setAuth = useAuth((s) => s.setAuth)
  const navigate = useNavigate()

  const finishLogin = useCallback(
    (token: string, user: unknown) => {
      setAuth(token, user as never)
      navigate('/', { replace: true })
    },
    [setAuth, navigate],
  )

  // Silent SSO when opened inside the Lark webview.
  const larkLogin = useCallback(async () => {
    setLarkBusy(true)
    try {
      const cfg = (await api.get('/auth/lark/config')).data
      if (!cfg.configured || !window.tt?.requestAuthCode) {
        message.info('未在 Lark 客户端内或应用未配置,请用开发登录')
        return
      }
      const code: string = await new Promise((resolve, reject) =>
        window.tt!.requestAuthCode!({
          appId: cfg.app_id,
          success: (r) => resolve(r.code),
          fail: reject,
        }),
      )
      const { data } = await api.post('/auth/lark/callback', { code })
      finishLogin(data.token, data.user)
    } catch {
      message.error('Lark 免登失败,请重试或用开发登录')
    } finally {
      setLarkBusy(false)
    }
  }, [finishLogin])

  // Auto-attempt免登 if the Lark JSSDK is present.
  useEffect(() => {
    if (window.tt?.requestAuthCode) larkLogin()
  }, [larkLogin])

  const devSubmit = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/dev-login', { email })
      finishLogin(data.token, data.user)
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
        <Button block loading={larkBusy} onClick={larkLogin} style={{ marginBottom: 12 }}>
          使用 Lark 登录
        </Button>
        <Divider plain style={{ color: 'var(--text-3)', fontSize: 12 }}>
          或开发登录
        </Divider>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="开发登录"
          description="生产在 Lark 工作台内自动免登;此表单仅用于浏览器联调。"
        />
        <Input
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onPressEnter={devSubmit}
          style={{ marginBottom: 12 }}
        />
        <Button type="primary" block loading={loading} disabled={!email} onClick={devSubmit}>
          登录
        </Button>
      </Card>
    </div>
  )
}
