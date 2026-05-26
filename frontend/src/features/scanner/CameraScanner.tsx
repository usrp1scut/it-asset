import { useEffect, useRef, useState } from 'react'
import { Alert, Modal } from 'antd'
import { api } from '../../api/client'

/** Pull "PC-0099" out of a scanned URL payload, else return the raw value. */
function extractCode(payload: string): string {
  const s = payload.trim()
  try {
    const u = new URL(s)
    const c = u.searchParams.get('code')
    if (c) return c
  } catch {
    // not a URL — fall through
  }
  return s
}

interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>
}

// Lark JSSDK (h5sdk + tt) declarations live in src/lark-jssdk.d.ts.
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike
  }
}

const inLark = /Lark|Feishu/i.test(navigator.userAgent)
const SDK_ID = 'lark-h5-jssdk'

/** Load the Lark H5 JSSDK on demand. No-op if already loaded. */
async function ensureLarkJssdk(): Promise<boolean> {
  if (window.h5sdk && window.tt?.scanCode) return true
  try {
    const cfg = (await api.get('/auth/lark/config')).data as {
      jssdk_url?: string
    }
    if (!cfg.jssdk_url) return false
    if (!document.getElementById(SDK_ID)) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.id = SDK_ID
        s.src = cfg.jssdk_url!
        s.onload = () => resolve()
        s.onerror = () => reject(new Error('jssdk load failed'))
        document.head.appendChild(s)
      })
    }
    // Wait briefly for the SDK to attach itself to window.
    if (!window.h5sdk) await new Promise((r) => setTimeout(r, 300))
    if (!window.h5sdk) return false
    return new Promise<boolean>((resolve) => {
      window.h5sdk!.ready(() => resolve(true))
      window.h5sdk!.error(() => resolve(false))
    })
  } catch {
    return false
  }
}

