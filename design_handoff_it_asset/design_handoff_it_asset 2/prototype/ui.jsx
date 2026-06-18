// Shared UI primitives & icons — Lark-native style
// All components attached to window for cross-file access.

// ─── Icons ─────────────────────────────────────────────────
const Icon = ({ name, size = 16, color = 'currentColor', style }) => {
  const paths = {
    // Nav
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    assets: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></>,
    inventory: <><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/></>,
    approval: <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
    inspect: <><path d="M9 11H3v10h6V11z"/><path d="M21 3h-6v18h6V3z"/><path d="M15 11h-6"/></>,
    report: <><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 6-6"/></>,
    repair: <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    // Action
    search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></>,
    add: <><path d="M12 5v14M5 12h14"/></>,
    filter: <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></>,
    refresh: <><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></>,
    qr: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M14 20h3M20 14v3M20 20h1"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    more: <><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></>,
    close: <><path d="M18 6L6 18M6 6l12 12"/></>,
    chevronDown: <path d="M6 9l6 6 6-6"/>,
    chevronRight: <path d="M9 18l6-6-6-6"/>,
    chevronLeft: <path d="M15 18l-6-6 6-6"/>,
    arrowRight: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    check: <path d="M20 6L9 17l-5-5"/>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    // Asset
    laptop: <><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M1 21h22"/></>,
    monitor: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    phone: <><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></>,
    tablet: <><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></>,
    dock: <><rect x="2" y="9" width="20" height="6" rx="1.5"/><circle cx="6" cy="12" r="1"/><circle cx="10" cy="12" r="1"/></>,
    headphones: <><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-7h3v5zM3 19a2 2 0 0 0 2 2h1v-7H3v5z"/></>,
    camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11z"/><circle cx="12" cy="13" r="4"/></>,
    // Timeline
    plus: <><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></>,
    tag: <><path d="M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
    request: <><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    verify: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></>,
    warning: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>,
    // Inventory
    box: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></>,
    trendUp: <><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></>,
    trendDown: <><path d="M23 18l-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/></>,
    // Mobile
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></>,
    package: <><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
  };
  const path = paths[name];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>{path}</svg>
  );
};

// ─── Status badge ─────────────────────────────────────────
const StatusBadge = ({ status, lang = 'zh' }) => {
  const s = window.ASSET_STATUS[status];
  if (!s) return null;
  const styles = {
    success: { bg: '#E8FFEA', color: '#00863C', dot: '#00B42A' },
    blue: { bg: '#E8F1FF', color: '#1A5BD0', dot: '#3370FF' },
    warning: { bg: '#FFF7E8', color: '#A66200', dot: '#FF8800' },
    danger: { bg: '#FFECE8', color: '#A8261D', dot: '#F53F3F' },
    gray: { bg: '#F2F3F5', color: '#4E5969', dot: '#86909C' },
    'gray-dark': { bg: '#E5E6EB', color: '#4E5969', dot: '#4E5969' },
  };
  const st = styles[s.color] || styles.gray;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500,
      background: st.bg, color: st.color, lineHeight: '20px', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot }} />
      {lang === 'en' ? s.en : s.label}
    </span>
  );
};

// ─── Avatar ───────────────────────────────────────────────
const Avatar = ({ user, size = 28 }) => {
  if (!user) return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#E5E6EB', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#86909C', fontSize: size * 0.4 }}>—</div>
  );
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: user.avatarColor,
      color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 500, flexShrink: 0, letterSpacing: '-0.02em',
    }}>{user.avatar}</div>
  );
};

const UserCell = ({ userId, secondary }) => {
  const u = window.getUser(userId);
  if (!u) return <span style={{ color: 'var(--text-3)' }}>未分配</span>;
  const d = window.getDept(u.dept);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Avatar user={u} size={28} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
        {secondary !== false && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{d?.name} · {u.role}</div>}
      </div>
    </div>
  );
};

