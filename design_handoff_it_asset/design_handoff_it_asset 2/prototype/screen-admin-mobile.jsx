// Admin Mobile H5 — for IT admins on the go
// Top use cases: approve quickly, scan to look up, check low stock, push notifications

const AdminMobile = ({ onClose }) => {
  const [route, setRoute] = React.useState('home');
  const [openApproval, setOpenApproval] = React.useState(null);
  const [openRepair, setOpenRepair] = React.useState(null);
  const [openOffboarding, setOpenOffboarding] = React.useState(null);

  // Lark-mobile theme palette
  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#F4F5F7',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', fontFamily: 'var(--font-sans)',
    }}>
      <AdminMobileTopBar route={route} onBack={() => route === 'home' ? onClose() : setRoute('home')} onClose={onClose} />

      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {route === 'home' && <AdminMobileHome onNav={setRoute} />}
        {route === 'approvals' && <AdminMobileApprovals onOpen={(a) => setOpenApproval(a)} />}
        {route === 'scan' && <AdminMobileScan onBack={() => setRoute('home')} />}
        {route === 'lowstock' && <AdminMobileLowStock />}
        {route === 'repair' && <AdminMobileRepair onOpen={(r) => setOpenRepair(r)} />}
        {route === 'offboarding' && <AdminMobileOffboarding onOpen={(o) => setOpenOffboarding(o)} />}
        {route === 'larkmsg' && <AdminMobileLarkMessages />}
      </div>

      {openApproval && <AdminMobileApprovalSheet approval={openApproval} onClose={() => setOpenApproval(null)} />}
      {openRepair && <AdminMobileRepairSheet order={openRepair} onClose={() => setOpenRepair(null)} />}
      {openOffboarding && <AdminMobileOffboardingSheet offcase={openOffboarding} onClose={() => setOpenOffboarding(null)} />}

      {route === 'home' && <AdminMobileTabBar route={route} onNav={setRoute} />}
      {(route === 'approvals' || route === 'repair' || route === 'offboarding' || route === 'lowstock' || route === 'larkmsg') && <AdminMobileTabBar route={route} onNav={setRoute} />}
    </div>
  );
};

const AdminMobileTopBar = ({ route, onBack, onClose }) => {
  const titles = {
    home: 'IT 管理台',
    approvals: '审批中心',
    scan: '扫码查询',
    lowstock: '库存预警',
    repair: '维修工单',
    offboarding: '离职归还',
    larkmsg: 'Lark 消息',
  };
  return (
    <>
      {/* Status bar */}
      <div style={{
        height: 44, paddingTop: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px 4px', fontSize: 14, fontWeight: 600,
        color: '#000', background: '#fff',
      }}>
        <span>9:41</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="16" height="10" viewBox="0 0 16 10" fill="#000"><rect x="0" y="6" width="3" height="4" rx="0.5"/><rect x="4" y="4" width="3" height="6" rx="0.5"/><rect x="8" y="2" width="3" height="8" rx="0.5"/><rect x="12" y="0" width="3" height="10" rx="0.5"/></svg>
          <svg width="22" height="10" viewBox="0 0 22 10"><rect x="0.5" y="0.5" width="18" height="9" rx="2" fill="none" stroke="#000" strokeOpacity="0.4"/><rect x="20" y="3" width="1.5" height="4" rx="0.5" fill="#000" fillOpacity="0.4"/><rect x="2" y="2" width="14" height="6" rx="1" fill="#000"/></svg>
        </div>
      </div>
      {/* Nav bar */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', padding: '0 14px',
        background: '#fff', borderBottom: '0.5px solid #E5E6EB',
      }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', color: '#1F2329', padding: 4 }}>
          {route === 'home' ? <Icon name="close" size={18} /> : <Icon name="chevronLeft" size={18} />}
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 600, color: '#1F2329' }}>{titles[route]}</div>
        <button style={{ padding: 4 }}>
          {route === 'home' ? <Icon name="bell" size={18} color="#1F2329" /> : <Icon name="more" size={18} color="#1F2329" />}
        </button>
      </div>
    </>
  );
};

