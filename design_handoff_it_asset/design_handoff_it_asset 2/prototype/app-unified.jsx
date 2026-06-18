// Unified App — Phase 1 + Phase 2 + new screens (Approvals, Offboarding)
// Single navigation showing entire system

const allNavItems = [
  { section: 'main', label: '主要工作' },
  { id: 'dashboard',   icon: 'dashboard',  label: '工作台',     phase: 1 },
  { id: 'assets',      icon: 'assets',     label: '资产台账',    phase: 1, badge: window.STATS.total },
  { id: 'inventory',   icon: 'inventory',  label: '库存物品',    phase: 1, badge: window.STATS.lowStock, badgeColor: 'warning' },
  { id: 'approval',    icon: 'approval',   label: '审批中心',    phase: 1, badge: window.APPROVALS_FULL.filter(a => a.status === 'pending' && a.currentApprover === 'u15').length, badgeColor: 'primary' },

  { section: 'flows',  label: '流程管理' },
  { id: 'inspect',     icon: 'inspect',    label: '盘点管理',    phase: 2, badge: window.PHASE2_STATS.pendingInspectionItems, badgeColor: 'warning' },
  { id: 'repair',      icon: 'repair',     label: '维修工单',    phase: 2, badge: window.PHASE2_STATS.openRepairs, badgeColor: 'primary' },
  { id: 'scrap',       icon: 'warning',    label: '报废处置',    phase: 2, badge: window.PHASE2_STATS.pendingScraps, badgeColor: 'warning' },
  { id: 'offboarding', icon: 'user',       label: '离职归还',    phase: 3, isNew: true, badge: window.OFFBOARDING_CASES.filter(c => c.status === 'overdue').length, badgeColor: 'danger' },

  { section: 'tools',  label: '工具与系统' },
  { id: 'labels',      icon: 'qr',         label: '二维码标签',  phase: 2 },
  { id: 'audit',       icon: 'clock',      label: '审计日志',    phase: 2 },
];

const UnifiedSidebar = ({ active, onNav, onEmployeeView, onAdminMobile }) => (
  <aside style={{
    width: 224, background: '#FAFBFC', borderRight: '1px solid var(--divider)',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  }}>
    <div style={{ padding: '20px 20px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
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
          Lark Asset · <span style={{ color: 'var(--lark-blue)', fontWeight: 500 }}>v0.3</span>
        </div>
      </div>
    </div>

    <nav style={{ flex: 1, padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 1, overflow: 'auto' }}>
      {allNavItems.map((item, i) => {
        if (item.section) {
          return (
            <div key={item.section} style={{
              padding: i === 0 ? '8px 12px 4px' : '14px 12px 4px',
              fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em',
              textTransform: 'uppercase', fontWeight: 500,
            }}>{item.label}</div>
          );
        }
        const isActive = active === item.id;
        return (
          <button key={item.id} onClick={() => onNav(item.id)}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#EFF0F2'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '0 12px', height: 34, borderRadius: 6,
              fontSize: 13, fontWeight: isActive ? 500 : 400,
              color: isActive ? 'var(--lark-blue)' : 'var(--text-2)',
              background: isActive ? 'var(--lark-blue-bg)' : 'transparent',
              transition: 'all 0.16s', width: '100%', justifyContent: 'flex-start',
            }}>
            <Icon name={item.icon} size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
            {item.isNew && !isActive && (
              <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 2, background: '#F1ECFF', color: '#7E5EE5', fontWeight: 600, letterSpacing: '0.04em' }}>NEW</span>
            )}
            {item.badge !== undefined && item.badge > 0 && (
              <span style={{
                minWidth: 18, height: 18, padding: '0 6px', borderRadius: 9,
                background: item.badgeColor === 'warning' ? 'var(--warning)' :
                            item.badgeColor === 'danger' ? 'var(--danger)' :
                            item.badgeColor === 'primary' ? 'var(--lark-blue)' : 'var(--text-3)',
                color: '#fff', fontSize: 11, fontWeight: 500,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>{item.badge}</span>
            )}
          </button>
        );
      })}
    </nav>

    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--divider)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button onClick={onEmployeeView}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--lark-blue)'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 8,
          border: '1px dashed var(--border)', background: '#fff',
          transition: 'all 0.16s', textAlign: 'left',
        }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--lark-blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="phone" size={14} color="var(--lark-blue)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>员工端 H5</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Lark 内嵌</div>
        </div>
        <Icon name="chevronRight" size={12} color="var(--text-3)" />
      </button>
      <button onClick={onAdminMobile}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#7E5EE5'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 8,
          border: '1px dashed var(--border)', background: '#fff',
          transition: 'all 0.16s', textAlign: 'left',
        }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: '#F1ECFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="phone" size={14} color="#7E5EE5" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>管理端移动版</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>扫码 · 审批 · 库存</div>
        </div>
        <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 2, background: '#F1ECFF', color: '#7E5EE5', fontWeight: 600 }}>NEW</span>
      </button>
    </div>
  </aside>
);

