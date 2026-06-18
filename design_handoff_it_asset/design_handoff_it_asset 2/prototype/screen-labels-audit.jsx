// Phase 2 — QR Labels batch print + Audit logs

// ─── QR Labels ────────────────────────────────────────
const QRLabels = () => {
  // Build a real QR-like pattern for visual fidelity (not a real scannable QR)
  const fakeQR = (seed) => {
    const cells = [];
    const N = 21; // standard small QR module size
    let h = 1; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        // 3 finder patterns
        const inFinder = (cx, cy) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7 &&
          !((x === cx + 1 || x === cx + 5) && (y >= cy + 1 && y <= cy + 5)) &&
          !((y === cy + 1 || y === cy + 5) && (x >= cx + 1 && x <= cx + 5));
        if (inFinder(0, 0) || inFinder(14, 0) || inFinder(0, 14)) {
          // outer border + inner solid block
          if (x === 0 || x === 6 || y === 0 || y === 6 ||
              x === 14 || x === 20 ||
              y === 14 || y === 20 ||
              (x >= 16 && x <= 18 && y >= 2 && y <= 4) ||
              (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
              (x >= 2 && x <= 4 && y >= 16 && y <= 18)) {
            cells.push({ x, y });
          }
          continue;
        }
        // pseudo-random data modules
        h = (h * 1103515245 + 12345) >>> 0;
        if ((h % 100) < 45) cells.push({ x, y });
      }
    }
    return cells;
  };

  const QRSvg = ({ code, size = 80 }) => {
    const N = 21;
    const cellSize = size / N;
    const cells = React.useMemo(() => fakeQR(code), [code]);
    return (
      <svg width={size} height={size} style={{ display: 'block' }}>
        <rect width={size} height={size} fill="#fff" />
        {cells.map((c, i) => (
          <rect key={i} x={c.x * cellSize} y={c.y * cellSize} width={cellSize + 0.4} height={cellSize + 0.4} fill="#000" />
        ))}
      </svg>
    );
  };

  // Pool of assets without labels (unprinted)
  const candidates = window.ASSETS.filter(a => a.status !== 'scrapped').slice(0, 24);
  const [selected, setSelected] = React.useState(new Set(candidates.slice(0, 14).map(a => a.code)));
  const [labelSize, setLabelSize] = React.useState('medium');
  const [layout, setLayout] = React.useState('4x8');

  const toggle = (code) => {
    const next = new Set(selected);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelected(next);
  };

  const selectedAssets = candidates.filter(a => selected.has(a.code));
  const totalSheets = Math.ceil(selectedAssets.length / 32);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }} className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>二维码标签打印</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            批量生成贴标用 PDF · A4 标签纸,4 × 8 = 每页 32 张
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="default" icon="download">导出 PDF</Button>
          <Button variant="primary" icon="upload" disabled={selectedAssets.length === 0}>
            打印 {selectedAssets.length} 个标签 ({totalSheets} 页)
          </Button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, overflow: 'hidden' }}>
        {/* Left panel — selection */}
        <Card padding={0} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Settings */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>打印设置</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 5 }}>纸张布局</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[
                    { id: '4x8', label: '4 × 8(密)', size: '50×35mm' },
                    { id: '3x6', label: '3 × 6(中)', size: '65×45mm' },
                    { id: '2x4', label: '2 × 4(大)', size: '100×70mm' },
                  ].map(o => (
                    <button key={o.id} onClick={() => setLayout(o.id)}
                      style={{
                        flex: 1, padding: '6px 8px', borderRadius: 6, fontSize: 11,
                        border: `1.5px solid ${layout === o.id ? 'var(--lark-blue)' : 'var(--border)'}`,
                        background: layout === o.id ? 'var(--lark-blue-bg)' : '#fff',
                        color: layout === o.id ? 'var(--lark-blue)' : 'var(--text-2)',
                        fontWeight: layout === o.id ? 500 : 400,
                      }}>
                      <div>{o.label}</div>
                      <div style={{ fontSize: 10, marginTop: 1, opacity: 0.7 }}>{o.size}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 5 }}>含字段</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['QR 码', '资产编号', '资产名称', '品牌型号', '采购日期'].map((f, i) => (
                    <label key={f} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                      borderRadius: 14, fontSize: 11, cursor: 'pointer',
                      background: i < 3 ? 'var(--lark-blue-bg)' : 'var(--bg-canvas)',
                      color: i < 3 ? 'var(--lark-blue)' : 'var(--text-2)',
                    }}>
                      <span style={{ width: 12, height: 12, borderRadius: 2, border: `1.5px solid ${i < 3 ? 'var(--lark-blue)' : 'var(--border-strong)'}`,
                        background: i < 3 ? 'var(--lark-blue)' : '#fff',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {i < 3 && <Icon name="check" size={8} color="#fff" />}
                      </span>
                      {f}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Asset list to print */}
          <div style={{ padding: '14px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>待打印资产({selected.size})</div>
            <button onClick={() => setSelected(selected.size === candidates.length ? new Set() : new Set(candidates.map(a => a.code)))}
              style={{ fontSize: 12, color: 'var(--lark-blue)' }}>
              {selected.size === candidates.length ? '取消全选' : '全选'}
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
            {candidates.map(a => {
              const checked = selected.has(a.code);
              return (
                <label key={a.code} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                  background: checked ? 'var(--lark-blue-bg)' : 'transparent',
                  marginBottom: 2, transition: 'background 0.12s',
                }}
                  onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = '#FAFBFC'; }}
                  onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = 'transparent'; }}>
                  <Checkbox checked={checked} onChange={() => toggle(a.code)} />
                  <AssetTypeIcon typeId={a.type} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-mono" style={{ fontSize: 11, color: 'var(--lark-blue)' }}>{a.code}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </Card>

        {/* Right: A4 print preview */}
        <div style={{
          background: 'var(--bg-canvas)', borderRadius: 10,
          overflow: 'auto', padding: 32,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="box" size={12} />
            <span>A4 横向预览 · 共 {totalSheets} 页 · 已选 {selectedAssets.length} 标签</span>
          </div>
          {/* Page */}
          <div style={{
            width: 595, // A4 portrait width 1pt = 0.353mm → 210mm * 2.834 = 595pt
            background: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            padding: '14px', borderRadius: 2,
            display: 'grid',
            gridTemplateColumns: layout === '4x8' ? 'repeat(4, 1fr)' : layout === '3x6' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
            gridAutoRows: layout === '4x8' ? '102px' : layout === '3x6' ? '128px' : '198px',
            gap: 0, position: 'relative',
          }}>
            {selectedAssets.slice(0, layout === '4x8' ? 32 : layout === '3x6' ? 18 : 8).map(a => (
              <LabelCell key={a.code} asset={a} layout={layout} QRSvg={QRSvg} />
            ))}
            {/* Page footer */}
            <div style={{ position: 'absolute', bottom: 4, right: 14, fontSize: 9, color: '#86909C' }}>第 1 / {totalSheets} 页 · 生成于 2026-05-18</div>
          </div>
          {selectedAssets.length > (layout === '4x8' ? 32 : layout === '3x6' ? 18 : 8) && (
            <div style={{
              padding: '20px 80px', background: '#fff', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              fontSize: 12, color: 'var(--text-3)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="more" size={14} />
              <span>余下 {selectedAssets.length - (layout === '4x8' ? 32 : layout === '3x6' ? 18 : 8)} 个标签将分布在第 2 - {totalSheets} 页</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LabelCell = ({ asset, layout, QRSvg }) => {
  const qrSize = layout === '4x8' ? 60 : layout === '3x6' ? 80 : 130;
  const padding = layout === '4x8' ? 6 : layout === '3x6' ? 8 : 12;
  const showBrand = layout !== '4x8';
  return (
    <div style={{
      borderRight: '1px dashed #D7D9DC', borderBottom: '1px dashed #D7D9DC',
      padding, display: 'flex', alignItems: 'center', gap: padding,
    }}>
      <QRSvg code={asset.code} size={qrSize} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="text-mono" style={{ fontSize: layout === '4x8' ? 9 : 11, fontWeight: 600, color: '#000', letterSpacing: '-0.02em' }}>
          {asset.code}
        </div>
        <div style={{
          fontSize: layout === '4x8' ? 9 : 11,
          color: '#000', marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontWeight: 500,
        }}>{asset.name}</div>
        {showBrand && (
          <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>
            {asset.brand}
          </div>
        )}
        {layout === '2x4' && (
          <div style={{ fontSize: 9, color: '#666', marginTop: 6, paddingTop: 6, borderTop: '1px solid #eee' }}>
            采购 · {asset.purchase}<br />
            保修至 · {asset.warranty}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Audit Logs Timeline ─────────────────────────────────
const AuditLogs = () => {
  const [filterAction, setFilterAction] = React.useState('all');
  const [filterActor, setFilterActor] = React.useState('all');

  // Group by day
  const filtered = window.AUDIT_EVENTS.filter(e => {
    if (filterAction !== 'all' && !e.action.startsWith(filterAction)) return false;
    if (filterActor !== 'all') {
      if (filterActor === 'system' && e.actor !== null) return false;
      if (filterActor !== 'system' && e.actor !== filterActor) return false;
    }
    return true;
  });

  const byDay = {};
  filtered.forEach(e => {
    const day = e.t.slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(e);
  });
  const days = Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }} className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>审计日志</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            最近 12 条记录 · 全量保留 · 不可篡改
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="default" icon="download">导出 CSV</Button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <DropdownFilter label="操作类型" value={filterAction} onChange={setFilterAction}
          options={[
            { id: 'all', label: '全部操作' },
            { id: 'asset', label: '资产相关' },
            { id: 'inventory', label: '库存相关' },
            { id: 'approval', label: '审批相关' },
            { id: 'inspection', label: '盘点相关' },
            { id: 'repair', label: '维修相关' },
            { id: 'scrap', label: '报废相关' },
            { id: 'lark', label: 'Lark 回调' },
            { id: 'celery', label: '定时任务' },
          ]} />
        <DropdownFilter label="操作人" value="all" onChange={() => {}}
          options={[
            { id: 'all', label: '全部用户' },
            ...window.USERS.slice(0, 6).map(u => ({ id: u.id, label: u.name })),
            { id: 'system', label: '系统/Webhook' },
          ]} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>共 {filtered.length} 条</span>
      </div>

      {/* Timeline grouped by day */}
      <div style={{ flex: 1, overflow: 'auto', paddingRight: 8 }}>
        {days.map(([day, events]) => (
          <div key={day} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, position: 'sticky', top: 0, background: 'var(--bg-canvas)', padding: '6px 0', zIndex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{day}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', padding: '2px 6px', borderRadius: 3, background: '#fff' }}>{events.length} 条</span>
              <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
            </div>
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {events.map((e, i) => <AuditRow key={i} event={e} isLast={i === events.length - 1} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AuditRow = ({ event, isLast }) => {
  const meta = window.ACTION_META[event.action] || { label: event.action, color: 'gray', icon: 'box' };
  const actor = event.actor ? window.getUser(event.actor) : null;
  const colorMap = {
    blue: '#3370FF', success: '#00B42A', warning: '#FF8800', danger: '#F53F3F', purple: '#7E5EE5', gray: '#86909C',
  };
  const c = colorMap[meta.color] || '#86909C';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderBottom: isLast ? 'none' : '1px solid var(--divider)',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', width: 64 }}>{event.t.slice(11, 19)}</span>
      <div style={{
        width: 28, height: 28, borderRadius: 6, background: `${c}14`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={meta.icon} size={14} color={c} />
      </div>
      <div style={{ flex: '0 0 110px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 3, background: `${c}14`, color: c, fontWeight: 500 }}>{meta.label}</span>
      </div>
      <div style={{ flex: '0 0 130px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {actor ? (
          <><Avatar user={actor} size={20} /><span style={{ fontSize: 12, color: 'var(--text-1)' }}>{actor.name}</span></>
        ) : (
          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: 'var(--bg-canvas)', color: 'var(--text-2)' }}>系统</span>
        )}
      </div>
      <span className="text-mono" style={{ fontSize: 12, color: 'var(--lark-blue)', flex: '0 0 180px' }}>{event.resource}</span>
      <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.note}</span>
      <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{event.ip}</span>
    </div>
  );
};

Object.assign(window, { QRLabels, AuditLogs });