const AdminMobileHome = ({ onNav }) => {
  const me = window.getUser('u15');
  const dept = window.getDept(me.dept);
  const overdueApprovals = window.APPROVALS_FULL.filter(a => a.status === 'pending' && a.currentApprover === 'u15' && a.overdue).length;
  const pendingApprovals = window.APPROVALS_FULL.filter(a => a.status === 'pending' && a.currentApprover === 'u15').length;
  const lowStock = window.SKUS.filter(s => s.stock < s.safety).length;
  const overdueOffboarding = window.OFFBOARDING_CASES.filter(c => c.status === 'overdue').length;
  const openRepairs = window.REPAIR_ORDERS.filter(r => r.status === 'open' || r.status === 'in_progress').length;

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Hero — admin specific */}
      <div style={{
        padding: '20px 16px 28px',
        background: 'linear-gradient(180deg, #1F2329 0%, #2E3440 100%)',
        color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(51,112,255,0.18)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar user={me} size={44} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{me.name}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{dept.name} · {me.role}</div>
          </div>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(51,112,255,0.25)', color: '#9DC1FF', fontWeight: 500, letterSpacing: '0.04em' }}>ADMIN</span>
        </div>

        {/* Today summary */}
        <div style={{ marginTop: 18, position: 'relative' }}>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>今日待办</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em' }}>{pendingApprovals + overdueOffboarding}</span>
            <span style={{ fontSize: 13, opacity: 0.7 }}>项需处理</span>
            {overdueApprovals + overdueOffboarding > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 8px', borderRadius: 10, background: 'rgba(245,63,63,0.2)', color: '#FF8F8F', fontWeight: 500 }}>
                <Icon name="warning" size={10} /> {overdueApprovals + overdueOffboarding} 已逾期
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick action grid */}
      <div style={{
        margin: '-18px 12px 0', padding: '14px 4px', borderRadius: 14, background: '#fff',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, rowGap: 4, position: 'relative',
        boxShadow: '0 2px 12px rgba(31,35,41,0.08)',
      }}>
        <QuickAction icon="qr" label="扫码查询" color="#3370FF" bg="#E8F1FF" onClick={() => onNav('scan')} hint="扫资产标签" />
        <QuickAction icon="approval" label="审批" color="#FF8800" bg="#FFF7E8" badge={pendingApprovals} onClick={() => onNav('approvals')} />
        <QuickAction icon="repair" label="维修" color="#00B2C7" bg="#E0F7FA" badge={openRepairs} onClick={() => onNav('repair')} />
        <QuickAction icon="warning" label="库存预警" color="#F53F3F" bg="#FFECE8" badge={lowStock} onClick={() => onNav('lowstock')} />
        <QuickAction icon="user" label="离职归还" color="#7E5EE5" bg="#F1ECFF" badge={overdueOffboarding} onClick={() => onNav('offboarding')} />
        <QuickAction icon="bell" label="Lark 消息" color="#3370FF" bg="#E8F1FF" badge={3} onClick={() => onNav('larkmsg')} hint="未读 3 条" />
        <QuickAction icon="inspect" label="盘点" color="#7E5EE5" bg="#F1ECFF" onClick={() => {}} hint="进行中 2" />
        <QuickAction icon="settings" label="更多" color="#86909C" bg="#F2F3F5" onClick={() => {}} />
      </div>

      {/* Urgent items */}
      <div style={{ margin: '20px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1F2329' }}>🔥 紧急事项</span>
          <span style={{ fontSize: 11, color: '#86909C' }}>{overdueApprovals + overdueOffboarding} 项</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {window.APPROVALS_FULL.filter(a => a.overdue && a.currentApprover === 'u15').slice(0, 2).map(a => {
            const meta = window.APPROVAL_TYPE_META[a.type];
            const applicant = window.getUser(a.applicant);
            return (
              <div key={a.id} onClick={() => onNav('approvals')} style={{
                padding: 12, borderRadius: 12, background: '#fff',
                border: '1px solid #FFD8C8',
                boxShadow: '0 0 0 3px rgba(245,63,63,0.04)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={meta.icon} size={16} color={meta.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1F2329', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {a.target}
                    <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: '#FFECE8', color: '#A8261D', fontWeight: 500 }}>已逾期 {a.waitingHours - a.sla}h</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#86909C', marginTop: 2 }}>{applicant.name} · {meta.label} · 等了 {a.waitingHours}h</div>
                </div>
                <Icon name="chevronRight" size={14} color="#C9CDD4" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Today snapshot — stats row */}
      <div style={{ margin: '20px 16px 0' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2329', marginBottom: 10 }}>系统概况</div>
        <div style={{ background: '#fff', borderRadius: 14, padding: 0, overflow: 'hidden' }}>
          <SnapshotRow icon="assets" iconColor="#3370FF" iconBg="#E8F1FF" label="资产总数" value={window.STATS.total} suffix="件" hint="¥0.18M 总价值" />
          <SnapshotRow icon="repair" iconColor="#FF8800" iconBg="#FFF7E8" label="维修中" value={openRepairs} suffix="单" hint="2 单 SLA 即将到期" />
          <SnapshotRow icon="inspect" iconColor="#7E5EE5" iconBg="#F1ECFF" label="盘点中" value="1" suffix="个任务" hint="进度 67% · 剩 3 天" />
          <SnapshotRow icon="inventory" iconColor="#00B42A" iconBg="#E8FFEA" label="本月发放" value="62" suffix="件" hint="较上月 +18%" last />
        </div>
      </div>

      {/* Notifications */}
      <div style={{ margin: '20px 16px 0' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2329', marginBottom: 10 }}>消息</div>
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden' }}>
          {[
            { icon: 'bell', iconColor: '#3370FF', text: '联想服务点反馈:PC-0088 键盘已更换完毕', time: '12 分钟前', unread: true },
            { icon: 'warning', iconColor: '#FF8800', text: 'USB-C 转 HDMI 转接头库存仅剩 2 个', time: '1 小时前', unread: true },
            { icon: 'check', iconColor: '#00B42A', text: '何雪已确认 Q2 盘点 - 4 件资产无误', time: '昨天 17:30' },
          ].map((n, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, borderBottom: i < arr.length - 1 ? '0.5px solid #F2F3F5' : 'none' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F2F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={n.icon} size={14} color={n.iconColor} />
                </div>
                {n.unread && <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#F53F3F', border: '2px solid #fff' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#1F2329', lineHeight: 1.5 }}>{n.text}</div>
                <div style={{ fontSize: 10, color: '#86909C', marginTop: 3 }}>{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const QuickAction = ({ icon, label, color, bg, onClick, badge, hint }) => (
  <button onClick={onClick} style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 8,
    position: 'relative',
  }}>
    <div style={{ position: 'relative' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={color} />
      </div>
      {badge > 0 && (
        <span style={{
          position: 'absolute', top: -4, right: -4,
          minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9,
          background: '#F53F3F', color: '#fff', fontSize: 10, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px solid #fff', lineHeight: 1,
        }}>{badge}</span>
      )}
    </div>
    <span style={{ fontSize: 12, color: '#1F2329' }}>{label}</span>
    {hint && <span style={{ fontSize: 10, color: '#86909C' }}>{hint}</span>}
  </button>
);

const SnapshotRow = ({ icon, iconColor, iconBg, label, value, suffix, hint, last }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12, padding: 14,
    borderBottom: last ? 'none' : '0.5px solid #F2F3F5',
  }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={16} color={iconColor} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, color: '#86909C' }}>{label}</div>
      <div style={{ fontSize: 11, color: '#86909C', marginTop: 1 }}>{hint}</div>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
      <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>{value}</span>
      <span style={{ fontSize: 11, color: '#86909C' }}>{suffix}</span>
    </div>
    <Icon name="chevronRight" size={14} color="#C9CDD4" />
  </div>
);

const AdminMobileTabBar = ({ route, onNav }) => (
  <div style={{
    height: 60, paddingBottom: 8, background: '#fff', borderTop: '0.5px solid #E5E6EB',
    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
  }}>
    {[
      { id: 'home', icon: 'home', label: '首页' },
      { id: 'approvals', icon: 'approval', label: '审批' },
      { id: 'scan', icon: 'qr', label: '扫码', special: true },
      { id: 'lowstock', icon: 'inventory', label: '库存' },
      { id: 'me', icon: 'user', label: '我的' },
    ].map(tab => {
      if (tab.special) {
        return (
          <button key={tab.id} onClick={() => onNav(tab.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            marginTop: -16,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'linear-gradient(135deg, #3370FF, #5B92FF)',
              boxShadow: '0 4px 14px rgba(51,112,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '3px solid #fff',
            }}>
              <Icon name={tab.icon} size={20} color="#fff" />
            </div>
            <span style={{ fontSize: 10, color: '#3370FF', fontWeight: 500, marginTop: 2 }}>{tab.label}</span>
          </button>
        );
      }
      const active = route === tab.id;
      return (
        <button key={tab.id} onClick={() => onNav(tab.id)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 12px',
        }}>
          <Icon name={tab.icon} size={20} color={active ? '#3370FF' : '#86909C'} />
          <span style={{ fontSize: 10, color: active ? '#3370FF' : '#86909C', fontWeight: active ? 500 : 400 }}>{tab.label}</span>
        </button>
      );
    })}
  </div>
);

// ─── Approvals on mobile — swipeable cards ────────────────
const AdminMobileApprovals = ({ onOpen }) => {
  const [filter, setFilter] = React.useState('mine');
  const items = window.APPROVALS_FULL.filter(a => {
    if (filter === 'mine') return a.status === 'pending' && a.currentApprover === 'u15';
    if (filter === 'urgent') return a.status === 'pending' && a.currentApprover === 'u15' && (a.urgency !== 'normal' || a.overdue);
    return a.status === 'pending';
  });

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Filter chips */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, background: '#fff', borderBottom: '0.5px solid #E5E6EB', position: 'sticky', top: 0, zIndex: 1 }}>
        {[
          { id: 'mine', label: '待我处理', count: window.APPROVALS_FULL.filter(a => a.status === 'pending' && a.currentApprover === 'u15').length },
          { id: 'urgent', label: '紧急', count: window.APPROVALS_FULL.filter(a => a.status === 'pending' && a.currentApprover === 'u15' && (a.urgency !== 'normal' || a.overdue)).length },
          { id: 'all', label: '全部', count: window.APPROVALS_FULL.filter(a => a.status === 'pending').length },
        ].map(opt => (
          <button key={opt.id} onClick={() => setFilter(opt.id)} style={{
            padding: '6px 14px', borderRadius: 16, fontSize: 13,
            background: filter === opt.id ? '#3370FF' : '#F2F3F5',
            color: filter === opt.id ? '#fff' : '#1F2329',
            fontWeight: filter === opt.id ? 500 : 400,
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            {opt.label}
            <span style={{
              fontSize: 11, padding: '0 6px', borderRadius: 8,
              background: filter === opt.id ? 'rgba(255,255,255,0.25)' : '#fff',
              color: filter === opt.id ? '#fff' : '#86909C',
            }}>{opt.count}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(a => <ApprovalMobileCard key={a.id} approval={a} onOpen={onOpen} />)}
        {items.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: '#86909C' }}>
            <Icon name="check" size={36} color="#C9CDD4" />
            <div style={{ marginTop: 12, fontSize: 13 }}>没有待处理的审批 ✨</div>
          </div>
        )}
      </div>
    </div>
  );
};

const ApprovalMobileCard = ({ approval, onOpen }) => {
  const meta = window.APPROVAL_TYPE_META[approval.type];
  const urgency = window.URGENCY_META[approval.urgency];
  const applicant = window.getUser(approval.applicant);
  const dept = window.getDept(applicant?.dept);
  const [swipe, setSwipe] = React.useState(0); // -1 = reject hint, +1 = approve hint
  const [actionResult, setActionResult] = React.useState(null); // 'approved' / 'rejected'

  if (actionResult) {
    return (
      <div style={{
        padding: 18, borderRadius: 14,
        background: actionResult === 'approved' ? '#E8FFEA' : '#FFECE8',
        border: `1px solid ${actionResult === 'approved' ? '#BAF5C5' : '#FFB8B0'}`,
        display: 'flex', alignItems: 'center', gap: 12,
        animation: 'fadeIn 0.3s',
      }}>
        <Icon name={actionResult === 'approved' ? 'check' : 'close'} size={24} color={actionResult === 'approved' ? '#00B42A' : '#F53F3F'} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: actionResult === 'approved' ? '#00863C' : '#A8261D' }}>
            已{actionResult === 'approved' ? '通过' : '驳回'} · {approval.id}
          </div>
          <div style={{ fontSize: 11, color: '#86909C', marginTop: 2 }}>Lark 已通知 {applicant?.name}</div>
        </div>
        <button onClick={() => setActionResult(null)} style={{ fontSize: 11, color: '#86909C', padding: '4px 10px', borderRadius: 12, background: '#fff' }}>撤销</button>
      </div>
    );
  }

  return (
    <div style={{
      padding: 14, borderRadius: 14, background: '#fff',
      border: `1px solid ${approval.overdue ? '#FFD8C8' : '#E5E6EB'}`,
      boxShadow: approval.overdue ? '0 0 0 3px rgba(245,63,63,0.04)' : 'none',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={meta.icon} size={16} color={meta.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '1px 5px', borderRadius: 3, background: meta.bg, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
            {urgency && approval.urgency !== 'normal' && (
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: urgency.bg, color: urgency.color, fontWeight: 500 }}>{urgency.label}</span>
            )}
            {approval.overdue && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#FFECE8', color: '#A8261D', fontWeight: 500 }}>已逾期 {approval.waitingHours - approval.sla}h</span>}
          </div>
          <div className="text-mono" style={{ fontSize: 10, color: '#86909C', marginTop: 2 }}>{approval.id}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2329', marginBottom: 4 }}>{approval.target}</div>
      <div style={{ fontSize: 12, color: '#4E5969', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {approval.reason}
      </div>

      {/* Applicant */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 11, color: '#86909C' }}>
        <Avatar user={applicant} size={20} />
        <span style={{ color: '#1F2329', fontWeight: 500 }}>{applicant?.name}</span>
        <span>· {dept?.name}</span>
        <span style={{ marginLeft: 'auto' }}>{approval.submittedAt.slice(5, 16)}</span>
      </div>

      {/* SLA bar */}
      {approval.sla && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#86909C', marginBottom: 3 }}>
            <span>已等 {approval.waitingHours}h</span>
            <span>SLA {approval.sla}h</span>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: '#F2F3F5', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (approval.waitingHours / approval.sla) * 100)}%`,
              height: '100%',
              background: approval.waitingHours >= approval.sla ? '#F53F3F' : (approval.waitingHours >= approval.sla * 0.75) ? '#FF8800' : '#00B42A',
            }} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setActionResult('rejected')} style={{
          flex: 1, height: 38, borderRadius: 19,
          border: '1px solid #E5E6EB', background: '#fff', color: '#1F2329',
          fontSize: 13, fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="close" size={14} />驳回
        </button>
        <button onClick={() => onOpen(approval)} style={{
          flex: '0 0 60px', height: 38, borderRadius: 19,
          border: '1px solid #E5E6EB', background: '#fff', color: '#86909C',
          fontSize: 13,
        }}>详情</button>
        <button onClick={() => setActionResult('approved')} style={{
          flex: 1.4, height: 38, borderRadius: 19,
          background: '#3370FF', color: '#fff',
          fontSize: 13, fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxShadow: '0 2px 6px rgba(51,112,255,0.25)',
        }}>
          <Icon name="check" size={14} />一键通过
        </button>
      </div>
    </div>
  );
};

// ─── Approval bottom sheet (when "详情" tapped) ───────────
const AdminMobileApprovalSheet = ({ approval, onClose }) => {
  const meta = window.APPROVAL_TYPE_META[approval.type];
  const applicant = window.getUser(approval.applicant);
  const dept = window.getDept(applicant?.dept);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, animation: 'fadeIn 0.2s' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(31,35,41,0.5)' }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: '#fff', borderRadius: '20px 20px 0 0',
        maxHeight: '85%', overflow: 'auto', animation: 'slideUp 0.28s',
      }}>
        <div style={{ padding: '12px 0 8px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E6EB' }} />
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={meta.icon} size={18} color={meta.color} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#86909C' }}>{meta.label} · {approval.id}</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{approval.target}</div>
            </div>
          </div>

          {/* Stock warning */}
          {approval.stockHint?.warning && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FFF7E8', border: '1px solid #FFE4B3', fontSize: 12, color: '#A66200', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="warning" size={14} color="#FF8800" />
              <span><b>库存预警</b> · 当前 {approval.stockHint.stock},低于安全线 {approval.stockHint.safety}</span>
            </div>
          )}

          {/* Fields */}
          <div style={{ background: '#FAFBFC', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            {[
              { k: '申请人', v: <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar user={applicant} size={20} /><span>{applicant?.name} · {dept?.name}</span></div> },
              { k: '申请事由', v: approval.reason },
              { k: '紧急程度', v: window.URGENCY_META[approval.urgency]?.label || '常规' },
              { k: '提交时间', v: approval.submittedAt },
              { k: '已等待', v: <span style={{ color: approval.overdue ? '#F53F3F' : '#1F2329', fontWeight: 500 }}>{approval.waitingHours}h{approval.overdue ? ' (已逾期)' : ''}</span> },
            ].map((row, i, arr) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '6px 0', fontSize: 12, borderBottom: i < arr.length - 1 ? '0.5px solid #F2F3F5' : 'none' }}>
                <span style={{ flex: '0 0 76px', color: '#86909C' }}>{row.k}</span>
                <div style={{ flex: 1, color: '#1F2329' }}>{row.v}</div>
              </div>
            ))}
          </div>

          {/* Approval chain */}
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>审批流</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 18 }}>
            {approval.approvalChain?.map((step, i, arr) => {
              const u = window.getUser(step.user);
              const stepStyle = { approved: '#00B42A', pending: '#FF8800', rejected: '#F53F3F' }[step.status];
              return (
                <React.Fragment key={i}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 50 }}>
                    <div style={{ position: 'relative' }}>
                      <Avatar user={u} size={32} />
                      <div style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 14, height: 14, borderRadius: '50%', background: stepStyle,
                        border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon name={step.status === 'approved' ? 'check' : step.status === 'rejected' ? 'close' : 'clock'} size={7} color="#fff" />
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: step.status === 'pending' ? '#FF8800' : '#1F2329', fontWeight: 500 }}>{u?.name?.slice(0, 3)}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ flex: 1, height: 2, background: step.status === 'approved' ? '#00B42A' : '#E5E6EB', marginTop: 14 }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Action area */}
          <textarea placeholder="审批意见(可选)" style={{
            width: '100%', minHeight: 60, padding: 12, borderRadius: 10,
            border: '1px solid #E5E6EB', fontSize: 13, fontFamily: 'var(--font-sans)',
            resize: 'vertical', marginBottom: 12, outline: 'none',
          }} />

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, height: 44, borderRadius: 22, border: '1px solid #E5E6EB', background: '#fff',
              fontSize: 14, color: '#F53F3F', fontWeight: 500,
            }}>驳回</button>
            <button onClick={onClose} style={{
              flex: 1.5, height: 44, borderRadius: 22, background: '#3370FF', color: '#fff',
              fontSize: 14, fontWeight: 500, border: 'none',
              boxShadow: '0 4px 12px rgba(51,112,255,0.3)',
            }}>通过审批</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Scan ────────────────────────────────────────────────
const AdminMobileScan = ({ onBack }) => {
  const [scanned, setScanned] = React.useState(null);

  // Simulate "scan complete" after delay
  React.useEffect(() => {
    if (!scanned) {
      const t = setTimeout(() => setScanned(window.ASSETS[0]), 2500);
      return () => clearTimeout(t);
    }
  }, [scanned]);

  if (scanned) {
    return <ScanResult asset={scanned} onScanAgain={() => setScanned(null)} />;
  }

  return (
    <div style={{ height: '100%', background: '#000', position: 'relative', overflow: 'hidden' }}>
      {/* Fake camera feed — animated gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, #2A3140 0%, #0F1218 100%)',
        opacity: 0.9,
      }} />

      {/* Scan frame */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -55%)',
        width: 240, height: 240,
      }}>
        {/* Corners */}
        {[{ t: 0, l: 0 }, { t: 0, r: 0 }, { b: 0, l: 0 }, { b: 0, r: 0 }].map((p, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: p.t !== undefined ? 0 : 'auto',
            bottom: p.b !== undefined ? 0 : 'auto',
            left: p.l !== undefined ? 0 : 'auto',
            right: p.r !== undefined ? 0 : 'auto',
            width: 32, height: 32,
            borderTop: p.t !== undefined ? '3px solid #3370FF' : 'none',
            borderBottom: p.b !== undefined ? '3px solid #3370FF' : 'none',
            borderLeft: p.l !== undefined ? '3px solid #3370FF' : 'none',
            borderRight: p.r !== undefined ? '3px solid #3370FF' : 'none',
          }} />
        ))}
        {/* Scanning line */}
        <div style={{
          position: 'absolute', top: 0, left: 8, right: 8, height: 2,
          background: 'linear-gradient(90deg, transparent, #3370FF, transparent)',
          boxShadow: '0 0 12px #3370FF',
          animation: 'scan 2s ease-in-out infinite',
        }} />
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(236px); }
        }
      `}</style>

      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 100, left: 0, right: 0,
        textAlign: 'center', color: '#fff',
      }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>对准资产标签二维码</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>识别后自动跳转资产详情</div>
      </div>

      {/* Bottom toolbar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 24px',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      }}>
        <button style={{ color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
            <Icon name="more" size={20} />
          </div>
          手输编号
        </button>
        <button style={{ color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
            <Icon name="upload" size={20} />
          </div>
          从相册
        </button>
      </div>
    </div>
  );
};

const ScanResult = ({ asset, onScanAgain }) => {
  const u = window.getUser(asset.owner);
  const d = u ? window.getDept(u.dept) : null;
  return (
    <div className="fade-in" style={{ padding: 16, paddingBottom: 80 }}>
      <div style={{ padding: '12px 14px', borderRadius: 10, background: '#E8FFEA', border: '1px solid #BAF5C5', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon name="check" size={16} color="#00B42A" />
        <span style={{ fontSize: 13, color: '#00863C', fontWeight: 500 }}>识别成功</span>
      </div>

      <div style={{ padding: 16, borderRadius: 14, background: '#fff', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <AssetTypeIcon typeId={asset.type} size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span className="text-mono" style={{ fontSize: 11, color: '#3370FF', fontWeight: 500, padding: '1px 5px', background: '#E8F1FF', borderRadius: 3 }}>{asset.code}</span>
              <StatusBadge status={asset.status} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{asset.name}</div>
            <div style={{ fontSize: 11, color: '#86909C', marginTop: 2 }}>{asset.brand} · {asset.model}</div>
          </div>
        </div>

        {u && (
          <div style={{ padding: '10px 12px', borderRadius: 8, background: '#F5F9FF', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <Avatar user={u} size={28} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{u.name}</div>
              <div style={{ color: '#86909C' }}>{d?.name} · {u.role}</div>
            </div>
            <span style={{ fontSize: 11, color: '#3370FF' }}>责任人 →</span>
          </div>
        )}

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
          <div><div style={{ color: '#86909C', fontSize: 10 }}>采购日期</div><div>{asset.purchase}</div></div>
          <div><div style={{ color: '#86909C', fontSize: 10 }}>保修截止</div><div>{asset.warranty}</div></div>
          <div><div style={{ color: '#86909C', fontSize: 10 }}>存放地点</div><div>{asset.location}</div></div>
          <div><div style={{ color: '#86909C', fontSize: 10 }}>采购价</div><div>¥{asset.price.toLocaleString()}</div></div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button style={{ height: 48, borderRadius: 24, background: '#3370FF', color: '#fff', fontSize: 14, fontWeight: 500, border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="verify" size={16} />确认盘点
        </button>
        <button style={{ height: 48, borderRadius: 24, background: '#fff', color: '#1F2329', fontSize: 14, border: '1px solid #E5E6EB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="repair" size={16} />报修
        </button>
        <button style={{ height: 48, borderRadius: 24, background: '#fff', color: '#1F2329', fontSize: 14, border: '1px solid #E5E6EB' }}>查看完整详情</button>
        <button onClick={onScanAgain} style={{ height: 40, color: '#3370FF', fontSize: 13 }}>继续扫码下一个</button>
      </div>
    </div>
  );
};

// ─── Low stock view ──────────────────────────────────────
const AdminMobileLowStock = () => {
  const lowSkus = window.SKUS.filter(s => s.stock < s.safety);
  return (
    <div style={{ padding: 16, paddingBottom: 20 }}>
      <div style={{ padding: '12px 14px', borderRadius: 10, background: '#FFF7E8', border: '1px solid #FFE4B3', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Icon name="warning" size={16} color="#FF8800" />
        <div style={{ flex: 1, fontSize: 12, color: '#A66200' }}>
          <b>{lowSkus.length} 个 SKU 库存低于安全线</b>
          <div style={{ opacity: 0.8, marginTop: 2 }}>建议尽快补货,可一键生成补货单</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lowSkus.map(s => (
          <div key={s.sku} style={{ padding: 14, borderRadius: 12, background: '#fff', border: '1px solid #FFD8C8' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#FFECE8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="package" size={18} color="#F53F3F" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: '#86909C', marginTop: 2 }}>{s.brand} · {s.spec}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#F53F3F' }}>{s.stock}</div>
                <div style={{ fontSize: 10, color: '#86909C' }}>{s.unit} / 安全 {s.safety}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, height: 36, borderRadius: 18, border: '1px solid #E5E6EB', background: '#fff', fontSize: 12 }}>详情</button>
              <button style={{ flex: 1, height: 36, borderRadius: 18, background: '#3370FF', color: '#fff', fontSize: 12, fontWeight: 500, border: 'none' }}>
                补货 +{s.max - s.stock}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

Object.assign(window, { AdminMobile });

// ─── M6: Repair orders mobile ─────────────────────────────
const AdminMobileRepair = ({ onOpen }) => {
  const [filter, setFilter] = React.useState('active');
  const items = window.REPAIR_ORDERS.filter(r => {
    if (filter === 'active') return r.status === 'open' || r.status === 'in_progress';
    if (filter === 'overdue') {
      if (r.status !== 'in_progress' || !r.expectedReturnAt) return false;
      return new Date(r.expectedReturnAt) < new Date('2026-05-18');
    }
    return r.status === 'completed';
  });

  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, background: '#fff', borderBottom: '0.5px solid #E5E6EB', position: 'sticky', top: 0, zIndex: 1 }}>
        {[
          { id: 'active', label: '进行中', count: window.REPAIR_ORDERS.filter(r => r.status === 'open' || r.status === 'in_progress').length },
          { id: 'overdue', label: '已延期', count: 1, danger: true },
          { id: 'completed', label: '已完结', count: window.REPAIR_ORDERS.filter(r => r.status === 'completed').length },
        ].map(opt => (
          <button key={opt.id} onClick={() => setFilter(opt.id)} style={{
            padding: '6px 14px', borderRadius: 16, fontSize: 13,
            background: filter === opt.id ? (opt.danger ? '#F53F3F' : '#3370FF') : '#F2F3F5',
            color: filter === opt.id ? '#fff' : (opt.danger ? '#F53F3F' : '#1F2329'),
            fontWeight: filter === opt.id ? 500 : 400,
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            {opt.label}
            <span style={{
              fontSize: 11, padding: '0 6px', borderRadius: 8,
              background: filter === opt.id ? 'rgba(255,255,255,0.25)' : '#fff',
              color: filter === opt.id ? '#fff' : '#86909C',
            }}>{opt.count}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(r => <RepairMobileCard key={r.id} order={r} onOpen={onOpen} />)}
        {items.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: '#86909C' }}>
            <Icon name="check" size={36} color="#C9CDD4" />
            <div style={{ marginTop: 12, fontSize: 13 }}>暂无{filter === 'active' ? '进行中' : filter === 'overdue' ? '延期' : '已完结'}工单</div>
          </div>
        )}
      </div>
    </div>
  );
};

const RepairMobileCard = ({ order, onOpen }) => {
  const asset = window.ASSETS.find(a => a.code === order.assetCode);
  const opener = window.getUser(order.openedBy);
  const meta = window.REPAIR_STATUS_META?.[order.status] || { label: order.status, color: '#86909C', bg: '#F2F3F5' };
  const stageInfo = {
    opened: { label: '已报修', n: 1, of: 5, color: '#FF8800' },
    reviewed: { label: 'IT 受理', n: 2, of: 5, color: '#FF8800' },
    shipped: { label: '送修中', n: 3, of: 5, color: '#3370FF' },
    in_progress: { label: '维修中', n: 4, of: 5, color: '#3370FF' },
    returned: { label: '已返厂', n: 5, of: 5, color: '#7E5EE5' },
    completed: { label: '完结', n: 5, of: 5, color: '#00B42A' },
    cancelled: { label: '已取消', n: 0, of: 5, color: '#86909C' },
  };
  const lastStage = order.timeline[order.timeline.length - 1]?.stage || 'opened';
  const stage = stageInfo[lastStage];

  // SLA / overdue
  const isOverdue = order.expectedReturnAt && new Date(order.expectedReturnAt) < new Date('2026-05-18') && order.status === 'in_progress';

  return (
    <div onClick={() => onOpen(order)} style={{
      padding: 14, borderRadius: 14, background: '#fff',
      border: `1px solid ${isOverdue ? '#FFD8C8' : '#E5E6EB'}`,
      boxShadow: isOverdue ? '0 0 0 3px rgba(245,63,63,0.04)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <AssetTypeIcon typeId={asset?.type || 't1'} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 2 }}>
            <span className="text-mono" style={{ fontSize: 10, color: '#3370FF', fontWeight: 500, padding: '1px 5px', background: '#E8F1FF', borderRadius: 3 }}>{order.id}</span>
            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: meta.bg, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
            {order.warrantyCovered && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#E8FFEA', color: '#00863C', fontWeight: 500 }}>保修内</span>}
            {isOverdue && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#FFECE8', color: '#A8261D', fontWeight: 500 }}>已延期</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2329' }}>{order.assetName}</div>
          <div style={{ fontSize: 11, color: '#86909C', marginTop: 1 }}>{order.assetCode} · 报修人 {opener?.name}</div>
        </div>
      </div>

      {/* Reason */}
      <div style={{ fontSize: 12, color: '#4E5969', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {order.reason}
      </div>

      {/* Progress steps - mobile compact */}
      {stage.n > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#86909C', marginBottom: 5 }}>
            <span>当前 · <b style={{ color: stage.color }}>{stage.label}</b></span>
            <span>{stage.n}/{stage.of} 步</span>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: stage.of }).map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i < stage.n ? stage.color : '#F2F3F5',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Footer: vendor + due date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#86909C' }}>
        <span>
          {order.repairType === 'external' ? `送修 · ${order.vendor || ''}` : '内部维修'}
        </span>
        {order.expectedReturnAt && order.status === 'in_progress' && (
          <span style={{ color: isOverdue ? '#F53F3F' : '#86909C', fontWeight: isOverdue ? 500 : 400 }}>
            预计返还 {order.expectedReturnAt}
            {isOverdue && ` · 已延期 ${Math.abs(Math.ceil((new Date(order.expectedReturnAt) - new Date('2026-05-18')) / 86400000))} 天`}
          </span>
        )}
        {order.status === 'completed' && order.cost !== null && (
          <span style={{ color: order.warrantyCovered ? '#00B42A' : '#1F2329' }}>
            费用 ¥{order.cost}{order.warrantyCovered && ' · 免'}
          </span>
        )}
      </div>
    </div>
  );
};

const AdminMobileRepairSheet = ({ order, onClose }) => {
  const asset = window.ASSETS.find(a => a.code === order.assetCode);
  const opener = window.getUser(order.openedBy);
  const stageInfo = {
    opened: { label: '已报修', color: '#FF8800', icon: 'request' },
    reviewed: { label: 'IT 受理', color: '#FF8800', icon: 'check' },
    shipped: { label: '送修中', color: '#3370FF', icon: 'arrowRight' },
    in_progress: { label: '维修中', color: '#3370FF', icon: 'repair' },
    returned: { label: '已返厂', color: '#7E5EE5', icon: 'refresh' },
    completed: { label: '完结', color: '#00B42A', icon: 'verify' },
    cancelled: { label: '已取消', color: '#86909C', icon: 'close' },
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, animation: 'fadeIn 0.2s' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(31,35,41,0.5)' }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: '#fff', borderRadius: '20px 20px 0 0',
        maxHeight: '90%', overflow: 'auto', animation: 'slideUp 0.28s',
      }}>
        <div style={{ padding: '12px 0 8px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E6EB' }} />
        </div>
        <div style={{ padding: '0 20px 24px' }}>
          {/* Hero */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <AssetTypeIcon typeId={asset?.type || 't1'} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-mono" style={{ fontSize: 11, color: '#3370FF', fontWeight: 500 }}>{order.id}</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{order.assetName}</div>
              <div style={{ fontSize: 11, color: '#86909C' }}>{order.assetCode}</div>
            </div>
          </div>

          {/* Reason */}
          <div style={{ padding: 12, borderRadius: 10, background: '#FFF7E8', border: '1px solid #FFE4B3', fontSize: 13, color: '#1F2329', lineHeight: 1.6, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#A66200', fontWeight: 500, marginBottom: 3 }}>问题</div>
            {order.reason}
          </div>

          {/* Timeline */}
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>维修进度</div>
          <div style={{ marginBottom: 16, position: 'relative' }}>
            {order.timeline.map((e, i) => {
              const isLast = i === order.timeline.length - 1;
              const info = stageInfo[e.stage] || stageInfo.opened;
              const op = e.by ? window.getUser(e.by) : null;
              return (
                <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: isLast ? 0 : 16, position: 'relative' }}>
                  {!isLast && <div style={{ position: 'absolute', left: 13, top: 28, bottom: 0, width: 2, background: '#E5E6EB' }} />}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: `${info.color}14`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, border: `2px solid ${info.color}`,
                    boxShadow: isLast && order.status !== 'completed' && order.status !== 'cancelled' ? `0 0 0 4px ${info.color}33` : 'none',
                    zIndex: 1,
                  }}>
                    <Icon name={info.icon} size={12} color={info.color} />
                  </div>
                  <div style={{ flex: 1, paddingTop: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{e.action}</div>
                    {e.note && <div style={{ fontSize: 11, color: '#4E5969', marginTop: 2 }}>{e.note}</div>}
                    <div style={{ fontSize: 10, color: '#86909C', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                      {op?.name && `${op.name} · `}{e.t}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Meta info */}
          <div style={{ background: '#FAFBFC', borderRadius: 10, padding: 12, marginBottom: 16 }}>
            {[
              { k: '报修人', v: opener?.name },
              { k: '维修方式', v: order.repairType === 'external' ? '外送' : '内部' },
              order.vendor && { k: '服务方', v: order.vendor },
              order.expectedReturnAt && { k: '预计返还', v: order.expectedReturnAt },
              order.cost !== null && { k: '维修费用', v: `¥${order.cost}${order.warrantyCovered ? ' · 保修免' : ''}` },
            ].filter(Boolean).map((row, i, arr) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '5px 0', fontSize: 12, borderBottom: i < arr.length - 1 ? '0.5px solid #F2F3F5' : 'none' }}>
                <span style={{ flex: '0 0 70px', color: '#86909C' }}>{row.k}</span>
                <span style={{ flex: 1, color: '#1F2329' }}>{row.v}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          {(order.status === 'open' || order.status === 'in_progress') && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, height: 44, borderRadius: 22, border: '1px solid #E5E6EB', background: '#fff', fontSize: 13, color: '#1F2329' }}>更新进度</button>
              <button style={{ flex: 1.4, height: 44, borderRadius: 22, background: '#3370FF', color: '#fff', fontSize: 14, fontWeight: 500, border: 'none', boxShadow: '0 4px 12px rgba(51,112,255,0.3)' }}>
                推进到下一步
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── M7: Offboarding mobile ──────────────────────────────
const AdminMobileOffboarding = ({ onOpen }) => {
  const cases = window.OFFBOARDING_CASES.filter(c => c.status !== 'completed');

  return (
    <div style={{ padding: '14px 12px', paddingBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {cases.map(c => <OffboardingMobileCard key={c.id} offcase={c} onOpen={onOpen} />)}
    </div>
  );
};

const OffboardingMobileCard = ({ offcase, onOpen }) => {
  const user = window.getUser(offcase.user);
  const dept = window.getDept(user?.dept);
  const meta = window.OFFBOARDING_STATUS_META[offcase.status];
  const returnedCount = offcase.items.filter(i => i.status === 'returned').length;
  const lostCount = offcase.items.filter(i => i.status === 'lost').length;
  const totalCount = offcase.items.length;
  const completion = totalCount === 0 ? 100 : Math.round((returnedCount + lostCount) / totalCount * 100);
  const daysToLastDay = Math.ceil((new Date(offcase.lastDay) - new Date('2026-05-18')) / 86400000);
  const isOverdue = offcase.status === 'overdue';

  return (
    <div onClick={() => onOpen(offcase)} style={{
      padding: 14, borderRadius: 14, background: '#fff',
      border: `1px solid ${isOverdue ? '#FFD8C8' : '#E5E6EB'}`,
      boxShadow: isOverdue ? '0 0 0 3px rgba(245,63,63,0.04)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ position: 'relative' }}>
          <Avatar user={user} size={44} />
          <CircleProgress percent={completion} size={52} color={completion === 100 ? '#00B42A' : isOverdue ? '#F53F3F' : '#3370FF'} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{user?.name}</span>
            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: meta.bg, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
          </div>
          <div style={{ fontSize: 11, color: '#86909C' }}>{dept?.name} · {user?.role}</div>
          <div style={{ fontSize: 11, color: daysToLastDay < 0 ? '#F53F3F' : daysToLastDay <= 3 ? '#FF8800' : '#86909C', fontWeight: 500, marginTop: 3 }}>
            {daysToLastDay < 0 ? `已离职 ${Math.abs(daysToLastDay)} 天` : daysToLastDay === 0 ? '今天最后一天' : `${daysToLastDay} 天后离职`}
          </div>
        </div>
      </div>

      {/* Items mini list */}
      <div style={{ background: '#FAFBFC', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
          <span style={{ color: '#86909C' }}>名下资产 · {totalCount} 件</span>
          <span style={{ color: '#1F2329', fontWeight: 500 }}>{returnedCount + lostCount}/{totalCount}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {offcase.items.slice(0, 3).map(item => {
            const stm = window.ITEM_RETURN_STATUS_META[item.status];
            return (
              <div key={item.code} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: stm.color }} />
                <span style={{ flex: 1, color: '#1F2329', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                <span style={{ color: stm.color, fontWeight: 500 }}>{stm.label}</span>
              </div>
            );
          })}
          {offcase.items.length > 3 && (
            <div style={{ fontSize: 11, color: '#86909C', textAlign: 'center', marginTop: 2 }}>还有 {offcase.items.length - 3} 件</div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={(e) => { e.stopPropagation(); }} style={{
          flex: 1, height: 36, borderRadius: 18, border: '1px solid #E5E6EB', background: '#fff',
          fontSize: 12, color: '#1F2329', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <Icon name="bell" size={12} />催办
        </button>
        <button style={{
          flex: 1.4, height: 36, borderRadius: 18, background: '#3370FF', color: '#fff',
          fontSize: 12, fontWeight: 500, border: 'none',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <Icon name="qr" size={12} />扫码验收
        </button>
      </div>
    </div>
  );
};

const AdminMobileOffboardingSheet = ({ offcase, onClose }) => {
  const user = window.getUser(offcase.user);
  const dept = window.getDept(user?.dept);
  const meta = window.OFFBOARDING_STATUS_META[offcase.status];
  const totalValue = offcase.items.reduce((s, i) => s + i.value, 0);
  const returnedValue = offcase.items.filter(i => i.status === 'returned').reduce((s, i) => s + i.value, 0);
  const pendingValue = offcase.items.filter(i => i.status === 'return_pending').reduce((s, i) => s + i.value, 0);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, animation: 'fadeIn 0.2s' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(31,35,41,0.5)' }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: '#fff', borderRadius: '20px 20px 0 0',
        maxHeight: '92%', overflow: 'auto', animation: 'slideUp 0.28s',
      }}>
        <div style={{ padding: '12px 0 8px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E6EB' }} />
        </div>
        <div style={{ padding: '0 20px 24px' }}>
          {/* Hero */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Avatar user={user} size={48} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{user?.name}</span>
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: meta.bg, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
              </div>
              <div style={{ fontSize: 11, color: '#86909C' }}>{dept?.name} · 最后工作日 <b style={{ color: '#1F2329' }}>{offcase.lastDay}</b></div>
              <div style={{ fontSize: 11, color: '#86909C', marginTop: 2 }}>{offcase.id} · 离职原因:{offcase.reason}</div>
            </div>
          </div>

          {/* Value summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 16 }}>
            <ValueBoxMobile label="总价值" value={`¥${(totalValue/1000).toFixed(1)}k`} color="#1F2329" />
            <ValueBoxMobile label="已回收" value={`¥${(returnedValue/1000).toFixed(1)}k`} color="#00B42A" />
            <ValueBoxMobile label="待归还" value={`¥${(pendingValue/1000).toFixed(1)}k`} color="#FF8800" />
          </div>

          {/* Items */}
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>名下资产 ({offcase.items.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {offcase.items.map(item => {
              const stm = window.ITEM_RETURN_STATUS_META[item.status];
              return (
                <div key={item.code} style={{
                  padding: 12, borderRadius: 10,
                  background: item.status === 'return_pending' && item.overdueDays ? '#FFF7F5' : '#FAFBFC',
                  border: '1px solid var(--divider)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <AssetTypeIcon typeId={item.type} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                        <span className="text-mono" style={{ fontSize: 10, color: '#3370FF', fontWeight: 500 }}>{item.code}</span>
                        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: stm.bg, color: stm.color, fontWeight: 500 }}>{stm.label}</span>
                        {item.overdueDays && <span style={{ fontSize: 10, color: '#F53F3F', fontWeight: 500 }}>· 逾期 {item.overdueDays} 天</span>}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: '#86909C', marginTop: 2 }}>¥{item.value.toLocaleString()}{item.returnedAt && ` · 归还于 ${item.returnedAt}`}</div>
                    </div>
                  </div>

                  {item.status === 'return_pending' && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--divider)' }}>
                      <button style={{
                        flex: 1, height: 32, borderRadius: 16, fontSize: 11,
                        border: '1px solid #FFB8B0', background: '#fff', color: '#F53F3F',
                      }}>登记丢失</button>
                      <button style={{
                        flex: 1.5, height: 32, borderRadius: 16, fontSize: 11, fontWeight: 500,
                        background: '#3370FF', color: '#fff', border: 'none',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}>
                        <Icon name="check" size={11} />确认归还
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom action */}
          <button disabled={offcase.items.some(i => i.status === 'return_pending')}
            style={{
              width: '100%', height: 48, borderRadius: 24,
              background: offcase.items.some(i => i.status === 'return_pending') ? '#C9CDD4' : '#3370FF',
              color: '#fff', fontSize: 14, fontWeight: 500, border: 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: offcase.items.some(i => i.status === 'return_pending') ? 'none' : '0 4px 12px rgba(51,112,255,0.3)',
            }}>
            <Icon name="check" size={14} />确认归还完成 · 关闭工单
          </button>
        </div>
      </div>
    </div>
  );
};

const ValueBoxMobile = ({ label, value, color }) => (
  <div style={{ background: '#FAFBFC', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--divider)', textAlign: 'center' }}>
    <div style={{ fontSize: 10, color: '#86909C' }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 600, color, letterSpacing: '-0.01em', marginTop: 2 }}>{value}</div>
  </div>
);

// ─── M8: Lark messages preview ───────────────────────────
const AdminMobileLarkMessages = () => {
  const messages = [
    {
      type: 'approval', unread: true, time: '12:42',
      from: 'IT 资产管理机器人',
      preview: '何雪 提交了资产领用申请',
      target: 'MacBook Pro 14"',
      meta: window.APPROVAL_TYPE_META.asset_request,
      cardData: window.APPROVALS_FULL[0],
    },
    {
      type: 'alert', unread: true, time: '11:15',
      from: 'IT 资产管理机器人',
      preview: '库存预警 · USB-C 转 HDMI 转接头',
      stockData: { name: 'USB-C 转 HDMI 转接头', stock: 2, safety: 5 },
    },
    {
      type: 'repair', unread: true, time: '09:30',
      from: '联想认证服务点',
      preview: 'REP-2026-0042 · 维修完成,可来取',
      repairData: window.REPAIR_ORDERS.find(r => r.id === 'REP-2026-0042'),
    },
    {
      type: 'reminder', unread: false, time: '昨天 18:00',
      from: 'IT 资产管理机器人',
      preview: '提醒:胡涛(u14)5/22 离职,4 件资产待归还',
    },
  ];

  return (
    <div style={{ background: '#F4F5F7', minHeight: '100%' }}>
      <div style={{ padding: '12px 16px', background: '#fff', borderBottom: '0.5px solid #E5E6EB', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="bell" size={14} color="#3370FF" />
        <span style={{ fontSize: 12, color: '#4E5969' }}>显示 <b style={{ color: '#1F2329' }}>IT 资产管理</b> 相关 Lark 消息</span>
      </div>

      <div style={{ padding: '12px 12px 80px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10 }}>
            {/* Bot avatar */}
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: m.from.includes('联想') ? 'linear-gradient(135deg, #E53039, #B12027)' : 'linear-gradient(135deg, #3370FF, #5B92FF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)', position: 'relative',
            }}>
              {m.from.includes('联想') ? (
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>L</span>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" stroke="#fff" strokeWidth="2"/>
                </svg>
              )}
              {m.unread && <span style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: '#F53F3F', border: '2px solid #F4F5F7' }} />}
            </div>

            {/* Card */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#1F2329', fontWeight: 500 }}>{m.from}</span>
                <span style={{ fontSize: 11, color: '#86909C' }}>{m.time}</span>
              </div>

              {/* Different card types */}
              {m.type === 'approval' && (
                <LarkInlineCard headerColor={m.meta.color} headerBg={m.meta.bg} headerLabel={`📥 待审批 · ${m.meta.label}`} title={m.target}
                  rows={[
                    { k: '申请人', v: window.getUser(m.cardData.applicant)?.name },
                    { k: '事由', v: m.cardData.reason },
                  ]}
                  actions={[
                    { label: '查看详情', primary: false },
                    { label: '同意', primary: true },
                    { label: '拒绝', primary: false },
                  ]}
                />
              )}
              {m.type === 'alert' && (
                <LarkInlineCard headerColor="#FF8800" headerBg="#FFF7E8" headerLabel="⚠️ 库存预警" title={m.stockData.name}
                  rows={[
                    { k: '当前库存', v: <span style={{ color: '#F53F3F', fontWeight: 600 }}>{m.stockData.stock} 个</span> },
                    { k: '安全库存', v: `${m.stockData.safety} 个` },
                    { k: '建议补货', v: '尽快采购' },
                  ]}
                  actions={[
                    { label: '查看 SKU', primary: false },
                    { label: '生成补货单', primary: true },
                  ]}
                />
              )}
              {m.type === 'repair' && (
                <LarkInlineCard headerColor="#00B42A" headerBg="#E8FFEA" headerLabel="✅ 维修完成通知" title={m.repairData.assetName}
                  rows={[
                    { k: '工单', v: m.repairData.id },
                    { k: '处理结果', v: '键盘模组已更换,保修内免费' },
                    { k: '可取时间', v: '今日 14:00 后' },
                  ]}
                  actions={[
                    { label: '查看工单', primary: false },
                    { label: '安排取件', primary: true },
                  ]}
                />
              )}
              {m.type === 'reminder' && (
                <div style={{ padding: 12, borderRadius: 10, background: '#fff', border: '1px solid #E5E6EB', fontSize: 13, color: '#1F2329' }}>
                  📋 {m.preview}
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid #F2F3F5' }}>
                    <button style={{ fontSize: 12, color: '#3370FF', fontWeight: 500 }}>查看清单 →</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LarkInlineCard = ({ headerColor, headerBg, headerLabel, title, rows, actions }) => (
  <div style={{ borderRadius: 10, overflow: 'hidden', background: '#fff', border: '1px solid #E5E6EB' }}>
    <div style={{ padding: '8px 12px', background: headerBg, color: headerColor, fontSize: 11, fontWeight: 500 }}>
      {headerLabel}
    </div>
    <div style={{ padding: '10px 12px' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2329', marginBottom: 8 }}>{title}</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, padding: '3px 0' }}>
          <span style={{ flex: '0 0 50px', color: '#86909C' }}>{r.k}</span>
          <span style={{ flex: 1, color: '#1F2329', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.v}</span>
        </div>
      ))}
    </div>
    {actions && (
      <div style={{ padding: '0 12px 12px', display: 'flex', gap: 6 }}>
        {actions.map((a, i) => (
          <button key={i} style={{
            flex: 1, height: 30, borderRadius: 6, fontSize: 12,
            background: a.primary ? '#3370FF' : '#fff',
            color: a.primary ? '#fff' : '#1F2329',
            border: a.primary ? 'none' : '1px solid #E5E6EB',
            fontWeight: a.primary ? 500 : 400,
          }}>{a.label}</button>
        ))}
      </div>
    )}
  </div>
);
