// Phase 2 — Inspection Kanban (盘点看板)
// Signature visual: progress dashboard + asset grid + per-person confirmation status

const InspectionKanban = ({ onOpenAsset }) => {
  const [selectedTask, setSelectedTask] = React.useState(window.INSPECTION_TASKS[0]);
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [newTaskOpen, setNewTaskOpen] = React.useState(false);

  const items = window.INSPECTION_ITEMS.filter(it => {
    if (filterStatus !== 'all' && it.confirmStatus !== filterStatus) return false;
    if (search && !it.assetCode.toLowerCase().includes(search.toLowerCase()) &&
        !it.assetName.toLowerCase().includes(search.toLowerCase()) &&
        !(window.getUser(it.owner)?.name.includes(search))) return false;
    return true;
  });

  // Group by owner for kanban view
  const byOwner = {};
  window.INSPECTION_ITEMS.forEach(it => {
    if (!byOwner[it.owner]) byOwner[it.owner] = { user: window.getUser(it.owner), items: [] };
    byOwner[it.owner].items.push(it);
  });
  const owners = Object.values(byOwner).sort((a, b) => {
    // Pending users first, then mismatch, then done
    const score = (g) => {
      const pending = g.items.filter(i => i.confirmStatus === 'pending').length;
      const mismatch = g.items.filter(i => i.confirmStatus === 'mismatch').length;
      return -pending * 100 - mismatch * 10;
    };
    return score(a) - score(b);
  });

  const t = selectedTask;
  const completionRate = ((t.confirmed + t.mismatch) / t.total * 100).toFixed(0);
  const daysLeft = Math.ceil((new Date(t.endsAt) - new Date('2026-05-18T14:00')) / 86400000);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }} className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>盘点管理</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            {window.PHASE2_STATS.activeInspections} 个进行中 · {window.PHASE2_STATS.pendingInspectionItems} 项待确认
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="default" icon="qr">扫码盘点</Button>
          <Button variant="default" icon="bell">催办未确认</Button>
          <Button variant="primary" icon="add" onClick={() => setNewTaskOpen(true)}>发起盘点</Button>
        </div>
      </div>

      {/* Task selector + KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px 280px 280px', gap: 12 }}>
        {/* Big task card */}
        <div style={{
          padding: '20px 24px', borderRadius: 10, position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, #3370FF 0%, #5B92FF 100%)',
          color: '#fff',
        }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 3, background: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>当前任务</span>
            <span className="text-mono" style={{ fontSize: 11, opacity: 0.85 }}>{t.id}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{t.name}</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4, marginBottom: 16 }}>
            {t.scopeLabel} · {t.startedAt} 启动 · 截止 {t.endsAt}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                <div style={{ width: `${completionRate}%`, height: '100%', background: '#fff', borderRadius: 3, transition: 'width 0.6s' }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span>已完成 {t.confirmed + t.mismatch} / {t.total}</span>
                <span style={{ fontWeight: 600 }}>{completionRate}%</span>
              </div>
            </div>
            <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.3)' }} />
            <div>
              <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>{daysLeft}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>剩余天数</div>
            </div>
          </div>
        </div>

        <InspKPI label="已确认" value={t.confirmed} total={t.total} color="#00B42A" icon="check" />
        <InspKPI label="存在差异" value={t.mismatch} total={t.total} color="#FF8800" icon="warning" />
        <InspKPI label="待确认" value={t.pending} total={t.total} color="#86909C" icon="clock" hint="6 人未操作" />
      </div>

      {/* Filter + view */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Input icon="search" placeholder="搜索资产编号 / 责任人" value={search} onChange={setSearch} style={{ width: 280 }} />
        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--bg-canvas)', borderRadius: 6 }}>
          {[
            { id: 'all', label: '全部', count: window.INSPECTION_ITEMS.length },
            { id: 'pending', label: '待确认', count: t.pending, color: '#86909C' },
            { id: 'ok', label: '已确认', count: t.confirmed, color: '#00B42A' },
            { id: 'mismatch', label: '差异', count: t.mismatch, color: '#FF8800' },
          ].map(opt => (
            <button key={opt.id} onClick={() => setFilterStatus(opt.id)}
              style={{
                padding: '5px 12px', borderRadius: 4, fontSize: 12,
                background: filterStatus === opt.id ? '#fff' : 'transparent',
                color: filterStatus === opt.id ? 'var(--text-1)' : 'var(--text-2)',
                fontWeight: filterStatus === opt.id ? 500 : 400,
                boxShadow: filterStatus === opt.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              {opt.color && <span style={{ width: 6, height: 6, borderRadius: '50%', background: opt.color }} />}
              {opt.label}
              <span style={{ color: 'var(--text-3)' }}>{opt.count}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>按 <b>责任人</b> 分组 · {owners.length} 人</span>
      </div>

      {/* Kanban — grouped by owner */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
        {owners.map(group => <OwnerGroup key={group.user.id} group={group} filterStatus={filterStatus} onOpenAsset={onOpenAsset} />)}
      </div>
    </div>
  );
};

const InspKPI = ({ label, value, total, color, icon, hint }) => {
  const pct = ((value / total) * 100).toFixed(0);
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '20px 24px',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={14} color={color} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 30, fontWeight: 600, color, letterSpacing: '-0.02em' }}>{value}</span>
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>/ {total}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-canvas)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.5s' }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{pct}%</span>
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{hint}</div>}
    </div>
  );
};

