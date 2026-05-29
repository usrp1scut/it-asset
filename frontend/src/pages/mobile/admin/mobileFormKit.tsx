/**
 * Shared building blocks for the mobile admin asset forms (new / edit).
 * Full-screen layout: dark sticky nav, scrollable body, fixed bottom save bar.
 * Only components are exported here so Vite fast-refresh stays happy.
 */
import type { ReactNode } from 'react'
import Icon from '../../../components/Icon'

const wrap: React.CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  minHeight: '100dvh',
  background: '#F4F5F7',
  paddingBottom: 96,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
}

export function MobileFormShell({
  title,
  onBack,
  onSave,
  saving,
  saveLabel = '保存',
  saveDisabled,
  children,
}: {
  title: string
  onBack: () => void
  onSave: () => void
  saving?: boolean
  saveLabel?: string
  saveDisabled?: boolean
  children: ReactNode
}) {
  return (
    <div style={wrap}>
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          background: '#1F2329',
          color: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            padding: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            opacity: 0.85,
          }}
          aria-label="返回"
        >
          <Icon name="chevronLeft" size={20} />
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 600 }}>
          {title}
        </div>
        <div style={{ width: 32 }} />
      </div>

      <div style={{ padding: '12px 0' }}>{children}</div>

      {/* Fixed save bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 480,
          margin: '0 auto',
          padding: '10px 16px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          background: '#fff',
          borderTop: '0.5px solid #E5E6EB',
          zIndex: 20,
        }}
      >
        <button
          onClick={onSave}
          disabled={saving || saveDisabled}
          style={{
            width: '100%',
            height: 46,
            borderRadius: 12,
            border: 'none',
            background: saveDisabled ? '#A9C4FF' : '#3370FF',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: saving || saveDisabled ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '保存中…' : saveLabel}
        </button>
      </div>
    </div>
  )
}

/** White card grouping a set of fields. */
export function FormCard({ children }: { children: ReactNode }) {
  return (
    <div style={{ margin: '0 12px 12px', background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
      {children}
    </div>
  )
}

/** A labelled field row (label on top, control below). */
export function Field({
  label,
  required,
  hint,
  children,
  last,
}: {
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
  last?: boolean
}) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderBottom: last ? 'none' : '0.5px solid #F2F3F5',
      }}
    >
      <div style={{ fontSize: 12, color: '#86909C', marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: '#F53F3F', marginLeft: 2 }}>*</span>}
      </div>
      {children}
      {hint && <div style={{ fontSize: 11, color: '#C9CDD4', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

const inputBase: React.CSSProperties = {
  width: '100%',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: 15,
  color: '#1F2329',
  padding: 0,
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  suffix,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  inputMode?: 'text' | 'numeric' | 'decimal'
  suffix?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        value={value}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={inputBase}
      />
      {suffix}
    </div>
  )
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputBase, resize: 'none', lineHeight: 1.5 }}
    />
  )
}

/** Inline scan button used as a TextInput suffix (serial-number capture). */
export function ScanSuffix({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="扫描条形码"
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderRadius: 8,
        border: '1px solid #E5E6EB',
        background: '#F7F8FA',
        cursor: 'pointer',
        color: '#3370FF',
      }}
    >
      <Icon name="qr" size={16} color="#3370FF" />
    </button>
  )
}
