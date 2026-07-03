import { useMemo, useState } from 'react'
import {
  Button,
  Checkbox,
  Empty,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  message,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

interface SeatAsset { id: number; asset_code: string; name: string | null }
interface Seat {
  id: number
  row: number
  col: number
  seat_no: string | null
  zone: string | null
  user_id: number | null
  user_name: string | null
  assets: SeatAsset[]
}
interface MapMeta { id: number; name: string; rows: number; cols: number }
interface MapDetail { map: MapMeta; seats: Seat[] }
interface Person { id: number; name: string; department_name: string | null; asset_count: number }
interface Candidates { people: Person[]; assets: SeatAsset[] }

const ZONES = ['A', 'B', 'C', 'D']
const ZONE_COLORS: Record<string, string> = { A: '#3370FF', B: '#00B42A', C: '#FF8800', D: '#7E5EE5' }
const zoneColor = (z?: string | null) => (z ? ZONE_COLORS[z] : undefined) ?? 'var(--border-strong)'
type Sel = { kind: 'person' | 'asset'; id: number; label: string } | null

export default function SeatMap() {
  const qc = useQueryClient()
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [mode, setMode] = useState<'assign' | 'edit'>('assign')
  const [zone, setZone] = useState('A')
  const [cellSize, setCellSize] = useState(58)
  const [order, setOrder] = useState<'row' | 'serpentine'>('row')
  const [editCells, setEditCells] = useState<Record<string, string | null>>({})
  const [sel, setSel] = useState<Sel>(null)
  const [moveAssets, setMoveAssets] = useState(true)
  const [q, setQ] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', rows: 6, cols: 8 })

  const { data: maps } = useQuery<MapMeta[]>({
    queryKey: ['seatmaps'],
    queryFn: async () => (await api.get('/seatmaps')).data,
  })
  const mapId = currentId ?? maps?.[0]?.id ?? null
  const { data: detail, isLoading } = useQuery<MapDetail>({
    queryKey: ['seatmap', mapId],
    queryFn: async () => (await api.get(`/seatmaps/${mapId}`)).data,
    enabled: mapId != null,
  })
  const { data: cand } = useQuery<Candidates>({
    queryKey: ['seatmap-cand', mapId, q],
    queryFn: async () => (await api.get(`/seatmaps/${mapId}/candidates`, { params: { q: q || undefined } })).data,
    enabled: mapId != null && mode === 'assign',
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['seatmap', mapId] })
    qc.invalidateQueries({ queryKey: ['seatmap-cand', mapId] })
  }
  const seatAt = useMemo(() => {
    const m = new Map<string, Seat>()
    detail?.seats.forEach((s) => m.set(`${s.row}-${s.col}`, s))
    return m
  }, [detail])

  const mut = (fn: () => Promise<unknown>, ok?: string) =>
    fn()
      .then(() => { invalidate(); if (ok) message.success(ok) })
      .catch((e: { response?: { data?: { detail?: string } } }) =>
        message.error(e.response?.data?.detail ?? '操作失败'))

  const createMap = useMutation({
    mutationFn: async () => (await api.post('/seatmaps', form)).data as MapDetail,
    onSuccess: (d) => {
      setCurrentId(d.map.id)
      setCreateOpen(false)
      setForm({ name: '', rows: 6, cols: 8 })
      qc.invalidateQueries({ queryKey: ['seatmaps'] })
    },
    onError: () => message.error('创建失败'),
  })
  const deleteMap = () => {
    if (!detail) return
    Modal.confirm({
      title: `删除座位图「${detail.map.name}」?`,
      content: '将删除该图与全部工位;图上资产会移出工位、location 清空(可再手填)。',
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: async () => {
        await api.delete(`/seatmaps/${detail.map.id}`)
        setCurrentId(null)
        qc.invalidateQueries({ queryKey: ['seatmaps'] })
        message.success('已删除')
      },
    })
  }

  const exportPdf = async () => {
    if (mapId == null) return
    try {
      const res = await api.get(`/seatmaps/${mapId}/export`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `座位图-${detail?.map.name ?? mapId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('导出失败')
    }
  }

  const enterEdit = () => {
    const cells: Record<string, string | null> = {}
    detail?.seats.forEach((s) => { cells[`${s.row}-${s.col}`] = s.zone })
    setEditCells(cells)
    setSel(null)
    setMode('edit')
  }
  const saveLayout = () =>
    mut(async () => {
      const seats = Object.entries(editCells).map(([k, z]) => {
        const [r, c] = k.split('-').map(Number)
        return { row: r, col: c, zone: z }
      })
      await api.put(`/seatmaps/${mapId}/layout`, { seats })
    }, '布局已保存')
  const autonumber = () =>
    mut(async () => { await api.post(`/seatmaps/${mapId}/autonumber`, { order, per_zone: true, prefix: 'A' }) }, '已自动编号')

  const onCell = (r: number, c: number) => {
    const k = `${r}-${c}`
    if (mode === 'edit') {
      setEditCells((prev) => {
        const next = { ...prev }
        if (k in next) delete next[k]
        else next[k] = zone
        return next
      })
      return
    }
    const seat = seatAt.get(k)
    if (!seat) return
    if (sel) {
      if (sel.kind === 'person')
        mut(async () => { await api.post(`/seatmaps/${mapId}/seats/${seat.id}/assign-user`, { user_id: sel.id, move_assets: moveAssets }) })
      else
        mut(async () => { await api.post(`/seatmaps/${mapId}/seats/${seat.id}/place-asset`, { asset_id: sel.id }) })
      setSel(null)
      return
    }
    if (seat.user_id || seat.assets.length) {
      Modal.confirm({
        title: `清空工位 ${seat.seat_no ?? ''}?`,
        content: '将撤离占用人、把工位上的设备移出(location 清空)。',
        okText: '清空', cancelText: '取消',
        onOk: () => mut(async () => { await api.post(`/seatmaps/${mapId}/seats/${seat.id}/clear`) }),
      })
    }
  }
  const onDrop = (r: number, c: number, e: React.DragEvent) => {
    e.preventDefault()
    const seat = seatAt.get(`${r}-${c}`)
    if (!seat) return
    const [kind, id] = (e.dataTransfer.getData('text/plain') || '').split(':')
    if (!id) return
    if (kind === 'person')
      mut(async () => { await api.post(`/seatmaps/${mapId}/seats/${seat.id}/assign-user`, { user_id: +id, move_assets: moveAssets }) })
    else if (kind === 'asset')
      mut(async () => { await api.post(`/seatmaps/${mapId}/seats/${seat.id}/place-asset`, { asset_id: +id }) })
  }

  if (maps && maps.length === 0)
    return (
      <div style={{ padding: 24 }}>
        <PageHead onNew={() => setCreateOpen(true)} />
        <Empty description="还没有座位图" style={{ marginTop: 80 }}>
          <Button type="primary" onClick={() => setCreateOpen(true)}>新建座位图</Button>
        </Empty>
        <CreateModal open={createOpen} form={form} setForm={setForm}
          onOk={() => createMap.mutate()} onCancel={() => setCreateOpen(false)} loading={createMap.isPending} />
      </div>
    )

  const m = detail?.map
  return (
    <div style={{ padding: 24 }}>
      <PageHead onNew={() => setCreateOpen(true)}>
        <Select
          style={{ width: 200 }} value={mapId ?? undefined}
          onChange={(v) => { setCurrentId(v); setMode('assign'); setSel(null) }}
          options={(maps ?? []).map((x) => ({ value: x.id, label: x.name }))}
        />
        {m && <Button onClick={exportPdf}>导出 PDF</Button>}
        {m && <Button danger onClick={deleteMap}>删除图</Button>}
      </PageHead>

      {m && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '4px 0 16px' }}>
          <Segmented
            value={mode}
            onChange={(v) => { const nv = v as 'assign' | 'edit'; if (nv === 'edit') enterEdit(); else { setMode('assign'); setSel(null) } }}
            options={[{ label: '分配', value: 'assign' }, { label: '布局编辑', value: 'edit' }]}
          />
          {mode === 'edit' ? (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>区域</span>
              <Select value={zone} onChange={setZone} style={{ width: 80 }}
                options={ZONES.map((z) => ({ value: z, label: z + ' 区' }))} />
              <Button type="primary" onClick={saveLayout}>保存布局</Button>
              <span style={{ fontSize: 12, color: 'var(--text-4)' }}>点格子:工位 ⇄ 过道;先保存再自动编号</span>
            </>
          ) : (
            <>
              <Select value={order} onChange={setOrder} style={{ width: 120 }}
                options={[{ value: 'row', label: '行优先' }, { value: 'serpentine', label: '蛇形' }]} />
              <Button onClick={autonumber}>自动编号</Button>
              <Checkbox checked={moveAssets} onChange={(e) => setMoveAssets(e.target.checked)}>
                落座时带入名下在用资产
              </Checkbox>
            </>
          )}
        </div>
      )}

      {isLoading || !m ? (
        <Spin style={{ marginTop: 60 }} />
      ) : (
        <>
        <MapStats seats={detail?.seats ?? []} cellSize={cellSize} setCellSize={setCellSize} />
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${m.cols}, ${cellSize}px)`, gap: 6 }}>
              {Array.from({ length: m.rows * m.cols }).map((_, i) => {
                const r = Math.floor(i / m.cols), c = i % m.cols, k = `${r}-${c}`
                const seat = seatAt.get(k)
                const isSeat = mode === 'edit' ? k in editCells : !!seat
                const cellZone = mode === 'edit' ? editCells[k] : seat?.zone
                return (
                  <Cell key={k} size={cellSize} isSeat={isSeat} editing={mode === 'edit'} seat={seat} zone={cellZone}
                    onClick={() => onCell(r, c)}
                    onDrop={(e) => mode === 'assign' && onDrop(r, c, e)}
                    onDragOver={(e) => { if (mode === 'assign' && seat) e.preventDefault() }} />
                )
              })}
            </div>
          </div>

          {mode === 'assign' && (
            <div style={{ width: 240, flexShrink: 0 }}>
              <Input.Search placeholder="搜索人员 / 设备" allowClear value={q}
                onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
              <PanelGroup title="未分配人员">
                {(cand?.people ?? []).map((p) => (
                  <Chip key={'p' + p.id} icon="👤" title={p.name}
                    sub={(p.department_name ? p.department_name + ' · ' : '') + (p.asset_count ? `${p.asset_count} 件资产` : '无资产')}
                    active={sel?.kind === 'person' && sel.id === p.id}
                    onClick={() => setSel(sel?.kind === 'person' && sel.id === p.id ? null : { kind: 'person', id: p.id, label: p.name })}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', `person:${p.id}`)} />
                ))}
                {(cand?.people ?? []).length === 0 && <Hint>无</Hint>}
              </PanelGroup>
              <PanelGroup title="未分配设备(共享)">
                {(cand?.assets ?? []).map((a) => (
                  <Chip key={'a' + a.id} icon="🖥" title={a.name || a.asset_code} sub={a.asset_code}
                    active={sel?.kind === 'asset' && sel.id === a.id}
                    onClick={() => setSel(sel?.kind === 'asset' && sel.id === a.id ? null : { kind: 'asset', id: a.id, label: a.asset_code })}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', `asset:${a.id}`)} />
                ))}
                {(cand?.assets ?? []).length === 0 && <Hint>无</Hint>}
              </PanelGroup>
              <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>
                {sel ? `已选「${sel.label}」· 点工位落座` : '点人员/设备再点工位,或直接拖入'}
              </div>
            </div>
          )}
        </div>
        </>
      )}

      <CreateModal open={createOpen} form={form} setForm={setForm}
        onOk={() => createMap.mutate()} onCancel={() => setCreateOpen(false)} loading={createMap.isPending} />
    </div>
  )
}

