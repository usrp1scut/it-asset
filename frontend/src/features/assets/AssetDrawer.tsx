import { useState } from 'react'
import {
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Switch,
  Tabs,
  message,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { AssetDetail } from './types'
import StatusBadge from './StatusBadge'
import Lifecycle from './Lifecycle'
import AccessoryTree from './AccessoryTree'

export default function AssetDrawer({
  code,
  onClose,
}: {
  code: string | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignUser, setAssignUser] = useState<number | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery<AssetDetail>({
    queryKey: ['asset', code],
    queryFn: async () => (await api.get(`/assets/${code}`)).data,
    enabled: !!code,
  })

  const act = useMutation({
    mutationFn: async (p: { path: string; body?: object }) =>
      (await api.post(`/assets/${code}/${p.path}`, p.body ?? {})).data,
    onSuccess: () => {
      message.success('操作成功')
      qc.invalidateQueries({ queryKey: ['asset', code] })
      qc.invalidateQueries({ queryKey: ['assets'] })
      setAssignOpen(false)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '操作失败'),
  })

  const editMut = useMutation({
    mutationFn: async (body: object) => (await api.put(`/assets/${code}`, body)).data,
    onSuccess: () => {
      message.success('已保存')
      qc.invalidateQueries({ queryKey: ['asset', code] })
      qc.invalidateQueries({ queryKey: ['assets'] })
      setEditOpen(false)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '保存失败'),
  })

  const a = data?.asset

  const openEdit = () => {
    if (!a) return
    form.setFieldsValue({
      brand_model: a.brand_model ?? '',
      spec: a.spec ?? '',
      serial_number: a.serial_number ?? '',
      owner_name: a.owner_name ?? '',
      department_name: a.department_name ?? '',
      location: a.location ?? '',
      purchase_date: a.purchase_date ?? '',
      purchase_price: a.purchase_price ? Number(a.purchase_price) : undefined,
      warranty_expire_date: a.warranty_expire_date ?? '',
      supplier: a.supplier ?? '',
      remark: a.remark ?? '',
      scrap_candidate: a.scrap_candidate,
      needs_review: a.needs_review,
    })
    setEditOpen(true)
  }

  const submitEdit = (v: Record<string, unknown>) => {
    const body: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) {
      body[k] = val === '' ? null : val
    }
    editMut.mutate(body)
  }

  const footer = a && (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <Button onClick={openEdit}>编辑</Button>
      <div style={{ display: 'flex', gap: 8 }}>
      {a.status === 'idle' && a.asset_class === 'personal' && (
        <Button type="primary" onClick={() => setAssignOpen(true)}>
          分配给员工
        </Button>
      )}
      {a.status === 'in_use' && (
        <>
          <Button onClick={() => act.mutate({ path: 'repair' })}>报修</Button>
          <Button onClick={() => act.mutate({ path: 'return' })}>归还入库</Button>
        </>
      )}
      {a.status === 'maintenance' && (
        <Button onClick={() => act.mutate({ path: 'return' })}>维修完成 · 归还入库</Button>
      )}
      {a.status !== 'scrapped' && (
        <Button danger onClick={() => act.mutate({ path: 'scrap' })}>
          申请报废
        </Button>
      )}
      </div>
    </div>
  )

  return (
    <Drawer
      open={!!code}
      onClose={onClose}
      width={780}
      title="资产详情"
      footer={footer}
      loading={isLoading}
    >
      {a && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 20,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #F5F9FF 0%, #FAFBFC 100%)',
              border: '1px solid var(--border)',
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span
                  className="text-mono"
                  style={{
                    fontSize: 12,
                    color: 'var(--lark-blue)',
                    fontWeight: 500,
                    padding: '2px 6px',
                    background: 'var(--lark-blue-bg)',
                    borderRadius: 3,
                  }}
                >
                  {a.asset_code}
                </span>
                <StatusBadge status={a.status} />
                {a.scrap_candidate && (
                  <span
                    style={{ fontSize: 11, color: '#A8261D', background: '#FFECE8', padding: '1px 6px', borderRadius: 3 }}
                  >
                    报废候选
                  </span>
                )}
                {a.needs_review && (
                  <span style={{ fontSize: 11, color: '#A66200', background: '#FFF7E8', padding: '1px 6px', borderRadius: 3 }}>
                    待核
                  </span>
                )}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{a.brand_model ?? a.asset_code}</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
                {a.spec ?? '—'} · SN <span className="text-mono">{a.serial_number ?? '无'}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>采购价</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {a.purchase_price ? `¥ ${Number(a.purchase_price).toLocaleString()}` : '—'}
              </div>
            </div>
          </div>

          <Tabs
            items={[
              {
                key: 'info',
                label: '基本信息',
                children: (
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label="资产类别">
                      {a.asset_class === 'personal' ? '个人发放' : '基础设施'}
                    </Descriptions.Item>
                    <Descriptions.Item label="责任人">
                      {a.owner_name ?? (a.owner_user_id ? `#${a.owner_user_id}` : '未分配')}
                    </Descriptions.Item>
                    <Descriptions.Item label="部门">
                      {a.department_name ?? '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="存放地点">{a.location ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="采购日期">{a.purchase_date ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="保修截止">
                      {a.warranty_expire_date ?? '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="旧编号">{a.legacy_code ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="供应商">{a.supplier ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="备注" span={2}>
                      {a.remark ?? '—'}
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'lifecycle',
                label: `生命周期 (${data.lifecycle.length})`,
                children: <Lifecycle events={data.lifecycle} />,
              },
              {
                key: 'accessories',
                label: `配件绑定 (${data.accessories.length})`,
                children: <AccessoryTree main={a} accessories={data.accessories} />,
              },
              {
                key: 'attachments',
                label: '附件 / 照片',
                children: (
                  <div style={{ color: 'var(--text-3)', fontSize: 13, padding: 24 }}>
                    附件上传将在后续 Sprint 接入对象存储。
                  </div>
                ),
              },
            ]}
          />

          <Modal
            open={assignOpen}
            title="分配给员工"
            onCancel={() => setAssignOpen(false)}
            onOk={() =>
              assignUser
                ? act.mutate({ path: 'assign', body: { user_id: assignUser } })
                : message.warning('请输入员工 ID')
            }
            confirmLoading={act.isPending}
          >
            <div style={{ marginBottom: 8, color: 'var(--text-2)' }}>员工用户 ID</div>
            <InputNumber
              style={{ width: '100%' }}
              value={assignUser ?? undefined}
              onChange={(v) => setAssignUser(v as number | null)}
            />
          </Modal>

          <Modal
            open={editOpen}
            title={`编辑 · ${a.asset_code}`}
            width={620}
            onCancel={() => setEditOpen(false)}
            onOk={() => form.submit()}
            confirmLoading={editMut.isPending}
            destroyOnClose
          >
            <Form form={form} layout="vertical" onFinish={submitEdit}>
              <div style={{ display: 'flex', gap: 12 }}>
                <Form.Item name="brand_model" label="品牌型号" style={{ flex: 1 }}>
                  <Input />
                </Form.Item>
                <Form.Item name="serial_number" label="序列号" style={{ flex: 1 }}>
                  <Input />
                </Form.Item>
              </div>
              <Form.Item name="spec" label="配置">
                <Input />
              </Form.Item>
              <div style={{ display: 'flex', gap: 12 }}>
                <Form.Item name="owner_name" label="责任人(文本)" style={{ flex: 1 }}>
                  <Input />
                </Form.Item>
                <Form.Item name="department_name" label="部门" style={{ flex: 1 }}>
                  <Input />
                </Form.Item>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <Form.Item name="location" label="存放地点" style={{ flex: 1 }}>
                  <Input />
                </Form.Item>
                <Form.Item name="supplier" label="供应商" style={{ flex: 1 }}>
                  <Input />
                </Form.Item>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <Form.Item name="purchase_date" label="采购日期 (YYYY-MM-DD)" style={{ flex: 1 }}>
                  <Input placeholder="2025-01-15" />
                </Form.Item>
                <Form.Item name="warranty_expire_date" label="保修截止 (YYYY-MM-DD)" style={{ flex: 1 }}>
                  <Input placeholder="2027-01-15" />
                </Form.Item>
                <Form.Item name="purchase_price" label="采购价" style={{ flex: 1 }}>
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </div>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} />
              </Form.Item>
              <div style={{ display: 'flex', gap: 24 }}>
                <Form.Item name="scrap_candidate" label="报废候选" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name="needs_review" label="待核" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </div>
            </Form>
          </Modal>
        </>
      )}
    </Drawer>
  )
}
