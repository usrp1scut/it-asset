// Phase 2 mock data — extends data.js
// Inspection tasks, repair orders, scrap requests, audit events

// ─── Inspection (盘点) ─────────────────────────────────
window.INSPECTION_TASKS = [
  {
    id: 'INSP-2026-Q2',
    name: '2026 Q2 全公司资产盘点',
    scope: 'personal_in_use',
    scopeLabel: '个人在用资产',
    status: 'open',
    startedAt: '2026-05-15 09:00',
    endsAt: '2026-05-20 23:59',
    createdBy: 'u15',
    total: 28,
    confirmed: 19,
    mismatch: 2,
    pending: 7,
  },
  {
    id: 'INSP-2026-INFRA-04',
    name: '会议室基础设施盘点(4 月)',
    scope: 'infrastructure',
    scopeLabel: '基础设施',
    status: 'open',
    startedAt: '2026-04-28 14:00',
    endsAt: '2026-05-05 18:00',
    createdBy: 'u15',
    total: 14,
    confirmed: 14,
    mismatch: 0,
    pending: 0,
  },
  {
    id: 'INSP-2026-Q1',
    name: '2026 Q1 全公司资产盘点',
    scope: 'personal_all',
    scopeLabel: '个人全部资产',
    status: 'closed',
    startedAt: '2026-02-10 09:00',
    endsAt: '2026-02-20 18:00',
    createdBy: 'u15',
    total: 32,
    confirmed: 30,
    mismatch: 2,
    pending: 0,
  },
];

// Per-asset confirmation rows for the active task
window.INSPECTION_ITEMS = (() => {
  const rows = [];
  const statuses = ['ok','ok','ok','ok','ok','ok','ok','ok','ok','ok','ok','ok','ok','ok','ok','ok','ok','ok','ok','mismatch','mismatch','pending','pending','pending','pending','pending','pending','pending'];
  let i = 0;
  for (const a of window.ASSETS) {
    if (a.owner && a.status === 'in_use' && i < statuses.length) {
      const st = statuses[i++];
      rows.push({
        assetCode: a.code, owner: a.owner, dept: a.dept,
        assetName: a.name, brand: a.brand, location: a.location,
        confirmStatus: st,
        confirmedAt: st === 'pending' ? null :
          ['2026-05-15 14:22','2026-05-15 16:08','2026-05-16 09:30','2026-05-16 11:45','2026-05-16 13:50','2026-05-17 09:11','2026-05-17 10:42','2026-05-17 14:30','2026-05-18 08:50','2026-05-18 09:30','2026-05-18 10:15'][i % 11],
        remark: st === 'mismatch' ? (i % 2 === 0 ? '外壳有划痕,功能正常' : '保护壳已损坏,需更换') : null,
      });
    }
  }
  return rows;
})();

