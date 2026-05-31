// Offboarding Checklist — 离职归还(PRD §8.4 信号场景)
// IT 管理员视角:HR 触发离职流程后,跟踪员工名下所有资产的归还状态

window.OFFBOARDING_CASES = [
  {
    id: 'OFF-2026-0018',
    user: 'u14', // 胡涛
    lastDay: '2026-05-22',
    notifiedAt: '2026-05-12 09:00',
    hrChannel: 'lark_event:user.left',
    status: 'in_progress',
    reason: '个人原因',
    assignedIT: 'u15',
    items: [
      { code: 'PHN-0002', name: 'iPhone 15 Pro', type: 't3', status: 'return_pending', value: 8999, action: 'await_return' },
      { code: 'PC-0007', name: 'MacBook Pro 14"', type: 't1', status: 'returned', value: 19999, returnedAt: '2026-05-16 14:00', condition: 'good' },
      { code: 'MON-0003', name: 'Dell U2723QE 27"', type: 't2', status: 'returned', value: 4499, returnedAt: '2026-05-16 14:00', condition: 'good' },
      { code: 'DOK-0001', name: 'CalDigit TS4', type: 't5', status: 'lost', value: 2399, action: 'lost_acknowledge' },
    ],
    consumables: [
      { sku: 'SKU-MS-001', name: '罗技 M185 鼠标', qty: 1, needReturn: false, status: 'consumed' },
      { sku: 'SKU-BG-001', name: '笔记本电脑包', qty: 1, needReturn: true, status: 'returned' },
    ],
  },
  {
    id: 'OFF-2026-0017',
    user: 'u13', // 朱琳
    lastDay: '2026-05-19',
    notifiedAt: '2026-05-09 14:30',
    hrChannel: 'lark_event:user.left',
    status: 'overdue',
    reason: '转岗(集团内)',
    assignedIT: 'u15',
    items: [
      { code: 'PC-0009', name: 'MacBook Air 13"', type: 't1', status: 'return_pending', value: 10999, action: 'await_return', overdueDays: 1 },
      { code: 'TAB-0001', name: 'iPad Pro 11"', type: 't4', status: 'return_pending', value: 7999, action: 'await_return', overdueDays: 1 },
    ],
    consumables: [],
  },
  {
    id: 'OFF-2026-0016',
    user: 'u7',  // 黄磊
    lastDay: '2026-04-30',
    notifiedAt: '2026-04-20 10:00',
    hrChannel: 'manual',
    status: 'completed',
    reason: '个人原因',
    assignedIT: 'u15',
    completedAt: '2026-04-29 17:00',
    items: [
      { code: 'PC-0011', name: 'ThinkPad X1 Carbon', type: 't1', status: 'returned', value: 12999, returnedAt: '2026-04-28', condition: 'good' },
      { code: 'MON-0008', name: 'LG 27UP850', type: 't2', status: 'returned', value: 3299, returnedAt: '2026-04-28', condition: 'good' },
    ],
    consumables: [],
  },
];

window.OFFBOARDING_STATUS_META = {
  in_progress: { label: '进行中', color: '#3370FF', bg: '#E8F1FF', icon: 'clock' },
  overdue:     { label: '已逾期', color: '#F53F3F', bg: '#FFECE8', icon: 'warning' },
  completed:   { label: '已完成', color: '#00B42A', bg: '#E8FFEA', icon: 'check' },
};

window.ITEM_RETURN_STATUS_META = {
  return_pending: { label: '待归还', color: '#FF8800', bg: '#FFF7E8' },
  returned:       { label: '已归还', color: '#00B42A', bg: '#E8FFEA' },
  lost:           { label: '丢失登记', color: '#F53F3F', bg: '#FFECE8' },
  consumed:       { label: '消耗品 · 不需归还', color: '#86909C', bg: '#F2F3F5' },
};