function PageHead({ onNew, children }: { onNew: () => void; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <h2 style={{ margin: 0 }}>座位图</h2>
      <Space>{children}<Button type="primary" onClick={onNew}>新建座位图</Button></Space>
    </div>
  )
}

function Cell({ size, isSeat, editing, seat, zone, onClick, onDrop, onDragOver }: {
  size: number; isSeat: boolean; editing: boolean; seat?: Seat; zone?: string | null
  onClick: () => void; onDrop: (e: React.DragEvent) => void; onDragOver: (e: React.DragEvent) => void
}) {
  // Non-seat cell: a paintable 过道 in edit mode, invisible whitespace in assign
  // mode (so empty aisles don't clutter the map and seat clusters stand out).
  if (!isSeat) {
    return (
      <div onClick={onClick} onDrop={onDrop} onDragOver={onDragOver}
        style={{
          width: size, height: size, borderRadius: 8,
          cursor: editing ? 'pointer' : 'default',
          border: editing ? '1px dashed var(--border)' : '1px solid transparent',
          background: editing ? 'var(--bg-canvas)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
        {editing && <span style={{ fontSize: 10, color: 'var(--text-4)' }}>过道</span>}
      </div>
    )
  }
  const occ = !!seat?.user_id
  const nd = seat?.assets.length ?? 0
  let bg = 'var(--bg-card)', bd = 'var(--border)', fg = 'var(--text-4)'
  if (occ) { bg = 'var(--lark-blue-bg)'; bd = 'var(--lark-blue)'; fg = 'var(--lark-blue)' }
  else if (nd) { bg = 'var(--success-bg)'; bd = 'var(--success)'; fg = 'var(--success)' }
  const small = size < 52
  return (
    <div onClick={onClick} onDrop={onDrop} onDragOver={onDragOver}
      title={seat?.user_name ?? undefined}
      style={{
        position: 'relative', width: size, height: size, borderRadius: 8, cursor: 'pointer', padding: 3,
        border: `1px solid ${bd}`, background: bg,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
        overflow: 'hidden',
      }}>
      {/* zone accent stripe — makes A/B/C/D areas visually distinct */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: zoneColor(zone), borderTopLeftRadius: 8, borderTopRightRadius: 8,
      }} />
      <span style={{ fontSize: 10, color: fg }}>{seat?.seat_no ?? '—'}</span>
      {occ ? (
        <>
          <span style={{
            fontSize: small ? 10 : 11, fontWeight: 600, color: 'var(--lark-blue)',
            lineHeight: 1.05, textAlign: 'center', maxWidth: '100%',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {seat?.user_name ?? '已占'}
          </span>
          {nd > 0 && !small && <span style={{ fontSize: 10, color: 'var(--lark-blue)' }}>+{nd} 资产</span>}
        </>
      ) : nd ? (
        <span style={{ fontSize: 11, color: 'var(--success)' }}>{nd} 台</span>
      ) : (
        <span style={{ fontSize: 14, color: 'var(--text-4)' }}>+</span>
      )}
    </div>
  )
}

function MapStats({ seats, cellSize, setCellSize }: {
  seats: Seat[]; cellSize: number; setCellSize: (n: number) => void
}) {
  const total = seats.length
  const occupied = seats.filter((s) => s.user_id || s.assets.length).length
  const withAssets = seats.filter((s) => s.assets.length).length
  const zones = [...new Set(seats.map((s) => s.zone).filter(Boolean))] as string[]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
        工位 <b>{total}</b> · 已坐 <b style={{ color: 'var(--lark-blue)' }}>{occupied}</b>
        {' '}· 空 {total - occupied} · 带资产 {withAssets}
      </span>
      {zones.length > 1 && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {zones.map((z) => (
            <span key={z} style={{ fontSize: 12, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: zoneColor(z) }} />
              {z} 区 · {seats.filter((s) => s.zone === z).length}
            </span>
          ))}
        </div>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>缩放</span>
        <Segmented size="small" value={cellSize} onChange={(v) => setCellSize(v as number)}
          options={[{ label: '紧凑', value: 46 }, { label: '适中', value: 58 }, { label: '宽松', value: 74 }]} />
      </div>
    </div>
  )
}

function PanelGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflow: 'auto' }}>{children}</div>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{children}</span>
}

