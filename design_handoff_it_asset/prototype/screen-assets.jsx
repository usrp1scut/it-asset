// Admin: Asset List (台账)
const AssetList = ({ onOpenAsset }) => {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [selected, setSelected] = React.useState(new Set());

  const statusTabs = [
    { id: 'all', label: '全部', count: window.ASSETS.length },
    { id: 'assigned', label: '已领用', count: window.STATS.assigned },
    { id: 'stocked', label: '库存中', count: window.STATS.stocked },
    { id: 'repairing', label: '维修中', count: window.STATS.repairing },
    { id: 'idle', label: '闲置', count: window.STATS.idle },
    { id: 'pending_scrap', label: '待报废', count: window.ASSETS.filter(a => a.status === 'pending_scrap').length },
    { id: 'scrapped', label: '已报废', count: window.ASSETS.filter(a => a.status === 'scrapped').length },
  ];

  const filtered = window.ASSETS.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const u = window.getUser(a.owner);
      if (!a.code.toLowerCase().includes(q) &&
          !a.name.toLowerCase().includes(q) &&
          !a.sn.toLowerCase().includes(q) &&
          !(u?.name.includes(q))) return false;
    }
    return true;
  });

  const toggleSelect = (code) => {
    const next = new Set(selected);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(a => a.code)));
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }} className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>资产台账</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            共 {window.ASSETS.length} 件固定资产 · 总价值 ¥{(window.STATS.totalValue).toLocaleString()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="default" icon="filter">高级筛选</Button>
          <Button variant="default" icon="download">导出</Button>
          <Button variant="default" icon="upload">批量导入</Button>
          <Button variant="primary" icon="add">新增资产</Button>
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--divider)' }}>
        {statusTabs.map(tab => (
          <button key={tab.id} onClick={() => setStatusFilter(tab.id)}
            style={{
              padding: '10px 16px', position: 'relative',
              fontSize: 13, fontWeight: statusFilter === tab.id ? 600 : 400,
              color: statusFilter === tab.id ? 'var(--lark-blue)' : 'var(--text-2)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <span>{tab.label}</span>
            <span style={{
              padding: '0 6px', borderRadius: 8, fontSize: 11,
              background: statusFilter === tab.id ? 'var(--lark-blue-bg)' : 'var(--bg-canvas)',
              color: statusFilter === tab.id ? 'var(--lark-blue)' : 'var(--text-3)',
            }}>{tab.count}</span>
            {statusFilter === tab.id && (
              <span style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--lark-blue)', borderRadius: 1 }} />
            )}
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Input icon="search" placeholder="搜索资产编号 / 名称 / SN / 责任人" value={search} onChange={setSearch} style={{ width: 320 }} />
        <DropdownFilter label="资产类型" value={typeFilter} onChange={setTypeFilter}
          options={[{ id: 'all', label: '全部类型' }, ...window.ASSET_TYPES.map(t => ({ id: t.id, label: t.name }))]} />
        <DropdownFilter label="责任部门" value="all" onChange={() => {}}
          options={[{ id: 'all', label: '全部部门' }, ...window.DEPARTMENTS.map(d => ({ id: d.id, label: d.name }))]} />
        <DropdownFilter label="存放地点" value="all" onChange={() => {}}
          options={[{ id: 'all', label: '全部地点' }, { id: 'sh', label: '上海·张江' }, { id: 'wh', label: 'IT 仓库·A 区' }]} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>共 {filtered.length} 条</span>
      </div>

      {/* Selection bar (appears when items selected) */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', borderRadius: 8,
          background: 'var(--lark-blue-bg)', border: '1px solid var(--lark-blue-bg-strong)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--lark-blue)' }}>
            已选择 <b>{selected.size}</b> 项
          </span>
          <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
          <Button size="sm" variant="text">批量分配</Button>
          <Button size="sm" variant="text">批量盘点</Button>
          <Button size="sm" variant="text">导出选中</Button>
          <Button size="sm" variant="text">标签打印</Button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setSelected(new Set())} style={{ fontSize: 12, color: 'var(--text-3)' }}>取消选择</button>
        </div>
      )}

      {/* Table */}
      <Card padding={0} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#FAFBFC', zIndex: 1 }}>
              <tr style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--divider)' }}>
                <th style={{...tableHeaderStyle, width: 40, paddingRight: 0 }}>
                  <Checkbox checked={selected.size === filtered.length && filtered.length > 0} indeterminate={selected.size > 0 && selected.size < filtered.length} onChange={toggleAll} />
                </th>
                <th style={tableHeaderStyle}>资产编号</th>
                <th style={tableHeaderStyle}>资产名称 / 型号</th>
                <th style={tableHeaderStyle}>状态</th>
                <th style={tableHeaderStyle}>责任人</th>
                <th style={tableHeaderStyle}>存放地点</th>
                <th style={{...tableHeaderStyle, textAlign: 'right' }}>采购价</th>
                <th style={tableHeaderStyle}>保修至</th>
                <th style={{...tableHeaderStyle, width: 100 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const today = new Date('2026-05-18');
                const wDate = new Date(a.warranty);
                const daysLeft = Math.floor((wDate - today) / (1000 * 60 * 60 * 24));
                return (
                  <tr key={a.code}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#FAFBFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = selected.has(a.code) ? '#F5F9FF' : 'transparent'}
                    style={{
                      borderBottom: '1px solid var(--divider)',
                      background: selected.has(a.code) ? '#F5F9FF' : 'transparent',
                      transition: 'background 0.12s',
                    }}>
                    <td style={{...tableCellStyle, paddingRight: 0 }} onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(a.code)} onChange={() => toggleSelect(a.code)} />
                    </td>
                    <td style={{ ...tableCellStyle, cursor: 'pointer' }} onClick={() => onOpenAsset(a)}>
                      <span className="text-mono" style={{ fontSize: 12, color: 'var(--lark-blue)', fontWeight: 500 }}>{a.code}</span>
                      {a.boundTo && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Icon name="link" size={10} />
                          绑定 {a.boundTo}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tableCellStyle, cursor: 'pointer' }} onClick={() => onOpenAsset(a)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AssetTypeIcon typeId={a.type} size={32} />
                        <div>
                          <div style={{ fontWeight: 500 }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.brand} · {a.model} · SN {a.sn}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tableCellStyle}><StatusBadge status={a.status} /></td>
                    <td style={tableCellStyle}><UserCell userId={a.owner} /></td>
                    <td style={{...tableCellStyle, color: 'var(--text-2)' }}>{a.location}</td>
                    <td style={{...tableCellStyle, textAlign: 'right', fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: 13 }}>¥ {a.price.toLocaleString()}</td>
                    <td style={tableCellStyle}>
                      <div style={{ fontSize: 12, color: daysLeft < 90 ? 'var(--warning)' : 'var(--text-2)' }}>
                        {a.warranty}
                        {daysLeft < 90 && daysLeft > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--warning)' }}>剩 {daysLeft} 天</div>
                        )}
                        {daysLeft < 0 && (
                          <div style={{ fontSize: 11, color: 'var(--danger)' }}>已过保</div>
                        )}
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => onOpenAsset(a)} style={{ fontSize: 12, color: 'var(--lark-blue)', padding: '4px 8px', borderRadius: 4 }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--lark-blue-bg)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>详情</button>
                        <button style={{ fontSize: 12, color: 'var(--text-2)', padding: '4px 8px', borderRadius: 4 }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <Icon name="more" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <Empty text="没有符合条件的资产" />}
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid var(--divider)', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>第 1-{filtered.length} 条 / 共 {filtered.length} 条</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Pagination />
            <select style={{ height: 28, padding: '0 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)' }}>
              <option>20 条/页</option>
              <option>50 条/页</option>
              <option>100 条/页</option>
            </select>
          </div>
        </div>
      </Card>
    </div>
  );
};

