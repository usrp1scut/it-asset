// Phase 2 — Main App orchestration
// Extended sidebar with Phase 2 modules + new screens

const phase2NavItems = [
  { id: 'dashboard',  icon: 'dashboard',  label: '工作台',     phase: 1 },
  { id: 'assets',     icon: 'assets',     label: '资产台账',    phase: 1, badge: window.STATS.total },
  { id: 'inventory',  icon: 'inventory',  label: '库存物品',    phase: 1, badge: window.STATS.lowStock, badgeColor: 'warning' },
  { id: 'approval',   icon: 'approval',   label: '审批中心',    phase: 1, badge: window.APPROVALS.length, badgeColor: 'primary' },
  { divider: 'Phase 2 新增', id: 'p2-div' },
  { id: 'inspect',    icon: 'inspect',    label: '盘点管理',    phase: 2, badge: window.PHASE2_STATS.pendingInspectionItems, badgeColor: 'warning' },
  { id: 'repair',     icon: 'repair',     label: '维修工单',    phase: 2, badge: window.PHASE2_STATS.openRepairs, badgeColor: 'primary' },
  { id: 'scrap',      icon: 'warning',    label: '报废处置',    phase: 2, badge: window.PHASE2_STATS.pendingScraps, badgeColor: 'warning' },
  { id: 'labels',     icon: 'qr',         label: '二维码标签',  phase: 2 },
  { id: 'audit',      icon: 'clock',      label: '审计日志',    phase: 2 },
];

const Phase2Sidebar = ({ active, onNav }) => (
  <aside style={{
    width: 224, background: '#FAFBFC', borderRight: '1px solid var(--divider)',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  }}>
    {/* Logo */}
    <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: 'linear-gradient(135deg, #3370FF 0%, #5B92FF 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(51,112,255,0.3)',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
          <path d="M3 7l9 4 9-4M12 11v10" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>IT 资产管理</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
          Lark Asset · <span style={{ color: 'var(--lark-blue)', fontWeight: 500 }}>v0.2 Phase 2</span>
        </div>
      </div>
    </div>

    <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {phase2NavItems.map((item) => {
        if (item.divider) {
          return (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 12px 6px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
              <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>{item.divider}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
            </div>
          );
        }
        const isActive = active === item.id;
        return (
          <button key={item.id} onClick={() => onNav(item.id)}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#EFF0F2'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '0 12px', height: 36, borderRadius: 6,
              fontSize: 13, fontWeight: isActive ? 500 : 400,
              color: isActive ? 'var(--lark-blue)' : 'var(--text-2)',
              background: isActive ? 'var(--lark-blue-bg)' : 'transparent',
              transition: 'all 0.16s', width: '100%', justifyContent: 'flex-start',
              position: 'relative',
            }}>
            <Icon name={item.icon} size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
            {item.phase === 2 && !isActive && (
              <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 2, background: 'var(--lark-blue-bg)', color: 'var(--lark-blue)', fontWeight: 600, letterSpacing: '0.04em' }}>NEW</span>
            )}
            {item.badge !== undefined && item.badge > 0 && (
              <span style={{
                minWidth: 18, height: 18, padding: '0 6px', borderRadius: 9,
                background: item.badgeColor === 'warning' ? 'var(--warning)' : item.badgeColor === 'primary' ? 'var(--lark-blue)' : 'var(--text-3)',
                color: '#fff', fontSize: 11, fontWeight: 500,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>{item.badge}</span>
            )}
          </button>
        );
      })}
    </nav>

    {/* Phase 2 banner at bottom */}
    <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--divider)' }}>
      <div style={{
        padding: 12, borderRadius: 8, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #E8F1FF 0%, #F5F9FF 100%)',
        border: '1px solid var(--lark-blue-bg-strong)',
      }}>
        <div style={{ fontSize: 11, color: 'var(--lark-blue)', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 3 }}>PHASE 2 设计补充</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
          盘点 · 维修 · 报废 · 标签 · 审计
        </div>
      </div>
    </div>
  </aside>
);