function Chip({ icon, title, sub, active, onClick, onDragStart }: {
  icon: string; title: string; sub: string; active: boolean
  onClick: () => void; onDragStart: (e: React.DragEvent) => void
}) {
  return (
    <div draggable onDragStart={onDragStart} onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${active ? 'var(--lark-blue)' : 'var(--border)'}`,
        background: active ? 'var(--lark-blue-bg)' : 'var(--bg-card)',
      }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{title}</span>{' '}
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{sub}</span>
      </span>
    </div>
  )
}

function CreateModal({ open, form, setForm, onOk, onCancel, loading }: {
  open: boolean; form: { name: string; rows: number; cols: number }
  setForm: (f: { name: string; rows: number; cols: number }) => void
  onOk: () => void; onCancel: () => void; loading: boolean
}) {
  return (
    <Modal open={open} title="新建座位图" onOk={onOk} onCancel={onCancel} okText="创建"
      okButtonProps={{ loading, disabled: !form.name.trim() }} cancelText="取消">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>名称(如 3F 研发区)</div>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="3F 研发区" />
        </div>
        <Space>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>行数</div>
            <InputNumber min={1} max={40} value={form.rows} onChange={(v) => setForm({ ...form, rows: v ?? 1 })} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>列数</div>
            <InputNumber min={1} max={40} value={form.cols} onChange={(v) => setForm({ ...form, cols: v ?? 1 })} />
          </div>
        </Space>
      </div>
    </Modal>
  )
}
