# Handoff: 基于 Lark 的 IT 资产与低值耗材管理系统

> ⚠️ **已完成 Phase 1 开发后回看**:本文档(README.md)是**原始设计规格**。
> 实施过程中 PRD 和落地决策有 11 处调整,**最新约定见 [`DESIGN_REVISIONS.md`](DESIGN_REVISIONS.md)**(优先级最高)。
> 阅读顺序建议:`DESIGN_REVISIONS.md` → 本文档 → `PRD.md` → `PHASE2_DESIGN.md`。

> 给负责开发的工程师 / Claude Code:这份文档 + `prototype/` 里的 HTML 原型 + `PRD.md` 业务文档,是你的完整输入。仔细读 README 和 DEVELOPMENT_PLAN,看一遍跑起来的原型,然后按 Phase 1 的范围开始实现。

---

## 1. 关于本交接包

### 1.1 文件清单

```
design_handoff_it_asset/
├── README.md                  ← 原始设计规格(本文件)
├── DESIGN_REVISIONS.md        ← ⚠️ 实施后修订(最高优先级)
├── PHASE2_DESIGN.md           ← Phase 2 设计补充
├── DEVELOPMENT_PLAN.md        ← 推荐技术栈、目录结构、Sprint 拆解
├── PRD.md                     ← 业务方提供的产品需求文档
└── prototype/                 ← 用 HTML/React 做的高保真原型
    ├── IT 资产管理系统.html      ← Phase 1 入口
    ├── Phase 2 设计补充.html     ← Phase 2 入口
    ├── styles.css             ← Design tokens(颜色/字体/圆角/阴影)
    ├── data.js                ← Phase 1 模拟数据(已对齐 4 态状态机)
    ├── data-phase2.js         ← Phase 2 模拟数据
    ├── ui.jsx                 ← 共享 UI 组件(按钮/状态徽章/图标等)
    ├── shell.jsx              ← 侧边栏 + 顶栏
    ├── screen-dashboard.jsx   ← 工作台首页
    ├── screen-assets.jsx      ← 资产台账列表
    ├── screen-asset-detail.jsx← 资产详情抽屉(含生命周期 + 配件树)
    ├── screen-inventory.jsx   ← 库存物品 + 预警
    ├── screen-employee.jsx    ← 员工端 Lark H5
    ├── app.jsx                ← 路由与状态编排
    └── browser-window.jsx     ← 浏览器窗口壳(仅原型展示用)
```

### 1.2 这些文件是什么 / 不是什么

**`prototype/` 里的 HTML 文件是设计参考,不是生产代码。**
你的任务是 **把这些 HTML 设计在目标技术栈里重新实现** —— 用项目里已有的组件库、状态管理、路由方案、API 客户端等。

具体说:
- ✅ **照抄** 颜色、字体大小、圆角、间距、状态机定义、表单字段、交互流程
- ✅ **照抄** PRD 里的数据模型字段、状态枚举、业务流程
- ❌ **不要照抄** HTML/CSS/React 代码本身,它是为了原型展示而写的 inline-style 实现,不适合生产
- ❌ **不要照抄** `data.js` 里的模拟数据,只把它当作字段命名和典型场景的参考

### 1.3 设计保真度

**高保真(High-Fidelity)** —— 颜色、字号、间距、圆角、阴影、状态机都已确定。请按数值实现。
唯一需要团队再决策的是 **暗色模式**(原型没做)和 **多语言完整翻译**(原型只对员工端做了中英切换)。

---

## 2. 设计语言:Lark 原生

整套系统在 **飞书/Lark 自建应用** 内使用,因此视觉上贴近 Lark 原生:

- 主色 `#3370FF`
- 圆角克制(常用 6/8/12)
- 间距留白偏紧凑(B 端密度)
- 中性灰阶有完整 4 级
- 字体首选 PingFang SC

完整 token 见下面「设计令牌」一节。

---

## 3. 屏幕清单

原型聚焦了 **5 个核心屏幕** + 占位的 5 个次要模块。Phase 1 至少覆盖这 5 屏。

| # | 屏幕 | 端 | 路径 | 优先级 |
|---|---|---|---|---|
| 1 | 工作台(Dashboard) | 管理端 | `/admin` | P0 |
| 2 | 资产台账(Asset List) | 管理端 | `/admin/assets` | P0 |
| 3 | 资产详情抽屉(Asset Detail Drawer) | 管理端 | `/admin/assets/:code` | P0 |
| 4 | 库存物品(Inventory) | 管理端 | `/admin/inventory` | P0 |
| 5 | 员工端首页 + 申请领用 | 员工 H5 | `/m` `/m/request` | P0 |
| 6 | 审批中心 | 管理端 | `/admin/approvals` | P1 |
| 7 | 盘点管理 | 管理端 | `/admin/inspections` | P1 |
| 8 | 维修报废 | 管理端 | `/admin/repair` | P2 |
| 9 | 报表统计 | 管理端 | `/admin/reports` | P2 |
| 10 | 系统设置 | 管理端 | `/admin/settings` | P2 |