const UnifiedApp = () => {
  const [active, setActive] = React.useState('dashboard');
  const [drawerAsset, setDrawerAsset] = React.useState(null);
  const [drawerApproval, setDrawerApproval] = React.useState(null);
  const [drawerRepair, setDrawerRepair] = React.useState(null);
  const [drawerScrap, setDrawerScrap] = React.useState(null);
  const [employeeMode, setEmployeeMode] = React.useState(false);
  const [adminMobileMode, setAdminMobileMode] = React.useState(false);

  const currentUser = window.getUser('u15');

  const breadcrumb = {
    dashboard:   ['工作台', '数据总览'],
    assets:      ['资产管理', '资产台账'],
    inventory:   ['资产管理', '库存物品'],
    approval:    ['流程', '审批中心'],
    inspect:     ['流程', '盘点管理'],
    repair:      ['流程', '维修工单'],
    scrap:       ['流程', '报废处置'],
    offboarding: ['流程', '离职归还'],
    labels:      ['工具', '二维码标签'],
    audit:       ['系统', '审计日志'],
  }[active] || [];

  const UnifiedTopbar = () => (
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
        <span style={{ fontSize: 13, color: 'var(--text-3)', flex: 1 }}>搜索资产、SKU、员工…</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', padding: '1px 5px', borderRadius: 3, background: '#fff', border: '1px solid var(--border)' }}>⌘ K</span>
      </div>
      <button style={{ width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', position: 'relative' }}>
        <Icon name="qr" size={18} />
      </button>
      <button style={{ width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', position: 'relative' }}>
        <Icon name="bell" size={18} />
        <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', border: '1.5px solid #fff' }} />
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px', borderRadius: 20, cursor: 'pointer' }}>
        <Avatar user={currentUser} size={26} />
        <div style={{ fontSize: 13, fontWeight: 500 }}>{currentUser.name}</div>
        <Icon name="chevronDown" size={12} color="var(--text-3)" />
      </div>
    </div>
  );

  const renderScreen = () => {
    switch (active) {
      case 'dashboard':   return <Dashboard onNav={setActive} onOpenAsset={setDrawerAsset} />;
      case 'assets':      return <AssetList onOpenAsset={setDrawerAsset} />;
      case 'inventory':   return <Inventory />;
      case 'approval':    return <ApprovalCenter onOpenApproval={setDrawerApproval} />;
      case 'inspect':     return <InspectionKanban onOpenAsset={setDrawerAsset} />;
      case 'repair':      return <RepairCenter onOpenRepair={setDrawerRepair} />;
      case 'scrap':       return <ScrapCenter onOpenScrap={setDrawerScrap} />;
      case 'offboarding': return <OffboardingCenter onOpenAsset={setDrawerAsset} />;
      case 'labels':      return <QRLabels />;
      case 'audit':       return <AuditLogs />;
      default:            return <Dashboard onNav={setActive} onOpenAsset={setDrawerAsset} />;
    }
  };

  return (
    <div className="frame-host">
      <ChromeWindow width={1440} height={920}
        tabs={[{ title: 'IT 资产管理 · v0.3 完整版' }, { title: 'Lark · 飞书' }]}
        activeIndex={0}
        url={`asset.company.com/admin/${active}`}>
        <div style={{ display: 'flex', height: '100%', background: '#fff' }}>
          <UnifiedSidebar active={active} onNav={setActive} onEmployeeView={() => setEmployeeMode(true)} onAdminMobile={() => setAdminMobileMode(true)} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-canvas)' }}>
            <UnifiedTopbar />
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {renderScreen()}
            </div>
          </div>
        </div>
      </ChromeWindow>

      <AssetDetail asset={drawerAsset} open={!!drawerAsset} onClose={() => setDrawerAsset(null)} />
      <ApprovalDetail approval={drawerApproval} open={!!drawerApproval} onClose={() => setDrawerApproval(null)} />
      <RepairDetail order={drawerRepair} open={!!drawerRepair} onClose={() => setDrawerRepair(null)} />
      <ScrapDetail req={drawerScrap} open={!!drawerScrap} onClose={() => setDrawerScrap(null)} />

      {employeeMode && <EmployeeOverlay onClose={() => setEmployeeMode(false)} />}
      {adminMobileMode && <AdminMobileOverlay onClose={() => setAdminMobileMode(false)} />}
    </div>
  );
};

const AdminMobileOverlay = ({ onClose }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 100,
    background: 'rgba(15, 20, 30, 0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    animation: 'fadeIn 0.2s', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  }}>
    <div style={{
      position: 'absolute', top: 32, left: 0, right: 0,
      textAlign: 'center', color: 'rgba(255,255,255,0.85)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.7 }}>Admin Mobile</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>管理端 · 移动版预览</div>
      <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>IT 管理员高频场景:扫码 · 审批 · 库存预警</div>
    </div>
    <button onClick={onClose} style={{
      position: 'absolute', top: 28, right: 28,
      width: 40, height: 40, borderRadius: 20,
      background: 'rgba(255,255,255,0.12)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)',
    }}>
      <Icon name="close" size={18} />
    </button>
    <div style={{
      width: 390, height: 780, borderRadius: 24, overflow: 'hidden',
      boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1)',
      animation: 'fadeIn 0.3s 0.05s both',
    }}>
      <AdminMobile onClose={onClose} />
    </div>
  </div>
);

const EmployeeOverlay = ({ onClose }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 100,
    background: 'rgba(15, 20, 30, 0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    animation: 'fadeIn 0.2s', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  }}>
    <div style={{
      position: 'absolute', top: 32, left: 0, right: 0,
      textAlign: 'center', color: 'rgba(255,255,255,0.85)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.7 }}>Employee View</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>员工端 · Lark H5 预览</div>
    </div>
    <button onClick={onClose} style={{
      position: 'absolute', top: 28, right: 28,
      width: 40, height: 40, borderRadius: 20,
      background: 'rgba(255,255,255,0.12)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)',
    }}>
      <Icon name="close" size={18} />
    </button>
    <div style={{
      width: 390, height: 780, borderRadius: 24, overflow: 'hidden',
      boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1)',
      animation: 'fadeIn 0.3s 0.05s both',
    }}>
      <EmployeeApp onClose={onClose} />
    </div>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(<UnifiedApp />);
