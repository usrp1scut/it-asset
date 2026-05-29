import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import CameraScanner from '../../../features/scanner/CameraScanner'
import Icon from '../../../components/Icon'
import AssetTypeIcon from '../../../components/AssetTypeIcon'

interface AssetOut {
  id: number
  asset_code: string
  asset_class: string
  asset_type_name: string | null
  asset_type_icon: string | null
  asset_type_color: string | null
  brand_model: string | null
  spec: string | null
  serial_number: string | null
  status: string
  owner_user_id: number | null
  owner_name: string | null
  department_name: string | null
  location: string | null
  purchase_date: string | null
  purchase_price: string | null
  warranty_expire_date: string | null
  supplier: string | null
  remark: string | null
}
interface ChangeLog {
  action: string
  from_status: string | null
  to_status: string | null
  reason: string | null
  created_at: string
}
interface AssetDetail {
  asset: AssetOut
  lifecycle: ChangeLog[]
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  in_use: { label: '在用', color: '#00B42A', bg: '#E8FFEA' },
  idle: { label: '闲置', color: '#86909C', bg: '#F2F3F5' },
  maintenance: { label: '维修中', color: '#FF8800', bg: '#FFF7E8' },
  scrapped: { label: '已报废', color: '#86909C', bg: '#F2F3F5' },
}

const ACTION_CN: Record<string, string> = {
  assign: '分配',
  return: '归还',
  transfer: '转移',
  repair: '送修',
  return_from_repair: '维修返回',
  scrap: '报废',
  create: '建档',
  update: '修改',
  inspect_ok: '盘点确认',
  inspect_lost: '盘点遗失',
}

const wrap: React.CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  minHeight: '100dvh',
  background: '#F4F5F7',
  paddingBottom: 80,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('zh-CN')
  } catch {
    return s
  }
}

function NavBar({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  return (
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
        扫码结果
      </div>
      <button
        onClick={onClose}
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
        aria-label="关闭"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  )
}

function InfoRow({
  label,
  value,
  multiline,
}: {
  label: string
  value: React.ReactNode
  multiline?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '11px 14px',
        borderBottom: '0.5px solid #F2F3F5',
        alignItems: multiline ? 'flex-start' : 'center',
      }}
    >
      <span style={{ fontSize: 12, color: '#86909C', minWidth: 78 }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          color: '#1F2329',
          flex: 1,
          textAlign: 'right',
          wordBreak: 'break-all',
        }}
      >
        {value || <span style={{ color: '#C9CDD4' }}>—</span>}
      </span>
    </div>
  )
}