下面逐屏给规格。

---

## 4. 屏幕规格

### 4.1 管理端 · 工作台(Dashboard)

**目的**:IT 管理员一进入系统看到的核心面板,展示待办、概览和关键运营指标。

**布局**(自上而下,垂直 16px 间距):
1. **问候栏** + 右上角主操作按钮(扫码盘点 / 导入 / 新增资产)
2. **4 个 KPI 卡片**(等宽 grid):资产总数、资产总价值、待审批、库存预警
3. **状态分布(donut) + 12 周流转趋势(line chart)** —— 左 360px 右自适应
4. **待我审批 + 部门资产分布 + 库存预警** —— 1.2 : 1 : 1
5. **最近资产流转表格**

**关键交互**:
- KPI 卡片悬浮:无变化
- 流转趋势图悬浮:暂未做 tooltip(可在生产里补)
- 待审批行点击:打开审批详情抽屉
- 表格行点击:打开「资产详情抽屉」
- 「补货」按钮:打开生成补货单流程

**字段**(从后端拿):
- `stats.totalAssets`, `stats.totalValue`, `stats.pendingApprovals`, `stats.lowStockCount`
- `stats.assignedCount`, `stats.stockedCount`, `stats.repairingCount`, `stats.idleCount`, `stats.scrappedCount`
- `trends.assignment[]`, `trends.return[]`, `trends.repair[]` —— 12 周数据,每周 1 个数
- `recentApprovals[]`, `recentAssignments[]`, `lowStockSkus[]`
- `deptDistribution[]` —— { deptId, name, count }

### 4.2 管理端 · 资产台账(Asset List)

**目的**:管理员管理所有固定资产的主表格。

**布局**:
1. 标题区 + 工具按钮(高级筛选 / 导出 / 批量导入 / 新增资产)
2. **状态 Tab**:全部 / 已领用 / 库存中 / 维修中 / 闲置 / 待报废 / 已报废 —— 每个 Tab 带计数 badge
3. 二级筛选行:搜索框 + 资产类型 + 责任部门 + 存放地点 + 排序
4. **批量选择浮条**(选中 >0 时出现):批量分配 / 批量盘点 / 导出选中 / 标签打印
5. 表格(8 列):勾选 / 资产编号 / 名称+型号 / 状态 / 责任人 / 地点 / 采购价 / 保修至 / 操作
6. 分页器

**关键交互**:
- 行点击 → 打开「资产详情抽屉」
- 资产编号、名称列 = 主点击区域(链接色 `#3370FF`)
- 保修剩余 <90 天显示橙色提示「剩 X 天」;过期显示红色「已过保」
- 配件资产(有 `boundTo` 字段)在编号下方显示 `🔗 绑定 IT-2025-0001`

**字段**:见 PRD §10.1 `assets` 表

**API**:
```
GET /api/assets?status=&type=&dept=&q=&page=&size=
  → { total, items: Asset[] }
POST /api/assets/export  → CSV/XLSX
POST /api/assets/batch  { action, codes[] }
```

### 4.3 管理端 · 资产详情抽屉(Asset Detail Drawer)

**目的**:点击一条资产打开右侧抽屉(width 780px),查看完整生命周期、配件绑定、规格。

**布局**:
1. **Hero 头部**:资产图标(64×64) + 资产编号徽章 + 状态徽章 + 名称(18px/600) + 品牌型号 SN + 右侧采购价
2. **4 个 Tab**:基本信息 / 生命周期(带计数) / 配件绑定(带计数) / 附件照片
3. Tab 切换内容区
4. 固定页脚:左侧「二维码 / 编辑」+ 右侧根据状态显示动作:
   - 状态 `stocked` → 「分配给员工」(primary)
   - 状态 `assigned` → 「报修 / 归还入库 / 转移」
   - 状态 `idle`/`pending_scrap` → 「申请报废」(danger)

#### 签名时刻 ⭐:生命周期时间线

垂直时间线,左侧 32×32 圆形图标(根据 `icon` 字段配色),右侧:
- 大字标题(资产入库 / 资产编号 / 配件绑定 / 领用申请 / 审批通过 / 已分配 / 盘点确认)
- 英文徽章(灰色小标签)
- 「最新」绿色徽章(只标记第一条)
- 详细描述
- 操作人小头像 + 名字 + 时钟图标 + 时间戳(monospace)
- 节点之间用 2px 浅灰线连接

