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
        if (!ok || !window.tt?.scanCode) {
          setErr('Lark 原生扫码不可用,请确认 Lark 客户端已更新到最新版。')
          return
        }
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
            const msg = e?.errMsg || ''
            // user-cancelled — silently close without raising an error banner
            if (/cancel/i.test(msg)) {
              onClose()
            } else {
              setErr('Lark 扫码失败:' + (msg || '未知错误'))
            }
          },
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
        <Alert type="warning" showIcon message={err} />
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
        <Alert type="warning" showIcon message={err} />
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
