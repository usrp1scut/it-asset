// Phase 2 — Scrap Approval Workflow
const SCRAP_STATUS_META = {
  pending:  { label: '待审批',       color: '#FF8800', bg: '#FFF7E8' },
  approved: { label: '已批准·待处置', color: '#3370FF', bg: '#E8F1FF' },
  rejected: { label: '已驳回',       color: '#F53F3F', bg: '#FFECE8' },
  disposed: { label: '已处置',       color: '#00B42A', bg: '#E8FFEA' },
};

const SCRAP_STAGES = [
  { id: 'submitted', label: 'IT 申请',  icon: 'request',  color: '#FF8800' },
  { id: 'reviewed',  label: '财务初审',  icon: 'inspect',  color: '#FF8800' },
  { id: 'approved',  label: '批准',     icon: 'check',    color: '#3370FF' },
  { id: 'disposed',  label: '处置完成',  icon: 'verify',   color: '#00B42A' },
];

const DISPOSITION_META = {
  recycle:  { label: '回收',     color: '#00B42A', icon: 'refresh' },
  resale:   { label: '转售',     color: '#3370FF', icon: 'trendUp' },
  writeoff: { label: '核销',     color: '#86909C', icon: 'close' },
  exchange: { label: '换货抵扣',  color: '#7E5EE5', icon: 'link' },
  other:    { label: '其他',     color: '#86909C', icon: 'more' },
};

