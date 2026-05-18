// Employee H5 — mobile-styled in-Lark page
// Shown inside admin canvas as a "phone-like" centered card (no device bezel per requirements).
// Width 390px, full-height of the canvas, Lark mobile aesthetic.

const EmployeeApp = ({ onClose }) => {
  const [route, setRoute] = React.useState('home'); // home | request | submitted | detail
  const [lang, setLang] = React.useState('zh');
  const [requestForm, setRequestForm] = React.useState({
    type: '', // 'sku' or 'asset'
    items: [],
    reason: '',
    urgency: 'normal',
    deliverTo: 'self_desk',
  });
  const [showSheet, setShowSheet] = React.useState(null); // null | 'category' | 'success'

  const me = window.getUser('u8'); // 周明 - 前端工程师
  const myAssets = window.ASSETS.filter(a => a.owner === me.id);
  const myType = window.getType(myAssets[0]?.type);

  const t = (zh, en) => lang === 'zh' ? zh : en;

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#F4F5F7',
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Lark top bar */}
      <LarkTopBar route={route} lang={lang} setLang={setLang} onBack={() => {
        if (route === 'home') onClose();
        else if (route === 'submitted') setRoute('home');
        else setRoute('home');
      }} t={t} />

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {route === 'home' && <EmployeeHome me={me} myAssets={myAssets} lang={lang} t={t} onGoRequest={() => setRoute('request')} />}
        {route === 'request' && <RequestFlow form={requestForm} setForm={setRequestForm} lang={lang} t={t}
          onSubmit={() => { setRoute('submitted'); setShowSheet('success'); }}
          onShowSheet={setShowSheet} showSheet={showSheet} />}
        {route === 'submitted' && <SubmittedScreen form={requestForm} lang={lang} t={t} onBack={() => setRoute('home')} onNew={() => { setRequestForm({ type: '', items: [], reason: '', urgency: 'normal', deliverTo: 'self_desk' }); setRoute('request'); }} />}
      </div>

      {/* Bottom tab bar (always visible on home) */}
      {route === 'home' && <BottomTabBar lang={lang} t={t} />}
    </div>
  );
};

const LarkTopBar = ({ route, lang, setLang, onBack, t }) => {
  const titles = {
    home: t('IT 服务', 'IT Service'),
    request: t('申请领用', 'Request Items'),
    submitted: t('提交成功', 'Submitted'),
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
          <svg width="14" height="10" viewBox="0 0 14 10" fill="#000"><path d="M7 1a8 8 0 0 1 5.66 2.34l-1.42 1.42A6 6 0 0 0 7 3a6 6 0 0 0-4.24 1.76L1.34 3.34A8 8 0 0 1 7 1zM7 5a4 4 0 0 1 2.83 1.17l-1.42 1.42A2 2 0 0 0 7 7a2 2 0 0 0-1.41.59L4.17 6.17A4 4 0 0 1 7 5zm0 4a1 1 0 0 1 .71.29L7 10l-.71-.71A1 1 0 0 1 7 9z"/></svg>
          <svg width="22" height="10" viewBox="0 0 22 10"><rect x="0.5" y="0.5" width="18" height="9" rx="2" fill="none" stroke="#000" strokeOpacity="0.4"/><rect x="20" y="3" width="1.5" height="4" rx="0.5" fill="#000" fillOpacity="0.4"/><rect x="2" y="2" width="14" height="6" rx="1" fill="#000"/></svg>
        </div>
      </div>
      {/* Nav bar */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', padding: '0 14px',
        background: '#fff', borderBottom: '0.5px solid #E5E6EB', position: 'relative',
      }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#1F2329', fontSize: 16, padding: 4 }}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 600, color: '#1F2329' }}>{titles[route]}</div>
        <button onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} style={{
          fontSize: 12, color: '#3370FF', padding: '4px 8px', borderRadius: 4, fontWeight: 500,
        }}>{lang === 'zh' ? 'EN' : '中'}</button>
      </div>
    </>
  );
};

