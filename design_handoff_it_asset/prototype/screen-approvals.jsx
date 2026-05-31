// Approval Center — replaces Phase 1 placeholder
// Batch approve + filter + detail drawer with Lark card preview

const ApprovalCenter = ({ onOpenApproval }) => {
  const [tab, setTab] = React.useState('pending');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState(new Set());

  const filtered = window.APPROVALS_FULL.filter(a => {
    if (tab === 'pending') {
      if (a.status !== 'pending') return false;
      if (a.currentApprover !== 'u15') return false; // "等我审"
    } else if (tab === 'others_pending') {
      if (a.status !== 'pending' || a.currentApprover === 'u15') return false;
    } else if (a.status !== tab) return false;
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const u = window.getUser(a.applicant);
      if (!a.id.toLowerCase().includes(q) && !a.target.toLowerCase().includes(q) && !u?.name.includes(search)) return false;
    }
    return true;
  });

  const counts = {
    pending: window.APPROVALS_FULL.filter(a => a.status === 'pending' && a.currentApprover === 'u15').length,
    others_pending: window.APPROVALS_FULL.filter(a => a.status === 'pending' && a.currentApprover !== 'u15').length,
    approved: window.APPROVALS_FULL.filter(a => a.status === 'approved').length,
    rejected: window.APPROVALS_FULL.filter(a => a.status === 'rejected').length,
  };
  const overdue = window.APPROVALS_FULL.filter(a => a.status === 'pending' && a.overdue && a.currentApprover === 'u15').length;

  const toggleSelect = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(a => a.id)));
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }} className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>审批中心</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            <b style={{ color: 'var(--lark-blue)' }}>{counts.pending}</b> 单待我处理
            {overdue > 0 && <> · <b style={{ color: 'var(--danger)' }}>{overdue}</b> 单已逾期</>}
            <span> · 本月已审批 18 单</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="default" icon="filter">筛选条件</Button>
          <Button variant="default" icon="download">导出</Button>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <ApprovalKPI label="待我处理" value={counts.pending} color="#3370FF" icon="approval"
          hint={overdue > 0 ? `${overdue} 已逾期` : '按 SLA 内'} hintColor={overdue > 0 ? 'var(--danger)' : 'var(--success)'} />
        <ApprovalKPI label="待他人处理" value={counts.others_pending} color="#86909C" icon="clock" hint="非我的环节" />
        <ApprovalKPI label="本月已审批" value="18" color="#00B42A" icon="check" hint="耗时均值 4.2h" />
        <ApprovalKPI label="自动审批占比" value="32%" color="#7E5EE5" icon="verify" hint="耗材常规件" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--divider)' }}>
        {[
          { id: 'pending', label: '待我处理', count: counts.pending, primary: true },
          { id: 'others_pending', label: '待他人处理', count: counts.others_pending },
          { id: 'approved', label: '已通过', count: counts.approved },
          { id: 'rejected', label: '已驳回', count: counts.rejected },
        ].map(opt => (
          <button key={opt.id} onClick={() => { setTab(opt.id); setSelected(new Set()); }}
            style={{
              padding: '10px 16px', position: 'relative',
              fontSize: 13, fontWeight: tab === opt.id ? 600 : 400,
              color: tab === opt.id ? 'var(--lark-blue)' : 'var(--text-2)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <span>{opt.label}</span>
            <span style={{
              padding: '0 6px', borderRadius: 8, fontSize: 11,
              background: tab === opt.id ? 'var(--lark-blue-bg)' : 'var(--bg-canvas)',
              color: tab === opt.id ? 'var(--lark-blue)' : 'var(--text-3)',
            }}>{opt.count}</span>
            {tab === opt.id && <span style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'var(--lark-blue)', borderRadius: 1 }} />}
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Input icon="search" placeholder="搜索申请单号 / 物品 / 申请人" value={search} onChange={setSearch} style={{ width: 320 }} />
        <DropdownFilter label="类型" value={typeFilter} onChange={setTypeFilter}
          options={[
            { id: 'all', label: '全部类型' },
            ...Object.entries(window.APPROVAL_TYPE_META).map(([id, m]) => ({ id, label: m.label })),
          ]} />
        <DropdownFilter label="紧急程度" value="all" onChange={() => {}}
          options={[{ id: 'all', label: '全部' }, { id: 'critical', label: '特急' }, { id: 'urgent', label: '紧急' }, { id: 'normal', label: '常规' }]} />
        <DropdownFilter label="提交时间" value="7d" onChange={() => {}}
          options={[{ id: '7d', label: '近 7 天' }, { id: '30d', label: '近 30 天' }, { id: 'all', label: '全部' }]} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>共 {filtered.length} 条</span>
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && tab === 'pending' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', borderRadius: 8,
          background: 'var(--lark-blue-bg)', border: '1px solid var(--lark-blue-bg-strong)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--lark-blue)' }}>
            已选 <b>{selected.size}</b> 单
          </span>
          <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
          <Button size="sm" variant="text" icon="check">批量通过</Button>
          <Button size="sm" variant="text" icon="close">批量驳回</Button>
          <Button size="sm" variant="text" icon="user">指派他人</Button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setSelected(new Set())} style={{ fontSize: 12, color: 'var(--text-3)' }}>取消选择</button>
        </div>
      )}

      {/* Approval cards list */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
        {tab === 'pending' && filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', fontSize: 12, color: 'var(--text-3)' }}>
            <Checkbox checked={selected.size === filtered.length && filtered.length > 0}
              indeterminate={selected.size > 0 && selected.size < filtered.length} onChange={toggleAll} />
            <span style={{ marginLeft: 4 }}>全选当前列表</span>
          </div>
        )}
        {filtered.map(a => (
          <ApprovalCard key={a.id} approval={a} onOpen={onOpenApproval}
            selectable={tab === 'pending'} selected={selected.has(a.id)} onToggle={() => toggleSelect(a.id)} />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
            <Icon name="check" size={40} color="var(--text-4)" />
            <div style={{ marginTop: 12, fontSize: 14 }}>太棒了!{tab === 'pending' ? '没有待你处理的审批' : '该 Tab 下暂无数据'}</div>
          </div>
        )}
      </div>
    </div>
  );
};

