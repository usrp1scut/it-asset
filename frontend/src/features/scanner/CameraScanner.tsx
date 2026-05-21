import { useEffect, useRef, useState } from 'react'
import { Alert, Modal } from 'antd'

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

declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike
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

    const Detector = window.BarcodeDetector
    if (!Detector) {
      setErr('当前浏览器不支持原生条码识别(BarcodeDetector)。请用 Chrome/Edge/Safari 最新版,或继续手动输入编号。')
      return
    }
    detectorRef.current = new Detector({ formats: ['qr_code'] })

    let cancelled = false
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
  }, [open, onCode])

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