// ─── Button ───────────────────────────────────────────────
const Button = ({ variant = 'default', size = 'md', icon, children, onClick, disabled, style, danger }) => {
  const sizes = {
    sm: { padding: '0 10px', height: 26, fontSize: 12, gap: 4, iconSize: 12 },
    md: { padding: '0 16px', height: 32, fontSize: 14, gap: 6, iconSize: 14 },
    lg: { padding: '0 20px', height: 40, fontSize: 14, gap: 8, iconSize: 16 },
  };
  const sz = sizes[size];
  const variants = {
    primary: { background: 'var(--lark-blue)', color: '#fff', border: '1px solid var(--lark-blue)' },
    default: { background: '#fff', color: 'var(--text-1)', border: '1px solid var(--border-strong)' },
    text: { background: 'transparent', color: 'var(--lark-blue)', border: '1px solid transparent' },
    subtle: { background: 'var(--lark-blue-bg)', color: 'var(--lark-blue)', border: '1px solid transparent' },
    ghost: { background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border)' },
  };
  let v = variants[variant];
  if (danger) v = { background: 'var(--danger)', color: '#fff', border: '1px solid var(--danger)' };
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={(e) => { if (!disabled && variant === 'primary') e.currentTarget.style.background = 'var(--lark-blue-hover)'; if (!disabled && variant === 'default') e.currentTarget.style.background = '#FAFBFC'; }}
      onMouseLeave={(e) => { if (!disabled && variant === 'primary') e.currentTarget.style.background = 'var(--lark-blue)'; if (!disabled && variant === 'default') e.currentTarget.style.background = '#fff'; }}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: sz.gap, padding: sz.padding, height: sz.height, fontSize: sz.fontSize,
        borderRadius: 6, fontWeight: 500, transition: 'all 0.16s',
        opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
        ...v, ...style,
      }}>
      {icon && <Icon name={icon} size={sz.iconSize} />}
      {children}
    </button>
  );
};

// ─── Card ─────────────────────────────────────────────────
const Card = ({ title, extra, children, style, bodyStyle, padding = 20 }) => (
  <div style={{ background: '#fff', borderRadius: 8, border: '1px solid var(--border)', ...style }}>
    {(title || extra) && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{title}</div>
        {extra}
      </div>
    )}
    <div style={{ padding, ...bodyStyle }}>{children}</div>
  </div>
);

// ─── Drawer ───────────────────────────────────────────────
const Drawer = ({ open, onClose, title, width = 720, children, footer }) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, animation: 'fadeIn 0.2s' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(31,35,41,0.45)' }} />
      <div className="slide-in-right" style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width,
        background: '#fff', display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
          <button onClick={onClose} style={{ display: 'flex', padding: 6, borderRadius: 4, color: 'var(--text-2)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
        {footer && <div style={{ padding: '14px 24px', borderTop: '1px solid var(--divider)', background: '#FAFBFC' }}>{footer}</div>}
      </div>
    </div>
  );
};

// ─── Input ───────────────────────────────────────────────
const Input = ({ icon, placeholder, value, onChange, style, error }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    border: `1px solid ${error ? 'var(--danger)' : 'var(--border-strong)'}`,
    borderRadius: 6, padding: '0 12px', height: 32, background: '#fff',
    transition: 'all 0.16s', ...style,
  }}>
    {icon && <Icon name={icon} size={14} color="var(--text-3)" />}
    <input type="text" placeholder={placeholder} value={value || ''} onChange={(e) => onChange?.(e.target.value)}
      style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--text-1)' }} />
  </div>
);

// ─── Asset type icon (with colored bg) ────────────────────
const AssetTypeIcon = ({ typeId, size = 36 }) => {
  const t = window.getType(typeId);
  if (!t) return null;
  const colors = {
    t1: { bg: '#E8F1FF', icon: '#3370FF' }, // laptop
    t2: { bg: '#F1ECFF', icon: '#7E5EE5' }, // monitor
    t3: { bg: '#FFF7E8', icon: '#D17A00' }, // phone
    t4: { bg: '#E8FFEA', icon: '#00863C' }, // tablet
    t5: { bg: '#E0F7FA', icon: '#0086A8' }, // dock
    t6: { bg: '#FFECE8', icon: '#D4380D' }, // headphones
    t7: { bg: '#FFF1F5', icon: '#C72060' }, // camera
  };
  const c = colors[typeId] || colors.t1;
  return (
    <div style={{ width: size, height: size, borderRadius: 8, background: c.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={t.icon} size={size * 0.5} color={c.icon} />
    </div>
  );
};

// ─── Empty state ───────────────────────────────────────────
const Empty = ({ text = '暂无数据', icon = 'box' }) => (
  <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
    <Icon name={icon} size={40} color="var(--text-4)" />
    <div style={{ marginTop: 12, fontSize: 13 }}>{text}</div>
  </div>
);

Object.assign(window, { Icon, StatusBadge, Avatar, UserCell, Button, Card, Drawer, Input, AssetTypeIcon, Empty });
