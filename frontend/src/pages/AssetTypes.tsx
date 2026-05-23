import { useState } from 'react'
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

interface AssetType {
  id: number
  name: string
  code_prefix: string
  asset_class: 'personal' | 'infrastructure'
  depreciation_years: number | null
  asset_count: number
}

const CLASS_META: Record<string, { color: string; label: string }> = {
  personal: { color: 'blue', label: '个人发放' },
  infrastructure: { color: 'purple', label: '基础设施' },
}

export default function AssetTypes() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<null | 'new' | AssetType>(null)
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery<AssetType[]>({
    queryKey: ['asset-types'],
    queryFn: async () => (await api.get('/asset-types')).data,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['asset-types'] })

  const mut = useMutation({
    mutationFn: async (v: Record<string, unknown>) => {
      if (modal === 'new') return (await api.post('/asset-types', v)).data
      return (await api.put(`/asset-types/${(modal as AssetType).id}`, v)).data
    },
    onSuccess: () => {
      message.success(modal === 'new' ? '类型已创建' : '类型已更新')
      invalidate()
      setModal(null)
      form.resetFields()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '操作失败'),
  })

  const delMut = useMutation({
    mutationFn: async (id: number) => api.delete(`/asset-types/${id}`),
    onSuccess: () => {
      message.success('类型已删除')
      invalidate()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '删除失败'),
  })

  const backfillMut = useMutation({
    mutationFn: async () =>
      (await api.post('/asset-types/backfill-assets')).data as {
        scanned: number
        updated: number
        ambiguous: number
        no_match: number
      },
    onSuccess: (s) => {
      message.success(
        `扫描 ${s.scanned} 项,绑定 ${s.updated} 项;歧义 ${s.ambiguous},无匹配 ${s.no_match}`,
        6,
      )
      invalidate()
      qc.invalidateQueries({ queryKey: ['assets'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '回填失败'),
  })

  const openEdit = (t: AssetType) => {
    setModal(t)
    form.setFieldsValue({
      name: t.name,
      code_prefix: t.code_prefix,
      asset_class: t.asset_class,
      depreciation_years: t.depreciation_years ?? undefined,
    })
  }

  const columns: ColumnsType<AssetType> = [
    {
      title: '编号前缀',
      dataIndex: 'code_prefix',
      render: (v) => <Tag className="text-mono">{v}</Tag>,
    },
    { title: '名称', dataIndex: 'name' },
    {
      title: '类别',
      dataIndex: 'asset_class',
      render: (v: string) => (
        <Tag color={CLASS_META[v]?.color}>{CLASS_META[v]?.label ?? v}</Tag>
      ),
    },
    {
      title: '折旧年限',
      dataIndex: 'depreciation_years',
      render: (v: number | null) => (v ? `${v} 年` : '—'),
    },
    {
      title: '资产数量',
      dataIndex: 'asset_count',
      render: (n: number) => <Tag color={n > 0 ? 'blue' : 'default'}>{n}</Tag>,
    },
    {
      title: '操作',
      render: (_, r) => (
        <Space>
          <Button size="small" type="link" onClick={() => openEdit(r)}>
            编辑
          </Button>
          {r.asset_count === 0 ? (
            <Popconfirm
              title={`删除类型「${r.name}」?`}
              onConfirm={() => delMut.mutate(r.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" type="link" danger>
                删除
              </Button>
            </Popconfirm>
          ) : (
            <Button
              size="small"
              type="link"
              danger
              onClick={() =>
                message.warning(
                  `该类型下还有 ${r.asset_count} 个资产,请先转走再删除`,
                )
              }
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ marginTop: 0 }}>资产类型</h2>
        <Space>
          <Popconfirm
            title="为未关联类型的旧资产按编号前缀回填类型?"
            description="只处理 asset_type_id 为空的资产;歧义或无匹配会跳过。"
            onConfirm={() => backfillMut.mutate()}
            okText="开始回填"
            cancelText="取消"
          >
            <Button loading={backfillMut.isPending}>回填旧资产类型</Button>
          </Popconfirm>
          <Button type="primary" onClick={() => setModal('new')}>
            新建类型
          </Button>
        </Space>
      </div>
      <Table<AssetType>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={data ?? []}
        pagination={false}
      />

      <Modal
        open={modal !== null}
        title={modal === 'new' ? '新建类型' : '编辑类型'}
        onCancel={() => {
          setModal(null)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        confirmLoading={mut.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ asset_class: 'personal' }}
          onFinish={(v) => mut.mutate(v)}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="如 笔记本电脑" />
          </Form.Item>
          <Form.Item
            name="code_prefix"
            label="编号前缀(自动大写;资产编号将以此为前缀,如 PC-0001)"
            rules={[
              { required: true },
              { pattern: /^[A-Za-z0-9]{1,16}$/, message: '1-16 位字母或数字' },
            ]}
          >
            <Input placeholder="PC" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="asset_class" label="资产类别" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'personal', label: '个人发放' },
                { value: 'infrastructure', label: '基础设施' },
              ]}
            />
          </Form.Item>
          <Form.Item name="depreciation_years" label="折旧年限(可空)">
            <InputNumber min={1} max={50} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
