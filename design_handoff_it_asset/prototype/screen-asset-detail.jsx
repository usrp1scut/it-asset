// Asset detail drawer — signature moment: lifecycle timeline + accessory tree
const AssetDetail = ({ asset, open, onClose }) => {
  const [tab, setTab] = React.useState('overview');
  if (!asset) return null;

  // Build accessory tree
  const accessories = window.ASSETS.filter(a => a.boundTo === asset.code);
  // Parent (if this is itself bound to something)
  const parent = asset.boundTo ? window.ASSETS.find(a => a.code === asset.boundTo) : null;

  // Lifecycle events
  const events = window.LIFECYCLE[asset.code] || window.LIFECYCLE['default'];

  const u = window.getUser(asset.owner);
  const d = window.getDept(asset.dept);

  const tabs = [
    { id: 'overview', label: '基本信息' },
    { id: 'lifecycle', label: '生命周期', count: events.length },
    { id: 'accessories', label: '配件绑定', count: accessories.length },
    { id: 'attachments', label: '附件 / 照片' },
  ];

  return (
    <Drawer open={open} onClose={onClose} title="资产详情" width={780}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="default" size="md" icon="qr">查看二维码</Button>
            <Button variant="default" size="md" icon="edit">编辑</Button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {asset.status === 'stocked' && <Button variant="primary" size="md" icon="user">分配给员工</Button>}
            {asset.status === 'assigned' && <>
              <Button variant="default" size="md" icon="repair">报修</Button>
              <Button variant="default" size="md" icon="refresh">归还入库</Button>
              <Button variant="default" size="md" icon="link">转移</Button>
            </>}
            {(asset.status === 'idle' || asset.status === 'pending_scrap') && <Button danger size="md">申请报废</Button>}
          </div>
        </div>
      }>
      {/* Hero header */}
      <div style={{ padding: '24px 24px 0' }}>
        <div style={{
          display: 'flex', gap: 16, padding: 20,
          borderRadius: 10, background: 'linear-gradient(135deg, #F5F9FF 0%, #FAFBFC 100%)',
          border: '1px solid var(--border)',
        }}>
          <AssetTypeIcon typeId={asset.type} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="text-mono" style={{ fontSize: 12, color: 'var(--lark-blue)', fontWeight: 500, padding: '2px 6px', background: 'var(--lark-blue-bg)', borderRadius: 3 }}>{asset.code}</span>
              <StatusBadge status={asset.status} />
              {parent && (
                <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="link" size={11} />绑定于 {parent.code}
                </span>
              )}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{asset.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
              {asset.brand} · {asset.model} · SN <span className="text-mono">{asset.sn}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>采购价</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>¥ {asset.price.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{asset.supplier}</div>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ padding: '0 24px', borderBottom: '1px solid var(--divider)', display: 'flex', gap: 4, marginTop: 16 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '12px 16px', position: 'relative',
              fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--lark-blue)' : 'var(--text-2)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span style={{ padding: '0 6px', borderRadius: 8, fontSize: 11, background: tab === t.id ? 'var(--lark-blue-bg)' : 'var(--bg-canvas)', color: tab === t.id ? 'var(--lark-blue)' : 'var(--text-3)' }}>{t.count}</span>
            )}
            {tab === t.id && (
              <span style={{ position: 'absolute', bottom: -1, left: 8, right: 8, height: 2, background: 'var(--lark-blue)', borderRadius: 1 }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div style={{ padding: 24 }}>
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Section title="使用信息">
              <InfoGrid>
                <InfoItem label="责任人">{u ? <UserCell userId={u.id} /> : <span style={{ color: 'var(--text-3)' }}>未分配</span>}</InfoItem>
                <InfoItem label="所属部门">{d?.name || '—'}</InfoItem>
                <InfoItem label="存放地点">{asset.location}</InfoItem>
                <InfoItem label="领用日期">{u ? asset.purchase : '—'}</InfoItem>
              </InfoGrid>
            </Section>

            <Section title="采购与保修">
              <InfoGrid>
                <InfoItem label="采购日期">{asset.purchase}</InfoItem>
                <InfoItem label="采购价格">¥ {asset.price.toLocaleString()}</InfoItem>
                <InfoItem label="供应商">{asset.supplier}</InfoItem>
                <InfoItem label="保修截止">
                  {asset.warranty}
                  {(() => {
                    const days = Math.floor((new Date(asset.warranty) - new Date('2026-05-18')) / 86400000);
                    if (days < 0) return <span style={{ marginLeft: 6, color: 'var(--danger)', fontSize: 12 }}>已过保 {Math.abs(days)} 天</span>;
                    if (days < 180) return <span style={{ marginLeft: 6, color: 'var(--warning)', fontSize: 12 }}>剩 {days} 天</span>;
                    return <span style={{ marginLeft: 6, color: 'var(--success)', fontSize: 12 }}>剩 {Math.floor(days / 30)} 个月</span>;
                  })()}
                </InfoItem>
              </InfoGrid>
            </Section>

            <Section title="规格与备注">
              <InfoGrid>
                <InfoItem label="资产类型">{window.getType(asset.type)?.name}</InfoItem>
                <InfoItem label="品牌型号">{asset.brand} {asset.model}</InfoItem>
                <InfoItem label="序列号"><span className="text-mono">{asset.sn}</span></InfoItem>
                <InfoItem label="管理方式">一物一码</InfoItem>
              </InfoGrid>
            </Section>
          </div>
        )}

        {tab === 'lifecycle' && <Timeline events={events} />}

        {tab === 'accessories' && <AccessoryTree main={parent || asset} accessories={parent ? window.ASSETS.filter(a => a.boundTo === parent.code) : accessories} highlight={asset.code} />}

        {tab === 'attachments' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {['资产照片正面', '资产照片背面', '采购发票', '验收单'].map((name, i) => (
              <div key={i} style={{
                aspectRatio: '4/3', borderRadius: 8, border: '1px dashed var(--border-strong)',
                background: '#FAFBFC', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Icon name={i < 2 ? 'camera' : 'box'} size={28} color="var(--text-4)" />
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
};

const Section = ({ title, children }) => (
  <div>
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 3, height: 12, borderRadius: 1.5, background: 'var(--lark-blue)' }} />
      {title}
    </div>
    {children}
  </div>
);

const InfoGrid = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>{children}</div>
);

const InfoItem = ({ label, children }) => (
  <div>
    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 13, color: 'var(--text-1)' }}>{children}</div>
  </div>
);

// ─── Timeline (signature) ─────────────────────────────────
const Timeline = ({ events }) => {
  const iconMap = {
    plus: { color: '#3370FF', bg: '#E8F1FF' },
    tag: { color: '#7E5EE5', bg: '#F1ECFF' },
    link: { color: '#00B2C7', bg: '#E0F7FA' },
    request: { color: '#FF8800', bg: '#FFF7E8' },
    check: { color: '#00B42A', bg: '#E8FFEA' },
    user: { color: '#3370FF', bg: '#E8F1FF' },
    verify: { color: '#00B42A', bg: '#E8FFEA' },
  };
  return (
    <div style={{ position: 'relative', paddingLeft: 8 }}>
      {events.map((e, i) => {
        const op = window.getUser(e.operator);
        const ic = iconMap[e.icon] || iconMap.plus;
        const isLast = i === events.length - 1;
        return (
          <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: isLast ? 0 : 24, position: 'relative' }}>
            {/* connecting line */}
            {!isLast && (
              <div style={{ position: 'absolute', left: 15, top: 32, bottom: 0, width: 2, background: 'var(--divider)' }} />
            )}
            {/* dot */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: ic.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              border: `2px solid ${i === 0 ? ic.color : 'transparent'}`,
              boxShadow: i === 0 ? `0 0 0 4px ${ic.bg}` : 'none',
              position: 'relative', zIndex: 1,
            }}>
              <Icon name={e.icon} size={14} color={ic.color} />
            </div>
            {/* content */}
            <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{e.action}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)', padding: '1px 6px', background: 'var(--bg-canvas)', borderRadius: 3, letterSpacing: '0.02em' }}>{e.en}</span>
                {i === 0 && <span style={{ fontSize: 11, color: 'var(--success)', padding: '1px 6px', background: 'var(--success-bg)', borderRadius: 3, fontWeight: 500 }}>最新</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 6 }}>{e.detail}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-3)' }}>
                {op && <>
                  <Avatar user={op} size={18} />
                  <span>{op.name}</span>
                  <span>·</span>
                </>}
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

// ─── Accessory Tree (signature) ──────────────────────────
const AccessoryTree = ({ main, accessories, highlight }) => {
  const mainUser = window.getUser(main.owner);
  return (
    <div>
      {/* Description */}
      <div style={{
        padding: '12px 14px', background: '#F5F9FF', borderRadius: 8,
        border: '1px solid var(--lark-blue-bg-strong)', marginBottom: 20,
        display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: 'var(--text-2)',
      }}>
        <Icon name="link" size={14} color="var(--lark-blue)" style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <b style={{ color: 'var(--text-1)' }}>配件绑定</b> · 主资产领用/归还时,绑定的配件会一起流转。
          解绑或独立分配请点击配件后的「⋯」操作。
        </div>
      </div>

      {/* Tree */}
      <div style={{ position: 'relative' }}>
        {/* Main node */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderRadius: 8,
          background: highlight === main.code ? 'var(--lark-blue-bg)' : '#fff',
          border: `1.5px solid ${highlight === main.code ? 'var(--lark-blue)' : 'var(--border)'}`,
        }}>
          <div style={{ position: 'relative' }}>
            <AssetTypeIcon typeId={main.type} size={44} />
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 18, height: 18, borderRadius: '50%', background: 'var(--lark-blue)',
              border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#fff', fontWeight: 600,
            }}>主</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span className="text-mono" style={{ fontSize: 11, color: 'var(--lark-blue)', fontWeight: 500 }}>{main.code}</span>
              <StatusBadge status={main.status} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{main.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{main.brand} · {main.model}</div>
          </div>
          {mainUser && <UserCell userId={mainUser.id} secondary={false} />}
        </div>

        {/* Accessories */}
        {accessories.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12, border: '1px dashed var(--border)', borderRadius: 8, marginTop: 16 }}>
            <Icon name="link" size={28} color="var(--text-4)" />
            <div style={{ marginTop: 8 }}>暂无绑定配件</div>
            <button style={{ marginTop: 12, fontSize: 12, color: 'var(--lark-blue)' }}>+ 添加配件绑定</button>
          </div>
        ) : (
          <div style={{ position: 'relative', marginLeft: 24, marginTop: 8 }}>
            {accessories.map((acc, i) => {
              const isLast = i === accessories.length - 1;
              return (
                <div key={acc.code} style={{ position: 'relative', paddingTop: 12 }}>
                  {/* Tree branch lines */}
                  <svg style={{ position: 'absolute', left: -16, top: 0, width: 32, height: '100%', overflow: 'visible' }}>
                    {/* vertical line */}
                    <line x1="8" y1="0" x2="8" y2={isLast ? 38 : '100%'} stroke="#E5E6EB" strokeWidth="1.5" />
                    {/* horizontal branch */}
                    <line x1="8" y1="38" x2="24" y2="38" stroke="#E5E6EB" strokeWidth="1.5" />
                    {/* connector dot */}
                    <circle cx="8" cy="38" r="3" fill="#fff" stroke="#3370FF" strokeWidth="1.5" />
                  </svg>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 8,
                    background: highlight === acc.code ? 'var(--lark-blue-bg)' : '#fff',
                    border: `1px solid ${highlight === acc.code ? 'var(--lark-blue)' : 'var(--border)'}`,
                    transition: 'all 0.16s',
                  }}>
                    <AssetTypeIcon typeId={acc.type} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span className="text-mono" style={{ fontSize: 11, color: 'var(--lark-blue)', fontWeight: 500 }}>{acc.code}</span>
                        <StatusBadge status={acc.status} />
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 3, background: 'var(--bg-canvas)', color: 'var(--text-3)' }}>跟随主资产</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{acc.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>¥ {acc.price.toLocaleString()} · {acc.brand}</div>
                    </div>
                    <button style={{ padding: 6, borderRadius: 4, color: 'var(--text-3)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <Icon name="more" size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add button */}
            <div style={{ position: 'relative', paddingTop: 12 }}>
              <svg style={{ position: 'absolute', left: -16, top: 0, width: 32, height: '100%' }}>
                <line x1="8" y1="0" x2="8" y2="32" stroke="#E5E6EB" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="8" y1="32" x2="24" y2="32" stroke="#E5E6EB" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                fontSize: 12, color: 'var(--lark-blue)', borderRadius: 6,
                border: '1px dashed var(--lark-blue-bg-strong)', background: '#fff',
              }}>
                <Icon name="add" size={12} />
                绑定配件
              </button>
            </div>
          </div>
        )}

        {/* Summary card */}
        <div style={{
          marginTop: 20, padding: 14, borderRadius: 8,
          background: '#FAFBFC', border: '1px solid var(--divider)',
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
        }}>
          <SummaryItem label="主资产" value={main.name} />
          <SummaryItem label="配件数量" value={`${accessories.length} 件`} />
          <SummaryItem label="组合总价" value={`¥ ${(main.price + accessories.reduce((s, a) => s + a.price, 0)).toLocaleString()}`} />
        </div>
      </div>
    </div>
  );
};

const SummaryItem = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{value}</div>
  </div>
);

Object.assign(window, { AssetDetail });
