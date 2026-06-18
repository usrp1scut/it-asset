// Admin: Inventory (库存余额 + 预警)
const Inventory = () => {
  const [view, setView] = React.useState('all');
  const [search, setSearch] = React.useState('');

  const skus = window.SKUS.filter(s => {
    if (view === 'warning' && s.stock >= s.safety) return false;
    if (view === 'consumable' && s.mode !== 'consumable') return false;
    if (view === 'inventory' && s.mode !== 'inventory') return false;
    if (search && !s.name.includes(search) && !s.sku.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSKU = window.SKUS.length;
  const lowSKU = window.SKUS.filter(s => s.stock < s.safety).length;
  const totalValue = window.SKUS.reduce((s, sku) => s + sku.stock * sku.price, 0);
  const totalQty = window.SKUS.reduce((s, sku) => s + sku.stock, 0);

  const tabs = [
    { id: 'all', label: '全部 SKU', count: totalSKU },
    { id: 'warning', label: '库存预警', count: lowSKU, color: 'warning' },
    { id: 'inventory', label: '一物多码(配件)', count: window.SKUS.filter(s => s.mode === 'inventory').length },
    { id: 'consumable', label: '消耗品(耗材)', count: window.SKUS.filter(s => s.mode === 'consumable').length },
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }} className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>库存物品</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            {totalSKU} 个 SKU · 库存总量 {totalQty} 件 · 总价值 ¥{totalValue.toLocaleString()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="default" icon="refresh">库存盘点</Button>
          <Button variant="default" icon="download">导出</Button>
          <Button variant="default" icon="add">新建领用单</Button>
          <Button variant="primary" icon="add">入库</Button>
        </div>
      </div>

      {/* KPI strip — inventory focused */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <MiniKPI icon="box" color="#3370FF" label="SKU 总数" value={totalSKU} />
        <MiniKPI icon="warning" color="#FF8800" label="预警 SKU" value={lowSKU} hint={`占 ${((lowSKU / totalSKU) * 100).toFixed(0)}%`} />
        <MiniKPI icon="trendDown" color="#00B42A" label="本月发放" value="62" suffix="件" hint="较上月 +18%" />
        <MiniKPI icon="trendUp" color="#7E5EE5" label="本月入库" value="48" suffix="件" hint="¥ 12,460" />
      </div>

      {/* Warning banner */}
      {lowSKU > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          borderRadius: 8, background: '#FFF7E8', border: '1px solid #FFE4B3',
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FF8800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="warning" size={16} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#A66200' }}>有 {lowSKU} 个 SKU 库存低于安全线,建议尽快补货</div>
            <div style={{ fontSize: 12, color: '#A66200', opacity: 0.8, marginTop: 2 }}>系统将自动在每周一通过 Lark 机器人推送补货提醒</div>
          </div>
          <Button size="sm" variant="default" onClick={() => setView('warning')}>查看预警</Button>
          <Button size="sm" variant="primary">一键生成补货单</Button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--divider)' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setView(tab.id)}
            style={{
              padding: '10px 16px', position: 'relative',
              fontSize: 13, fontWeight: view === tab.id ? 600 : 400,
              color: view === tab.id ? 'var(--lark-blue)' : 'var(--text-2)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <span>{tab.label}</span>
            <span style={{
              padding: '0 6px', borderRadius: 8, fontSize: 11,
              background: tab.color === 'warning' ? 'var(--warning-bg)' : (view === tab.id ? 'var(--lark-blue-bg)' : 'var(--bg-canvas)'),
              color: tab.color === 'warning' ? 'var(--warning)' : (view === tab.id ? 'var(--lark-blue)' : 'var(--text-3)'),
            }}>{tab.count}</span>
            {view === tab.id && (
              <span style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--lark-blue)', borderRadius: 1 }} />
            )}
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Input icon="search" placeholder="搜索 SKU 名称或编号" value={search} onChange={setSearch} style={{ width: 320 }} />
        <DropdownFilter label="存放地点" value="all" onChange={() => {}}
          options={[{ id: 'all', label: '全部地点' }, { id: 'b', label: 'IT 仓库·B 区' }, { id: 'c', label: 'IT 仓库·C 区' }]} />
        <DropdownFilter label="排序" value="risk" onChange={() => {}}
          options={[{ id: 'risk', label: '按预警程度' }, { id: 'name', label: '按名称' }, { id: 'value', label: '按总价值' }]} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>共 {skus.length} 个 SKU</span>
      </div>

      {/* SKU grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, flex: 1, alignContent: 'start', overflow: 'auto', paddingBottom: 8 }}>
        {skus.map(s => <SKUCard key={s.sku} sku={s} />)}
      </div>
    </div>
  );
};

const MiniKPI = ({ icon, color, label, value, suffix, hint }) => (
  <div style={{
    background: '#fff', borderRadius: 8, padding: 16,
    border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', gap: 14,
  }}>
    <div style={{ width: 40, height: 40, borderRadius: 8, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={18} color={color} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{value}</span>
        {suffix && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{suffix}</span>}
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{hint}</div>}
    </div>
  </div>
);

const SKUCard = ({ sku }) => {
  const ratio = sku.stock / sku.safety;
  const max = sku.max;
  const stockRatio = Math.min(100, (sku.stock / max) * 100);
  const safetyRatio = (sku.safety / max) * 100;

  let level = 'normal';
  if (sku.stock < sku.safety) level = 'low';
  else if (sku.stock < sku.safety * 1.5) level = 'warn';

  const levelStyle = {
    normal: { color: '#00B42A', label: '充足', bg: '#E8FFEA' },
    warn: { color: '#FF8800', label: '偏低', bg: '#FFF7E8' },
    low: { color: '#F53F3F', label: '预警', bg: '#FFECE8' },
  }[level];

  const modeLabel = sku.mode === 'consumable' ? '耗材' : '配件';
  const monthsLeft = sku.monthlyUse > 0 ? (sku.stock / sku.monthlyUse).toFixed(1) : '—';

  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: 16,
      border: `1px solid ${level === 'low' ? '#FFD8C8' : 'var(--border)'}`,
      boxShadow: level === 'low' ? '0 0 0 3px rgba(245,63,63,0.04)' : 'none',
      display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'all 0.16s', cursor: 'pointer',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(31,35,41,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = level === 'low' ? '0 0 0 3px rgba(245,63,63,0.04)' : 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 8,
          background: 'linear-gradient(135deg, #F2F3F5 0%, #FAFBFC 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          border: '1px solid var(--border)',
        }}>
          <Icon name="package" size={20} color="var(--text-2)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span className="text-mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{sku.sku}</span>
            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-canvas)', color: 'var(--text-2)' }}>{modeLabel}</span>
            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: levelStyle.bg, color: levelStyle.color, fontWeight: 500 }}>{levelStyle.label}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sku.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{sku.brand} · {sku.spec} · {sku.location}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: level === 'low' ? 'var(--danger)' : 'var(--text-1)' }}>{sku.stock}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{sku.unit}</div>
        </div>
      </div>

      {/* Stock bar with safety / max markers */}
      <div>
        <div style={{ position: 'relative', height: 8, borderRadius: 4, background: '#F2F3F5', overflow: 'visible' }}>
          {/* safety line marker */}
          <div style={{
            position: 'absolute', left: `${safetyRatio}%`, top: -3, bottom: -3,
            width: 2, background: 'var(--warning)', borderRadius: 1,
          }} title={`安全库存 ${sku.safety}`} />
          {/* actual stock */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${stockRatio}%`, borderRadius: 4,
            background: level === 'low' ? 'linear-gradient(90deg, #F53F3F 0%, #FF7570 100%)' :
                        level === 'warn' ? 'linear-gradient(90deg, #FF8800 0%, #FFAA33 100%)' :
                        'linear-gradient(90deg, #00B42A 0%, #4ECC4E 100%)',
            transition: 'width 0.4s',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--text-3)' }}>
          <span>0</span>
          <span style={{ color: 'var(--warning)' }}>安全 {sku.safety}</span>
          <span>上限 {sku.max}</span>
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, paddingTop: 12, borderTop: '1px solid var(--divider)' }}>
        <MetricCell label="可用" value={sku.stock - sku.locked - sku.damaged} />
        <MetricCell label="锁定" value={sku.locked} />
        <MetricCell label="月均耗" value={`${sku.monthlyUse}`} subtle />
        <MetricCell label="可用月数" value={monthsLeft} accent={Number(monthsLeft) < 1 ? 'danger' : null} />
      </div>

      {/* Action footer */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {level === 'low' && <Button size="sm" variant="subtle" icon="upload">补货 {sku.max - sku.stock}</Button>}
        <Button size="sm" variant="default">发放</Button>
        <Button size="sm" variant="text">详情 →</Button>
      </div>
    </div>
  );
};

const MetricCell = ({ label, value, subtle, accent }) => (
  <div>
    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{label}</div>
    <div style={{
      fontSize: 14, fontWeight: 600,
      color: accent === 'danger' ? 'var(--danger)' : subtle ? 'var(--text-2)' : 'var(--text-1)',
      fontFamily: 'var(--font-mono)',
    }}>{value}</div>
  </div>
);

Object.assign(window, { Inventory });