// ─── Repair Orders (维修工单) ─────────────────────────
window.REPAIR_ORDERS = [
  {
    id: 'REP-2026-0042',
    assetCode: 'IT-2024-0088',
    assetName: 'ThinkPad X1 Carbon',
    brand: 'Lenovo',
    openedBy: 'u16', // 何雪
    reason: '键盘 B 键失灵,使用频率高,影响开发',
    repairType: 'external',
    vendor: '联想认证服务点(张江)',
    shippedAt: '2026-05-16 14:30',
    expectedReturnAt: '2026-05-21',
    status: 'in_progress',
    cost: null,
    warrantyCovered: true,
    warrantyUntil: '2027-08-12',
    createdAt: '2026-05-16 09:42',
    timeline: [
      { t: '2026-05-16 09:42', stage: 'opened',     action: '提交报修',     by: 'u16', note: '员工通过 Lark 提交' },
      { t: '2026-05-16 10:15', stage: 'reviewed',   action: 'IT 受理',     by: 'u15', note: '判定外送 - 联想保修内' },
      { t: '2026-05-16 14:30', stage: 'shipped',    action: '送至服务点',   by: 'u15', note: '签收单号 SF-2026051600988' },
      { t: '2026-05-17 11:20', stage: 'in_progress',action: '服务点已接收', by: null,  note: '反馈:键盘模组需更换,保修内免费' },
    ],
  },
  {
    id: 'REP-2026-0043',
    assetCode: 'IT-2025-0103',
    assetName: 'LG 27UP850-W',
    brand: 'LG',
    openedBy: 'u4',
    reason: '屏幕右下角有亮斑,影响色彩校准',
    repairType: 'in_house',
    vendor: null,
    shippedAt: null,
    expectedReturnAt: '2026-05-20',
    status: 'open',
    cost: null,
    warrantyCovered: false,
    warrantyUntil: '2027-02-20',
    createdAt: '2026-05-17 16:08',
    timeline: [
      { t: '2026-05-17 16:08', stage: 'opened', action: '提交报修', by: 'u4', note: '员工通过 Lark 提交' },
    ],
  },
  {
    id: 'REP-2026-0040',
    assetCode: 'IT-2024-0089',
    assetName: 'Dell XPS 13',
    brand: 'Dell',
    openedBy: 'u15',
    reason: '电池虚电严重,续航不到 1 小时',
    repairType: 'external',
    vendor: '戴尔企业服务',
    shippedAt: '2026-05-10 11:00',
    expectedReturnAt: '2026-05-18',
    status: 'completed',
    cost: 680,
    warrantyCovered: false,
    warrantyUntil: '2027-06-05',
    createdAt: '2026-05-09 14:20',
    resolution: '更换电池模组,容量恢复至 95%',
    timeline: [
      { t: '2026-05-09 14:20', stage: 'opened',     action: '提交报修',    by: 'u15', note: '盘点时发现' },
      { t: '2026-05-10 09:30', stage: 'reviewed',   action: 'IT 受理',     by: 'u15', note: '判定外送 - 已过保需付费' },
      { t: '2026-05-10 11:00', stage: 'shipped',    action: '送至服务点',  by: 'u15', note: '' },
      { t: '2026-05-15 16:00', stage: 'returned',   action: '维修完成',    by: null,  note: '更换电池模组,费用 ¥680' },
      { t: '2026-05-15 17:30', stage: 'completed',  action: '工单完结',    by: 'u15', note: '资产回库,等待重新分配' },
    ],
  },
  {
    id: 'REP-2026-0038',
    assetCode: 'IT-2025-0405',
    assetName: 'Logitech Brio 4K',
    brand: 'Logitech',
    openedBy: 'u4',
    reason: '画面闪烁,USB-C 接口接触不良',
    repairType: 'in_house',
    vendor: null,
    shippedAt: null,
    expectedReturnAt: null,
    status: 'cancelled',
    cost: 0,
    warrantyCovered: true,
    warrantyUntil: '2027-02-20',
    createdAt: '2026-05-08 11:00',
    timeline: [
      { t: '2026-05-08 11:00', stage: 'opened',    action: '提交报修', by: 'u4',  note: '' },
      { t: '2026-05-08 14:20', stage: 'cancelled', action: '取消工单', by: 'u4',  note: '换了一根 USB-C 线就好了,误报' },
    ],
  },
];

