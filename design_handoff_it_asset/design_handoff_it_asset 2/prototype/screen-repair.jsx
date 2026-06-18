// Phase 2 — Repair Orders + Detail Drawer
// State machine timeline as the visual highlight

const REPAIR_STAGES = [
  { id: 'opened',      label: '已报修',     en: 'Opened',      icon: 'request', color: '#FF8800' },
  { id: 'reviewed',    label: 'IT 受理',    en: 'Reviewed',    icon: 'check',   color: '#FF8800' },
  { id: 'shipped',     label: '送修',       en: 'Shipped',     icon: 'arrowRight', color: '#3370FF' },
  { id: 'in_progress', label: '维修中',     en: 'In Progress', icon: 'repair',  color: '#3370FF' },
  { id: 'returned',    label: '已返厂',     en: 'Returned',    icon: 'refresh', color: '#7E5EE5' },
  { id: 'completed',   label: '已完结',     en: 'Completed',   icon: 'verify',  color: '#00B42A' },
];

const REPAIR_STATUS_META = {
  open:        { label: '已报修', color: '#FF8800', bg: '#FFF7E8' },
  in_progress: { label: '维修中', color: '#3370FF', bg: '#E8F1FF' },
  completed:   { label: '已完结', color: '#00B42A', bg: '#E8FFEA' },
  cancelled:   { label: '已取消', color: '#86909C', bg: '#F2F3F5' },
};

const RepairCenter = ({ onOpenRepair }) => {
  const [tab, setTab] = React.useState('active');

  const filtered = window.REPAIR_ORDERS.filter(r => {
    if (tab === 'active') return r.status === 'open' || r.status === 'in_progress';
    if (tab === 'completed') return r.status === 'completed';
    if (tab === 'cancelled') return r.status === 'cancelled';
    return true;
  });

  const counts = {
    active: window.REPAIR_ORDERS.filter(r => r.status === 'open' || r.status === 'in_progress').length,
    completed: window.REPAIR_ORDERS.filter(r => r.status === 'completed').length,
    cancelled: window.REPAIR_ORDERS.filter(r => r.status === 'cancelled').length,
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }} className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>维修工单</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            {counts.active} 个进行中 · 本月共 {window.REPAIR_ORDERS.length} 单 · 累计支出 ¥680
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="default" icon="download">导出</Button>
          <Button variant="primary" icon="add">新建工单</Button>
        </div>
      </div>

      {/* Stage funnel — across the top */}
      <div style={{
        background: '#fff', borderRadius: 10, padding: '20px 24px', border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 16 }}>本周维修流转</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { stage: 'opened',     label: '已报修',  count: 2, color: '#FF8800' },
            { stage: 'reviewed',   label: 'IT 受理', count: 1, color: '#FF8800' },
            { stage: 'shipped',    label: '送修',    count: 1, color: '#3370FF' },
            { stage: 'in_progress',label: '维修中',  count: 1, color: '#3370FF' },
            { stage: 'completed',  label: '已完结',  count: 3, color: '#00B42A' },
          ].map((s, i, arr) => (
            <React.Fragment key={s.stage}>
              <div style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14, margin: '0 auto',
                  background: `${s.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${s.color}`,
                }}>
                  <span style={{ fontSize: 22, fontWeight: 600, color: s.color, letterSpacing: '-0.02em' }}>{s.count}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>{s.label}</div>
              </div>
              {i < arr.length - 1 && (
                <div style={{ flex: 0.4, height: 2, background: 'var(--divider)', marginTop: -20, position: 'relative' }}>
                  <Icon name="chevronRight" size={14} color="var(--text-4)" style={{ position: 'absolute', right: -7, top: -7, background: '#fff' }} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--divider)' }}>
        {[
          { id: 'active', label: '进行中', count: counts.active },
          { id: 'completed', label: '已完结', count: counts.completed },
          { id: 'cancelled', label: '已取消', count: counts.cancelled },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px', position: 'relative',
              fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--lark-blue)' : 'var(--text-2)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <span>{t.label}</span>
            <span style={{
              padding: '0 6px', borderRadius: 8, fontSize: 11,
              background: tab === t.id ? 'var(--lark-blue-bg)' : 'var(--bg-canvas)',
              color: tab === t.id ? 'var(--lark-blue)' : 'var(--text-3)',
            }}>{t.count}</span>
            {tab === t.id && <span style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--lark-blue)', borderRadius: 1 }} />}
          </button>
        ))}
      </div>

      {/* Repair order cards */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
        {filtered.map(r => <RepairCard key={r.id} order={r} onOpen={onOpenRepair} />)}
      </div>
    </div>
  );
};