const Checkbox = ({ checked, indeterminate, onChange }) => (
  <label style={{ display: 'inline-flex', cursor: 'pointer', userSelect: 'none' }}>
    <span style={{
      width: 16, height: 16, borderRadius: 3,
      border: `1.5px solid ${checked || indeterminate ? 'var(--lark-blue)' : 'var(--border-strong)'}`,
      background: checked || indeterminate ? 'var(--lark-blue)' : '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.12s',
    }}>
      {checked && <Icon name="check" size={11} color="#fff" />}
      {indeterminate && !checked && <span style={{ width: 8, height: 2, background: '#fff', borderRadius: 1 }} />}
    </span>
    <input type="checkbox" checked={!!checked} onChange={onChange} style={{ display: 'none' }} />
  </label>
);

const DropdownFilter = ({ label, value, onChange, options }) => {
  const cur = options.find(o => o.id === value) || options[0];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      height: 32, padding: '0 12px', borderRadius: 6,
      border: '1px solid var(--border-strong)', background: '#fff', fontSize: 13, cursor: 'pointer',
    }}>
      <span style={{ color: 'var(--text-3)' }}>{label}:</span>
      <span style={{ color: 'var(--text-1)' }}>{cur.label}</span>
      <Icon name="chevronDown" size={12} color="var(--text-3)" />
    </div>
  );
};

const Pagination = () => (
  <div style={{ display: 'flex', gap: 4 }}>
    {['‹', '1', '2', '3', '›'].map((p, i) => (
      <button key={i} style={{
        minWidth: 28, height: 28, padding: '0 8px', fontSize: 12,
        borderRadius: 4, border: '1px solid var(--border)',
        background: p === '1' ? 'var(--lark-blue)' : '#fff',
        color: p === '1' ? '#fff' : 'var(--text-2)',
        cursor: 'pointer',
      }}>{p}</button>
    ))}
  </div>
);

Object.assign(window, { AssetList, Checkbox, DropdownFilter });