事件类型与图标颜色对应:
| 事件 | icon | 颜色 |
|---|---|---|
| 入库 Inbound | `plus` | `#3370FF` |
| 资产编号 Tagged | `tag` | `#7E5EE5` |
| 配件绑定 Bound | `link` | `#00B2C7` |
| 领用申请 Requested | `request` | `#FF8800` |
| 审批通过 Approved | `check` | `#00B42A` |
| 已分配 Assigned | `user` | `#3370FF` |
| 盘点确认 Verified | `verify` | `#00B42A` |

#### 签名时刻 ⭐:配件绑定树

可视化「主资产 ↔ 配件」的层级关系:
1. 顶部蓝色提示条解释规则
2. **主资产卡片**:大图标(右下角带「主」徽章) + 编号 + 状态 + 名称 + 责任人
3. **配件子节点**:每个配件用 SVG 画 L 形树枝线连接,带「跟随主资产」灰色标签
4. 虚线「+ 绑定配件」入口
5. 底部 summary:主资产名 / 配件数量 / 组合总价

**API**:
```
GET /api/assets/:code/detail
  → { asset, lifecycle: Event[], accessories: Asset[], parent: Asset? }
POST /api/assets/:code/assign      { userId, deliverTo, note }
POST /api/assets/:code/return      { conditionNote }
POST /api/assets/:code/repair      { reason }
POST /api/assets/:code/scrap       { reason }
POST /api/assets/:code/accessories { childCodes[] }   # 绑定
```

### 4.4 管理端 · 库存物品(Inventory)

**目的**:管理 SKU 库存余额、预警和发放。

**布局**:
1. 标题区 + 主操作(库存盘点 / 导出 / 新建领用单 / **入库**)
2. **4 个 MiniKPI**:SKU 总数 / 预警 SKU / 本月发放 / 本月入库
3. **黄色预警 Banner**(有预警 SKU 时显示)+「查看预警 / 一键生成补货单」
4. Tab:全部 SKU / 库存预警(橙色 badge)/ 一物多码(配件)/ 消耗品(耗材)
5. 筛选行
6. **SKU 卡片网格**(2 列)—— 见下方

**SKU 卡片结构**(签名设计):
```
┌─────────────────────────────────────────┐
│ [包裹icon] SKU-MS-001 [配件] [预警]   3  │
│           罗技 M185 鼠标               个 │
│           Logitech · 无线 · IT 仓库       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 渐变彩条 │
│  0      安全 10          上限 50          │
│ ─────────────────────────────────────── │
│ 可用 2  锁定 0  月均耗 18  可用月数 0.2 │
│                  [补货 47] [发放] [详情→]│
└─────────────────────────────────────────┘
```

- 卡片有 3 个等级:`normal`(绿) / `warn`(橙) / `low`(红)
- 进度条用渐变(`linear-gradient(90deg, color1, color2)`)
- 预警卡片有 3px 红色外发光阴影
- 安全线在进度条上以 2px 竖线标记

**字段**(参考 PRD §10.5 + 原型 `data.js`):
```ts
SKU {
  sku: string          // 'SKU-MS-001'
  name: string         // '罗技 M185 鼠标'
  brand: string
  spec: string         // '无线'
  unit: string         // '个' / '根' / '盒' / '套' / '卷'
  mode: 'inventory' | 'consumable'   // 配件 vs 耗材
  stock: number
  locked: number
  damaged: number
  safety: number       // 安全库存
  max: number          // 库存上限
  monthlyUse: number   // 月均消耗(后端计算或运营录入)
  location: string
  price: number
}
```

### 4.5 员工端 · Lark H5

**呈现**:
原型在管理端 Sidebar 底部点「员工端预览」会弹出 390×780 居中卡片。
实际部署时是 Lark 工作台内的 H5 应用,自动免登。

**目录**:
1. **首页**(`/m`)
2. **申请领用 3 步流**(`/m/request`)
3. 提交成功页(`/m/request/done`)

#### 首页结构

1. **顶部蓝色品牌区**:头像 + 姓名 + 部门角色 + 3 个统计(名下资产 / 总价值 / 待办)
2. **4 宫格快捷入口**:申请领用 / 申请归还 / 申请维修 / 盘点确认
3. **黄色待办 Banner**:Q2 盘点提醒
4. **我的资产列表**:横向卡片 — 资产图标 + 名称 + 编号 + 状态徽章
5. **耗材领用记录**:卡片内 3 条记录
6. **底部 Tab Bar**:首页 / 资产 / 记录 / 我的(60px 高,Lark 标准)

