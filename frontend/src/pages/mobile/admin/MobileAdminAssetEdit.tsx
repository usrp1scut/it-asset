import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import CameraScanner from '../../../features/scanner/CameraScanner'
import { MobileFormShell, FormCard, Field, TextInput, TextArea, ScanSuffix } from './mobileFormKit'

interface AssetOut {
  asset_code: string
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

  const { data, isLoading } = useQuery<AssetDetail>({
    queryKey: ['m-admin-asset', code],
    queryFn: async () => (await api.get(`/assets/${encodeURIComponent(code)}`)).data,
    enabled: !!code,
  })
  const asset = data?.asset
  const isInfra = asset?.asset_class === 'infrastructure'

  // Seed the form once the asset loads.
  useEffect(() => {
    if (asset && form === null) {
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
    mutationFn: async () => {
      if (!form) return
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
      return (await api.put(`/assets/${encodeURIComponent(code)}`, body)).data
    },
    onSuccess: () => {
      message.success('已保存')
      qc.invalidateQueries({ queryKey: ['m-admin-asset', code] })
      qc.invalidateQueries({ queryKey: ['m-admin-assets'] })
      qc.invalidateQueries({ queryKey: ['assets'] })
      navigate(`/m/admin/asset/${encodeURIComponent(code)}`, { replace: true })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '保存失败'),
  })

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
      onSave={() => saveMut.mutate()}
      saving={saveMut.isPending}
    >
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
