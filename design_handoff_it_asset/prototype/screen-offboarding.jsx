// Offboarding Checklist Screen — IT admin tracks asset returns when employees leave
// Signature workflow: HR event → checklist → return verification → close case

const OffboardingCenter = ({ onOpenAsset }) => {
  const [tab, setTab] = React.useState('active');
  const [selectedCase, setSelectedCase] = React.useState(null);

  const filtered = window.OFFBOARDING_CASES.filter(c => {
    if (tab === 'active') return c.status === 'in_progress' || c.status === 'overdue';
    return c.status === tab;
  });

  const counts = {
    active: window.OFFBOARDING_CASES.filter(c => c.status === 'in_progress' || c.status === 'overdue').length,
    overdue: window.OFFBOARDING_CASES.filter(c => c.status === 'overdue').length,
    completed: window.OFFBOARDING_CASES.filter(c => c.status === 'completed').length,
  };
  const pendingItemsTotal = window.OFFBOARDING_CASES
    .filter(c => c.status !== 'completed')
    .reduce((sum, c) => sum + c.items.filter(i => i.status === 'return_pending').length, 0);
  const pendingValueTotal = window.OFFBOARDING_CASES
    .filter(c => c.status !== 'completed')
    .reduce((sum, c) => sum + c.items.filter(i => i.status === 'return_pending').reduce((s, i) => s + i.value, 0), 0);

  // Auto-select first case
  React.useEffect(() => {
    if (filtered.length > 0 && (!selectedCase || !filtered.find(c => c.id === selectedCase.id))) {
      setSelectedCase(filtered[0]);
    }
  }, [tab, filtered.length]);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }} className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>离职归还</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            {counts.active} 单进行中 · 待归还 {pendingItemsTotal} 件 · 待回收价值 ¥{pendingValueTotal.toLocaleString()}
            {counts.overdue > 0 && <span> · <b style={{ color: 'var(--danger)' }}>{counts.overdue} 已逾期</b></span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="default" icon="bell">催办未归还</Button>
          <Button variant="primary" icon="add">手工发起</Button>
        </div>
      </div>

      {/* HR Integration banner */}
      <div style={{
        padding: '12px 16px', borderRadius: 8,
        background: 'linear-gradient(135deg, #F1ECFF 0%, #F5F9FF 100%)',
        border: '1px solid var(--lark-blue-bg-strong)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="link" size={18} color="#7E5EE5" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>已对接 Lark 通讯录事件 · 员工离职自动触发</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>HR 在 Lark 后台标记离职 → 系统自动创建归还工单 → Lark 卡片提醒员工 → IT 跟踪验收</div>
        </div>
        <Button size="sm" variant="default">配置 Webhook</Button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--divider)' }}>
        {[
          { id: 'active', label: '进行中', count: counts.active, primary: true },
          { id: 'overdue', label: '已逾期', count: counts.overdue, color: 'danger' },
          { id: 'completed', label: '已完成', count: counts.completed },
        ].map(opt => (
          <button key={opt.id} onClick={() => setTab(opt.id)}
            style={{
              padding: '10px 16px', position: 'relative',
              fontSize: 13, fontWeight: tab === opt.id ? 600 : 400,
              color: tab === opt.id ? 'var(--lark-blue)' : 'var(--text-2)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <span>{opt.label}</span>
            <span style={{
              padding: '0 6px', borderRadius: 8, fontSize: 11,
              background: opt.color === 'danger' ? 'var(--danger-bg)' : (tab === opt.id ? 'var(--lark-blue-bg)' : 'var(--bg-canvas)'),
              color: opt.color === 'danger' ? 'var(--danger)' : (tab === opt.id ? 'var(--lark-blue)' : 'var(--text-3)'),
            }}>{opt.count}</span>
            {tab === opt.id && <span style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--lark-blue)', borderRadius: 1 }} />}
          </button>
        ))}
      </div>

      {/* Two-pane layout: list + detail */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, overflow: 'hidden' }}>
        {/* Case list */}
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(c => <OffboardingCaseRow key={c.id} offcase={c} selected={selectedCase?.id === c.id} onClick={() => setSelectedCase(c)} />)}
          {filtered.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              <Icon name="check" size={36} color="var(--text-4)" />
              <div style={{ marginTop: 12 }}>暂无{tab === 'active' ? '进行中' : tab === 'overdue' ? '逾期' : '已完成'}的离职工单</div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedCase ? (
          <OffboardingDetail offcase={selectedCase} onOpenAsset={onOpenAsset} />
        ) : (
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
            选择左侧工单查看详情
          </div>
        )}
      </div>
    </div>
  );
};