const RepairCard = ({ order, onOpen }) => {
  const asset = window.ASSETS.find(a => a.code === order.assetCode);
  const opener = window.getUser(order.openedBy);
  const meta = REPAIR_STATUS_META[order.status];
  const stageIndex = REPAIR_STAGES.findIndex(s => s.id === order.timeline[order.timeline.length - 1].stage);

  return (
    <div onClick={() => onOpen(order)} style={{
      background: '#fff', borderRadius: 10, padding: 16,
      border: '1px solid var(--border)', cursor: 'pointer',
      display: 'flex', gap: 16, transition: 'all 0.16s',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--lark-blue-bg-strong)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(31,35,41,0.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}>
      {/* Left: asset info */}
      <div style={{ display: 'flex', gap: 12, flex: '0 0 280px' }}>
        <AssetTypeIcon typeId={asset?.type || 't1'} size={48} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span className="text-mono" style={{ fontSize: 11, color: 'var(--lark-blue)', fontWeight: 500, padding: '1px 6px', background: 'var(--lark-blue-bg)', borderRadius: 3 }}>{order.id}</span>
            <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: meta.bg, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{order.assetName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{order.assetCode} · {order.brand}</div>
        </div>
      </div>

      {/* Middle: progress steps + reason */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 10 }}>
          {[REPAIR_STAGES[0], REPAIR_STAGES[1], REPAIR_STAGES[2], REPAIR_STAGES[3], REPAIR_STAGES[5]].map((s, i, arr) => {
            const reached = order.timeline.some(e => e.stage === s.id) ||
                            (s.id === 'in_progress' && order.timeline.some(e => e.stage === 'in_progress'));
            const isCurrent = order.timeline[order.timeline.length - 1].stage === s.id;
            const cancelled = order.status === 'cancelled';
            return (
              <React.Fragment key={s.id}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 56 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: cancelled ? '#F2F3F5' : reached ? s.color : '#fff',
                    border: `2px solid ${cancelled ? '#C9CDD4' : reached ? s.color : 'var(--border-strong)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isCurrent && !cancelled ? `0 0 0 4px ${s.color}33` : 'none',
                  }}>
                    {reached && !cancelled && <Icon name="check" size={11} color="#fff" />}
                  </div>
                  <span style={{ fontSize: 11, color: cancelled ? 'var(--text-3)' : reached ? 'var(--text-1)' : 'var(--text-3)', fontWeight: isCurrent ? 600 : 400, whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: reached && order.timeline.some(e => e.stage === arr[i+1].id) && !cancelled ? s.color : 'var(--divider)', marginTop: -16, transition: 'background 0.3s' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          <b style={{ color: 'var(--text-1)' }}>问题:</b> {order.reason}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, display: 'flex', gap: 12 }}>
          <span>报修人 · {opener?.name}</span>
          {order.repairType === 'external' && order.vendor && <span>送修 · {order.vendor}</span>}
          {order.repairType === 'in_house' && <span>内部维修</span>}
          {order.warrantyCovered && <span style={{ color: 'var(--success)' }}>✓ 保修内</span>}
          {!order.warrantyCovered && order.cost && <span style={{ color: 'var(--warning)' }}>付费 ¥{order.cost}</span>}
        </div>
      </div>

      {/* Right: expected return */}
      <div style={{ flex: '0 0 130px', textAlign: 'right', borderLeft: '1px solid var(--divider)', paddingLeft: 16 }}>
        {order.expectedReturnAt ? (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>预计返还</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{order.expectedReturnAt}</div>
            {order.status === 'in_progress' && (() => {
              const days = Math.ceil((new Date(order.expectedReturnAt) - new Date('2026-05-18')) / 86400000);
              if (days < 0) return <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>已延期 {Math.abs(days)} 天</div>;
              return <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>剩 {days} 天</div>;
            })()}
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>待评估</div>
        )}
      </div>
    </div>
  );
};

// ─── Repair Detail Drawer ────────────────────────────────
const RepairDetail = ({ order, open, onClose }) => {
  if (!order) return null;
  const asset = window.ASSETS.find(a => a.code === order.assetCode);
  const opener = window.getUser(order.openedBy);
  const meta = REPAIR_STATUS_META[order.status];

  return (
    <Drawer open={open} onClose={onClose} title="维修工单详情" width={780}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button variant="default" icon="edit">编辑工单</Button>
          <div style={{ display: 'flex', gap: 6 }}>
            {(order.status === 'open' || order.status === 'in_progress') && <>
              <Button variant="default" danger>取消工单</Button>
              <Button variant="default" icon="arrowRight">推进状态</Button>
              <Button variant="primary" icon="check">完结工单</Button>
            </>}
          </div>
        </div>
      }>
      {/* Hero */}
      <div style={{ padding: '24px 24px 0' }}>
        <div style={{
          padding: 20, borderRadius: 10,
          background: 'linear-gradient(135deg, #F5F9FF 0%, #FAFBFC 100%)',
          border: '1px solid var(--border)',
          display: 'flex', gap: 16, alignItems: 'center',
        }}>
          <AssetTypeIcon typeId={asset?.type || 't1'} size={64} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="text-mono" style={{ fontSize: 12, color: 'var(--lark-blue)', fontWeight: 500, padding: '2px 8px', background: 'var(--lark-blue-bg)', borderRadius: 3 }}>{order.id}</span>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 3, background: meta.bg, color: meta.color, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />{meta.label}
              </span>
              {order.warrantyCovered && <span style={{ fontSize: 11, color: 'var(--success)', padding: '2px 6px', background: 'var(--success-bg)', borderRadius: 3 }}>保修内</span>}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{order.assetName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{order.assetCode} · {order.brand}</div>
          </div>
          {order.cost !== null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>维修费用</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: order.warrantyCovered ? 'var(--success)' : 'var(--text-1)' }}>
                ¥ {order.cost.toLocaleString()}
              </div>
              {order.warrantyCovered && <div style={{ fontSize: 11, color: 'var(--success)' }}>已免</div>}
            </div>
          )}
        </div>
      </div>

      {/* Sections */}
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Section title="问题描述">
          <div style={{ padding: 14, borderRadius: 8, background: '#FFF7E8', border: '1px solid #FFE4B3', fontSize: 13, color: 'var(--text-1)', lineHeight: 1.7 }}>
            {order.reason}
          </div>
          <InfoGrid style={{ marginTop: 14 }}>
            <InfoItem label="报修人"><UserCell userId={order.openedBy} secondary={false} /></InfoItem>
            <InfoItem label="维修方式">{order.repairType === 'external' ? '外送' : '内部维修'}</InfoItem>
            {order.vendor && <InfoItem label="服务方">{order.vendor}</InfoItem>}
            <InfoItem label="预计返还">{order.expectedReturnAt || '待评估'}</InfoItem>
            {order.shippedAt && <InfoItem label="送修时间">{order.shippedAt}</InfoItem>}
            <InfoItem label="提交时间">{order.createdAt}</InfoItem>
          </InfoGrid>
        </Section>

        <Section title="维修进度">
          <RepairTimeline events={order.timeline} status={order.status} resolution={order.resolution} />
        </Section>

        {order.warrantyCovered && (
          <Section title="保修信息">
            <div style={{ padding: 14, borderRadius: 8, background: '#E8FFEA', border: '1px solid #BAF5C5', fontSize: 13, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="check" size={18} />
              <div>本次维修在保修期内,服务方免费维修。保修截止 <b>{order.warrantyUntil}</b></div>
            </div>
          </Section>
        )}
      </div>
    </Drawer>
  );
};

// ─── Repair Timeline ─────────────────────────────────────
const RepairTimeline = ({ events, status, resolution }) => {
  const cancelled = status === 'cancelled';
  return (
    <div style={{ position: 'relative', paddingLeft: 0 }}>
      {events.map((e, i) => {
        const isLast = i === events.length - 1;
        const stage = REPAIR_STAGES.find(s => s.id === e.stage) || REPAIR_STAGES[0];
        const operator = e.by ? window.getUser(e.by) : null;
        const color = cancelled && i === events.length - 1 ? '#86909C' : stage.color;
        return (
          <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: isLast ? 0 : 18, position: 'relative' }}>
            {!isLast && <div style={{ position: 'absolute', left: 13, top: 28, bottom: 0, width: 2, background: 'var(--divider)' }} />}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: `${color}14`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, border: `2px solid ${color}`, position: 'relative', zIndex: 1,
            }}>
              <Icon name={stage.icon} size={12} color={color} />
            </div>
            <div style={{ flex: 1, paddingTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{e.action}</span>
                {i === events.length - 1 && !cancelled && status !== 'completed' && (
                  <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: 'var(--lark-blue-bg)', color: 'var(--lark-blue)', fontWeight: 500 }}>当前</span>
                )}
              </div>
              {e.note && <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 4 }}>{e.note}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
                {operator ? <><Avatar user={operator} size={16} /><span>{operator.name}</span><span>·</span></> : <span style={{ padding: '0 5px', borderRadius: 2, background: 'var(--bg-canvas)' }}>系统</span>}
                <Icon name="clock" size={11} />
                <span className="text-mono">{e.t}</span>
              </div>
            </div>
          </div>
        );
      })}
      {resolution && (
        <div style={{ marginTop: 12, padding: 14, borderRadius: 8, background: '#E8FFEA', border: '1px solid #BAF5C5' }}>
          <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500, marginBottom: 4 }}>维修结论</div>
          <div style={{ fontSize: 13, color: 'var(--text-1)' }}>{resolution}</div>
        </div>
      )}
    </div>
  );
};

Object.assign(window, { RepairCenter, RepairDetail });
