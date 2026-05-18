// Shell: sidebar + topbar + layout
const navItems = [
  { id: 'dashboard', icon: 'dashboard', label: '工作台', en: 'Dashboard' },
  { id: 'assets', icon: 'assets', label: '资产台账', en: 'Assets', badge: window.STATS.total },
  { id: 'inventory', icon: 'inventory', label: '库存物品', en: 'Inventory', badge: window.STATS.lowStock, badgeColor: 'warning' },
  { id: 'approval', icon: 'approval', label: '审批中心', en: 'Approvals', badge: window.APPROVALS.length, badgeColor: 'primary' },
  { id: 'inspect', icon: 'inspect', label: '盘点管理', en: 'Inspection' },
  { id: 'repair', icon: 'repair', label: '维修报废', en: 'Repair & Scrap' },
  { id: 'report', icon: 'report', label: '报表统计', en: 'Reports' },
];

const Sidebar = ({ active, onNav, onEmployeeView }) => (
  <aside style={{
    width: 220, background: '#FAFBFC', borderRight: '1px solid var(--divider)',
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
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Lark Asset · v0.1</div>
      </div>
    </div>

    {/* Nav */}
    <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {navItems.map(item => {
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
            }}>
            <Icon name={item.icon} size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
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

      <div style={{ height: 1, background: 'var(--divider)', margin: '12px 0' }} />

      <button onClick={() => onNav('settings')}
        onMouseEnter={(e) => e.currentTarget.style.background = '#EFF0F2'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 12px', height: 36, borderRadius: 6,
          fontSize: 13, color: 'var(--text-2)', width: '100%', justifyContent: 'flex-start',
        }}>
        <Icon name="settings" size={16} />
        <span>系统设置</span>
      </button>
    </nav>

    {/* Employee view trigger */}
    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--divider)' }}>
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
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>员工端预览</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Lark H5 视图</div>
        </div>
        <Icon name="chevronRight" size={12} color="var(--text-3)" />
      </button>
    </div>
  </aside>
);

const Topbar = ({ active, currentUser }) => {
  const breadcrumb = {
    dashboard: ['工作台', '数据总览'],
    assets: ['资产管理', '资产台账'],
    inventory: ['资产管理', '库存物品'],
    approval: ['流程', '审批中心'],
    inspect: ['流程', '盘点管理'],
    repair: ['流程', '维修报废'],
    report: ['报表统计'],
    settings: ['系统设置'],
  }[active] || [];

  return (
    <div style={{
      height: 56, borderBottom: '1px solid var(--divider)',
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
      background: '#fff',
    }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
        {breadcrumb.map((b, i) => (
          <React.Fragment key={i}>
            <span style={{ color: i === breadcrumb.length - 1 ? 'var(--text-1)' : 'var(--text-3)', fontWeight: i === breadcrumb.length - 1 ? 500 : 400 }}>{b}</span>
            {i < breadcrumb.length - 1 && <Icon name="chevronRight" size={12} color="var(--text-4)" />}
          </React.Fragment>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-canvas)', borderRadius: 6, padding: '0 12px', height: 32, width: 280,
      }}>
        <Icon name="search" size={14} color="var(--text-3)" />
        <span style={{ fontSize: 13, color: 'var(--text-3)', flex: 1 }}>搜索资产、SKU、员工…</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', padding: '1px 5px', borderRadius: 3, background: '#fff', border: '1px solid var(--border)' }}>⌘ K</span>
      </div>

      {/* Actions */}
      <button style={{ width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', position: 'relative' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <Icon name="qr" size={18} />
      </button>
      <button style={{ width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', position: 'relative' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <Icon name="bell" size={18} />
        <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', border: '1.5px solid #fff' }} />
      </button>

      {/* User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px', borderRadius: 20, cursor: 'pointer' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <Avatar user={currentUser} size={26} />
        <div style={{ fontSize: 13, fontWeight: 500 }}>{currentUser.name}</div>
        <Icon name="chevronDown" size={12} color="var(--text-3)" />
      </div>
    </div>
  );
};

Object.assign(window, { Sidebar, Topbar });
