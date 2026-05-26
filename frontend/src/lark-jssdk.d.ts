// Lark / Feishu H5 JSSDK globals.
//
// The SDK script is loaded on demand (see Login.tsx + CameraScanner.tsx) —
// it is NOT auto-injected just by opening the page inside the Lark client.
// Declaring these globals in one shared file avoids TypeScript "Subsequent
// property declarations must have the same type" merge errors when multiple
// pages declare `Window.tt`.

export {}

declare global {
  interface Window {
    h5sdk?: {
      ready: (cb: () => void) => void
      error: (cb: (e: unknown) => void) => void
      // Feishu's config / auth — required before capability-gated APIs like
      // tt.scanCode. Calls `onSuccess` (or `onFail`) asynchronously.
      config?: (opts: {
        appId: string
        timestamp: number
        nonceStr: string
        signature: string
        jsApiList: string[]
        onSuccess?: () => void
        onFail?: (e: unknown) => void
      }) => void
    }
    tt?: {
      requestAuthCode?: (opts: {
        appId: string
        success: (res: { code: string }) => void
        fail?: (e: unknown) => void
      }) => void
      scanCode?: (opts: {
        scanType?: string[]
        success: (res: { result?: string }) => void
        fail?: (e: { errMsg?: string }) => void
      }) => void
    }
  }
}
