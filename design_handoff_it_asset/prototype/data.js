// Mock data for IT asset management system
//
// ⚠️ 生产实现唯一基准 = PRD v0.2。本文件的 status 值与字段名是 v0.1 原型遗留,
//    仅为让原型可视化跑起来而保留;实现时按下表映射到 v0.2,不要照搬这里的命名。
//
// ── 状态映射(v0.1 原型 → v0.2 生产,4 态)──────────────────────
//   stocked / pending_in  →  idle        闲置(在库可分配)
//   assigned              →  in_use      在用
//   repairing             →  maintenance 维修中
//   idle                  →  idle        闲置
//   scrapped              →  scrapped    已报废
//   lost / pending_scrap  →  (不再是状态)走 remark + scrap_candidate 标记
//
// ── 字段映射(v0.1 原型 → v0.2 生产)────────────────────────────
//   code        →  asset_code        (生产规则 PC/MON/NET-####,无年份;原型用 IT-YYYY-#### 仅占位)
//   name/brand/model → brand_model    (v0.2 合并为单一自由文本,不拆分)
//   (PC 配置)   →  spec              (自由文本,不结构化)
//   sn          →  serial_number     ('无' → null)
//   (旧临时编号) → legacy_code        (如 gw-1/x99-1)
//   owner       →  owner_user_id     (匹配飞书用户);未匹配 → owner_name 文本 + needs_review
//   dept        →  department_id     (+ department_name 兜底)
//   (无)        →  asset_class        personal | infrastructure(网络设备=infrastructure,不走领用/归还)
//   (无)        →  scrap_candidate / needs_review(容脏标记,见 PRD §13.2)
//
// Departments
window.DEPARTMENTS = [
  { id: 'd1', name: '研发部', en: 'Engineering', code: 'ENG' },
  { id: 'd2', name: '产品部', en: 'Product', code: 'PRD' },
  { id: 'd3', name: '设计部', en: 'Design', code: 'DSN' },
  { id: 'd4', name: '市场部', en: 'Marketing', code: 'MKT' },
  { id: 'd5', name: '运营部', en: 'Operations', code: 'OPS' },
  { id: 'd6', name: '财务部', en: 'Finance', code: 'FIN' },
  { id: 'd7', name: '人力资源', en: 'HR', code: 'HR' },
  { id: 'd8', name: 'IT 部', en: 'IT', code: 'IT' },
];

// Users (with Lark-style avatar initials)
const avatarColors = ['#3370FF', '#00B42A', '#FF8800', '#7E5EE5', '#F53F3F', '#00B2C7', '#D4380D', '#52C41A'];
window.USERS = [
  { id: 'u1', name: '张伟', en: 'Wei Zhang', dept: 'd1', role: '高级前端工程师', email: 'wei.zhang@company.com', avatar: '张' },
  { id: 'u2', name: '李娜', en: 'Na Li', dept: 'd1', role: '后端工程师', email: 'na.li@company.com', avatar: '娜' },
  { id: 'u3', name: '王芳', en: 'Fang Wang', dept: 'd2', role: '产品经理', email: 'fang.wang@company.com', avatar: '芳' },
  { id: 'u4', name: '刘洋', en: 'Yang Liu', dept: 'd3', role: '设计师', email: 'yang.liu@company.com', avatar: '洋' },
  { id: 'u5', name: '陈晨', en: 'Chen Chen', dept: 'd3', role: '设计师', email: 'chen@company.com', avatar: '晨' },
  { id: 'u6', name: '杨帆', en: 'Fan Yang', dept: 'd4', role: '市场经理', email: 'fan.yang@company.com', avatar: '帆' },
  { id: 'u7', name: '黄磊', en: 'Lei Huang', dept: 'd5', role: '运营专员', email: 'lei.h@company.com', avatar: '磊' },
  { id: 'u8', name: '周明', en: 'Ming Zhou', dept: 'd1', role: '前端工程师', email: 'ming@company.com', avatar: '明' },
  { id: 'u9', name: '吴敏', en: 'Min Wu', dept: 'd6', role: '财务主管', email: 'min.wu@company.com', avatar: '敏' },
  { id: 'u10', name: '徐静', en: 'Jing Xu', dept: 'd7', role: 'HR', email: 'jing@company.com', avatar: '静' },
  { id: 'u11', name: '孙浩', en: 'Hao Sun', dept: 'd1', role: '架构师', email: 'hao@company.com', avatar: '浩' },
  { id: 'u12', name: '马丽', en: 'Li Ma', dept: 'd2', role: '产品经理', email: 'li.ma@company.com', avatar: '丽' },
  { id: 'u13', name: '朱琳', en: 'Lin Zhu', dept: 'd4', role: '内容运营', email: 'lin.zhu@company.com', avatar: '琳' },
  { id: 'u14', name: '胡涛', en: 'Tao Hu', dept: 'd5', role: '客户成功', email: 'tao@company.com', avatar: '涛' },
  { id: 'u15', name: '林峰', en: 'Feng Lin', dept: 'd8', role: 'IT 管理员', email: 'feng.lin@company.com', avatar: '峰' },
  { id: 'u16', name: '何雪', en: 'Xue He', dept: 'd1', role: '测试工程师', email: 'xue@company.com', avatar: '雪' },
];
window.USERS.forEach((u, i) => { u.avatarColor = avatarColors[i % avatarColors.length]; });