const OwnerGroup = ({ group, filterStatus, onOpenAsset }) => {
  const filtered = group.items.filter(it => filterStatus === 'all' || it.confirmStatus === filterStatus);
  if (filtered.length === 0) return null;

  const dept = window.getDept(group.user.dept);
  const pending = group.items.filter(i => i.confirmStatus === 'pending').length;
  const mismatch = group.items.filter(i => i.confirmStatus === 'mismatch').length;
  const ok = group.items.filter(i => i.confirmStatus === 'ok').length;
  const total = group.items.length;
  const completion = ((ok + mismatch) / total * 100).toFixed(0);

  // Banner color based on user state
  let banner = 'normal';
  if (pending > 0) banner = 'pending';
  else if (mismatch > 0) banner = 'mismatch';
  else banner = 'done';

  const bannerStyle = {
    pending: { bg: '#FFF7E8', accent: '#FF8800', text: '待该员工确认' },
    mismatch: { bg: '#FFECE8', accent: '#F53F3F', text: '存在差异需处理' },
    done: { bg: '#E8FFEA', accent: '#00B42A', text: '已全部确认' },
  }[banner];

  return (
    <div style={{
      background: '#fff', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      {/* Header — owner card */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 20px',
        borderLeft: `3px solid ${bannerStyle.accent}`,
        background: bannerStyle.bg,
      }}>
        <Avatar user={group.user} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{group.user.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{dept?.name} · {group.user.role}</span>
            <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 3, background: '#fff', color: bannerStyle.accent, fontWeight: 500 }}>{bannerStyle.text}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
            共 {total} 件资产 · 已确认 {ok} · 差异 {mismatch} · 待确认 {pending}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CircleProgress percent={completion} size={36} color={bannerStyle.accent} />
            <span style={{ fontSize: 13, fontWeight: 600, color: bannerStyle.accent }}>{completion}%</span>
          </div>
          {pending > 0 && <Button size="sm" variant="default" icon="bell">催办</Button>}
          {mismatch > 0 && <Button size="sm" variant="primary">查看差异</Button>}
        </div>
      </div>

      {/* Items grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 0 }}>
        {filtered.map((it, i) => (
          <ItemCard key={it.assetCode} item={it} onOpenAsset={onOpenAsset} isLast={i === filtered.length - 1} />
        ))}
      </div>
    </div>
  );
};

const CircleProgress = ({ percent, size = 36, color = '#3370FF' }) => {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F2F3F5" strokeWidth="3" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (percent/100) * c}
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dashoffset 0.5s' }} />
    </svg>
  );
};

const ItemCard = ({ item, onOpenAsset }) => {
  const asset = window.ASSETS.find(a => a.code === item.assetCode);
  const statusStyle = {
    pending: { bg: '#FAFBFC', dot: '#86909C', label: '待确认', textColor: 'var(--text-2)' },
    ok: { bg: '#fff', dot: '#00B42A', label: '已确认', textColor: 'var(--success)' },
    mismatch: { bg: '#FFF7F5', dot: '#F53F3F', label: '差异', textColor: 'var(--danger)' },
  }[item.confirmStatus];

  return (
    <div onClick={() => asset && onOpenAsset?.(asset)} style={{
      padding: '12px 16px', cursor: 'pointer',
      background: statusStyle.bg,
      borderTop: '1px solid var(--divider)',
      borderRight: '1px solid var(--divider)',
      display: 'flex', alignItems: 'flex-start', gap: 12,
      transition: 'background 0.16s',
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#F5F9FF'}
      onMouseLeave={(e) => e.currentTarget.style.background = statusStyle.bg}>
      <AssetTypeIcon typeId={asset?.type || 't1'} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span className="text-mono" style={{ fontSize: 11, color: 'var(--lark-blue)', fontWeight: 500 }}>{item.assetCode}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.assetName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusStyle.dot }} />
          <span style={{ fontSize: 11, color: statusStyle.textColor, fontWeight: 500 }}>{statusStyle.label}</span>
          {item.confirmedAt && (
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>· {item.confirmedAt.slice(5)}</span>
          )}
        </div>
        {item.remark && (
          <div style={{
            marginTop: 6, padding: '6px 8px', borderRadius: 4,
            background: '#FFECE8', fontSize: 11, color: '#A8261D',
            display: 'flex', alignItems: 'flex-start', gap: 4,
          }}>
            <Icon name="warning" size={10} color="#F53F3F" style={{ marginTop: 2, flexShrink: 0 }} />
            <span>{item.remark}</span>
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { InspectionKanban });