export default function CameraScanner({
  open,
  onClose,
  onCode,
}: {
  open: boolean
  onClose: () => void
  onCode: (code: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const handledRef = useRef(false)

  useEffect(() => {
    if (!open) return
    handledRef.current = false
    setErr(null)
    let cancelled = false

    // Inside the Lark webview, getUserMedia is unreliable / blocked. Hand off
    // to the native scanner via `tt.scanCode` — same UX as 飞书 'scan'.
    if (inLark) {
      ;(async () => {
        const ok = await ensureLarkJssdk()
        if (cancelled) return
        // Log what the SDK actually exposes so version mismatches are easy
        // to diagnose in the field.
        console.info(
          '[Lark JSSDK] h5sdk:',
          Object.keys(window.h5sdk || {}),
          'tt:',
          Object.keys(window.tt || {}),
        )
        if (!ok || !window.tt?.scanCode) {
          setErr('Lark 原生扫码不可用,请确认 Lark 客户端已更新到最新版。')
          return
        }
        // Feishu's tt.scanCode is config-gated — call h5sdk.config (the
        // Feishu equivalent of wx.config) with a signed jsapi_ticket
        // signature first. Without it, scanCode returns 'fail' with no
        // further detail.
        type SignCfg = {
          appId: string
          timestamp: number
          nonceStr: string
          signature: string
          serverTime?: number
          signedUrl?: string
          ticketFresh?: boolean
          ticketPreview?: string
          ticketLength?: number
          apiBase?: string
        }
        const fetchSign = async (force: boolean): Promise<SignCfg | null> => {
          try {
            const url = window.location.href.split('#')[0]
            const params: Record<string, string> = { url }
            if (force) params.force = '1'
            return (await api.get('/auth/lark/jssdk-sign', { params })).data
          } catch (e) {
            console.error('[Lark JSSDK] sign fetch failed:', e)
            const msg =
              (e as { response?: { data?: { detail?: string } } })?.response
                ?.data?.detail ??
              (e instanceof Error ? e.message : String(e))
            setErr('获取 JSSDK 签名失败:' + msg)
            return null
          }
        }
        const cfg = await fetchSign(false)
        if (cancelled || !cfg) return

        const runScan = () => {
          if (cancelled || !window.tt?.scanCode) return
          window.tt.scanCode({
            scanType: ['qrCode', 'barCode'],
            success: (res) => {
              if (cancelled || handledRef.current) return
              const raw = (res.result ?? '').trim()
              if (raw) {
                handledRef.current = true
                onCode(extractCode(raw))
              } else {
                onClose()
              }
            },
            fail: (e) => {
              if (cancelled) return
              console.error('[Lark scanCode] fail object:', e)
              const msg = e?.errMsg || ''
              if (/cancel/i.test(msg)) {
                onClose()
                return
              }
              const dump = JSON.stringify(e ?? {}, null, 2) || '(空错误对象)'
              setErr(
                `Lark 扫码失败:${msg || '(无 errMsg)'}\n\n完整错误对象:\n${dump}`,
              )
            },
          })
        }

        if (!window.h5sdk?.config) {
          // Some older SDK builds don't expose config — try scanCode directly
          // and let its fail callback surface the real reason.
          console.warn('[Lark JSSDK] h5sdk.config not available; calling scanCode directly')
          runScan()
          return
        }

        const isSigExpired = (e: unknown): boolean =>
          (e as { errno?: number })?.errno === 2601002 ||
          /signature is expired/i.test(
            (e as { errString?: string })?.errString ?? '',
          )

        const reportConfigFailure = (e: unknown, used: SignCfg, retried: boolean) => {
          const dump = JSON.stringify(e ?? {}, null, 2) || '(空错误对象)'
          const clientNow = Math.floor(Date.now() / 1000)
          const srv = used.serverTime ?? used.timestamp
          const drift = clientNow - srv
          const driftLine = `客户端时间 ${clientNow},服务器时间 ${srv},偏差 ${drift}s`
          const liveUrl = window.location.href.split('#')[0]
          const urlMatch = used.signedUrl === liveUrl
          const urlLines =
            `签名 URL: ${used.signedUrl ?? '(未回显)'}\n` +
            `当前 URL: ${liveUrl}\n` +
            `URL 一致: ${urlMatch ? '是' : '否(可能就是它)'}`
          const ticketLines =
            `appId: ${used.appId}\n` +
            `API base: ${used.apiBase ?? '(未回显)'}\n` +
            `ticket: ${used.ticketPreview ?? '(未回显)'} (len=${used.ticketLength ?? 0})`
          const retryLine = retried
            ? '\n已用 force=1 强刷 ticket 重试过仍失败,基本可排除 ticket 缓存陈旧。'
            : ''
          // When clock/URL/ticket-cache are all ruled out, the remaining root
          // causes are Lark dev-console configuration — be specific about
          // which switches need to be on, because "可信域名" alone isn't enough.
          const hint = isSigExpired(e)
            ? [
                '',
                '',
                '→ 时钟/URL/ticket 缓存都排查过了。剩下的几乎都是 Lark 开发者后台的配置问题,请逐项核对:',
                '',
                '1. 「凭证与基础信息」里的 App ID 是否与上面的 appId 一致(部署用错环境的 app 会全程失败)。',
                '2. 「能力 → 网页应用」是否启用,且「桌面端主页」「移动端主页」填了当前域名(http://192.168.107.21:8080)。',
                '3. 「安全设置 → 重定向 URL」要包含 http://192.168.107.21:8080/ 这条根路径(只配 /login 不够,扫码页是 /inspections)。',
                '4. 「权限管理」里要勾选「获取通讯录基本信息」之外,还要单独勾选「调用扫一扫 接入网页应用」/「JSSDK」相关权限,且发布版本生效。',
                '5. 应用是否已经「创建版本 → 申请发布 → 管理员审批通过」?未审批的版本只对开发者本人生效,所以 admin@deepjoy.me 自己测可能能过,其它人挂在这一步。',
                '',
                '把 Lark 后台「能力 → 网页应用」「安全设置」「权限管理」三页截图发我,我直接看哪个没开。',
              ].join('\n')
            : ''
          setErr(
            `Lark JSSDK config 失败。\n${driftLine}\n${urlLines}\n${ticketLines}${retryLine}${hint}\n\n完整错误对象:\n${dump}`,
          )
        }

        const callConfig = (used: SignCfg, onFail: (e: unknown) => void) => {
          window.h5sdk!.config!({
            appId: used.appId,
            timestamp: used.timestamp,
            nonceStr: used.nonceStr,
            signature: used.signature,
            jsApiList: ['scanCode'],
            onSuccess: () => {
              if (cancelled) return
              runScan()
            },
            onFail,
          })
        }

        callConfig(cfg, async (e) => {
          if (cancelled) return
          console.error('[Lark JSSDK] h5sdk.config failed:', e)
          if (!isSigExpired(e)) {
            reportConfigFailure(e, cfg, false)
            return
          }
          // Ticket cache may be stale — Feishu sometimes rotates server-side
          // before its advertised expiry. Refetch once with force=1 and retry.
          console.warn(
            '[Lark JSSDK] signature is expired — retrying once with force=1',
          )
          const fresh = await fetchSign(true)
          if (cancelled || !fresh) return
          callConfig(fresh, (e2) => {
            if (cancelled) return
            console.error('[Lark JSSDK] retry failed:', e2)
            reportConfigFailure(e2, fresh, true)
          })
        })
      })()
      return () => {
        cancelled = true
      }
    }

    // Browser path — native BarcodeDetector against a getUserMedia stream.
    const Detector = window.BarcodeDetector
    if (!Detector) {
      setErr(
        '当前浏览器不支持原生条码识别(BarcodeDetector)。请用 Chrome/Edge/Safari 最新版,或继续手动输入编号。',
      )
      return
    }
    detectorRef.current = new Detector({ formats: ['qr_code'] })

    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream
        await v.play()
        const loop = async () => {
          if (handledRef.current || cancelled) return
          try {
            const hits = await detectorRef.current!.detect(v)
            if (hits.length && !handledRef.current) {
              handledRef.current = true
              onCode(extractCode(hits[0].rawValue))
              return
            }
          } catch {
            // transient detect errors are fine; keep scanning
          }
          rafRef.current = requestAnimationFrame(loop)
        }
        loop()
      } catch (e) {
        setErr(
          '无法访问摄像头:' +
            ((e as Error).message || '请检查权限设置,或在 https 下访问'),
        )
      }
    })()

    return () => {
      cancelled = true
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [open, onCode, onClose])

  // Inside Lark the native scanner takes over the screen — render only an
  // error fallback if something went wrong (otherwise stay invisible).
  if (inLark) {
    if (!open || !err) return null
    return (
      <Modal
        open={open}
        title="扫码"
        footer={null}
        onCancel={onClose}
        destroyOnClose
        width={360}
      >
        <Alert
          type="warning"
          showIcon
          message={
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                margin: 0,
                fontFamily: 'inherit',
                fontSize: 13,
              }}
            >
              {err}
            </pre>
          }
        />
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      title="摄像头扫描二维码"
      footer={null}
      onCancel={onClose}
      destroyOnClose
      width={420}
    >
      {err ? (
        <Alert
          type="warning"
          showIcon
          message={
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                margin: 0,
                fontFamily: 'inherit',
                fontSize: 13,
              }}
            >
              {err}
            </pre>
          }
        />
      ) : (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              borderRadius: 8,
              background: '#000',
              aspectRatio: '4 / 3',
            }}
          />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
            将资产二维码对准取景框,识别后自动填入编号并关闭。
          </div>
        </>
      )}
    </Modal>
  )
}