// Asset status
window.ASSET_STATUS = {
  stocked: { label: '库存中', en: 'In Stock', color: 'success' },
  assigned: { label: '已领用', en: 'Assigned', color: 'blue' },
  repairing: { label: '维修中', en: 'Repairing', color: 'warning' },
  idle: { label: '闲置', en: 'Idle', color: 'gray' },
  lost: { label: '已丢失', en: 'Lost', color: 'danger' },
  pending_scrap: { label: '待报废', en: 'Pending Scrap', color: 'warning' },
  scrapped: { label: '已报废', en: 'Scrapped', color: 'gray-dark' },
  pending_in: { label: '待入库', en: 'Pending', color: 'gray' },
};

window.ASSET_TYPES = [
  { id: 't1', name: '笔记本电脑', en: 'Laptop', icon: 'laptop' },
  { id: 't2', name: '显示器', en: 'Monitor', icon: 'monitor' },
  { id: 't3', name: '手机', en: 'Phone', icon: 'phone' },
  { id: 't4', name: '平板', en: 'Tablet', icon: 'tablet' },
  { id: 't5', name: '扩展坞', en: 'Dock', icon: 'dock' },
  { id: 't6', name: '耳机', en: 'Headphones', icon: 'headphones' },
  { id: 't7', name: '摄像头', en: 'Camera', icon: 'camera' },
];