const EmployeeHome = ({ me, myAssets, lang, t, onGoRequest }) => {
  const myDept = window.getDept(me.dept);
  const myAssetValue = myAssets.reduce((s, a) => s + a.price, 0);

  const quickActions = [
    { id: 'request', icon: 'add', label: t('申请领用', 'Request'), color: '#3370FF', bg: '#E8F1FF' },
    { id: 'return', icon: 'refresh', label: t('申请归还', 'Return'), color: '#00B42A', bg: '#E8FFEA' },
    { id: 'repair', icon: 'repair', label: t('申请维修', 'Repair'), color: '#FF8800', bg: '#FFF7E8' },
    { id: 'inspect', icon: 'verify', label: t('盘点确认', 'Verify'), color: '#7E5EE5', bg: '#F1ECFF' },
  ];

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Profile header */}
      <div style={{
        padding: '20px 16px 28px',
        background: 'linear-gradient(180deg, #3370FF 0%, #5B92FF 100%)',
        color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -40, right: 30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <Avatar user={me} size={48} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{me.name}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{myDept.name} · {me.role}</div>
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, position: 'relative' }}>
          <ProfileStat label={t('名下资产', 'My Assets')} value={myAssets.length} suffix={t('件', '')} />
          <ProfileStat label={t('总价值', 'Value')} value={`¥${(myAssetValue / 1000).toFixed(1)}k`} />
          <ProfileStat label={t('待办', 'Pending')} value="1" hint={t('待盘点', 'Verify')} />
        </div>
      </div>

      {/* Quick actions */}
      <div style={{
        margin: '-16px 12px 0', padding: '16px 8px', borderRadius: 12, background: '#fff',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, position: 'relative',
        boxShadow: '0 2px 12px rgba(31,35,41,0.06)',
      }}>
        {quickActions.map(a => (
          <button key={a.id} onClick={a.id === 'request' ? onGoRequest : undefined}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 8, borderRadius: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={a.icon} size={20} color={a.color} />
            </div>
            <span style={{ fontSize: 12, color: '#1F2329' }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* To-do banner */}
      <div style={{ margin: '16px 12px 0', padding: '12px 14px', borderRadius: 12, background: '#FFF7E8', border: '1px solid #FFE4B3', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FF8800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell" size={16} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#A66200' }}>{t('2026 Q2 资产盘点 - 请确认', 'Q2 2026 Inventory - Please Confirm')}</div>
          <div style={{ fontSize: 11, color: '#A66200', opacity: 0.8 }}>{t('截止 5/20 · 共 ' + myAssets.length + ' 件待确认', `Due 5/20 · ${myAssets.length} items`)}</div>
        </div>
        <Icon name="chevronRight" size={14} color="#A66200" />
      </div>

      {/* My assets */}
      <div style={{ margin: '20px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1F2329' }}>{t('我的资产', 'My Assets')}</span>
          <span style={{ fontSize: 12, color: '#86909C' }}>{t('查看全部', 'See all')} ›</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myAssets.map(a => (
            <div key={a.code} style={{
              padding: 14, borderRadius: 12, background: '#fff',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <AssetTypeIcon typeId={a.type} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1F2329' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: '#86909C', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{a.code}</div>
              </div>
              <StatusBadge status={a.status} lang={lang} />
            </div>
          ))}
        </div>
      </div>

      {/* Recent issues */}
      <div style={{ margin: '20px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1F2329' }}>{t('耗材领用记录', 'Consumable History')}</span>
          <span style={{ fontSize: 12, color: '#86909C' }}>{t('查看全部', 'See all')} ›</span>
        </div>
        <div style={{ padding: 14, borderRadius: 12, background: '#fff' }}>
          {[
            { item: 'USB-C 转 HDMI 转接头', qty: 1, time: '2026-05-10', en: 'USB-C to HDMI' },
            { item: 'CAT6 网线 3m', qty: 2, time: '2026-04-22', en: 'CAT6 Cable 3m' },
            { item: '罗技 M185 鼠标', qty: 1, time: '2026-03-18', en: 'Logitech M185' },
          ].map((r, i, arr) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 0', borderBottom: i < arr.length - 1 ? '0.5px solid #E5E6EB' : 'none',
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F2F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="package" size={14} color="#86909C" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#1F2329' }}>{t(r.item, r.en)}</div>
                <div style={{ fontSize: 11, color: '#86909C' }}>{r.time}</div>
              </div>
              <span style={{ fontSize: 12, color: '#86909C' }}>× {r.qty}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ProfileStat = ({ label, value, suffix, hint }) => (
  <div>
    <div style={{ fontSize: 11, opacity: 0.85 }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginTop: 2 }}>
      <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>{value}</span>
      {suffix && <span style={{ fontSize: 11, opacity: 0.85 }}>{suffix}</span>}
    </div>
    {hint && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>{hint}</div>}
  </div>
);

const RequestFlow = ({ form, setForm, lang, t, onSubmit, onShowSheet, showSheet }) => {
  const [step, setStep] = React.useState(1);

  const skuOptions = window.SKUS.slice(0, 8);

  // Validation
  const canNext = (s) => {
    if (s === 1) return form.items.length > 0;
    if (s === 2) return form.reason.trim().length >= 5;
    return true;
  };

  return (
    <div style={{ paddingBottom: 100, position: 'relative' }}>
      {/* Stepper */}
      <div style={{ padding: '16px 20px', background: '#fff', borderBottom: '0.5px solid #E5E6EB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { n: 1, label: t('选择物品', 'Items') },
            { n: 2, label: t('填写信息', 'Details') },
            { n: 3, label: t('确认提交', 'Confirm') },
          ].map((s, i, arr) => (
            <React.Fragment key={s.n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: step >= s.n ? '#3370FF' : '#F2F3F5',
                  color: step >= s.n ? '#fff' : '#86909C',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600,
                  border: step === s.n ? '3px solid #D1E2FF' : 'none',
                  transition: 'all 0.2s',
                }}>
                  {step > s.n ? <Icon name="check" size={12} color="#fff" /> : s.n}
                </div>
                <span style={{ fontSize: 11, color: step >= s.n ? '#1F2329' : '#86909C', fontWeight: step === s.n ? 500 : 400 }}>{s.label}</span>
              </div>
              {i < arr.length - 1 && (
                <div style={{ flex: 1, height: 2, background: step > s.n ? '#3370FF' : '#F2F3F5', margin: '0 8px', marginTop: -16, borderRadius: 1, transition: 'background 0.2s' }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step 1: pick items */}
      {step === 1 && (
        <div className="fade-in" style={{ padding: 16 }}>
          {/* Type tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[
              { id: 'sku', label: t('耗材/配件', 'Consumables'), desc: t('从库存领取', 'From stock') },
              { id: 'asset', label: t('固定资产', 'Assets'), desc: t('如笔记本、显示器', 'Laptop, monitor…') },
            ].map(t2 => (
              <button key={t2.id} onClick={() => setForm({ ...form, type: t2.id })}
                style={{
                  flex: 1, padding: 14, borderRadius: 12, textAlign: 'left',
                  border: `1.5px solid ${form.type === t2.id ? '#3370FF' : '#E5E6EB'}`,
                  background: form.type === t2.id ? '#E8F1FF' : '#fff',
                  position: 'relative',
                }}>
                {form.type === t2.id && (
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: '50%', background: '#3370FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={10} color="#fff" />
                  </div>
                )}
                <div style={{ fontSize: 14, fontWeight: 600, color: form.type === t2.id ? '#1A5BD0' : '#1F2329' }}>{t2.label}</div>
                <div style={{ fontSize: 11, color: '#86909C', marginTop: 2 }}>{t2.desc}</div>
              </button>
            ))}
          </div>

          {form.type === 'sku' && (
            <>
              <div style={{ fontSize: 13, color: '#4E5969', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('请选择需要的物品', 'Select items')}</span>
                <span style={{ color: '#3370FF' }}>{t('已选 ' + form.items.length, `${form.items.length} selected`)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {skuOptions.map(s => {
                  const item = form.items.find(it => it.sku === s.sku);
                  return (
                    <div key={s.sku} style={{
                      padding: 12, borderRadius: 10, background: '#fff',
                      border: `1px solid ${item ? '#3370FF' : '#E5E6EB'}`,
                      display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'border 0.16s',
                    }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: '#F2F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="package" size={18} color="#4E5969" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#1F2329' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: '#86909C' }}>{s.brand} · {s.spec} · {t('库存', 'Stock')} {s.stock}</div>
                      </div>
                      {item ? (
                        <Stepper value={item.qty} onChange={(q) => {
                          if (q <= 0) setForm({ ...form, items: form.items.filter(it => it.sku !== s.sku) });
                          else setForm({ ...form, items: form.items.map(it => it.sku === s.sku ? { ...it, qty: q } : it) });
                        }} max={Math.min(s.stock, 5)} />
                      ) : (
                        <button onClick={() => setForm({ ...form, items: [...form.items, { sku: s.sku, name: s.name, qty: 1 }] })}
                          style={{
                            padding: '6px 14px', borderRadius: 18, background: '#3370FF',
                            color: '#fff', fontSize: 12, fontWeight: 500,
                          }}>{t('添加', 'Add')}</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {form.type === 'asset' && (
            <div style={{ padding: 40, textAlign: 'center', color: '#86909C', fontSize: 13, background: '#fff', borderRadius: 12 }}>
              <Icon name="laptop" size={36} color="#C9CDD4" />
              <div style={{ marginTop: 12 }}>{t('请选择需要的资产类型', 'Select asset type')}</div>
              <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {window.ASSET_TYPES.slice(0, 4).map(at => (
                  <button key={at.id} onClick={() => setForm({ ...form, items: [{ sku: at.id, name: at.name, qty: 1, isAsset: true }] })}
                    style={{
                      padding: '8px 14px', borderRadius: 18, fontSize: 12,
                      border: `1px solid ${form.items[0]?.sku === at.id ? '#3370FF' : '#E5E6EB'}`,
                      background: form.items[0]?.sku === at.id ? '#E8F1FF' : '#fff',
                      color: form.items[0]?.sku === at.id ? '#3370FF' : '#1F2329',
                    }}>{at.name}</button>
                ))}
              </div>
            </div>
          )}

          {!form.type && (
            <div style={{ padding: 40, textAlign: 'center', color: '#86909C', fontSize: 13 }}>
              {t('请先选择申请类型', 'Choose a type first')}
            </div>
          )}
        </div>
      )}

      {/* Step 2: details */}
      {step === 2 && (
        <div className="fade-in" style={{ padding: 16 }}>
          <FormField label={t('申请事由', 'Reason')} required>
            <textarea
              placeholder={t('请简要说明申请原因(至少 5 个字)', 'Briefly explain why (at least 5 chars)')}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              style={{
                width: '100%', minHeight: 88, padding: 12, borderRadius: 10,
                border: `1px solid ${form.reason && form.reason.length < 5 ? '#F53F3F' : '#E5E6EB'}`,
                fontSize: 14, resize: 'vertical', outline: 'none', background: '#fff',
                color: '#1F2329',
              }} />
            {form.reason && form.reason.length < 5 && (
              <div style={{ fontSize: 11, color: '#F53F3F', marginTop: 4 }}>{t('请输入至少 5 个字', 'Min 5 chars')}</div>
            )}
          </FormField>

          <FormField label={t('紧急程度', 'Urgency')}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: 'normal', label: t('常规(3 工作日)', 'Normal'), color: '#3370FF' },
                { id: 'urgent', label: t('紧急(24h)', 'Urgent'), color: '#FF8800' },
                { id: 'critical', label: t('特急(4h)', 'Critical'), color: '#F53F3F' },
              ].map(u => (
                <button key={u.id} onClick={() => setForm({ ...form, urgency: u.id })}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 8, fontSize: 12,
                    border: `1.5px solid ${form.urgency === u.id ? u.color : '#E5E6EB'}`,
                    background: form.urgency === u.id ? u.color + '12' : '#fff',
                    color: form.urgency === u.id ? u.color : '#1F2329',
                    fontWeight: form.urgency === u.id ? 500 : 400,
                  }}>{u.label}</button>
              ))}
            </div>
          </FormField>

          <FormField label={t('交付方式', 'Delivery')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { id: 'self_desk', label: t('送到我的工位', 'Deliver to my desk'), hint: t('上海·张江 - 研发区 6F-A21', 'Shanghai - 6F-A21') },
                { id: 'self_pickup', label: t('我自取', 'Self pickup'), hint: t('IT 仓库·B 区', 'IT Storage B') },
              ].map(d => (
                <label key={d.id} style={{
                  padding: 12, borderRadius: 10, background: '#fff',
                  border: `1px solid ${form.deliverTo === d.id ? '#3370FF' : '#E5E6EB'}`,
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: `2px solid ${form.deliverTo === d.id ? '#3370FF' : '#C9CDD4'}`,
                    background: form.deliverTo === d.id ? '#3370FF' : '#fff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {form.deliverTo === d.id && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#1F2329' }}>{d.label}</div>
                    <div style={{ fontSize: 11, color: '#86909C' }}>{d.hint}</div>
                  </div>
                  <input type="radio" checked={form.deliverTo === d.id} onChange={() => setForm({ ...form, deliverTo: d.id })} style={{ display: 'none' }} />
                </label>
              ))}
            </div>
          </FormField>
        </div>
      )}

      {/* Step 3: confirm */}
      {step === 3 && (
        <div className="fade-in" style={{ padding: 16 }}>
          <div style={{ padding: 16, borderRadius: 12, background: '#fff', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#86909C', marginBottom: 8 }}>{t('申请类型', 'Type')}</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
              {form.type === 'sku' ? t('耗材/配件领用', 'Consumable Request') : t('固定资产领用', 'Asset Request')}
            </div>
            <div style={{ fontSize: 12, color: '#86909C', marginBottom: 8 }}>{t('申请物品', 'Items')} ({form.items.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {form.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #F2F3F5', fontSize: 13 }}>
                  <span>{it.name}</span>
                  <span style={{ color: '#86909C' }}>× {it.qty}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#86909C', marginBottom: 4 }}>{t('申请事由', 'Reason')}</div>
            <div style={{ fontSize: 13, color: '#1F2329', marginBottom: 12, padding: '8px 12px', background: '#FAFBFC', borderRadius: 6 }}>{form.reason}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: '#86909C', marginBottom: 2 }}>{t('紧急程度', 'Urgency')}</div>
                <div style={{ fontSize: 13 }}>{form.urgency === 'normal' ? t('常规', 'Normal') : form.urgency === 'urgent' ? t('紧急', 'Urgent') : t('特急', 'Critical')}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#86909C', marginBottom: 2 }}>{t('交付方式', 'Delivery')}</div>
                <div style={{ fontSize: 13 }}>{form.deliverTo === 'self_desk' ? t('送达工位', 'Desk') : t('自取', 'Pickup')}</div>
              </div>
            </div>
          </div>

          {/* Approval flow preview */}
          <div style={{ padding: 16, borderRadius: 12, background: '#fff' }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>{t('审批流程', 'Approval Flow')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FlowNode user={window.getUser('u8')} label={t('提交人', 'Submitter')} active />
              <FlowArrow />
              <FlowNode user={window.getUser('u11')} label={t('部门主管', 'Manager')} />
              <FlowArrow />
              <FlowNode user={window.getUser('u15')} label={t('IT 发放', 'IT')} />
            </div>
            <div style={{ fontSize: 11, color: '#86909C', marginTop: 12 }}>
              {t('预计 1-2 工作日内完成审批和发放', 'Approx 1-2 business days')}
            </div>
          </div>
        </div>
      )}

      {/* Fixed bottom bar */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '12px 16px 20px', background: '#fff', borderTop: '0.5px solid #E5E6EB',
        display: 'flex', gap: 10,
      }}>
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} style={{
            padding: '0 20px', height: 44, borderRadius: 22, border: '1px solid #E5E6EB',
            background: '#fff', fontSize: 14, color: '#1F2329',
          }}>{t('上一步', 'Back')}</button>
        )}
        {step < 3 ? (
          <button disabled={!canNext(step)} onClick={() => setStep(step + 1)} style={{
            flex: 1, height: 44, borderRadius: 22,
            background: canNext(step) ? '#3370FF' : '#C9CDD4',
            color: '#fff', fontSize: 15, fontWeight: 500,
            transition: 'background 0.16s',
            cursor: canNext(step) ? 'pointer' : 'not-allowed',
          }}>{t('下一步', 'Next')}</button>
        ) : (
          <button onClick={onSubmit} style={{
            flex: 1, height: 44, borderRadius: 22,
            background: '#3370FF', color: '#fff', fontSize: 15, fontWeight: 500,
          }}>{t('提交申请', 'Submit')}</button>
        )}
      </div>
    </div>
  );
};

const FormField = ({ label, required, children }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ fontSize: 13, fontWeight: 500, color: '#1F2329', marginBottom: 8 }}>
      {label}{required && <span style={{ color: '#F53F3F', marginLeft: 2 }}>*</span>}
    </div>
    {children}
  </div>
);

const Stepper = ({ value, onChange, max = 99 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#F2F3F5', borderRadius: 14, padding: 2 }}>
    <button onClick={() => onChange(value - 1)} style={{
      width: 24, height: 24, borderRadius: '50%', background: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3370FF',
    }}>−</button>
    <span style={{ minWidth: 28, textAlign: 'center', fontSize: 13, fontWeight: 500 }}>{value}</span>
    <button onClick={() => value < max && onChange(value + 1)} style={{
      width: 24, height: 24, borderRadius: '50%', background: '#3370FF',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      opacity: value >= max ? 0.4 : 1,
    }}>+</button>
  </div>
);

const FlowNode = ({ user, label, active }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}>
    <div style={{ position: 'relative' }}>
      <Avatar user={user} size={36} />
      {active && <span style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: '#00B42A', border: '2px solid #fff' }} />}
    </div>
    <div style={{ fontSize: 11, color: '#86909C', textAlign: 'center' }}>{label}</div>
    <div style={{ fontSize: 11, fontWeight: 500, color: '#1F2329' }}>{user.name}</div>
  </div>
);

const FlowArrow = () => (
  <div style={{ flex: 1, height: 1, marginTop: -28, background: 'repeating-linear-gradient(90deg, #C9CDD4 0 4px, transparent 4px 8px)' }} />
);

const SubmittedScreen = ({ form, lang, t, onBack, onNew }) => {
  const reqId = 'AP-2026-' + Math.floor(1000 + Math.random() * 9000);
  return (
    <div className="fade-in" style={{ padding: '40px 20px', textAlign: 'center' }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%', background: '#E8FFEA',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '20px auto 16px',
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid #00B42A', opacity: 0.3 }} />
        <Icon name="check" size={36} color="#00B42A" />
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#1F2329' }}>{t('提交成功', 'Submitted!')}</div>
      <div style={{ fontSize: 13, color: '#86909C', marginTop: 6 }}>{t('申请单号', 'Request ID')}: <span className="text-mono">{reqId}</span></div>

      <div style={{ margin: '24px 0', padding: 16, borderRadius: 12, background: '#fff', textAlign: 'left' }}>
        <div style={{ fontSize: 12, color: '#86909C', marginBottom: 6 }}>{t('当前状态', 'Status')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF8800', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>{t('等待部门主管审批', 'Pending manager approval')}</span>
        </div>
        <div style={{ fontSize: 11, color: '#86909C', marginTop: 4 }}>{t('Lark 已通知 孙浩', 'Notified via Lark: Sun Hao')}</div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={{ flex: 1, height: 44, borderRadius: 22, border: '1px solid #E5E6EB', background: '#fff', fontSize: 14, color: '#1F2329' }}>{t('返回首页', 'Home')}</button>
        <button onClick={onNew} style={{ flex: 1, height: 44, borderRadius: 22, background: '#3370FF', color: '#fff', fontSize: 14, fontWeight: 500 }}>{t('再提一单', 'New Request')}</button>
      </div>
    </div>
  );
};

const BottomTabBar = ({ lang, t }) => (
  <div style={{
    height: 60, paddingBottom: 8, background: '#fff', borderTop: '0.5px solid #E5E6EB',
    display: 'flex', alignItems: 'center', justifyContent: 'space-around', position: 'relative',
  }}>
    {[
      { icon: 'home', label: t('首页', 'Home'), active: true },
      { icon: 'box', label: t('资产', 'Assets') },
      { icon: 'clock', label: t('记录', 'History') },
      { icon: 'user', label: t('我的', 'Me') },
    ].map((tab, i) => (
      <button key={i} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 12px',
      }}>
        <Icon name={tab.icon} size={20} color={tab.active ? '#3370FF' : '#86909C'} />
        <span style={{ fontSize: 10, color: tab.active ? '#3370FF' : '#86909C', fontWeight: tab.active ? 500 : 400 }}>{tab.label}</span>
      </button>
    ))}
  </div>
);

Object.assign(window, { EmployeeApp });
