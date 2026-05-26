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
          hostLocalTime?: number
          realUtcTime?: number | null
          hostClockDrift?: number | null
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
          // The relevant drift is host-vs-real-UTC (not client-vs-server),
          // because client+server can both be wrong by the same amount on a
          // skewed VM and still agree with each other.
          const hostLocal = used.hostLocalTime ?? used.timestamp
          const realUtc = used.realUtcTime ?? null
          const hostDrift = used.hostClockDrift ?? null
          const driftLine =
            realUtc != null && hostDrift != null
              ? `主机时间 ${hostLocal},Lark Date 头给的真实 UTC ${realUtc},主机时钟偏差 ${hostDrift}s`
              : `主机时间 ${hostLocal} (未能从 Lark 抓真实 UTC,网络可能不通)`
          const clientDriftLine = `浏览器时间 ${clientNow},签名 timestamp ${used.timestamp},差 ${clientNow - used.timestamp}s`
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
          // Now that we sign with real UTC pulled from Lark's Date header,
          // a leftover sig-expired error means real network latency >5min,
          // a configuration issue, or that Lark itself rotated something
          // — hint accordingly without crying wolf about the clock.
          const driftBad = Math.abs(hostDrift ?? 0) > 60
          const hint = isSigExpired(e)
            ? driftBad
              ? `\n\n→ 主机时钟偏差 ${hostDrift}s,虽然我们已经用 Lark 的真实 UTC 重算了签名,但请同步 NTP(\`sudo timedatectl set-ntp true\` 或 \`sudo ntpdate -u pool.ntp.org\`) —— 漂移会触发别的隐性问题。`
              : '\n\n→ 时钟、URL、ticket 都排查过了。剩下的可能是: Lark 后台「能力 → 网页应用」未启用 / 应用未发布审批 / 安全设置的可信域名缺当前域名。把 Lark 后台「能力配置」「安全设置」「版本管理」三页截图发我。'
            : ''
          setErr(
            `Lark JSSDK config 失败。\n${driftLine}\n${clientDriftLine}\n${urlLines}\n${ticketLines}${retryLine}${hint}\n\n完整错误对象:\n${dump}`,
          )
        }

        const callConfig = (used: SignCfg, onFail: (e: unknown) => void) => {
          // Lark international's h5sdk.config wants an EMPTY jsApiList —
          // confirmed by lark-samples/web_app_with_jssdk/public/index.js
          // which passes `jsApiList: []` and then calls tt.getUserInfo /
          // tt.scanCode freely after onSuccess. Declaring `['scanCode']`
          // (WeChat-style) makes the whole config fail with errno
          // 2601002 "signature is expired" because Lark's server-side
          // doesn't recognize that identifier in this build.
          window.h5sdk!.config!({
            appId: used.appId,
            timestamp: used.timestamp,
            nonceStr: used.nonceStr,
            signature: used.signature,
            jsApiList: [],
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