export default function MobileAdminScanResult() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  // Raw scan payload (pre-extractCode) passed via navigation state from
  // the scanner — surface it in the "not found" panel so a mismatch
  // between what was on the sticker and what we tried to lookup is
  // immediately visible.
  const raw = (location.state as { raw?: string } | null)?.raw ?? null
  const [scanOpen, setScanOpen] = useState(false)

  const { data, isLoading, error } = useQuery<AssetDetail>({
    queryKey: ['m-admin-asset', code],
    queryFn: async () => (await api.get(`/assets/${encodeURIComponent(code)}`)).data,
    enabled: !!code,
    retry: false,
  })

  const notFound =
    (error as { response?: { status?: number } } | undefined)?.response?.status === 404

  return (
    <div style={wrap}>
      <NavBar onBack={() => navigate('/m/admin')} onClose={() => navigate('/m/admin')} />

      {isLoading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#86909C', fontSize: 13 }}>
          加载中…
        </div>
      )}

      {notFound && (
        <div style={{ padding: 24 }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              textAlign: 'center',
              border: '1px solid #FFD8C8',
            }}
          >
            <Icon
              name="warning"
              size={36}
              color="#F53F3F"
              style={{ marginBottom: 8 }}
            />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1F2329' }}>
              没找到资产
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#86909C',
                marginTop: 10,
                lineHeight: 1.6,
                textAlign: 'left',
              }}
            >
              {raw && raw !== code && (
                <div style={{ marginBottom: 8 }}>
                  扫到的原文:
                  <code
                    style={{
                      display: 'block',
                      marginTop: 4,
                      background: '#F2F3F5',
                      padding: '6px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      wordBreak: 'break-all',
                      color: '#1F2329',
                    }}
                  >
                    {raw}
                  </code>
                </div>
              )}
              <div>
                查询的编号:
                <code
                  style={{
                    display: 'block',
                    marginTop: 4,
                    background: '#FFECE8',
                    padding: '6px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    color: '#A8261D',
                    wordBreak: 'break-all',
                  }}
                >
                  {code}
                </code>
              </div>
              <div style={{ marginTop: 10, color: '#86909C', fontSize: 11 }}>
                数据库里没有这条 asset_code。请检查 QR 是否对应已录入资产,或换码再试。
              </div>
            </div>
            <button
              onClick={() => setScanOpen(true)}
              style={{
                marginTop: 16,
                width: '100%',
                height: 44,
                borderRadius: 22,
                background: '#3370FF',
                color: '#fff',
                border: 'none',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              继续扫码
            </button>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Success banner */}
          <div
            style={{
              background: '#E8FFEA',
              color: '#00853E',
              padding: '10px 16px',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderBottom: '0.5px solid #BCEAC7',
            }}
          >
            <Icon name="check" size={16} color="#00853E" />
            <span>扫描成功</span>
          </div>

          {/* Asset header card */}
          <div style={{ padding: 16 }}>
            <div
              style={{
                background: '#fff',
                borderRadius: 14,
                padding: 16,
                boxShadow: '0 2px 12px rgba(31,35,41,0.04)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: '#86909C',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {data.asset.asset_code}
                </span>
                {(() => {
                  const meta = STATUS_META[data.asset.status] ?? {
                    label: data.asset.status,
                    color: '#86909C',
                    bg: '#F2F3F5',
                  }
                  return (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 10,
                        background: meta.bg,
                        color: meta.color,
                        fontWeight: 500,
                      }}
                    >
                      {meta.label}
                    </span>
                  )
                })()}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <AssetTypeIcon
                  icon={data.asset.asset_type_icon}
                  color={data.asset.asset_type_color}
                  size={44}
                  radius={10}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 600,
                      color: '#1F2329',
                      lineHeight: 1.3,
                    }}
                  >
                    {data.asset.brand_model || '(未填型号)'}
                  </div>
                  {(data.asset.asset_type_name || data.asset.spec) && (
                    <div style={{ fontSize: 12, color: '#86909C', marginTop: 4 }}>
                      {data.asset.asset_type_name
                        ? `${data.asset.asset_type_name}${data.asset.spec ? ' · ' : ''}`
                        : ''}
                      {data.asset.spec ?? ''}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Details */}
            <div
              style={{
                background: '#fff',
                borderRadius: 14,
                marginTop: 12,
                overflow: 'hidden',
              }}
            >
              <InfoRow
                label="责任人"
                value={
                  data.asset.owner_name ||
                  (data.asset.owner_user_id ? `#${data.asset.owner_user_id}` : '未分配')
                }
              />
              <InfoRow label="部门" value={data.asset.department_name} />
              <InfoRow label="位置" value={data.asset.location} />
              <InfoRow label="序列号" value={data.asset.serial_number} />
              <InfoRow label="采购日期" value={fmtDate(data.asset.purchase_date)} />
              <InfoRow
                label="保修到期"
                value={fmtDate(data.asset.warranty_expire_date)}
              />
              <InfoRow label="供应商" value={data.asset.supplier} />
              {data.asset.remark && (
                <InfoRow label="备注" value={data.asset.remark} multiline />
              )}
            </div>

            {/* Recent lifecycle (top 3) */}
            {data.lifecycle.length > 0 && (
              <div
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  marginTop: 12,
                  padding: '8px 0',
                }}
              >
                <div
                  style={{
                    padding: '8px 14px 4px',
                    fontSize: 12,
                    color: '#86909C',
                    fontWeight: 500,
                  }}
                >
                  最近变更
                </div>
                {data.lifecycle.slice(0, 3).map((log, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: '8px 14px',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#3370FF',
                      }}
                    />
                    <div style={{ flex: 1, fontSize: 12 }}>
                      <span style={{ color: '#1F2329', fontWeight: 500 }}>
                        {ACTION_CN[log.action] ?? log.action}
                      </span>
                      {log.from_status && log.to_status && (
                        <span style={{ color: '#86909C', marginLeft: 6 }}>
                          {log.from_status} → {log.to_status}
                        </span>
                      )}
                      {log.reason && (
                        <div style={{ color: '#86909C', marginTop: 2 }}>{log.reason}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: '#C9CDD4' }}>
                      {new Date(log.created_at).toLocaleDateString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginTop: 16,
              }}
            >
              <button
                onClick={() => navigate('/assets')}
                style={{
                  height: 44,
                  borderRadius: 22,
                  background: '#fff',
                  border: '1px solid #E5E6EB',
                  color: '#1F2329',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                查看完整详情
              </button>
              <button
                onClick={() => setScanOpen(true)}
                style={{
                  height: 44,
                  borderRadius: 22,
                  background: 'linear-gradient(135deg, #3370FF, #5B92FF)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(51,112,255,0.3)',
                }}
              >
                继续扫码
              </button>
            </div>
          </div>
        </>
      )}

      <CameraScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onCode={(c, rawNext) => {
          setScanOpen(false)
          // Replace current entry so back goes to home, not previous code
          navigate(`/m/admin/asset/${encodeURIComponent(c)}`, {
            replace: true,
            state: { raw: rawNext },
          })
        }}
      />
    </div>
  )
}