// ─── Scrap Requests (报废申请) ────────────────────────
window.SCRAP_REQUESTS = [
  {
    id: 'SCR-2026-0007',
    assetCode: 'IT-2024-0099',
    assetName: 'ThinkPad T14',
    brand: 'Lenovo',
    proposer: 'u15',
    reason: '主板损坏,维修报价 ¥4200 高于残值,建议报废处置',
    status: 'pending',
    approver: 'u9', // 吴敏 财务
    approvedAt: null,
    approveRemark: null,
    dispositionMethod: null,
    residualValue: null,
    disposedAt: null,
    createdAt: '2026-05-15 10:30',
    originalPrice: 8999,
    bookValue: 1800,
    timeline: [
      { t: '2026-05-15 10:30', stage: 'submitted', action: 'IT 提交报废申请', by: 'u15', note: '主板诊断结论附件已上传' },
    ],
  },
  {
    id: 'SCR-2026-0006',
    assetCode: 'IT-2022-0011',
    assetName: 'MacBook Pro 13"(旧)',
    brand: 'Apple',
    proposer: 'u15',
    reason: '使用年限 4 年,Intel 架构无法升级最新系统,已闲置 6 个月',
    status: 'approved',
    approver: 'u9',
    approvedAt: '2026-05-12 14:30',
    approveRemark: '同意按残值处置',
    dispositionMethod: null,
    residualValue: 2400,
    disposedAt: null,
    createdAt: '2026-05-10 09:15',
    originalPrice: 14999,
    bookValue: 2400,
    timeline: [
      { t: '2026-05-10 09:15', stage: 'submitted', action: 'IT 提交报废申请',  by: 'u15', note: '' },
      { t: '2026-05-11 11:00', stage: 'reviewed',  action: '财务初审',         by: 'u9',  note: '残值评估 ¥2400' },
      { t: '2026-05-12 14:30', stage: 'approved',  action: '财务批准',         by: 'u9',  note: '同意按残值处置' },
    ],
  },
  {
    id: 'SCR-2026-0005',
    assetCode: 'IT-2022-0012',
    assetName: 'Dell P2419H 24"',
    brand: 'Dell',
    proposer: 'u15',
    reason: '屏幕老化色偏严重,无修复价值',
    status: 'disposed',
    approver: 'u9',
    approvedAt: '2026-04-22 10:00',
    approveRemark: '同意处置',
    dispositionMethod: 'recycle',
    residualValue: 0,
    disposedAt: '2026-05-08 16:00',
    disposalRemark: '联系拾尚回收,环保处置',
    createdAt: '2026-04-20 11:00',
    originalPrice: 1299,
    bookValue: 0,
    timeline: [
      { t: '2026-04-20 11:00', stage: 'submitted', action: 'IT 提交报废申请', by: 'u15', note: '' },
      { t: '2026-04-22 10:00', stage: 'approved',  action: '财务批准',        by: 'u9',  note: '同意处置 - 残值 ¥0' },
      { t: '2026-05-08 16:00', stage: 'disposed',  action: '已完成回收处置',  by: 'u15', note: '拾尚回收单号 SS-20260508-3399' },
    ],
  },
  {
    id: 'SCR-2026-0004',
    assetCode: 'IT-2023-0055',
    assetName: 'iPhone 12 (员工归还)',
    brand: 'Apple',
    proposer: 'u15',
    reason: '员工归还时屏幕严重碎裂,无维修价值',
    status: 'rejected',
    approver: 'u9',
    approvedAt: '2026-04-18 11:00',
    approveRemark: '建议先报修评估,不直接报废',
    dispositionMethod: null,
    residualValue: null,
    disposedAt: null,
    createdAt: '2026-04-15 14:00',
    originalPrice: 6999,
    bookValue: 1400,
    timeline: [
      { t: '2026-04-15 14:00', stage: 'submitted', action: 'IT 提交报废申请', by: 'u15', note: '' },
      { t: '2026-04-18 11:00', stage: 'rejected',  action: '财务驳回',        by: 'u9',  note: '建议先报修评估,不直接报废' },
    ],
  },
];

