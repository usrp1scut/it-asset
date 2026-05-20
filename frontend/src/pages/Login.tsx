import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Divider, Input, Typography, message } from 'antd'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'

// Lark H5 JSSDK globals (the SDK script must be loaded first; it is NOT
// auto-injected just by opening inside the Lark client).
declare global {
  interface Window {
    h5sdk?: {
      ready: (cb: () => void) => void
      error: (cb: (e: unknown) => void) => void
    }
    tt?: {
      requestAuthCode?: (opts: {
        appId: string
        success: (res: { code: string }) => void
        fail?: (e: unknown) => void
      }) => void
    }
  }
}

interface LarkCfg {
  app_id: string
  variant: string
  configured: boolean
  jssdk_url: string
}

const SDK_ID = 'lark-h5-jssdk'

function loadJssdk(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.h5sdk) return resolve(true)
    if (document.getElementById(SDK_ID)) {
      // already injected, give it a tick
      const t = setInterval(() => {
        if (window.h5sdk) {
          clearInterval(t)
          resolve(true)
        }
      }, 100)
      setTimeout(() => {
        clearInterval(t)
        resolve(!!window.h5sdk)
      }, 4000)
      return
    }
    const s = document.createElement('script')
    s.id = SDK_ID
    s.src = url
    s.onload = () => resolve(!!window.h5sdk)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
}

const inLarkClient = /Lark|Feishu/i.test(navigator.userAgent)

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [larkBusy, setLarkBusy] = useState(false)
  const [diag, setDiag] = useState('收集中…')
  const [diagVisible, setDiagVisible] = useState(
    () => new URLSearchParams(window.location.search).get('diag') === '1',
  )
  const setAuth = useAuth((s) => s.setAuth)
  const navigate = useNavigate()

  const finishLogin = useCallback(
    (token: string, user: unknown) => {
      setAuth(token, user as never)
      navigate('/', { replace: true })
    },
    [setAuth, navigate],
  )

  const larkLogin = useCallback(async () => {
    setLarkBusy(true)
    try {
      const cfg: LarkCfg = (await api.get('/auth/lark/config')).data
      if (!cfg.configured) {
        message.info('后端未配置 Lark 应用凭据')
        return
      }
      const ok = await loadJssdk(cfg.jssdk_url)
      if (!ok || !window.h5sdk) {
        message.error('Lark JSSDK 加载失败:请确认在 Lark 客户端内打开,且域名已在开发者后台「可信域名」中配置')
        return
      }
      const code: string = await new Promise((resolve, reject) => {
        window.h5sdk!.error((e) => reject({ stage: 'h5sdk.error', e }))
        window.h5sdk!.ready(() => {
          if (!window.tt?.requestAuthCode)
            return reject({ stage: 'requestAuthCode', e: 'tt.requestAuthCode 不可用' })
          window.tt.requestAuthCode({
            appId: cfg.app_id,
            success: (r) => resolve(r.code),
            fail: (e) => reject({ stage: 'requestAuthCode.fail', e }),
          })
        })
      })
      const { data } = await api.post('/auth/lark/callback', { code })
      finishLogin(data.token, data.user)
    } catch (err) {
      const staged = err as { stage?: string; e?: unknown }
      const detail = staged?.stage
        ? `[${staged.stage}] ${JSON.stringify(staged.e)}`
        : ((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          JSON.stringify(err))
      console.error('Lark 免登失败:', err)
      message.error(`Lark 免登失败:${detail}`, 8)
      setDiag((d) => `error: ${detail}\n${d}`)
      setDiagVisible(true)
    } finally {
      setLarkBusy(false)
    }
  }, [finishLogin])

  // Surface the real runtime values Lark validates against, so 免登
  // failures (e.g. invalid url 10236) can be diagnosed without devtools.
  useEffect(() => {
    const base = {
      href: window.location.href,
      origin: window.location.origin,
      ua: navigator.userAgent,
      h5sdk: !!window.h5sdk,
    }
    setDiag(JSON.stringify(base, null, 2))
    api
      .get('/auth/lark/config')
      .then((r) =>
        setDiag(JSON.stringify({ ...base, config: r.data }, null, 2)),
      )
      .catch(() => {})
  }, [])

  // Auto-run免登 only when actually inside the Lark client.
  useEffect(() => {
    if (inLarkClient) larkLogin()
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
          资产与耗材管理系统 · 登录
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
          description="在 Lark 工作台内打开会自动免登;此表单仅用于浏览器联调。"
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
        {diagVisible && (
          <>
            <Divider plain style={{ color: 'var(--text-3)', fontSize: 12 }}>
              诊断信息(截图发我)
            </Divider>
            <pre
              style={{
                fontSize: 11,
                lineHeight: 1.5,
                background: 'var(--fill-2, #f5f5f5)',
                padding: 8,
                borderRadius: 6,
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: 240,
                overflow: 'auto',
                userSelect: 'text',
              }}
            >
              {diag}
            </pre>
          </>
        )}
      </Card>
    </div>
  )
}