const Phase2App = () => {
  const [active, setActive] = React.useState('inspect'); // start on signature screen
  const [drawerAsset, setDrawerAsset] = React.useState(null);
  const [drawerRepair, setDrawerRepair] = React.useState(null);
  const [drawerScrap, setDrawerScrap] = React.useState(null);

  const currentUser = window.getUser('u15');

  const breadcrumb = {
    dashboard: ['工作台', '数据总览'],
    assets: ['资产管理', '资产台账'],
    inventory: ['资产管理', '库存物品'],
    approval: ['流程', '审批中心'],
    inspect: ['流程', '盘点管理'],
    repair: ['流程', '维修工单'],
    scrap: ['流程', '报废处置'],
    labels: ['工具', '二维码标签'],
    audit: ['系统', '审计日志'],
  }[active] || [];

  const Phase2Topbar = () => (
    <div style={{
      height: 56, borderBottom: '1px solid var(--divider)',
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
      background: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        {breadcrumb.map((b, i) => (
          <React.Fragment key={i}>
            <span style={{ color: i === breadcrumb.length - 1 ? 'var(--text-1)' : 'var(--text-3)', fontWeight: i === breadcrumb.length - 1 ? 500 : 400 }}>{b}</span>
            {i < breadcrumb.length - 1 && <Icon name="chevronRight" size={12} color="var(--text-4)" />}
          </React.Fragment>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-canvas)', borderRadius: 6, padding: '0 12px', height: 32, width: 280,
      }}>
        <Icon name="search" size={14} color="var(--text-3)" />
        <span style={{ fontSize: 13, color: 'var(--text-3)', flex: 1 }}>搜索…</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', padding: '1px 5px', borderRadius: 3, background: '#fff', border: '1px solid var(--border)' }}>⌘ K</span>
      </div>
      <button style={{ width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', position: 'relative' }}>
        <Icon name="bell" size={18} />
        <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', border: '1.5px solid #fff' }} />
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px', borderRadius: 20 }}>
        <Avatar user={currentUser} size={26} />
        <div style={{ fontSize: 13, fontWeight: 500 }}>{currentUser.name}</div>
        <Icon name="chevronDown" size={12} color="var(--text-3)" />
      </div>
    </div>
  );

  const renderScreen = () => {
    switch (active) {
      case 'inspect': return <InspectionKanban onOpenAsset={setDrawerAsset} />;
      case 'repair': return <RepairCenter onOpenRepair={setDrawerRepair} />;
      case 'scrap': return <ScrapCenter onOpenScrap={setDrawerScrap} />;
      case 'labels': return <QRLabels />;
      case 'audit': return <AuditLogs />;
      case 'dashboard': return <Dashboard onNav={setActive} onOpenAsset={setDrawerAsset} />;
      case 'assets': return <AssetList onOpenAsset={setDrawerAsset} />;
      case 'inventory': return <Inventory />;
      default: return (
        <div style={{ padding: 24, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Card padding={48} style={{ textAlign: 'center', maxWidth: 480 }}>
            <Icon name="settings" size={36} color="var(--lark-blue)" />
            <div style={{ marginTop: 12, fontSize: 15, fontWeight: 500 }}>{breadcrumb[breadcrumb.length-1] || '此模块'} · 占位</div>
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-3)' }}>
              本设计补充包聚焦 Phase 2 的 5 个新模块,其他模块见 v0.1 原型。
            </div>
            <div style={{ marginTop: 16 }}>
              <Button variant="primary" onClick={() => setActive('inspect')}>返回盘点看板</Button>
            </div>
          </Card>
        </div>
      );
    }
  };

  return (
    <div className="frame-host">
      <ChromeWindow width={1440} height={920}
        tabs={[
          { title: 'IT 资产管理 · v0.2 Phase 2' },
          { title: 'Lark · 飞书' },
        ]}
        activeIndex={0}
        url="asset.company.com/admin/inspections">
        <div style={{ display: 'flex', height: '100%', background: '#fff' }}>
          <Phase2Sidebar active={active} onNav={setActive} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-canvas)' }}>
            <Phase2Topbar />
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {renderScreen()}
            </div>
          </div>
        </div>
      </ChromeWindow>

      <AssetDetail asset={drawerAsset} open={!!drawerAsset} onClose={() => setDrawerAsset(null)} />
      <RepairDetail order={drawerRepair} open={!!drawerRepair} onClose={() => setDrawerRepair(null)} />
      <ScrapDetail req={drawerScrap} open={!!drawerScrap} onClose={() => setDrawerScrap(null)} />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<Phase2App />);