// Fixed assets — 32 items with rich detail
window.ASSETS = [
  // MacBooks
  { code: 'IT-2025-0001', type: 't1', name: 'MacBook Pro 14"', brand: 'Apple', model: 'M3 Pro', sn: 'C02ZK5XAGD7M', status: 'assigned', owner: 'u1', dept: 'd1', location: '上海·张江', purchase: '2025-01-15', price: 19999, warranty: '2027-01-15', supplier: 'Apple 企业销售' },
  { code: 'IT-2025-0002', type: 't1', name: 'MacBook Pro 16"', brand: 'Apple', model: 'M3 Max', sn: 'C02ZK5XAGD8N', status: 'assigned', owner: 'u11', dept: 'd1', location: '上海·张江', purchase: '2025-01-15', price: 29999, warranty: '2027-01-15', supplier: 'Apple 企业销售' },
  { code: 'IT-2025-0003', type: 't1', name: 'MacBook Pro 14"', brand: 'Apple', model: 'M3 Pro', sn: 'C02ZK5XAGD9P', status: 'assigned', owner: 'u2', dept: 'd1', location: '上海·张江', purchase: '2025-02-10', price: 19999, warranty: '2027-02-10', supplier: 'Apple 企业销售' },
  { code: 'IT-2025-0004', type: 't1', name: 'MacBook Air 13"', brand: 'Apple', model: 'M3', sn: 'C02ZK5XAGE1Q', status: 'assigned', owner: 'u3', dept: 'd2', location: '上海·张江', purchase: '2025-03-08', price: 10999, warranty: '2027-03-08', supplier: 'Apple 企业销售' },
  { code: 'IT-2025-0005', type: 't1', name: 'MacBook Pro 16"', brand: 'Apple', model: 'M3 Max', sn: 'C02ZK5XAGE2R', status: 'assigned', owner: 'u4', dept: 'd3', location: '上海·张江', purchase: '2025-03-15', price: 31999, warranty: '2027-03-15', supplier: 'Apple 企业销售' },
  { code: 'IT-2025-0006', type: 't1', name: 'MacBook Pro 14"', brand: 'Apple', model: 'M3 Pro', sn: 'C02ZK5XAGE3S', status: 'stocked', owner: null, dept: null, location: 'IT 仓库·A 区', purchase: '2025-04-20', price: 19999, warranty: '2027-04-20', supplier: 'Apple 企业销售' },
  { code: 'IT-2024-0087', type: 't1', name: 'ThinkPad X1 Carbon', brand: 'Lenovo', model: 'Gen 11', sn: 'PF3K9X2L', status: 'assigned', owner: 'u8', dept: 'd1', location: '上海·张江', purchase: '2024-08-12', price: 12999, warranty: '2027-08-12', supplier: '联想企业购' },
  { code: 'IT-2024-0088', type: 't1', name: 'ThinkPad X1 Carbon', brand: 'Lenovo', model: 'Gen 11', sn: 'PF3K9X2M', status: 'repairing', owner: 'u16', dept: 'd1', location: 'IT 仓库·维修区', purchase: '2024-08-12', price: 12999, warranty: '2027-08-12', supplier: '联想企业购' },
  { code: 'IT-2024-0089', type: 't1', name: 'Dell XPS 13', brand: 'Dell', model: '9340', sn: 'DXP9340Z1', status: 'idle', owner: null, dept: null, location: 'IT 仓库·A 区', purchase: '2024-06-05', price: 9999, warranty: '2027-06-05', supplier: '戴尔直销' },
  // Monitors
  { code: 'IT-2025-0101', type: 't2', name: 'Dell U2723QE 27"', brand: 'Dell', model: 'U2723QE', sn: 'CN-0M8FX0', status: 'assigned', owner: 'u1', dept: 'd1', location: '上海·张江', purchase: '2025-01-15', price: 4499, warranty: '2028-01-15', supplier: '戴尔直销' },
  { code: 'IT-2025-0102', type: 't2', name: 'Dell U2723QE 27"', brand: 'Dell', model: 'U2723QE', sn: 'CN-0M8FX1', status: 'assigned', owner: 'u11', dept: 'd1', location: '上海·张江', purchase: '2025-01-15', price: 4499, warranty: '2028-01-15', supplier: '戴尔直销' },
  { code: 'IT-2025-0103', type: 't2', name: 'LG 27UP850-W', brand: 'LG', model: '27UP850', sn: 'LG27UP850A1', status: 'assigned', owner: 'u4', dept: 'd3', location: '上海·张江', purchase: '2025-02-20', price: 3299, warranty: '2027-02-20', supplier: '京东企业购' },
  { code: 'IT-2025-0104', type: 't2', name: 'BenQ PD2705Q', brand: 'BenQ', model: 'PD2705Q', sn: 'BNQPD2705A', status: 'assigned', owner: 'u5', dept: 'd3', location: '上海·张江', purchase: '2025-02-20', price: 3899, warranty: '2027-02-20', supplier: '京东企业购' },
  { code: 'IT-2025-0105', type: 't2', name: 'Dell U2723QE 27"', brand: 'Dell', model: 'U2723QE', sn: 'CN-0M8FX2', status: 'stocked', owner: null, dept: null, location: 'IT 仓库·A 区', purchase: '2025-04-20', price: 4499, warranty: '2028-04-20', supplier: '戴尔直销' },
  { code: 'IT-2025-0106', type: 't2', name: 'LG 27UP850-W', brand: 'LG', model: '27UP850', sn: 'LG27UP850A2', status: 'stocked', owner: null, dept: null, location: 'IT 仓库·A 区', purchase: '2025-04-20', price: 3299, warranty: '2027-04-20', supplier: '京东企业购' },
  // Phones
  { code: 'IT-2025-0201', type: 't3', name: 'iPhone 15 Pro', brand: 'Apple', model: 'A2848', sn: 'F2LZK5XPG', status: 'assigned', owner: 'u6', dept: 'd4', location: '上海·张江', purchase: '2025-01-20', price: 8999, warranty: '2026-01-20', supplier: 'Apple 企业销售' },
  { code: 'IT-2025-0202', type: 't3', name: 'iPhone 15 Pro', brand: 'Apple', model: 'A2848', sn: 'F2LZK5XPH', status: 'assigned', owner: 'u3', dept: 'd2', location: '上海·张江', purchase: '2025-01-20', price: 8999, warranty: '2026-01-20', supplier: 'Apple 企业销售' },
  { code: 'IT-2024-0203', type: 't3', name: 'Samsung S24 Ultra', brand: 'Samsung', model: 'SM-S928', sn: 'SAMS24U001', status: 'idle', owner: null, dept: null, location: 'IT 仓库·B 区', purchase: '2024-12-01', price: 9999, warranty: '2026-12-01', supplier: '三星企业' },
  // Tablets
  { code: 'IT-2025-0301', type: 't4', name: 'iPad Pro 11"', brand: 'Apple', model: 'M4', sn: 'DMQZK5XIPA', status: 'assigned', owner: 'u4', dept: 'd3', location: '上海·张江', purchase: '2025-03-15', price: 7999, warranty: '2026-03-15', supplier: 'Apple 企业销售' },
  { code: 'IT-2025-0302', type: 't4', name: 'iPad Pro 13"', brand: 'Apple', model: 'M4', sn: 'DMQZK5XIPB', status: 'assigned', owner: 'u5', dept: 'd3', location: '上海·张江', purchase: '2025-03-15', price: 9999, warranty: '2026-03-15', supplier: 'Apple 企业销售' },
  // Docks & accessories (一物一码)
  { code: 'IT-2025-0401', type: 't5', name: 'CalDigit TS4', brand: 'CalDigit', model: 'TS4', sn: 'CDTS4001', status: 'assigned', owner: 'u1', dept: 'd1', location: '上海·张江', purchase: '2025-01-15', price: 2399, warranty: '2027-01-15', supplier: '京东企业购', boundTo: 'IT-2025-0001' },
  { code: 'IT-2025-0402', type: 't5', name: 'CalDigit TS4', brand: 'CalDigit', model: 'TS4', sn: 'CDTS4002', status: 'assigned', owner: 'u11', dept: 'd1', location: '上海·张江', purchase: '2025-01-15', price: 2399, warranty: '2027-01-15', supplier: '京东企业购', boundTo: 'IT-2025-0002' },
  { code: 'IT-2025-0403', type: 't6', name: 'Sony WH-1000XM5', brand: 'Sony', model: 'WH-1000XM5', sn: 'SNYWH001', status: 'assigned', owner: 'u1', dept: 'd1', location: '上海·张江', purchase: '2025-01-15', price: 2599, warranty: '2026-01-15', supplier: '索尼官方', boundTo: 'IT-2025-0001' },
  { code: 'IT-2025-0404', type: 't6', name: 'Apple AirPods Pro 2', brand: 'Apple', model: 'A2698', sn: 'APPRO001', status: 'stocked', owner: null, dept: null, location: 'IT 仓库·B 区', purchase: '2025-04-01', price: 1899, warranty: '2026-04-01', supplier: 'Apple 企业销售' },
  { code: 'IT-2025-0405', type: 't7', name: 'Logitech Brio 4K', brand: 'Logitech', model: 'Brio', sn: 'LGTBRIO01', status: 'assigned', owner: 'u4', dept: 'd3', location: '上海·张江', purchase: '2025-02-20', price: 1499, warranty: '2027-02-20', supplier: '罗技企业' },
  // Scrapped
  { code: 'IT-2022-0011', type: 't1', name: 'MacBook Pro 13" (旧)', brand: 'Apple', model: 'Intel i7', sn: 'C02OLD001', status: 'scrapped', owner: null, dept: null, location: '已处置', purchase: '2022-03-10', price: 14999, warranty: '2024-03-10', supplier: 'Apple 企业销售' },
  { code: 'IT-2022-0012', type: 't2', name: 'Dell P2419H 24"', brand: 'Dell', model: 'P2419H', sn: 'DELLOLD01', status: 'scrapped', owner: null, dept: null, location: '已处置', purchase: '2022-03-10', price: 1299, warranty: '2025-03-10', supplier: '戴尔直销' },
  { code: 'IT-2024-0099', type: 't1', name: 'ThinkPad T14', brand: 'Lenovo', model: 'T14 Gen 4', sn: 'PFLT14001', status: 'pending_scrap', owner: null, dept: null, location: 'IT 仓库·待处置', purchase: '2022-05-20', price: 8999, warranty: '2025-05-20', supplier: '联想企业购' },
];

