import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import CameraScanner from '../../../features/scanner/CameraScanner'
import AssetTypeIcon from '../../../components/AssetTypeIcon'
import Icon from '../../../components/Icon'
import { MobileFormShell, FormCard, Field, TextInput, TextArea, ScanSuffix } from './mobileFormKit'

interface AssetTypeOption {
  id: number
  name: string
  code_prefix: string
  asset_class: 'personal' | 'infrastructure'
  icon: string | null
  color: string | null
}

interface AssetOut {
  asset_code: string
  asset_type_id: number | null
  asset_class: 'personal' | 'infrastructure'
  brand_model: string | null
  spec: string | null
  serial_number: string | null
  owner_name: string | null
  department_name: string | null
  location: string | null
  supplier: string | null
  purchase_date: string | null
  purchase_price: string | null
  warranty_expire_date: string | null
  remark: string | null
}
interface AssetDetail {
  asset: AssetOut
}

interface FormState {
  brand_model: string
  spec: string
  serial_number: string
  owner_name: string
  department_name: string
  location: string
  supplier: string
  purchase_date: string
  warranty_expire_date: string
  purchase_price: string
  remark: string
}

export default function MobileAdminAssetEdit() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  // Asset-type change is tracked separately from the text form: changing it
  // hits a dedicated endpoint (and may re-code the asset).
  const [typeId, setTypeId] = useState<number | null>(null)
  const [typeSheet, setTypeSheet] = useState(false)

  const { data, isLoading } = useQuery<AssetDetail>({
    queryKey: ['m-admin-asset', code],
    queryFn: async () => (await api.get(`/assets/${encodeURIComponent(code)}`)).data,
    enabled: !!code,
  })
  const { data: types } = useQuery<AssetTypeOption[]>({
    queryKey: ['asset-types'],
    queryFn: async () => (await api.get('/asset-types')).data,
  })
  const asset = data?.asset
  const isInfra = asset?.asset_class === 'infrastructure'
  const selectedType = types?.find((t) => t.id === typeId) ?? null

  // Seed the form once the asset loads.
  useEffect(() => {
    if (asset && form === null) {
      setTypeId(asset.asset_type_id)
      setForm({
        brand_model: asset.brand_model ?? '',
        spec: asset.spec ?? '',
        serial_number: asset.serial_number ?? '',
        owner_name: asset.owner_name ?? '',
        department_name: asset.department_name ?? '',
        location: asset.location ?? '',
        supplier: asset.supplier ?? '',
        purchase_date: asset.purchase_date ?? '',
        warranty_expire_date: asset.warranty_expire_date ?? '',
        purchase_price: asset.purchase_price ? String(asset.purchase_price) : '',
        remark: asset.remark ?? '',
      })
    }
  }, [asset, form])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f))

  const saveMut = useMutation({
    mutationFn: async (): Promise<string> => {
      if (!form) return code
      const body: Record<string, unknown> = {}
      const textKeys: (keyof FormState)[] = [
        'brand_model', 'spec', 'serial_number', 'location', 'supplier',
        'purchase_date', 'warranty_expire_date', 'remark',
      ]
      for (const k of textKeys) {
        const v = form[k].trim()
        body[k] = v === '' ? null : v
      }
      body.purchase_price = form.purchase_price.trim()
        ? Number(form.purchase_price)
        : null
      // owner_name / department_name only apply to infrastructure — the backend
      // ignores them on personal assets (those use assign/transfer).
      if (isInfra) {
        body.owner_name = form.owner_name.trim() || null
        body.department_name = form.department_name.trim() || null
      }
      await api.put(`/assets/${encodeURIComponent(code)}`, body)
      // Type change goes through its own endpoint and may re-code the asset
      // (new prefix → new sequence number). Do it after the field PUT, which
      // still uses the old code.
      let finalCode = code
      if (typeId != null && typeId !== asset?.asset_type_id) {
        const updated = (
          await api.post(`/assets/${encodeURIComponent(code)}/change-type`, {
            asset_type_id: typeId,
          })
        ).data as { asset_code: string }
        finalCode = updated.asset_code
      }
      return finalCode
    },
    onSuccess: (finalCode: string) => {
      message.success(finalCode !== code ? `已保存,编号更新为 ${finalCode}` : '已保存')
      qc.invalidateQueries({ queryKey: ['m-admin-asset', code] })
      qc.invalidateQueries({ queryKey: ['m-admin-assets'] })
      qc.invalidateQueries({ queryKey: ['assets'] })
      navigate(`/m/admin/asset/${encodeURIComponent(finalCode)}`, { replace: true })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '保存失败'),
  })

  // Warn before a re-code (changing to a type with a different code prefix).
  const onSave = () => {
    if (typeId != null && asset && typeId !== asset.asset_type_id) {
      const newType = types?.find((t) => t.id === typeId)
      const oldPrefix = code.split('-')[0].toUpperCase()
      const willRecode = !!newType && newType.code_prefix.toUpperCase() !== oldPrefix
      const ok = window.confirm(
        willRecode
          ? `编号将按新类型前缀重新生成(${code} → ${newType!.code_prefix}-…),原实物标签作废、需重新打印。确认更改?`
          : '确认更改资产类型?',
      )
      if (!ok) return
    }
    saveMut.mutate()
  }

  if (isLoading || !form) {
    return (
      <MobileFormShell
        title="编辑资产"
        onBack={() => navigate(-1)}
        onSave={() => {}}
        saveDisabled
      >
        <div style={{ padding: 40, textAlign: 'center', color: '#86909C', fontSize: 13 }}>
          加载中…
        </div>
      </MobileFormShell>
    )
  }

  return (
    <MobileFormShell
      title={`编辑 · ${code}`}
      onBack={() => navigate(-1)}
      onSave={onSave}
      saving={saveMut.isPending}
    >
      <FormCard>
        <Field
          label="资产类型"
          hint="改类型会同步 个人/基础设施 类别;换前缀会重新生成编号"
          last
        >
          <button
            type="button"
            onClick={() => setTypeSheet(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {selectedType ? (
              <>
                <AssetTypeIcon icon={selectedType.icon} color={selectedType.color} size={32} />
                <span style={{ fontSize: 15, color: '#1F2329' }}>
                  {selectedType.name}
                  <span style={{ color: '#86909C', fontSize: 12, marginLeft: 6 }}>
                    {selectedType.code_prefix} ·{' '}
                    {selectedType.asset_class === 'personal' ? '个人发放' : '基础设施'}
                  </span>
                </span>
              </>
            ) : (
              <span style={{ fontSize: 15, color: '#C9CDD4' }}>选择资产类型</span>
            )}
            <span style={{ marginLeft: 'auto' }}>
              <Icon name="chevronRight" size={16} color="#C9CDD4" />
            </span>
          </button>
        </Field>
      </FormCard>

      <FormCard>
        <Field label="品牌型号">
          <TextInput value={form.brand_model} onChange={(v) => set('brand_model', v)} />
        </Field>
        <Field label="配置">
          <TextInput value={form.spec} onChange={(v) => set('spec', v)} />
        </Field>
        <Field label="序列号" last>
          <TextInput
            value={form.serial_number}
            onChange={(v) => set('serial_number', v)}
            placeholder="可扫码录入"
            suffix={<ScanSuffix onClick={() => setScanOpen(true)} />}
          />
        </Field>
      </FormCard>

      {/* Owner: editable text only for infrastructure; personal is directory-managed */}
      {isInfra ? (
        <FormCard>
          <Field label="责任人(文本)">
            <TextInput value={form.owner_name} onChange={(v) => set('owner_name', v)} />
          </Field>
          <Field label="部门" last>
            <TextInput value={form.department_name} onChange={(v) => set('department_name', v)} />
          </Field>
        </FormCard>
      ) : (
        <FormCard>
          <Field
            label="责任人 / 部门"
            hint="个人资产的责任人随分配的员工维护,如需变更请在详情页用 分配 / 转移"
            last
          >
            <div style={{ fontSize: 15, color: '#86909C' }}>
              {asset?.owner_name ?? '未分配'}
              {asset?.department_name ? ` · ${asset.department_name}` : ''}
            </div>
          </Field>
        </FormCard>
      )}

      <FormCard>
        <Field label="存放地点">
          <TextInput value={form.location} onChange={(v) => set('location', v)} />
        </Field>
        <Field label="供应商">
          <TextInput value={form.supplier} onChange={(v) => set('supplier', v)} />
        </Field>
        <Field label="采购日期">
          <TextInput
            value={form.purchase_date}
            onChange={(v) => set('purchase_date', v)}
            type="date"
          />
        </Field>
        <Field label="保修到期">
          <TextInput
            value={form.warranty_expire_date}
            onChange={(v) => set('warranty_expire_date', v)}
            type="date"
          />
        </Field>
        <Field label="采购价(元)">
          <TextInput
            value={form.purchase_price}
            onChange={(v) => set('purchase_price', v)}
            type="number"
            inputMode="decimal"
          />
        </Field>
        <Field label="备注" last>
          <TextArea value={form.remark} onChange={(v) => set('remark', v)} />
        </Field>
      </FormCard>

      {/* Type picker bottom sheet */}
      {typeSheet && (
        <div
          onClick={() => setTypeSheet(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(31,35,41,0.45)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '70dvh',
              background: '#fff',
              borderRadius: '16px 16px 0 0',
              overflowY: 'auto',
              paddingBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E6EB' }} />
            </div>
            <div style={{ padding: '4px 16px 8px', fontSize: 14, fontWeight: 600 }}>
              选择资产类型
            </div>
            {(types ?? []).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTypeId(t.id)
                  setTypeSheet(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '10px 16px',
                  border: 'none',
                  background: t.id === typeId ? '#F2F7FF' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <AssetTypeIcon icon={t.icon} color={t.color} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: '#1F2329' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: '#86909C' }}>
                    {t.code_prefix} · {t.asset_class === 'personal' ? '个人发放' : '基础设施'}
                  </div>
                </div>
                {t.id === typeId && <Icon name="check" size={16} color="#3370FF" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <CameraScanner
        open={scanOpen}
        mode="raw"
        title="扫描序列号条形码"
        hint="将设备序列号条形码对准取景框,识别后自动填入。"
        onClose={() => setScanOpen(false)}
        onCode={(_c, raw) => {
          set('serial_number', raw)
          setScanOpen(false)
          message.success('序列号已填入')
        }}
      />
    </MobileFormShell>
  )
}
