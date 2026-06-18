// Main App — orchestrates admin shell + employee view
const App = () => {
  const [active, setActive] = React.useState('dashboard');
  const [drawerAsset, setDrawerAsset] = React.useState(null);
  const [employeeMode, setEmployeeMode] = React.useState(false);

  const currentUser = window.getUser('u15'); // 林峰 IT 管理员

  // Placeholder screens
  const placeholder = (title, hint) => (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{hint}</div>
      </div>
      <Card padding={48} style={{ flex: 1 }} bodyStyle={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 80, height: 80, borderRadius: 20, background: 'var(--lark-blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="settings" size={36} color="var(--lark-blue)" />
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-2)' }}>本演示聚焦核心 5 屏</div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', maxWidth: 400, lineHeight: 1.7 }}>
          {hint}<br />
          本原型重点展示了 <b style={{ color: 'var(--text-2)' }}>工作台、资产台账、资产详情、库存物品、员工端申请</b> 这 5 个核心场景。
        </div>
        <Button variant="primary" onClick={() => setActive('dashboard')}>返回工作台</Button>
      </Card>
    </div>
  );

  const renderScreen = () => {
    switch (active) {
      case 'dashboard':
        return <Dashboard onNav={setActive} onOpenAsset={setDrawerAsset} />;
      case 'assets':
        return <AssetList onOpenAsset={setDrawerAsset} />;
      case 'inventory':
        return <Inventory />;
      case 'approval':
        return placeholder('审批中心', '展示所有待审批申请,支持批量审批和审批流可视化。');
      case 'inspect':
        return placeholder('盘点管理', '发起盘点任务、追踪员工确认进度的看板。');
      case 'repair':
        return placeholder('维修报废', '维修工单、报废申请、财务确认。');
      case 'report':
        return placeholder('报表统计', '资产折旧、领用消耗、采购成本等报表。');
      case 'settings':
        return placeholder('系统设置', '用户角色、Lark 配置、消息模板、审批流配置。');
      default:
        return <Dashboard onNav={setActive} onOpenAsset={setDrawerAsset} />;
    }
  };

  return (
    <div className="frame-host">
      <ChromeWindow
        width={1440}
        height={920}
        tabs={[
          { title: 'IT 资产管理 - 工作台' },
          { title: 'Lark · 飞书' },
          { title: 'Notion' },
        ]}
        activeIndex={0}
        url="asset.company.com/admin">
        <div style={{ display: 'flex', height: '100%', background: '#fff' }}>
          <Sidebar active={active} onNav={setActive} onEmployeeView={() => setEmployeeMode(true)} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-canvas)' }}>
            <Topbar active={active} currentUser={currentUser} />
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {renderScreen()}
            </div>
          </div>
        </div>
      </ChromeWindow>

      {/* Asset detail drawer */}
      <AssetDetail asset={drawerAsset} open={!!drawerAsset} onClose={() => setDrawerAsset(null)} />

      {/* Employee mode overlay */}
      {employeeMode && <EmployeeOverlay onClose={() => setEmployeeMode(false)} />}
    </div>
  );
};

// Employee preview — centered "H5 page" with surrounding dim
const EmployeeOverlay = ({ onClose }) => {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(15, 20, 30, 0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    }}>
      {/* Background label */}
      <div style={{
        position: 'absolute', top: 32, left: 0, right: 0,
        textAlign: 'center', color: 'rgba(255,255,255,0.85)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.7 }}>Employee View</div>
        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4, letterSpacing: '-0.01em' }}>员工端 · Lark H5 预览</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>员工通过 Lark 工作台进入 · 免登录 · 中英双语</div>
      </div>

      {/* Close button */}
      <button onClick={onClose} style={{
        position: 'absolute', top: 28, right: 28,
        width: 40, height: 40, borderRadius: 20,
        background: 'rgba(255,255,255,0.12)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.18)',
      }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}>
        <Icon name="close" size={18} />
      </button>

      {/* Phone-like H5 frame (without device bezel per spec) */}
      <div style={{
        width: 390, height: 780,
        borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1)',
        animation: 'fadeIn 0.3s 0.05s both',
      }}>
        <EmployeeApp onClose={onClose} />
      </div>

      {/* Side annotation */}
      <div style={{
        position: 'absolute', right: 'calc(50% - 320px)', top: '50%', transform: 'translateY(-50%)',
        color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 1.8, maxWidth: 200,
      }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>体验路径</div>
        <div style={{ opacity: 0.85 }}>① 点击「申请领用」</div>
        <div style={{ opacity: 0.85 }}>② 选择物品并填表</div>
        <div style={{ opacity: 0.85 }}>③ 确认提交</div>
        <div style={{ opacity: 0.85 }}>④ 查看审批流程预览</div>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