const ApprovalKPI = ({ label, value, color, icon, hint, hintColor }) => (
  <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid var(--border)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={14} color={color} />
      </div>
    </div>
    <div style={{ fontSize: 26, fontWeight: 600, color, letterSpacing: '-0.02em' }}>{value}</div>
    {hint && <div style={{ fontSize: 11, color: hintColor || 'var(--text-3)', marginTop: 4 }}>{hint}</div>}
  </div>
);

const ApprovalCard = ({ approval, onOpen, selectable, selected, onToggle }) => {
  const meta = window.APPROVAL_TYPE_META[approval.type];
  const urgency = window.URGENCY_META[approval.urgency];
  const applicant = window.getUser(approval.applicant);
  const dept = window.getDept(applicant?.dept);
  const slaPct = approval.sla ? Math.min(100, (approval.waitingHours / approval.sla) * 100) : 0;

  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: 16,
      border: `1px solid ${approval.overdue ? '#FFD8C8' : selected ? 'var(--lark-blue)' : 'var(--border)'}`,
      boxShadow: approval.overdue ? '0 0 0 3px rgba(245,63,63,0.04)' : 'none',
      display: 'flex', gap: 14, cursor: 'pointer', transition: 'all 0.16s',
    }}
      onClick={(e) => {
        if (e.target.closest('input, button, .checkbox-wrap')) return;
        onOpen(approval);
      }}
      onMouseEnter={(e) => !selected && (e.currentTarget.style.borderColor = 'var(--lark-blue-bg-strong)')}
      onMouseLeave={(e) => !selected && !approval.overdue && (e.currentTarget.style.borderColor = 'var(--border)')}>
      {selectable && (
        <div className="checkbox-wrap" style={{ paddingTop: 4 }} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          <Checkbox checked={selected} onChange={() => {}} />
        </div>
      )}

      {/* Type icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 8, background: meta.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={meta.icon} size={18} color={meta.color} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span className="text-mono" style={{ fontSize: 11, color: 'var(--lark-blue)', fontWeight: 500, padding: '1px 6px', background: 'var(--lark-blue-bg)', borderRadius: 3 }}>{approval.id}</span>
          <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: meta.bg, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
          {urgency && approval.urgency !== 'normal' && (
            <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: urgency.bg, color: urgency.color, fontWeight: 500 }}>{urgency.label}</span>
          )}
          {approval.overdue && (
            <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: '#FFECE8', color: '#A8261D', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Icon name="warning" size={10} />已逾期 {approval.waitingHours - approval.sla}h
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{approval.target}</span>
          {approval.targetQty > 1 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>× {approval.targetQty}</span>}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          <b style={{ color: 'var(--text-1)' }}>事由:</b>{approval.reason}
        </div>

        {/* Approval chain mini view */}
        {approval.approvalChain && approval.status === 'pending' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {approval.approvalChain.map((step, i, arr) => {
              const u = window.getUser(step.user);
              const stepIcon = {
                approved: { color: '#00B42A', icon: 'check' },
                pending: { color: '#FF8800', icon: 'clock' },
                rejected: { color: '#F53F3F', icon: 'close' },
              }[step.status];
              return (
                <React.Fragment key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    <div style={{ position: 'relative' }}>
                      <Avatar user={u} size={20} />
                      <div style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 10, height: 10, borderRadius: '50%', background: stepIcon.color,
                        border: '1.5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon name={stepIcon.icon} size={6} color="#fff" />
                      </div>
                    </div>
                    <span style={{
                      color: step.status === 'pending' ? 'var(--warning)' : 'var(--text-2)',
                      fontWeight: step.status === 'pending' ? 500 : 400,
                    }}>
                      {u?.name}
                      <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · {{ manager: '部门主管', it_admin: 'IT', finance: '财务' }[step.role]}</span>
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <Icon name="chevronRight" size={10} color="var(--text-4)" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* For approved/rejected — show result */}
        {approval.status === 'approved' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--success)' }}>
            <Icon name="check" size={12} />已通过 · {approval.approvedAt}
            {approval.fulfillment?.fulfilled && <span style={{ color: 'var(--text-3)' }}>· 已发放 {approval.fulfillment.fulfilledAt}</span>}
          </div>
        )}
        {approval.status === 'rejected' && (
          <div style={{ fontSize: 11, color: 'var(--danger)' }}>
            <Icon name="close" size={11} /> 驳回 · {approval.rejectedAt}
            <div style={{ color: 'var(--text-2)', marginTop: 2, fontSize: 11 }}>{approval.rejectReason}</div>
          </div>
        )}
      </div>

      {/* Right column: applicant + actions */}
      <div style={{ flex: '0 0 200px', textAlign: 'right', borderLeft: '1px solid var(--divider)', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{applicant?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{dept?.name}</div>
          </div>
          <Avatar user={applicant} size={32} />
        </div>

        {approval.status === 'pending' && approval.sla && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>
              <span>已等 {approval.waitingHours}h</span>
              <span>SLA {approval.sla}h</span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-canvas)', overflow: 'hidden' }}>
              <div style={{ width: `${slaPct}%`, height: '100%',
                background: slaPct >= 100 ? 'var(--danger)' : slaPct >= 75 ? 'var(--warning)' : 'var(--success)' }} />
            </div>
          </div>
        )}

        {approval.status === 'pending' && approval.currentApprover === 'u15' && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 'auto' }}>
            <Button size="sm" variant="default" onClick={(e) => e.stopPropagation()}>驳回</Button>
            <Button size="sm" variant="primary" icon="check" onClick={(e) => e.stopPropagation()}>通过</Button>
          </div>
        )}
        {approval.status === 'pending' && approval.currentApprover !== 'u15' && (() => {
          const cur = window.getUser(approval.currentApprover);
          return (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 'auto' }}>等待 <b style={{ color: 'var(--warning)' }}>{cur?.name}</b> 处理</div>
          );
        })()}
      </div>
    </div>
  );
};