// ─── Audit Log Events (审计日志) ─────────────────────
window.AUDIT_EVENTS = [
  { t: '2026-05-18 10:42:11', actor: 'u15', action: 'asset.assign',      resource: 'IT-2025-0006', ip: '10.16.42.18', note: '分配给 何雪(u16)' },
  { t: '2026-05-18 10:30:55', actor: 'u15', action: 'inventory.issue',   resource: 'SKU-AD-001',   ip: '10.16.42.18', note: '发放 1 个给 周明(u8)' },
  { t: '2026-05-18 09:42:33', actor: 'u8',  action: 'request.submit',    resource: 'AP-2026-0420', ip: '10.16.55.92', note: 'Lark H5 提交耗材申请' },
  { t: '2026-05-18 09:15:02', actor: 'u11', action: 'approval.approve',  resource: 'AP-2026-0419', ip: '10.16.42.66', note: '同意 - Lark 卡片操作' },
  { t: '2026-05-17 17:45:12', actor: 'u16', action: 'request.submit',    resource: 'AP-2026-0419', ip: '10.16.55.41', note: '提交维修申请' },
  { t: '2026-05-17 16:08:24', actor: 'u4',  action: 'repair.open',       resource: 'REP-2026-0043',ip: '10.16.42.103',note: '报修 LG 显示器' },
  { t: '2026-05-17 11:20:45', actor: null,  action: 'lark.webhook',      resource: 'REP-2026-0042',ip: 'lark-callback',note: '服务点回调:已接收' },
  { t: '2026-05-17 09:30:18', actor: 'u15', action: 'inspection.open',   resource: 'INSP-2026-Q2', ip: '10.16.42.18', note: '发起 2026 Q2 盘点 - 28 件' },
  { t: '2026-05-16 14:30:55', actor: 'u15', action: 'repair.ship',       resource: 'REP-2026-0042',ip: '10.16.42.18', note: '送至联想服务点' },
  { t: '2026-05-15 10:30:11', actor: 'u15', action: 'scrap.submit',      resource: 'SCR-2026-0007',ip: '10.16.42.18', note: 'ThinkPad T14 主板坏' },
  { t: '2026-05-15 09:00:00', actor: null,  action: 'celery.scheduled',  resource: 'lowstock.check',ip: 'worker',     note: '每周库存预警扫描 - 3 个 SKU 告警' },
  { t: '2026-05-12 14:30:20', actor: 'u9',  action: 'scrap.approve',     resource: 'SCR-2026-0006',ip: '10.16.42.220',note: '财务批准 - 残值 ¥2400' },
];

const ACTION_META = {
  'asset.assign':      { label: '资产分配',   color: 'blue',    icon: 'user' },
  'asset.return':      { label: '资产归还',   color: 'success', icon: 'refresh' },
  'asset.transfer':    { label: '资产转移',   color: 'purple',  icon: 'link' },
  'inventory.issue':   { label: '库存发放',   color: 'blue',    icon: 'box' },
  'inventory.receive': { label: '库存入库',   color: 'success', icon: 'upload' },
  'request.submit':    { label: '提交申请',   color: 'warning', icon: 'request' },
  'approval.approve':  { label: '审批通过',   color: 'success', icon: 'check' },
  'approval.reject':   { label: '审批驳回',   color: 'danger',  icon: 'close' },
  'inspection.open':   { label: '发起盘点',   color: 'purple',  icon: 'verify' },
  'inspection.confirm':{ label: '盘点确认',   color: 'success', icon: 'verify' },
  'repair.open':       { label: '提交报修',   color: 'warning', icon: 'repair' },
  'repair.ship':       { label: '送修',       color: 'warning', icon: 'arrowRight' },
  'repair.complete':   { label: '维修完结',   color: 'success', icon: 'check' },
  'scrap.submit':      { label: '报废申请',   color: 'warning', icon: 'warning' },
  'scrap.approve':     { label: '报废批准',   color: 'success', icon: 'check' },
  'scrap.dispose':     { label: '处置完成',   color: 'gray',    icon: 'box' },
  'lark.webhook':      { label: 'Lark 回调',  color: 'purple',  icon: 'bell' },
  'celery.scheduled':  { label: '定时任务',   color: 'gray',    icon: 'clock' },
};
window.ACTION_META = ACTION_META;

// ─── Phase 2 stats ───────────────────────────────────
window.PHASE2_STATS = {
  activeInspections: window.INSPECTION_TASKS.filter(t => t.status === 'open').length,
  pendingInspectionItems: window.INSPECTION_TASKS.filter(t => t.status === 'open').reduce((s,t) => s + t.pending, 0),
  openRepairs: window.REPAIR_ORDERS.filter(r => r.status === 'open' || r.status === 'in_progress').length,
  pendingScraps: window.SCRAP_REQUESTS.filter(s => s.status === 'pending' || s.status === 'approved').length,
  qrLabelsToprint: 14, // resources without printed labels
};