#### 申请领用流程

3 步:

**Step 1 选物品**
- 大卡片选择类型:「耗材/配件」vs「固定资产」
- 选耗材后展示 SKU 列表,每条带 `+/−` Stepper
- 已选数量在顶部红色徽章

**Step 2 填信息**
- 申请事由 textarea —— 校验:至少 5 个字
- 紧急程度 —— 3 选 1(常规/紧急/特急,3 种颜色)
- 交付方式 —— 单选(送达工位/自取)

**Step 3 确认**
- 信息卡片汇总
- **审批流可视化**:提交人(active 绿点)→ 部门主管 → IT 发放

**底部固定按钮**:
- Step 1-2: 「上一步」+「下一步」(校验未通过则灰色禁用)
- Step 3: 「上一步」+「提交申请」

**提交成功页**:大对勾 + 申请单号 + 当前状态(脉冲动画黄点 +「等待部门主管审批」) + 「返回首页 / 再提一单」

#### 中英双语

原型实现了运行时切换,右上角按钮(EN / 中)。所有 UI 文案用 `t(zh, en)` 函数包裹。

实际生产推荐用 `i18next` + 业务方提供完整翻译。

---

## 5. 设计令牌(Design Tokens)

请把这些 token 注入到目标项目的主题系统(Tailwind config / Ant Design ConfigProvider / 自有 SCSS 变量都行)。

### 5.1 颜色

```css
/* Brand */
--lark-blue:         #3370FF;
--lark-blue-hover:   #4E83FD;
--lark-blue-press:   #245BDB;
--lark-blue-bg:      #E8F1FF;
--lark-blue-bg-strong: #D1E2FF;

/* Semantic */
--success:    #00B42A;  --success-bg: #E8FFEA;
--warning:    #FF8800;  --warning-bg: #FFF7E8;
--danger:     #F53F3F;  --danger-bg:  #FFECE8;
--purple:     #7E5EE5;  --purple-bg:  #F1ECFF;

/* Text */
--text-1: #1F2329;   /* 主文本 */
--text-2: #4E5969;   /* 次要文本 */
--text-3: #86909C;   /* 辅助文本 */
--text-4: #C9CDD4;   /* 禁用文本 */

/* Surface */
--border:        #E5E6EB;
--border-strong: #C9CDD4;
--divider:       #F2F3F5;
--bg-canvas:     #F5F6F7;
--bg-card:       #FFFFFF;
--bg-hover:      #F2F3F5;
--bg-active:     #E8F1FF;

/* 资产类型图标背景 */
laptop:      bg #E8F1FF / icon #3370FF
monitor:     bg #F1ECFF / icon #7E5EE5
phone:       bg #FFF7E8 / icon #D17A00
tablet:      bg #E8FFEA / icon #00863C
dock:        bg #E0F7FA / icon #0086A8
headphones:  bg #FFECE8 / icon #D4380D
camera:      bg #FFF1F5 / icon #C72060
```

### 5.2 圆角

```css
--radius-sm: 4px;   /* 小标签、复选框 */
--radius-md: 6px;   /* 按钮、输入框、表格行 hover */
--radius-lg: 8px;   /* 卡片、KPI、抽屉头部 */
--radius-xl: 12px;  /* 移动端卡片、Banner */
20-24px → 移动端按钮(pill)、头像、悬浮元素
```

### 5.3 阴影

```css
--shadow-sm: 0 1px 2px rgba(31,35,41,0.04);
--shadow-md: 0 4px 16px rgba(31,35,41,0.08);
--shadow-lg: 0 8px 32px rgba(31,35,41,0.12);
```

### 5.4 字体

```css
--font-sans: 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', Arial, sans-serif;
--font-mono: 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace;
```

字号:11 / 12 / 13(默认正文) / 14(按钮) / 15(卡片标题) / 16(导航标题) / 18(详情标题) / 20 / 22(KPI) / 26-28(大数字)

字重:400 / 500(强调) / 600(标题)

字母间距(大数字):`-0.01em` ~ `-0.02em`

### 5.5 间距

```
4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 32
```
卡片内边距 16-24,卡片间距 12-16,屏幕内边距 24。

### 5.6 状态徽章配色