// SKU 库存物品(耗材 + 低值配件)
window.SKUS = [
  { sku: 'SKU-MS-001', name: '罗技 M185 鼠标', en: 'Logitech M185 Mouse', brand: 'Logitech', spec: '无线', unit: '个', mode: 'inventory', stock: 3, locked: 0, damaged: 1, safety: 10, max: 50, monthlyUse: 18, location: 'IT 仓库·B 区', price: 79 },
  { sku: 'SKU-KB-001', name: '罗技 K380 键盘', en: 'Logitech K380 Keyboard', brand: 'Logitech', spec: '蓝牙·黑色', unit: '个', mode: 'inventory', stock: 8, locked: 1, damaged: 0, safety: 5, max: 30, monthlyUse: 6, location: 'IT 仓库·B 区', price: 229 },
  { sku: 'SKU-AD-001', name: 'USB-C 转 HDMI 转接头', en: 'USB-C to HDMI Adapter', brand: '绿联', spec: '4K@60Hz', unit: '个', mode: 'inventory', stock: 2, locked: 0, damaged: 0, safety: 5, max: 30, monthlyUse: 12, location: 'IT 仓库·B 区', price: 89 },
  { sku: 'SKU-AD-002', name: 'USB-C 转 USB-A 转接头', en: 'USB-C to USB-A Adapter', brand: '绿联', spec: 'USB 3.0', unit: '个', mode: 'inventory', stock: 24, locked: 0, damaged: 0, safety: 10, max: 50, monthlyUse: 9, location: 'IT 仓库·B 区', price: 39 },
  { sku: 'SKU-CB-001', name: 'CAT6 网线', en: 'CAT6 Ethernet Cable', brand: '山泽', spec: '1m·黑', unit: '根', mode: 'consumable', stock: 45, locked: 0, damaged: 0, safety: 20, max: 100, monthlyUse: 14, location: 'IT 仓库·C 区', price: 12 },
  { sku: 'SKU-CB-002', name: 'CAT6 网线', en: 'CAT6 Ethernet Cable', brand: '山泽', spec: '3m·黑', unit: '根', mode: 'consumable', stock: 28, locked: 0, damaged: 0, safety: 15, max: 80, monthlyUse: 8, location: 'IT 仓库·C 区', price: 18 },
  { sku: 'SKU-PW-001', name: 'MagSafe 3 电源线', en: 'MagSafe 3 Cable', brand: 'Apple', spec: '2m', unit: '根', mode: 'inventory', stock: 4, locked: 0, damaged: 0, safety: 6, max: 20, monthlyUse: 3, location: 'IT 仓库·B 区', price: 379 },
  { sku: 'SKU-PW-002', name: 'USB-C 65W 电源适配器', en: 'USB-C 65W Adapter', brand: '绿联', spec: '65W·GaN', unit: '个', mode: 'inventory', stock: 11, locked: 0, damaged: 0, safety: 5, max: 30, monthlyUse: 4, location: 'IT 仓库·B 区', price: 199 },
  { sku: 'SKU-IK-001', name: 'HP 硒鼓', en: 'HP Toner Cartridge', brand: 'HP', spec: 'CF410A·黑', unit: '盒', mode: 'consumable', stock: 6, locked: 0, damaged: 0, safety: 4, max: 12, monthlyUse: 2, location: '行政仓库', price: 459 },
  { sku: 'SKU-IK-002', name: 'HP 硒鼓', en: 'HP Toner Cartridge', brand: 'HP', spec: 'CF411A·青', unit: '盒', mode: 'consumable', stock: 3, locked: 0, damaged: 0, safety: 3, max: 8, monthlyUse: 1, location: '行政仓库', price: 519 },
  { sku: 'SKU-LB-001', name: '标签纸', en: 'Label Paper', brand: 'Brother', spec: '12mm·白', unit: '卷', mode: 'consumable', stock: 18, locked: 0, damaged: 0, safety: 8, max: 30, monthlyUse: 5, location: 'IT 仓库·C 区', price: 89 },
  { sku: 'SKU-BG-001', name: '笔记本电脑包', en: 'Laptop Bag', brand: 'Tomtoc', spec: '14"·灰', unit: '个', mode: 'inventory', stock: 7, locked: 0, damaged: 0, safety: 5, max: 20, monthlyUse: 3, location: 'IT 仓库·B 区', price: 269 },
  { sku: 'SKU-CL-001', name: '清洁套装', en: 'Cleaning Kit', brand: '小米', spec: '屏幕+键盘', unit: '套', mode: 'consumable', stock: 22, locked: 0, damaged: 0, safety: 10, max: 40, monthlyUse: 6, location: 'IT 仓库·C 区', price: 49 },
  { sku: 'SKU-WP-001', name: '摄像头', en: 'Webcam', brand: 'Logitech', spec: 'C920', unit: '个', mode: 'inventory', stock: 5, locked: 1, damaged: 0, safety: 3, max: 15, monthlyUse: 2, location: 'IT 仓库·B 区', price: 549 },
];

