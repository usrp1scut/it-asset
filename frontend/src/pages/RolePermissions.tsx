import { useEffect, useState } from 'react'
import { Button, Checkbox, Spin, Tag, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

interface ModuleDef {
  key: string
  label: string
  section: string
  actions: string[]
  mode: 'config' | 'locked' | 'pinned'
}
interface Grant { can_view: boolean; can_manage: boolean }
interface Matrix {
  modules: ModuleDef[]
  roles: string[]
  grants: Record<string, Record<string, Grant>>
}

const ROLE_LABEL: Record<string, string> = {
  manager: '经理', it_admin: 'IT', procurement: '采购', finance: '财务', hr: 'HR',
}
const MODE_TAG: Record<string, { text: string; color: string }> = {
  locked: { text: '锁定', color: 'default' },
  pinned: { text: '流程固定', color: 'default' },
}

type Grants = Record<string, Record<string, Grant>>

export default function RolePermissions() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Matrix>({
    queryKey: ['role-permissions'],
    queryFn: async () => (await api.get('/role-permissions')).data,
  })
  const [grants, setGrants] = useState<Grants>({})
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (data) { setGrants(structuredClone(data.grants)); setDirty(false) }
  }, [data])

  const save = useMutation({
    mutationFn: async () => {
      const changes = (data?.modules ?? [])
        .filter((m) => m.mode === 'config')
        .flatMap((m) =>
          (data?.roles ?? []).map((r) => ({
            role: r,
            module: m.key,
            can_view: grants[m.key][r].can_view,
            can_manage: grants[m.key][r].can_manage,
          })),
        )
      return (await api.put('/role-permissions', { changes })).data
    },
    onSuccess: () => {
      message.success('权限已保存')
      qc.invalidateQueries({ queryKey: ['role-permissions'] })
      qc.invalidateQueries({ queryKey: ['my-permissions'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail ?? '保存失败'),
  })

  const toggle = (mod: string, role: string, action: 'view' | 'manage', on: boolean) => {
    setGrants((prev) => {
      const next = structuredClone(prev)
      const g = next[mod][role]
      if (action === 'view') {
        g.can_view = on
        if (!on) g.can_manage = false          // 收回查看 → 一并收回管理
      } else {
        g.can_manage = on
        if (on) g.can_view = true              // 授予管理 → 自动带查看
      }
      return next
    })
    setDirty(true)
  }

  if (isLoading || !data) return <div style={{ padding: 24 }}><Spin /></div>

  const roles = data.roles
  const sections = [...new Set(data.modules.map((m) => m.section))]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>角色权限</h2>
        <Button type="primary" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
          保存
        </Button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
        勾选各角色可<b>查看</b> / <b>管理</b>(增删改)的功能模块。系统管理员恒为全权;员工走员工端,不在此列。
        「锁定」「流程固定」模块不可在此调整。改动即时生效于后端接口。
      </div>

      <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 620, fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-canvas)' }}>
              <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-canvas)' }}>
                功能模块
              </th>
              {roles.map((r) => (
                <th key={r} style={th}>{ROLE_LABEL[r] ?? r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((sec) => (
              <SectionRows key={sec} sec={sec} modules={data.modules.filter((m) => m.section === sec)}
                roles={roles} grants={grants} toggle={toggle} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SectionRows({ sec, modules, roles, grants, toggle }: {
  sec: string; modules: ModuleDef[]; roles: string[]; grants: Grants
  toggle: (m: string, r: string, a: 'view' | 'manage', on: boolean) => void
}) {
  return (
    <>
      <tr>
        <td colSpan={roles.length + 1} style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-3)', background: 'var(--bg-hover)' }}>
          {sec}
        </td>
      </tr>
      {modules.map((m) => {
        const locked = m.mode !== 'config'
        const hasManage = m.actions.includes('manage')
        return (
          <tr key={m.key} style={{ borderTop: '1px solid var(--divider)' }}>
            <td style={{ ...td, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-card)' }}>
              {m.label}
              {locked && MODE_TAG[m.mode] && (
                <Tag style={{ marginLeft: 6 }} color={MODE_TAG[m.mode].color}>{MODE_TAG[m.mode].text}</Tag>
              )}
            </td>
            {roles.map((r) => {
              const g = grants[m.key]?.[r] ?? { can_view: false, can_manage: false }
              return (
                <td key={r} style={td}>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <Checkbox disabled={locked} checked={g.can_view}
                      onChange={(e) => toggle(m.key, r, 'view', e.target.checked)}>
                      <span style={{ fontSize: 12 }}>看</span>
                    </Checkbox>
                    {hasManage && (
                      <Checkbox disabled={locked} checked={g.can_manage}
                        onChange={(e) => toggle(m.key, r, 'manage', e.target.checked)}>
                        <span style={{ fontSize: 12 }}>管</span>
                      </Checkbox>
                    )}
                  </div>
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}

const th: React.CSSProperties = { padding: '8px 12px', fontWeight: 500, whiteSpace: 'nowrap', textAlign: 'center' }
const td: React.CSSProperties = { padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'center', background: 'var(--bg-card)' }
