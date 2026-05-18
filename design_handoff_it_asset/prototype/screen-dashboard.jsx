// Admin: Dashboard
const Dashboard = ({ onNav, onOpenAsset }) => {
  const stats = window.STATS;
  const fmt = (n) => n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : n.toLocaleString();

  // Status distribution (donut)
  const statusData = [
    { key: 'assigned', label: '已领用', count: stats.assigned, color: '#3370FF' },
    { key: 'stocked', label: '库存中', count: stats.stocked, color: '#00B42A' },
    { key: 'repairing', label: '维修中', count: stats.repairing, color: '#FF8800' },
    { key: 'idle', label: '闲置', count: stats.idle, color: '#7E5EE5' },
    { key: 'scrapped', label: '报废', count: stats.scrapped, color: '#C9CDD4' },
  ];
  const statusTotal = statusData.reduce((s, d) => s + d.count, 0);

  // Donut math
  let cumulative = 0;
  const donutR = 60, donutW = 18;
  const circumference = 2 * Math.PI * donutR;

  // Trend chart
  const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'];
  const assignment = window.TRENDS.assignment;
  const returnT = window.TRENDS.return;
  const repair = window.TRENDS.repair;
  const maxY = Math.max(...assignment, ...returnT, ...repair) + 4;
  const chartW = 520, chartH = 200;
  const padding = { l: 36, r: 16, t: 16, b: 28 };
  const innerW = chartW - padding.l - padding.r;
  const innerH = chartH - padding.t - padding.b;
  const xStep = innerW / (weeks.length - 1);
  const yFor = (v) => padding.t + innerH - (v / maxY) * innerH;
  const linePath = (data) => data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${padding.l + i * xStep} ${yFor(v)}`).join(' ');
  const areaPath = (data) => linePath(data) + ` L ${padding.l + (data.length - 1) * xStep} ${padding.t + innerH} L ${padding.l} ${padding.t + innerH} Z`;

  // Recent activity
  const recentAssets = window.ASSETS.filter(a => a.status === 'assigned').slice(0, 5);

  // Department distribution
  const deptDist = window.DEPARTMENTS.map(d => ({
    ...d, count: window.ASSETS.filter(a => a.dept === d.id && a.status === 'assigned').length,
  })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);
  const maxDept = Math.max(...deptDist.map(d => d.count));

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }} className="fade-in">
      {/* Greeting + quick actions */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
            下午好,林峰 👋
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            今天有 <b style={{ color: 'var(--lark-blue)' }}>{window.APPROVALS.length}</b> 个待审批 ·
            <b style={{ color: 'var(--warning)' }}> {stats.lowStock}</b> 个 SKU 库存预警 ·
            <b style={{ color: 'var(--text-2)' }}> {stats.repairing}</b> 件资产维修中
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="default" icon="qr">扫码盘点</Button>
          <Button variant="default" icon="upload">导入</Button>
          <Button variant="primary" icon="add">新增资产</Button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KPICard label="资产总数" value={stats.total} suffix="件" trend="+8" trendDir="up" hint="本月新增" icon="box" color="#3370FF" />
        <KPICard label="资产总价值" value={fmt(stats.totalValue)} suffix="元" trend="¥ 246,900" trendDir="up" hint="本月入库" icon="trendUp" color="#00B42A" />
        <KPICard label="待审批" value={window.APPROVALS.length} suffix="单" trend="2 件已逾期" trendDir="warn" hint="" icon="approval" color="#FF8800" />
        <KPICard label="库存预警" value={stats.lowStock} suffix="个 SKU" trend="建议补货" trendDir="danger" hint="" icon="warning" color="#F53F3F" />
      </div>

      {/* Row 2: Status donut + Trend chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 12 }}>
        {/* Status donut */}
        <Card title="资产状态分布" extra={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>实时</span>} padding={20}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg width="160" height="160" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r={donutR} fill="none" stroke="#F2F3F5" strokeWidth={donutW} />
              {statusData.map((d, i) => {
                const len = (d.count / statusTotal) * circumference;
                const offset = -cumulative;
                cumulative += len;
                return (
                  <circle key={i} cx="80" cy="80" r={donutR} fill="none"
                    stroke={d.color} strokeWidth={donutW}
                    strokeDasharray={`${len} ${circumference}`}
                    strokeDashoffset={offset}
                    transform="rotate(-90 80 80)"
                    style={{ transition: 'all 0.4s' }}
                  />
                );
              })}
              <text x="80" y="74" textAnchor="middle" fontSize="11" fill="#86909C">资产总数</text>
              <text x="80" y="96" textAnchor="middle" fontSize="26" fontWeight="600" fill="#1F2329" letterSpacing="-0.02em">{statusTotal}</text>
            </svg>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {statusData.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                  <span style={{ flex: 1, color: 'var(--text-2)' }}>{d.label}</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>{d.count}</span>
                  <span style={{ color: 'var(--text-3)', width: 40, textAlign: 'right' }}>{((d.count / statusTotal) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Trend chart */}
        <Card title="近 12 周流转趋势" extra={
          <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
            <LegendDot color="#3370FF" label="领用" />
            <LegendDot color="#00B42A" label="归还" />
            <LegendDot color="#FF8800" label="维修" />
          </div>
        } padding={20}>
          <svg width={chartW} height={chartH} style={{ display: 'block', overflow: 'visible' }}>
            <defs>
              <linearGradient id="grad-assign" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3370FF" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#3370FF" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Y grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
              const y = padding.t + innerH * (1 - p);
              return (
                <g key={i}>
                  <line x1={padding.l} y1={y} x2={chartW - padding.r} y2={y} stroke="#F2F3F5" strokeDasharray="2 4" />
                  <text x={padding.l - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#86909C">{Math.round(maxY * p)}</text>
                </g>
              );
            })}
            {/* X labels */}
            {weeks.map((w, i) => (
              <text key={i} x={padding.l + i * xStep} y={chartH - 8} textAnchor="middle" fontSize="11" fill="#86909C">{w}</text>
            ))}
            {/* Area + line */}
            <path d={areaPath(assignment)} fill="url(#grad-assign)" />
            <path d={linePath(assignment)} fill="none" stroke="#3370FF" strokeWidth="2" />
            <path d={linePath(returnT)} fill="none" stroke="#00B42A" strokeWidth="2" />
            <path d={linePath(repair)} fill="none" stroke="#FF8800" strokeWidth="2" strokeDasharray="4 4" />
            {/* Points on the last */}
            {assignment.map((v, i) => (
              <circle key={i} cx={padding.l + i * xStep} cy={yFor(v)} r="3" fill="#fff" stroke="#3370FF" strokeWidth="1.5" />
            ))}
            {/* Highlight last point */}
            <g>
              <circle cx={padding.l + (assignment.length - 1) * xStep} cy={yFor(assignment[assignment.length - 1])} r="6" fill="#3370FF" fillOpacity="0.16" />
              <circle cx={padding.l + (assignment.length - 1) * xStep} cy={yFor(assignment[assignment.length - 1])} r="3.5" fill="#3370FF" />
              <rect x={padding.l + (assignment.length - 1) * xStep - 32} y={yFor(assignment[assignment.length - 1]) - 30} width="64" height="22" rx="4" fill="#1F2329" />
              <text x={padding.l + (assignment.length - 1) * xStep} y={yFor(assignment[assignment.length - 1]) - 15} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="500">{assignment[assignment.length - 1]} 件 · 本周</text>
            </g>
          </svg>
        </Card>
      </div>

      {/* Row 3: Approvals + Dept dist + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12 }}>
        {/* Approvals */}
        <Card title="待我审批" padding={0}
          extra={<a onClick={() => onNav('approval')} style={{ fontSize: 12, color: 'var(--lark-blue)', cursor: 'pointer' }}>查看全部 →</a>}>
          <div>
            {window.APPROVALS.slice(0, 4).map((a, i) => {
              const u = window.getUser(a.applicant);
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 20px',
                  borderBottom: i < 3 ? '1px solid var(--divider)' : 'none',
                  cursor: 'pointer',
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#FAFBFC'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <Avatar user={u} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 500 }}>{u.name}</span>
                      <span style={{ color: 'var(--text-3)' }}>· {a.type}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.target} · {a.reason}
                    </div>
                  </div>
                  <Button size="sm" variant="default">详情</Button>
                  <Button size="sm" variant="primary">同意</Button>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Dept distribution */}
        <Card title="部门资产分布" padding={20}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {deptDist.slice(0, 6).map((d, i) => (
              <div key={d.id} style={{ fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{d.name}</span>
                  <span style={{ color: 'var(--text-2)' }}>{d.count} 件</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: '#F2F3F5', overflow: 'hidden' }}>
                  <div style={{
                    width: `${(d.count / maxDept) * 100}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, #3370FF 0%, #5B92FF 100%)`,
                    borderRadius: 3,
                    transition: 'width 0.6s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Low stock alert */}
        <Card title="库存预警" padding={0}
          extra={<a onClick={() => onNav('inventory')} style={{ fontSize: 12, color: 'var(--lark-blue)', cursor: 'pointer' }}>处理 →</a>}>
          {window.SKUS.filter(s => s.stock < s.safety).slice(0, 4).map((s, i, arr) => {
            const ratio = s.stock / s.safety;
            return (
              <div key={s.sku} style={{
                padding: '12px 20px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--divider)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Icon name="warning" size={14} color="var(--warning)" />
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-3)' }}>
                  <span>当前 <b style={{ color: 'var(--danger)' }}>{s.stock}</b> / 安全 {s.safety}</span>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#F2F3F5', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, ratio * 100)}%`, height: '100%', background: 'var(--warning)' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      {/* Row 4: Recent assignments */}
      <Card title="最近资产流转" padding={0}
        extra={<a onClick={() => onNav('assets')} style={{ fontSize: 12, color: 'var(--lark-blue)', cursor: 'pointer' }}>资产台账 →</a>}>
        <table style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#FAFBFC', color: 'var(--text-3)' }}>
              <th style={tableHeaderStyle}>资产编号</th>
              <th style={tableHeaderStyle}>资产名称</th>
              <th style={tableHeaderStyle}>状态</th>
              <th style={tableHeaderStyle}>责任人</th>
              <th style={tableHeaderStyle}>地点</th>
              <th style={{...tableHeaderStyle, textAlign: 'right' }}>领用时间</th>
            </tr>
          </thead>
          <tbody>
            {recentAssets.map((a, i) => (
              <tr key={a.code} onClick={() => onOpenAsset(a)}
                onMouseEnter={(e) => e.currentTarget.style.background = '#FAFBFC'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                style={{ cursor: 'pointer', borderTop: '1px solid var(--divider)' }}>
                <td style={tableCellStyle}>
                  <span className="text-mono" style={{ fontSize: 12, color: 'var(--lark-blue)', fontWeight: 500 }}>{a.code}</span>
                </td>
                <td style={tableCellStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AssetTypeIcon typeId={a.type} size={28} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.brand} · {a.model}</div>
                    </div>
                  </div>
                </td>
                <td style={tableCellStyle}><StatusBadge status={a.status} /></td>
                <td style={tableCellStyle}><UserCell userId={a.owner} secondary={false} /></td>
                <td style={{...tableCellStyle, color: 'var(--text-2)' }}>{a.location}</td>
                <td style={{...tableCellStyle, textAlign: 'right', color: 'var(--text-3)', fontSize: 12 }}>{a.purchase}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const tableHeaderStyle = { padding: '12px 20px', fontWeight: 500, fontSize: 12, textAlign: 'left' };
const tableCellStyle = { padding: '12px 20px', verticalAlign: 'middle' };

const LegendDot = ({ color, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-2)' }}>
    <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
    {label}
  </span>
);

const KPICard = ({ label, value, suffix, trend, trendDir, hint, icon, color }) => {
  const trendColor = { up: '#00B42A', down: '#F53F3F', warn: '#FF8800', danger: '#F53F3F' }[trendDir] || '#86909C';
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: 20,
      border: '1px solid var(--border)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -10, right: -10, width: 80, height: 80,
        background: `radial-gradient(circle, ${color}14 0%, transparent 70%)`,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</div>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={14} color={color} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>{value}</span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{suffix}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12 }}>
        <span style={{ color: trendColor, fontWeight: 500 }}>{trend}</span>
        <span style={{ color: 'var(--text-3)' }}>{hint}</span>
      </div>
    </div>
  );
};

Object.assign(window, { Dashboard });