// Asset lifecycle events (timeline)
window.LIFECYCLE = {
  'IT-2025-0001': [
    { t: '2025-01-15 09:24', action: '入库', en: 'Inbound', operator: 'u15', detail: '采购入库,序列号 C02ZK5XAGD7M,Apple 企业销售', icon: 'plus' },
    { t: '2025-01-15 10:02', action: '资产编号', en: 'Tagged', operator: 'u15', detail: '生成资产编号 IT-2025-0001,打印二维码标签', icon: 'tag' },
    { t: '2025-01-15 14:30', action: '配件绑定', en: 'Bound', operator: 'u15', detail: '绑定 CalDigit TS4 扩展坞、Sony WH-1000XM5 耳机', icon: 'link' },
    { t: '2025-01-16 09:15', action: '领用申请', en: 'Requested', operator: 'u1', detail: '张伟提交领用申请·新员工入职配置', icon: 'request' },
    { t: '2025-01-16 09:42', action: '审批通过', en: 'Approved', operator: 'u11', detail: '直接主管孙浩审批通过', icon: 'check' },
    { t: '2025-01-16 11:00', action: '已分配', en: 'Assigned', operator: 'u15', detail: '分配给 张伟(研发部),员工已签字确认', icon: 'user' },
    { t: '2025-04-12 16:20', action: '盘点确认', en: 'Verified', operator: 'u1', detail: '2025 Q1 盘点 — 张伟确认资产无误', icon: 'verify' },
  ],
};
window.LIFECYCLE['default'] = [
  { t: '2025-02-10 09:00', action: '入库', en: 'Inbound', operator: 'u15', detail: '采购入库', icon: 'plus' },
  { t: '2025-02-10 10:30', action: '已分配', en: 'Assigned', operator: 'u15', detail: '分配给责任人', icon: 'user' },
];