// ─── Approval Detail Drawer ──────────────────────────────
const ApprovalDetail = ({ approval, open, onClose }) => {
  if (!approval) return null;
  const meta = window.APPROVAL_TYPE_META[approval.type];
  const applicant = window.getUser(approval.applicant);
  const urgency = window.URGENCY_META[approval.urgency];
  const dept = window.getDept(applicant?.dept);

  return (
    <Drawer open={open} onClose={onClose} title="审批详情" width={820}
      footer={approval.status === 'pending' && approval.currentApprover === 'u15' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button variant="default" icon="user">转他人审批</Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="default" danger size="lg">驳回申请</Button>
            <Button variant="primary" icon="check" size="lg">通过审批</Button>
          </div>
        </div>
      ) : null}>
      {/* Hero */}
      <div style={{ padding: '24px 24px 0' }}>
        <div style={{
          padding: 20, borderRadius: 10,
          background: 'linear-gradient(135deg, #F5F9FF 0%, #FAFBFC 100%)',
          border: '1px solid var(--border)',
          display: 'flex', gap: 16, alignItems: 'center',
        }}>
          <div style={{ width: 64, height: 64, borderRadius: 12, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={meta.icon} size={28} color={meta.color} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="text-mono" style={{ fontSize: 12, color: 'var(--lark-blue)', fontWeight: 500, padding: '2px 8px', background: 'var(--lark-blue-bg)', borderRadius: 3 }}>{approval.id}</span>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 3, background: meta.bg, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
              {urgency && approval.urgency !== 'normal' && (
                <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: urgency.bg, color: urgency.color, fontWeight: 500 }}>{urgency.label} · {urgency.sla} 内</span>
              )}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{approval.target}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar user={applicant} size={18} />
              <span style={{ fontWeight: 500 }}>{applicant?.name}</span>
              <span style={{ color: 'var(--text-3)' }}>· {dept?.name} · {applicant?.role}</span>
              <span style={{ color: 'var(--text-3)' }}>· {approval.submittedAt} 提交</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Stock check banner for consumable */}
        {approval.stockHint && approval.stockHint.warning && (
          <div style={{
            padding: '12px 14px', borderRadius: 8, background: '#FFF7E8', border: '1px solid #FFE4B3',
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#A66200',
          }}>
            <Icon name="warning" size={16} color="#FF8800" />
            <div style={{ flex: 1 }}>
              <b>库存预警</b> · {approval.stockHint.sku} 当前库存 {approval.stockHint.stock},低于安全线 {approval.stockHint.safety}
            </div>
            <Button size="sm" variant="default">查看 SKU</Button>
          </div>
        )}

        <Section title="申请详情">
          <div style={{ padding: 14, borderRadius: 8, background: '#FAFBFC', border: '1px solid var(--divider)', fontSize: 13, color: 'var(--text-1)', lineHeight: 1.7 }}>
            {approval.reason}
          </div>
          <InfoGrid style={{ marginTop: 16 }}>
            <InfoItem label="申请类型">{meta.label}</InfoItem>
            <InfoItem label="申请数量">{approval.targetQty}</InfoItem>
            <InfoItem label="紧急程度">{urgency?.label || '常规'}</InfoItem>
            <InfoItem label="交付方式">{({
              self_desk: '送到工位', self_pickup: '员工自取', pickup_at_desk: 'IT 上门取', mail: '邮寄',
            })[approval.deliverTo] || approval.deliverTo} {approval.deliverHint && <span style={{ color: 'var(--text-3)' }}>· {approval.deliverHint}</span>}</InfoItem>
          </InfoGrid>
        </Section>

        <Section title="审批流程">
          {approval.approvalChain ? <ApprovalChainView chain={approval.approvalChain} /> : (
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              {approval.status === 'approved' && `已通过 · ${approval.approvedAt} · 审批人 ${window.getUser(approval.approver)?.name}`}
              {approval.status === 'rejected' && `已驳回 · ${approval.rejectedAt} · ${approval.rejectReason}`}
            </div>
          )}
        </Section>

        {/* Lark card preview — signature touch */}
        {approval.larkCardSent && (
          <Section title="Lark 卡片消息预览">
            <LarkCardPreview approval={approval} applicant={applicant} dept={dept} meta={meta} />
          </Section>
        )}

        {approval.status === 'pending' && approval.currentApprover === 'u15' && (
          <Section title="审批操作">
            <div style={{ padding: 16, borderRadius: 8, background: '#FAFBFC', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>审批意见(可选)</div>
              <textarea placeholder="如:同意 / 库存不足建议下周再申请 / 请确认是否真的需要…"
                style={{
                  width: '100%', minHeight: 64, padding: 10, borderRadius: 6,
                  border: '1px solid var(--border-strong)', fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical',
                }} />
              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, background: 'var(--lark-blue-bg)', fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="bell" size={14} color="var(--lark-blue)" />
                <span>审批后系统将自动通过 Lark 通知申请人 <b>{applicant?.name}</b>,并 {approval.type === 'consumable_request' ? '扣减对应 SKU 库存,触发发放工单' : '在资产台账中创建领用记录'}</span>
              </div>
            </div>
          </Section>
        )}
      </div>
    </Drawer>
  );
};

