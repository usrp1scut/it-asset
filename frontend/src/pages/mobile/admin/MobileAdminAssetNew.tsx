import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import Icon from '../../../components/Icon'
import AssetTypeIcon from '../../../components/AssetTypeIcon'
import CameraScanner from '../../../features/scanner/CameraScanner'
import { MobileFormShell, FormCard, Field, TextInput, TextArea, ScanSuffix } from './mobileFormKit'

interface AssetTypeOption {
  id: number
  name: string
  code_prefix: string
  asset_class: 'personal' | 'infrastructure'
  icon: string | null
  color: string | null
}

interface FormState {
  asset_type_id: number | null
  brand_model: string
  spec: string
  serial_number: string
  owner_name: string
  location: string
  supplier: string
  purchase_date: string
  purchase_price: string
  remark: string
}

const EMPTY: FormState = {
  asset_type_id: null,
  brand_model: '',
  spec: '',
  serial_number: '',
  owner_name: '',
  location: '',
  supplier: '',
  purchase_date: '',
  purchase_price: '',
  remark: '',
}

export default function MobileAdminAssetNew() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [typeSheet, setTypeSheet] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const { data: types } = useQuery<AssetTypeOption[]>({
    queryKey: ['asset-types'],
    queryFn: async () => (await api.get('/asset-types')).data,
  })
  const selectedType = types?.find((t) => t.id === form.asset_type_id) ?? null

  const createMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { asset_type_id: form.asset_type_id }
      const text: (keyof FormState)[] = [
        'brand_model', 'spec', 'serial_number', 'owner_name',
        'location', 'supplier', 'purchase_date', 'remark',
      ]
      for (const k of text) {
        const v = (form[k] as string).trim()
        if (v) body[k] = v
      }
      if (form.purchase_price.trim()) body.purchase_price = Number(form.purchase_price)
      return (await api.post('/assets', body)).data as { asset_code: string }
    },
    onSuccess: (a) => {
      message.success(`已创建 ${a.asset_code}`)
      qc.invalidateQueries({ queryKey: ['m-admin-assets'] })
      qc.invalidateQueries({ queryKey: ['assets'] })
      navigate(`/m/admin/asset/${encodeURIComponent(a.asset_code)}`, { replace: true })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '创建失败'),
  })

  const submit = () => {
    if (!form.asset_type_id) {
      message.warning('请先选择资产类型')
      return
    }
    createMut.mutate()
  }

  return (
    <MobileFormShell
      title="新增资产"
      onBack={() => navigate(-1)}
      onSave={submit}
      saving={createMut.isPending}
      saveLabel="创建资产"
      saveDisabled={!form.asset_type_id}
    >
      <FormCard>
        {/* Type picker row */}
        <Field label="资产类型" required hint="决定编号前缀与 个人/基础设施 类别">
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
              <span style={{ fontSize: 15, color: '#C9CDD4' }}>请选择资产类型</span>
            )}
            <span style={{ marginLeft: 'auto' }}>
              <Icon name="chevronRight" size={16} color="#C9CDD4" />
            </span>
          </button>
        </Field>
      </FormCard>

      <FormCard>
        <Field label="品牌型号">
          <TextInput
            value={form.brand_model}
            onChange={(v) => set('brand_model', v)}
            placeholder="如 Apple MacBook Pro 14"
          />
        </Field>
        <Field label="配置">
          <TextInput
            value={form.spec}
            onChange={(v) => set('spec', v)}
            placeholder="如 M3 Pro-18g-512g"
          />
        </Field>
        <Field label="序列号">
          <TextInput
            value={form.serial_number}
            onChange={(v) => set('serial_number', v)}
            placeholder="可扫码录入"
            suffix={<ScanSuffix onClick={() => setScanOpen(true)} />}
          />
        </Field>
        <Field label="责任人(文本)" last>
          <TextInput
            value={form.owner_name}
            onChange={(v) => set('owner_name', v)}
            placeholder="姓名(可空,基础设施留空)"
          />
        </Field>
      </FormCard>

      <FormCard>
        <Field label="存放地点">
          <TextInput
            value={form.location}
            onChange={(v) => set('location', v)}
            placeholder="如 上海·张江 / 3F 弱电间"
          />
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
        <Field label="采购价(元)">
          <TextInput
            value={form.purchase_price}
            onChange={(v) => set('purchase_price', v)}
            type="number"
            inputMode="decimal"
            placeholder="0"
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
                  set('asset_type_id', t.id)
                  setTypeSheet(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '10px 16px',
                  border: 'none',
                  background: t.id === form.asset_type_id ? '#F2F7FF' : 'transparent',
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
                {t.id === form.asset_type_id && <Icon name="check" size={16} color="#3370FF" />}
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