const OffboardingCaseRow = ({ offcase, selected, onClick }) => {
  const user = window.getUser(offcase.user);
  const dept = window.getDept(user?.dept);
  const meta = window.OFFBOARDING_STATUS_META[offcase.status];
  const pendingCount = offcase.items.filter(i => i.status === 'return_pending').length;
  const returnedCount = offcase.items.filter(i => i.status === 'returned').length;
  const totalCount = offcase.items.length;
  const completion = totalCount === 0 ? 100 : Math.round((returnedCount + offcase.items.filter(i => i.status === 'lost').length) / totalCount * 100);

  const daysToLastDay = Math.ceil((new Date(offcase.lastDay) - new Date('2026-05-18')) / 86400000);

  return (
    <div onClick={onClick} style={{
      padding: 14, borderRadius: 10, cursor: 'pointer',
      background: selected ? 'var(--lark-blue-bg)' : '#fff',
      border: `1px solid ${selected ? 'var(--lark-blue)' : offcase.status === 'overdue' ? '#FFD8C8' : 'var(--border)'}`,
      transition: 'all 0.16s',
    }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = '#FAFBFC'; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = '#fff'; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Avatar user={user} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{user?.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{dept?.name} · {user?.role}</div>
        </div>
        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: meta.bg, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
        <span className="text-mono">{offcase.id}</span>
        <span style={{ color: daysToLastDay < 0 ? 'var(--danger)' : daysToLastDay <= 3 ? 'var(--warning)' : 'var(--text-3)', fontWeight: 500 }}>
          {daysToLastDay < 0 ? `已离职 ${Math.abs(daysToLastDay)} 天` : daysToLastDay === 0 ? '今天最后一天' : `${daysToLastDay} 天后离职`}
        </span>
      </div>

      {/* Progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-2)' }}>归还进度 {returnedCount + offcase.items.filter(i => i.status === 'lost').length}/{totalCount}</span>
          <span style={{ color: completion === 100 ? 'var(--success)' : 'var(--text-2)', fontWeight: 500 }}>{completion}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: '#F2F3F5', overflow: 'hidden' }}>
          <div style={{
            width: `${completion}%`, height: '100%',
            background: completion === 100 ? 'var(--success)' : offcase.status === 'overdue' ? 'var(--danger)' : 'var(--lark-blue)',
            transition: 'width 0.4s',
          }} />
        </div>
      </div>

      {pendingCount > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: offcase.status === 'overdue' ? 'var(--danger)' : 'var(--warning)' }}>
          <Icon name="warning" size={10} /> {pendingCount} 件待归还
        </div>
      )}
    </div>
  );
};

const OffboardingDetail = ({ offcase, onOpenAsset }) => {
  const user = window.getUser(offcase.user);
  const dept = window.getDept(user?.dept);
  const meta = window.OFFBOARDING_STATUS_META[offcase.status];
  const it = window.getUser(offcase.assignedIT);

  const totalValue = offcase.items.reduce((s, i) => s + i.value, 0);
  const returnedValue = offcase.items.filter(i => i.status === 'returned').reduce((s, i) => s + i.value, 0);
  const lostValue = offcase.items.filter(i => i.status === 'lost').reduce((s, i) => s + i.value, 0);
  const pendingValue = offcase.items.filter(i => i.status === 'return_pending').reduce((s, i) => s + i.value, 0);

  const checklistSteps = [
    { id: 'hr_notified',  label: 'HR 离职流程触发',     done: true,  at: offcase.notifiedAt, hint: offcase.hrChannel === 'manual' ? '手工录入' : 'Lark 事件订阅' },
    { id: 'inventory',     label: '资产清单核对',         done: true,  at: offcase.notifiedAt, hint: `共 ${offcase.items.length} 件 · ¥${totalValue.toLocaleString()}` },
    { id: 'notify',        label: '通知员工归还(Lark)',  done: true,  at: offcase.notifiedAt },
    { id: 'returned',      label: '资产全部归还',         done: offcase.items.every(i => i.status !== 'return_pending'), at: null, hint: `${offcase.items.filter(i => i.status === 'returned').length}/${offcase.items.length} 已归还` },
    { id: 'verify',        label: 'IT 验收 & 资产入库',    done: offcase.status === 'completed', at: offcase.completedAt },
    { id: 'close',         label: '工单关闭 · 通知 HR',   done: offcase.status === 'completed', at: offcase.completedAt },
  ];

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <div style={{
        padding: 24,
        background: 'linear-gradient(135deg, #FAFBFC 0%, #F5F9FF 100%)',
        borderBottom: '1px solid var(--divider)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <Avatar user={user} size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span className="text-mono" style={{ fontSize: 11, color: 'var(--lark-blue)', fontWeight: 500, padding: '1px 6px', background: 'var(--lark-blue-bg)', borderRadius: 3 }}>{offcase.id}</span>
              <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: meta.bg, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{user?.name} · 离职归还</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
              {dept?.name} · {user?.role} · 离职原因:{offcase.reason} · 最后工作日 <b>{offcase.lastDay}</b>
            </div>
          </div>
        </div>

        {/* Value summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <ValueBox label="总价值" value={`¥${totalValue.toLocaleString()}`} color="var(--text-1)" />
          <ValueBox label="已回收" value={`¥${returnedValue.toLocaleString()}`} color="var(--success)" />
          <ValueBox label="待归还" value={`¥${pendingValue.toLocaleString()}`} color="var(--warning)" />
          {lostValue > 0 && <ValueBox label="丢失登记" value={`¥${lostValue.toLocaleString()}`} color="var(--danger)" />}
          {lostValue === 0 && <ValueBox label="完成度" value={`${Math.round((returnedValue + lostValue) / totalValue * 100)}%`} color="var(--lark-blue)" />}
        </div>
      </div>

      {/* Checklist progress */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>归还流程 Checklist</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, position: 'relative' }}>
          {checklistSteps.map((s, i, arr) => (
            <React.Fragment key={s.id}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: s.done ? 'var(--success)' : '#fff',
                  border: `2px solid ${s.done ? 'var(--success)' : 'var(--border-strong)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600, color: s.done ? '#fff' : 'var(--text-3)',
                  zIndex: 1,
                }}>
                  {s.done ? <Icon name="check" size={14} color="#fff" /> : (i + 1)}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, fontWeight: s.done ? 500 : 400, color: s.done ? 'var(--text-1)' : 'var(--text-3)', padding: '0 4px' }}>{s.label}</div>
                {s.hint && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, padding: '0 4px' }}>{s.hint}</div>}
                {s.at && <div className="text-mono" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{s.at.slice(5, 16)}</div>}
              </div>
              {i < arr.length - 1 && (
                <div style={{ flex: 0.4, height: 2, background: checklistSteps[i + 1].done ? 'var(--success)' : 'var(--divider)', marginTop: 14, transition: 'background 0.4s' }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Asset list */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>名下资产 ({offcase.items.length} 件)</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" variant="default" icon="bell">催办</Button>
            <Button size="sm" variant="default" icon="qr">扫码验收</Button>
          </div>
        </div>
        <div style={{ border: '1px solid var(--divider)', borderRadius: 8, overflow: 'hidden' }}>
          {offcase.items.map((item, i) => <ItemReturnRow key={item.code} item={item} isLast={i === offcase.items.length - 1} onOpenAsset={onOpenAsset} />)}
        </div>
      </div>

      {/* Consumables (handled simply) */}
      {offcase.consumables && offcase.consumables.length > 0 && (
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>耗材记录(参考)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {offcase.consumables.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 6, background: 'var(--bg-canvas)', fontSize: 12 }}>
                <Icon name="package" size={14} color="var(--text-3)" />
                <span style={{ flex: 1 }}>{c.name} × {c.qty}</span>
                <span style={{ color: c.needReturn ? (c.status === 'returned' ? 'var(--success)' : 'var(--warning)') : 'var(--text-3)' }}>
                  {c.needReturn ? (c.status === 'returned' ? '✓ 已归还' : '待归还') : '消耗品 · 不退还'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      {offcase.status !== 'completed' && (
        <div style={{ padding: 20, background: '#FAFBFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            归责 IT · {it?.name}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="default">挂起</Button>
            <Button variant="default" danger>申请丢失核销</Button>
            <Button variant="primary" icon="check"
              disabled={offcase.items.some(i => i.status === 'return_pending')}>
              确认归还完成 · 关闭工单
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const ValueBox = ({ label, value, color }) => (
  <div style={{ background: '#fff', borderRadius: 6, padding: '8px 12px', border: '1px solid var(--border)' }}>
    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 600, color, letterSpacing: '-0.01em' }}>{value}</div>
  </div>
);

const ItemReturnRow = ({ item, isLast, onOpenAsset }) => {
  const statusMeta = window.ITEM_RETURN_STATUS_META[item.status];
  const asset = window.ASSETS.find(a => a.code === item.code);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      borderBottom: isLast ? 'none' : '1px solid var(--divider)',
      background: item.status === 'return_pending' && item.overdueDays ? '#FFF7F5' : '#fff',
      cursor: 'pointer',
    }}
      onClick={() => asset && onOpenAsset?.(asset)}
      onMouseEnter={(e) => e.currentTarget.style.background = '#F5F9FF'}
      onMouseLeave={(e) => e.currentTarget.style.background = item.status === 'return_pending' && item.overdueDays ? '#FFF7F5' : '#fff'}>
      <AssetTypeIcon typeId={item.type} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="text-mono" style={{ fontSize: 11, color: 'var(--lark-blue)', fontWeight: 500 }}>{item.code}</span>
          <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: statusMeta.bg, color: statusMeta.color, fontWeight: 500 }}>{statusMeta.label}</span>
          {item.condition === 'good' && item.status === 'returned' && (
            <span style={{ fontSize: 11, color: 'var(--success)' }}>· 验收完好</span>
          )}
          {item.overdueDays && (
            <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 500 }}>· 已逾期 {item.overdueDays} 天</span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{item.name}</div>
        {item.returnedAt && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>归还时间 {item.returnedAt}</div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>¥ {item.value.toLocaleString()}</div>
        {item.action === 'await_return' && (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border-strong)', background: '#fff' }}>登记丢失</button>
            <button onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'var(--lark-blue)', color: '#fff', border: 'none', fontWeight: 500 }}>确认归还</button>
          </div>
        )}
        {item.action === 'lost_acknowledge' && (
          <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>待财务核销</div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { OffboardingCenter });