// ─── Approval chain view (vertical) ──────────────────────
const ApprovalChainView = ({ chain }) => {
  return (
    <div>
      {chain.map((step, i, arr) => {
        const u = window.getUser(step.user);
        const isLast = i === arr.length - 1;
        const stepIcon = {
          approved: { color: '#00B42A', icon: 'check', label: '已通过', bg: '#E8FFEA' },
          pending: { color: '#FF8800', icon: 'clock', label: '处理中', bg: '#FFF7E8' },
          rejected: { color: '#F53F3F', icon: 'close', label: '已驳回', bg: '#FFECE8' },
        }[step.status];
        return (
          <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: isLast ? 0 : 16, position: 'relative' }}>
            {!isLast && <div style={{ position: 'absolute', left: 23, top: 48, bottom: 0, width: 2, background: 'var(--divider)' }} />}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Avatar user={u} size={48} />
              <div style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 20, height: 20, borderRadius: '50%', background: stepIcon.color,
                border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={stepIcon.icon} size={11} color="#fff" />
              </div>
            </div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{u?.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>· {{ manager: '部门主管', it_admin: 'IT 管理员', finance: '财务', procurement: '采购' }[step.role]}</span>
                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: stepIcon.bg, color: stepIcon.color, fontWeight: 500 }}>{stepIcon.label}</span>
              </div>
              {step.note && <div style={{ fontSize: 12, color: 'var(--text-2)', padding: '8px 10px', borderRadius: 6, background: 'var(--bg-canvas)', marginTop: 4 }}>{step.note}</div>}
              {step.at && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{step.at}</div>}
              {!step.at && step.status === 'pending' && (
                <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', animation: 'pulse 1.5s infinite' }} />
                  等待操作
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Lark card preview (signature visual) ────────────────
const LarkCardPreview = ({ approval, applicant, dept, meta }) => (
  <div style={{
    maxWidth: 420, padding: 0, borderRadius: 8, overflow: 'hidden',
    background: '#fff', boxShadow: '0 4px 16px rgba(31,35,41,0.08)',
    border: '1px solid var(--border)',
  }}>
    {/* Lark message header */}
    <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, background: '#FAFBFC', borderBottom: '1px solid var(--divider)' }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6,
        background: 'linear-gradient(135deg, #3370FF, #5B92FF)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" stroke="#fff" strokeWidth="2"/>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>IT 资产管理</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>机器人 · {approval.submittedAt.slice(11, 16)}</div>
      </div>
      <Icon name="more" size={14} color="var(--text-3)" />
    </div>

    {/* Card colored header */}
    <div style={{ padding: '12px 14px', background: meta.bg, color: meta.color }}>
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.02em', opacity: 0.85 }}>📥 待审批 · {meta.label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: 'var(--text-1)' }}>{approval.target}</div>
    </div>

    {/* Card body */}
    <div style={{ padding: 14 }}>
      {[
        { k: '申请人', v: <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar user={applicant} size={18} /><span>{applicant?.name}</span></div> },
        { k: '部门', v: dept?.name },
        { k: '事由', v: <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{approval.reason}</span> },
        { k: '紧急程度', v: window.URGENCY_META[approval.urgency]?.label || '常规' },
      ].map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '5px 0', fontSize: 12 }}>
          <span style={{ flex: '0 0 60px', color: 'var(--text-3)' }}>{row.k}</span>
          <span style={{ flex: 1, color: 'var(--text-1)' }}>{row.v}</span>
        </div>
      ))}
    </div>

    {/* Action buttons */}
    <div style={{ padding: '0 14px 14px', display: 'flex', gap: 8 }}>
      <button style={{
        flex: 1, height: 32, borderRadius: 6, fontSize: 13,
        border: '1px solid var(--border-strong)', background: '#fff', color: 'var(--text-1)',
      }}>查看详情</button>
      <button style={{
        flex: 1, height: 32, borderRadius: 6, fontSize: 13,
        background: 'var(--lark-blue)', color: '#fff', fontWeight: 500, border: 'none',
      }}>同意</button>
      <button style={{
        flex: '0 0 64px', height: 32, borderRadius: 6, fontSize: 13,
        border: '1px solid var(--border-strong)', background: '#fff', color: 'var(--text-2)',
      }}>拒绝</button>
    </div>

    {/* Status footer */}
    <div style={{ padding: '8px 14px', borderTop: '1px solid var(--divider)', background: '#FAFBFC', fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
      <Icon name="check" size={11} color="var(--success)" />
      <span>已通过 Lark 推送给 {applicant?.name},消息已读</span>
    </div>
  </div>
);

Object.assign(window, { ApprovalCenter, ApprovalDetail });
