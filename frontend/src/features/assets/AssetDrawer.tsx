import { useState } from 'react'
import {
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd'
import type { Dayjs } from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { AssetDetail } from './types'
import StatusBadge from './StatusBadge'
import Lifecycle from './Lifecycle'
import AccessoryTree from './AccessoryTree'
import AssetAttachments from './AssetAttachments'
import EmployeeSelect from '../users/EmployeeSelect'

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
  const [scrapOpen, setScrapOpen] = useState(false)
  const [scrapReason, setScrapReason] = useState('')
  const [repairOpen, setRepairOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [repairForm] = Form.useForm()
  const [completeForm] = Form.useForm()
  const [editOpen, setEditOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferUser, setTransferUser] = useState<number | null>(null)
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery<AssetDetail>({
    queryKey: ['asset', code],
    queryFn: async () => (await api.get(`/assets/${code}`)).data,
    enabled: !!code,
  })

  type RepairRow = {
    id: number
    created_at: string
    repair_type: 'in_house' | 'external'
    vendor: string | null
    reason: string
    status: 'open' | 'in_progress' | 'completed' | 'cancelled'
    cost: string | null
    resolution: string | null
  }
  const { data: repairOrders } = useQuery<RepairRow[]>({
    queryKey: ['asset-repairs', code],
    queryFn: async () => (await api.get(`/assets/${code}/repair-orders`)).data,
    enabled: !!code,
  })
  const openRepairOrder = repairOrders?.find(
    (r) => r.status === 'open' || r.status === 'in_progress',
  )

  const { data: qrSvg } = useQuery<string>({
    queryKey: ['asset-qr', code],
    queryFn: async () =>
      (await api.get(`/assets/${code}/qrcode`, { responseType: 'text' })).data,
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
      setTransferOpen(false)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '操作失败'),
  })

  const scrapReqMut = useMutation({
    mutationFn: async (reason: string) =>
      (await api.post(`/assets/${code}/scrap-request`, { reason })).data,
    onSuccess: () => {
      message.success('已提交报废申请,等待另一管理员审批')
      qc.invalidateQueries({ queryKey: ['asset', code] })
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['scrap-requests'] })
      setScrapOpen(false)
      setScrapReason('')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '提交失败'),
  })

  const invalidateRepair = () => {
    qc.invalidateQueries({ queryKey: ['asset', code] })
    qc.invalidateQueries({ queryKey: ['assets'] })
    qc.invalidateQueries({ queryKey: ['asset-repairs', code] })
    qc.invalidateQueries({ queryKey: ['repair-orders'] })
  }

  const openRepairMut = useMutation({
    mutationFn: async (body: object) =>
      (await api.post(`/assets/${code}/repair-order`, body)).data,
    onSuccess: () => {
      message.success('已开维修单,资产置维修中')
      invalidateRepair()
      setRepairOpen(false)
      repairForm.resetFields()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '开单失败'),
  })

  const completeRepairMut = useMutation({
    mutationFn: async (body: object) =>
      (await api.post(`/repair-orders/${openRepairOrder!.id}/complete`, body)).data,
    onSuccess: () => {
      message.success('维修单已完结,资产归还')
      invalidateRepair()
      setCompleteOpen(false)
      completeForm.resetFields()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '完结失败'),
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
          <Button onClick={() => setRepairOpen(true)}>报修</Button>
          <Button onClick={() => setTransferOpen(true)}>转移</Button>
          <Button onClick={() => act.mutate({ path: 'return' })}>归还入库</Button>
        </>
      )}
      {a.status === 'maintenance' && (
        openRepairOrder ? (
          <Button type="primary" onClick={() => setCompleteOpen(true)}>
            完结维修单
          </Button>
        ) : (
          <Button onClick={() => act.mutate({ path: 'return' })}>
            维修完成 · 归还入库
          </Button>
        )
      )}
      {a.status !== 'scrapped' && (
        <Button danger disabled={a.scrap_candidate} onClick={() => setScrapOpen(true)}>
          {a.scrap_candidate ? '报废申请进行中' : '申请报废'}
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
                key: 'qrcode',
                label: '二维码',
                children: (
                  <div style={{ padding: 24, textAlign: 'center' }}>
                    {qrSvg ? (
                      <>
                        <img
                          src={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`}
                          width={200}
                          height={200}
                          alt={`二维码 ${a.asset_code}`}
                          style={{ border: '1px solid var(--border)', borderRadius: 8 }}
                        />
                        <div
                          style={{ color: 'var(--text-3)', fontSize: 12, margin: '10px 0 16px' }}
                        >
                          扫码得资产编号{' '}
                          <span className="text-mono">{a.asset_code}</span>
                        </div>
                        <Button
                          onClick={() => {
                            const blob = new Blob([qrSvg], { type: 'image/svg+xml' })
                            const url = URL.createObjectURL(blob)
                            const el = document.createElement('a')
                            el.href = url
                            el.download = `${a.asset_code}.svg`
                            el.click()
                            URL.revokeObjectURL(url)
                          }}
                        >
                          下载 SVG
                        </Button>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-3)', fontSize: 13 }}>生成中…</span>
                    )}
                  </div>
                ),
              },
              {
                key: 'repairs',
                label: `维修记录 (${repairOrders?.length ?? 0})`,
                children: (
                  <Table<RepairRow>
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={repairOrders ?? []}
                    columns={[
                      {
                        title: '时间',
                        dataIndex: 'created_at',
                        render: (v: string) => v?.slice(0, 10),
                      },
                      {
                        title: '类型',
                        dataIndex: 'repair_type',
                        render: (v) => (v === 'external' ? '外送' : '内部修'),
                      },
                      {
                        title: '维修商 / 备注',
                        render: (_, r) => r.vendor ?? r.reason,
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        render: (v: RepairRow['status']) => {
                          const m = {
                            open: { c: 'gold', l: '已报修' },
                            in_progress: { c: 'blue', l: '维修中' },
                            completed: { c: 'green', l: '已完结' },
                            cancelled: { c: 'default', l: '已取消' },
                          }[v]
                          return <Tag color={m.c}>{m.l}</Tag>
                        },
                      },
                      {
                        title: '费用 / 解决',
                        render: (_, r) =>
                          r.cost || r.resolution
                            ? `${r.cost ? '¥' + r.cost : ''} ${r.resolution ?? ''}`
                            : '—',
                      },
                    ]}
                  />
                ),
              },
              {
                key: 'attachments',
                label: '附件 / 照片',
                children: <AssetAttachments code={a.asset_code} />,
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
            <div style={{ marginBottom: 8, color: 'var(--text-2)' }}>选择员工</div>
            <EmployeeSelect value={assignUser} onChange={setAssignUser} />
          </Modal>

          <Modal
            open={transferOpen}
            title="转移给其他员工"
            onCancel={() => setTransferOpen(false)}
            onOk={() =>
              transferUser
                ? act.mutate({ path: 'transfer', body: { to_user_id: transferUser } })
                : message.warning('请输入接收员工 ID')
            }
            confirmLoading={act.isPending}
          >
            <div style={{ marginBottom: 8, color: 'var(--text-2)' }}>选择接收员工</div>
            <EmployeeSelect value={transferUser} onChange={setTransferUser} placeholder="搜索姓名 / 邮箱选择接收员工" />
          </Modal>

          <Modal
            open={scrapOpen}
            title={`申请报废 · ${a.asset_code}`}
            onCancel={() => setScrapOpen(false)}
            onOk={() =>
              scrapReason.trim()
                ? scrapReqMut.mutate(scrapReason.trim())
                : message.warning('请填写报废原因')
            }
            confirmLoading={scrapReqMut.isPending}
            okText="提交申请"
            cancelText="取消"
          >
            <div style={{ marginBottom: 8, color: 'var(--text-2)' }}>报废原因</div>
            <Input.TextArea
              rows={3}
              value={scrapReason}
              onChange={(e) => setScrapReason(e.target.value)}
              placeholder="如:硬盘损坏无法点亮;已超 10 年;摔机屏幕碎裂等"
            />
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
              提交后,需另一位 IT/财务管理员在「资产报废」页批准与录入处置方式,
              资产才会真正变为已报废。
            </div>
          </Modal>

          <Modal
            open={repairOpen}
            title={`报修 · ${a.asset_code}`}
            onCancel={() => setRepairOpen(false)}
            onOk={() => repairForm.submit()}
            confirmLoading={openRepairMut.isPending}
            okText="开维修单"
            cancelText="取消"
            destroyOnClose
          >
            <Form
              form={repairForm}
              layout="vertical"
              initialValues={{ repair_type: 'in_house' }}
              onFinish={(v: Record<string, unknown>) => {
                const body: Record<string, unknown> = { ...v }
                for (const k of ['shipped_at', 'expected_return_at']) {
                  if (body[k]) body[k] = (body[k] as Dayjs).format('YYYY-MM-DD')
                }
                openRepairMut.mutate(body)
              }}
            >
              <Form.Item name="reason" label="报修原因" rules={[{ required: true }]}>
                <Input.TextArea rows={2} placeholder="如:键盘 B 键失灵" />
              </Form.Item>
              <Form.Item name="repair_type" label="类型" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'in_house', label: '内部修' },
                    { value: 'external', label: '外送维修商' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="vendor" label="维修商(外送必填)">
                <Input placeholder="如 Apple 上海店" />
              </Form.Item>
              <div style={{ display: 'flex', gap: 12 }}>
                <Form.Item name="shipped_at" label="送修日" style={{ flex: 1 }}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="expected_return_at" label="预计回" style={{ flex: 1 }}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </div>
              <Form.Item name="note" label="备注">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Form>
          </Modal>

          <Modal
            open={completeOpen}
            title={`完结维修单 · ${a.asset_code}`}
            onCancel={() => setCompleteOpen(false)}
            onOk={() => completeForm.submit()}
            confirmLoading={completeRepairMut.isPending}
            okText="完结"
            cancelText="取消"
            destroyOnClose
          >
            <Form
              form={completeForm}
              layout="vertical"
              initialValues={{ warranty_covered: false }}
              onFinish={(v: Record<string, unknown>) => {
                const body: Record<string, unknown> = { ...v }
                if (body.warranty_until)
                  body.warranty_until = (body.warranty_until as Dayjs).format('YYYY-MM-DD')
                completeRepairMut.mutate(body)
              }}
            >
              <Form.Item name="resolution" label="解决说明" rules={[{ required: true }]}>
                <Input.TextArea rows={2} placeholder="如:更换键盘模组,清灰" />
              </Form.Item>
              <Form.Item name="cost" label="费用(¥,可空)">
                <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
              </Form.Item>
              <div style={{ display: 'flex', gap: 12 }}>
                <Form.Item name="warranty_covered" label="保修内" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name="warranty_until" label="新保修截止" style={{ flex: 1 }}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </div>
            </Form>
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