| 状态 | 背景 | 文字 | 圆点 |
|---|---|---|---|
| 库存中 In Stock | `#E8FFEA` | `#00863C` | `#00B42A` |
| 已领用 Assigned | `#E8F1FF` | `#1A5BD0` | `#3370FF` |
| 维修中 Repairing | `#FFF7E8` | `#A66200` | `#FF8800` |
| 闲置 Idle | `#F2F3F5` | `#4E5969` | `#86909C` |
| 已丢失 Lost | `#FFECE8` | `#A8261D` | `#F53F3F` |
| 已报废 Scrapped | `#E5E6EB` | `#4E5969` | `#4E5969` |

---

## 6. 状态机

### 6.1 资产状态

```
待入库 pending_in
     ↓
   入库
     ↓
库存中 stocked ──→ 分配 ──→ 已领用 assigned
     ↑                          ↓
   归还入库                    报修
     │                          ↓
     └────────────────────── 维修中 repairing
                                ↓
                              维修完
                                ↓
                              闲置 idle
                                ↓
                              报废申请 + 财务审批
                                ↓
                              已报废 scrapped

特殊:已丢失 lost(从任何状态跳转)
```

### 6.2 库存交易类型

`purchase_in / manual_in / issue_out / return_in / transfer_out / transfer_in / adjustment / damage_out / scrap_out`

### 6.3 申请审批状态

`draft → pending(等部门主管)→ approved(等 IT 发放)→ fulfilled(完成)`
或 `pending → rejected`

---

## 7. 关键交互细节

### 7.1 表格行点击
- 整行可点;复选框列阻止冒泡
- `:hover` 背景 `#FAFBFC`,选中行 `#F5F9FF`

### 7.2 抽屉(Drawer)
- 右侧滑入 `cubic-bezier(0.16, 1, 0.3, 1)` 0.28s
- 背景遮罩 `rgba(31,35,41,0.45)`,点击关闭
- 抽屉宽度:资产详情 780,表单 600

### 7.3 表单校验
- 失焦或提交时校验
- 错误边框 `var(--danger)` + 下方 11px 红色提示
- 按钮禁用条件 = 必填项空 or 校验失败

### 7.4 步骤条
- 已完成步骤:实心蓝圆 + 白色对勾
- 当前步骤:蓝圆 + 3px 浅蓝光晕环
- 未到步骤:浅灰圆 + 灰字
- 连接线:已完成蓝,未完成灰,过渡 0.2s

### 7.5 卡片悬浮(SKU 卡片)
- `transform: translateY(-1px) + box-shadow: 0 4px 12px`

### 7.6 动效
```css
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { … } }
@keyframes slideInRight { from { transform: translateX(100%); } to { … } }
@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }  /* 用于"待处理"状态点 */
```

---

## 8. Lark 集成要点

**这是最容易跑偏的部分,务必和后端确认 Lark API 文档。**

| 能力 | Lark API |
|---|---|
| 免登 | OAuth `https://passport.feishu.cn/suite/passport/oauth/authorize` |
| 通讯录同步 | `/open-apis/contact/v3/users` `/departments` |
| 机器人主动消息 | `/open-apis/im/v1/messages` |
| 卡片消息(可交互) | message_type=`interactive` + card JSON |
| 事件订阅 | 配置 Event Subscription 接收用户/部门变更 |
| 审批(可选) | `/open-apis/approval/v4/instances` |

消息模板见 PRD §8.4。

---

## 9. 资产 / 工具

- ✅ 图标:原型用 inline SVG,生产建议 **Lucide Icons** 或 **Tabler Icons**(都跟原型风格一致,线条粗细 1.8)
- ✅ 字体:系统字体即可,无需引入额外字体
- ⚠️ 二维码:`qrcode.js` / `qrcode-svg`,生成 + 打印对接
- ⚠️ Excel 导入导出:`xlsx` / `exceljs` 库
- ⚠️ 图表:推荐 **ECharts** 或 **Recharts**(donut + line chart 都用得上)

无任何品牌商标资产被使用。原型中提及的 MacBook、ThinkPad、罗技、CalDigit 等是为了让数据真实,生产环境数据由 IT 团队录入。

---

## 10. 文件索引

实际开发时主要查看这些原型文件:

- 视觉风格、token、动效 → `prototype/styles.css`
- 数据结构、字段命名、典型场景 → `prototype/data.js`
- 共享组件用法(按钮、徽章、抽屉) → `prototype/ui.jsx`
- 各屏幕详细布局 → `prototype/screen-*.jsx`
- PRD 业务文档(状态机、数据模型、审批流) → `PRD.md`

打开 `prototype/IT 资产管理系统.html` 即可在浏览器里跑起来看(双击或本地起 http 服务都行)。

---

## 下一步

请打开 `DEVELOPMENT_PLAN.md` 查看推荐的技术栈、目录结构和 Phase 1 任务清单。