// Pending approvals
window.APPROVALS = [
  { id: 'AP-2026-0421', type: '资产领用', applicant: 'u16', target: 'MacBook Pro 14"', reason: '入职配置', time: '2026-05-17 14:22', status: 'pending' },
  { id: 'AP-2026-0420', type: '耗材领用', applicant: 'u8', target: 'USB-C 转 HDMI 转接头 × 1', reason: '会议室连接需要', time: '2026-05-17 11:08', status: 'pending' },
  { id: 'AP-2026-0419', type: '维修申请', applicant: 'u16', target: 'ThinkPad X1 Carbon (IT-2024-0088)', reason: '键盘 B 键失灵', time: '2026-05-16 17:45', status: 'pending' },
  { id: 'AP-2026-0418', type: '资产归还', applicant: 'u14', target: 'iPhone 15 Pro (IT-2025-0202)', reason: '转岗,不再需要', time: '2026-05-16 10:15', status: 'pending' },
  { id: 'AP-2026-0417', type: '资产领用', applicant: 'u13', target: 'iPad Pro 11"', reason: '内容创作需要', time: '2026-05-15 16:30', status: 'pending' },
];

// Dashboard trend data (last 12 weeks)
window.TRENDS = {
  assignment: [12, 8, 15, 11, 18, 14, 9, 16, 13, 17, 21, 19],
  return: [4, 6, 3, 8, 5, 7, 4, 6, 9, 5, 7, 6],
  repair: [2, 1, 3, 2, 1, 4, 2, 3, 1, 2, 1, 3],
};

// Helper
window.getUser = (id) => window.USERS.find(u => u.id === id);
window.getDept = (id) => window.DEPARTMENTS.find(d => d.id === id);
window.getType = (id) => window.ASSET_TYPES.find(t => t.id === id);

// Stats
window.STATS = (() => {
  const total = window.ASSETS.length;
  const assigned = window.ASSETS.filter(a => a.status === 'assigned').length;
  const stocked = window.ASSETS.filter(a => a.status === 'stocked').length;
  const repairing = window.ASSETS.filter(a => a.status === 'repairing').length;
  const idle = window.ASSETS.filter(a => a.status === 'idle').length;
  const scrapped = window.ASSETS.filter(a => a.status === 'scrapped' || a.status === 'pending_scrap').length;
  const totalValue = window.ASSETS.filter(a => a.status !== 'scrapped').reduce((s, a) => s + a.price, 0);
  const lowStock = window.SKUS.filter(s => s.stock < s.safety).length;
  return { total, assigned, stocked, repairing, idle, scrapped, totalValue, lowStock };
})();