const ScrapCenter = ({ onOpenScrap }) => {
  const [tab, setTab] = React.useState('pending');

  const filtered = window.SCRAP_REQUESTS.filter(s => s.status === tab);
  const counts = {
    pending: window.SCRAP_REQUESTS.filter(s => s.status === 'pending').length,
    approved: window.SCRAP_REQUESTS.filter(s => s.status === 'approved').length,
    disposed: window.SCRAP_REQUESTS.filter(s => s.status === 'disposed').length,
    rejected: window.SCRAP_REQUESTS.filter(s => s.status === 'rejected').length,
  };

  const totalValue = window.SCRAP_REQUESTS.filter(s => s.status === 'disposed' || s.status === 'approved')
    .reduce((sum, s) => sum + (s.residualValue || 0), 0);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }} className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>报废处置</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            {counts.pending + counts.approved} 单进行中 · 本年累计残值回收 ¥{totalValue.toLocaleString()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="default" icon="download">导出处置清单</Button>
          <Button variant="primary" icon="add">提交报废申请</Button>
        </div>
      </div>

      {/* Stage funnel */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>报废流转</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {[
            { stage: 'submitted', label: 'IT 申请',    count: counts.pending + counts.approved + counts.disposed + counts.rejected, color: '#FF8800' },
            { stage: 'reviewed',  label: '财务审批',    count: counts.pending, color: '#FF8800', sub: '待审批' },
            { stage: 'approved',  label: '已批准',     count: counts.approved, color: '#3370FF', sub: '待处置' },
            { stage: 'disposed',  label: '已处置',     count: counts.disposed, color: '#00B42A' },
          ].map((s, i, arr) => (
            <React.Fragment key={s.stage}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14, margin: '0 auto',
                  background: `${s.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${s.color}`,
                }}>
                  <span style={{ fontSize: 22, fontWeight: 600, color: s.color, letterSpacing: '-0.02em' }}>{s.count}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, fontWeight: 500 }}>{s.label}</div>
                {s.sub && <div style={{ fontSize: 11, color: s.color, marginTop: 2 }}>{s.sub}</div>}
              </div>
              {i < arr.length - 1 && (
                <div style={{ flex: 0.4, height: 2, background: 'var(--divider)', marginTop: -32, position: 'relative' }}>
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
          { id: 'pending', label: '待审批', count: counts.pending },
          { id: 'approved', label: '待处置', count: counts.approved },
          { id: 'disposed', label: '已处置', count: counts.disposed },
          { id: 'rejected', label: '已驳回', count: counts.rejected },
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

      {/* Cards */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
        {filtered.map(s => <ScrapCard key={s.id} req={s} onOpen={onOpenScrap} />)}
      </div>
    </div>
  );
};

const ScrapCard = ({ req, onOpen }) => {
  const asset = window.ASSETS.find(a => a.code === req.assetCode);
  const proposer = window.getUser(req.proposer);
  const approver = req.approver ? window.getUser(req.approver) : null;
  const meta = SCRAP_STATUS_META[req.status];
  const depreciation = ((req.originalPrice - req.bookValue) / req.originalPrice * 100).toFixed(0);

  return (
    <div onClick={() => onOpen(req)} style={{
      background: '#fff', borderRadius: 10, padding: 16,
      border: '1px solid var(--border)', cursor: 'pointer',
      display: 'flex', gap: 16,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--lark-blue-bg-strong)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}>
      {/* Left: asset + reason */}
      <div style={{ flex: '0 0 320px', display: 'flex', gap: 12 }}>
        <AssetTypeIcon typeId={asset?.type || 't1'} size={48} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span className="text-mono" style={{ fontSize: 11, color: 'var(--lark-blue)', fontWeight: 500, padding: '1px 6px', background: 'var(--lark-blue-bg)', borderRadius: 3 }}>{req.id}</span>
            <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: meta.bg, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{req.assetName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{req.assetCode} · {req.brand}</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {req.reason}
          </div>
        </div>
      </div>

      {/* Middle: value */}
      <div style={{ flex: '0 0 200px', borderLeft: '1px solid var(--divider)', paddingLeft: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>原值 → 账面残值</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'line-through' }}>¥{req.originalPrice.toLocaleString()}</span>
          <Icon name="arrowRight" size={10} color="var(--text-4)" />
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)' }}>¥{req.bookValue.toLocaleString()}</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-canvas)', overflow: 'hidden' }}>
            <div style={{ width: `${depreciation}%`, height: '100%', background: 'linear-gradient(90deg, #FF8800, #FFAA33)' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>已折旧 {depreciation}%</div>
        </div>
        {req.residualValue !== null && req.residualValue !== undefined && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="check" size={12} />
            实际残值 ¥{req.residualValue}
          </div>
        )}
      </div>

      {/* Right: approval chain */}
      <div style={{ flex: 1, borderLeft: '1px solid var(--divider)', paddingLeft: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 0 }}>
          {/* Proposer */}
          <ScrapApprovalNode user={proposer} label="申请人" stage="completed" time={req.createdAt} />
          <ScrapArrow active />
          {/* Finance approver */}
          <ScrapApprovalNode user={approver} label="财务"
            stage={req.status === 'pending' ? 'current' : req.status === 'rejected' ? 'rejected' : 'completed'}
            time={req.approvedAt} />
          <ScrapArrow active={req.status === 'approved' || req.status === 'disposed'} />
          {/* Disposal */}
          <ScrapApprovalNode user={proposer} label="IT 处置"
            stage={req.status === 'disposed' ? 'completed' : req.status === 'approved' ? 'current' : 'pending'}
            time={req.disposedAt} />
        </div>
        {req.dispositionMethod && (
          <div style={{ marginTop: 10, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-canvas)', fontSize: 11, color: 'var(--text-2)', textAlign: 'center' }}>
            处置方式:<b style={{ color: DISPOSITION_META[req.dispositionMethod].color, marginLeft: 4 }}>{DISPOSITION_META[req.dispositionMethod].label}</b>
            {req.residualValue !== null && <span> · 回收 ¥{req.residualValue}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

const ScrapApprovalNode = ({ user, label, stage, time }) => {
  const stages = {
    completed: { ring: '#00B42A', bg: '#E8FFEA', dot: { color: '#00B42A', icon: 'check' } },
    current:   { ring: '#FF8800', bg: '#FFF7E8', dot: { color: '#FF8800', icon: 'clock' } },
    rejected:  { ring: '#F53F3F', bg: '#FFECE8', dot: { color: '#F53F3F', icon: 'close' } },
    pending:   { ring: '#C9CDD4', bg: '#F2F3F5', dot: null },
  }[stage];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: stages.bg,
          border: `2px solid ${stages.ring}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: stage === 'pending' ? 0.5 : 1,
        }}>
          {user ? <Avatar user={user} size={28} /> : <Icon name="user" size={16} color="var(--text-3)" />}
        </div>
        {stages.dot && (
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 16, height: 16, borderRadius: '50%', background: stages.dot.color,
            border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={stages.dot.icon} size={8} color="#fff" />
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-1)' }}>{user?.name || '—'}</div>
      {time && <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{time.slice(5, 10)}</div>}
    </div>
  );
};

const ScrapArrow = ({ active }) => (
  <div style={{
    flex: 0.5, height: 2,
    background: active ? 'var(--success)' : 'repeating-linear-gradient(90deg, #C9CDD4 0 3px, transparent 3px 6px)',
    marginTop: -28, borderRadius: 1, transition: 'background 0.3s',
  }} />
);

// ─── Scrap Detail Drawer ─────────────────────────────────
const ScrapDetail = ({ req, open, onClose }) => {
  if (!req) return null;
  const asset = window.ASSETS.find(a => a.code === req.assetCode);
  const meta = SCRAP_STATUS_META[req.status];

  return (
    <Drawer open={open} onClose={onClose} title="报废申请详情" width={780}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {req.status === 'pending' && <>
            <Button variant="default" danger>驳回</Button>
            <Button variant="primary" icon="check">批准报废</Button>
          </>}
          {req.status === 'approved' && (
            <Button variant="primary" icon="verify">登记处置完成</Button>
          )}
        </div>
      }>
      {/* Hero */}
      <div style={{ padding: '24px 24px 0' }}>
        <div style={{
          padding: 20, borderRadius: 10,
          background: 'linear-gradient(135deg, #FFF7F2 0%, #FAFBFC 100%)',
          border: '1px solid var(--border)',
          display: 'flex', gap: 16, alignItems: 'center',
        }}>
          <AssetTypeIcon typeId={asset?.type || 't1'} size={64} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="text-mono" style={{ fontSize: 12, color: 'var(--lark-blue)', fontWeight: 500, padding: '2px 8px', background: 'var(--lark-blue-bg)', borderRadius: 3 }}>{req.id}</span>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 3, background: meta.bg, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{req.assetName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{req.assetCode} · {req.brand}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>账面残值</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>¥ {req.bookValue.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>原值 ¥{req.originalPrice.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Section title="报废原因">
          <div style={{ padding: 14, borderRadius: 8, background: '#FFF7E8', border: '1px solid #FFE4B3', fontSize: 13, lineHeight: 1.7 }}>
            {req.reason}
          </div>
        </Section>

        <Section title="审批进度">
          <ScrapTimeline events={req.timeline} status={req.status} />
        </Section>

        {req.status === 'pending' && (
          <Section title="财务审批操作">
            <div style={{ padding: 16, borderRadius: 8, background: '#FAFBFC', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>残值评估(批准时填写)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 13 }}>¥</span>
                <div style={{ flex: 1, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-strong)', background: '#fff', fontSize: 14, fontFamily: 'var(--font-mono)' }}>
                  1,800
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>建议值(基于线性折旧)</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>审批备注</div>
              <textarea placeholder="如:同意按残值处置 / 建议先报修评估..."
                style={{ width: '100%', minHeight: 60, padding: 10, borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical' }} />
            </div>
          </Section>
        )}

        {req.status === 'approved' && (
          <Section title="处置登记">
            <div style={{ padding: 16, borderRadius: 8, background: '#F5F9FF', border: '1px solid var(--lark-blue-bg-strong)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10 }}>选择处置方式</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {Object.entries(DISPOSITION_META).slice(0, 4).map(([key, m]) => (
                  <button key={key} style={{
                    padding: 12, borderRadius: 8, border: `1.5px solid ${key === 'recycle' ? m.color : 'var(--border)'}`,
                    background: key === 'recycle' ? `${m.color}10` : '#fff',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                    <Icon name={m.icon} size={20} color={m.color} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: key === 'recycle' ? m.color : 'var(--text-1)' }}>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </Section>
        )}

        {req.status === 'disposed' && req.dispositionMethod && (
          <Section title="处置结果">
            <div style={{ padding: 16, borderRadius: 8, background: '#E8FFEA', border: '1px solid #BAF5C5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={DISPOSITION_META[req.dispositionMethod].icon} size={18} color={DISPOSITION_META[req.dispositionMethod].color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{DISPOSITION_META[req.dispositionMethod].label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{req.disposedAt}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>回收</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--success)' }}>¥ {req.residualValue}</div>
                </div>
              </div>
              {req.disposalRemark && (
                <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.6)', fontSize: 12, color: 'var(--text-2)' }}>
                  {req.disposalRemark}
                </div>
              )}
            </div>
          </Section>
        )}
      </div>
    </Drawer>
  );
};

const ScrapTimeline = ({ events, status }) => {
  return (
    <div style={{ position: 'relative' }}>
      {events.map((e, i) => {
        const isLast = i === events.length - 1;
        const stage = SCRAP_STAGES.find(s => s.id === e.stage) || SCRAP_STAGES[0];
        const operator = e.by ? window.getUser(e.by) : null;
        const isRejected = e.stage === 'rejected';
        const color = isRejected ? '#F53F3F' : stage.color;
        const icon = isRejected ? 'close' : stage.icon;
        return (
          <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: isLast ? 0 : 18, position: 'relative' }}>
            {!isLast && <div style={{ position: 'absolute', left: 13, top: 28, bottom: 0, width: 2, background: 'var(--divider)' }} />}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: `${color}14`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, border: `2px solid ${color}`, zIndex: 1,
            }}>
              <Icon name={icon} size={12} color={color} />
            </div>
            <div style={{ flex: 1, paddingTop: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{e.action}</div>
              {e.note && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{e.note}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                {operator && <><Avatar user={operator} size={16} /><span>{operator.name}</span><span>·</span></>}
                <Icon name="clock" size={11} />
                <span className="text-mono">{e.t}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

Object.assign(window, { ScrapCenter, ScrapDetail });
