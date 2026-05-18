# Development Plan — Claude Code 实施指南

> 这份文档是写给 **Claude Code** 看的:它告诉 Claude Code 怎么从零起项目、用什么技术栈、目录怎么分、Phase 1 做什么、怎么和你协作。
>
> **你(产品负责人)的协调方式**:把这整个 `design_handoff_it_asset/` 文件夹丢给 Claude Code,然后让它:
> 1. 先读 `README.md`(设计规格)和 `PRD.md`(业务文档)
> 2. 再读这份 `DEVELOPMENT_PLAN.md`
> 3. 跟你确认 §1「待决策事项」里的开放问题
> 4. 然后按 Phase 1 任务清单开干

---

## 1. 给产品负责人:开始前要先决定的事

> **决策已定(2026-05-18)**:
> - **基准 = PRD v0.2**(4 态状态机 `in_use/idle/maintenance/scrapped`、`brand_model/spec/legacy_code/owner_name/scrap_candidate/needs_review`、编号 `PC-0001` 无年份、含 Phase 0 迁移)。本文件与 README、prototype 已对齐到 v0.2;原型 JSX 仅作视觉/交互参考,不进生产。
> - §1.1 → 全新项目,用「推荐技术栈」。
> - §1.2 → **飞书与 Lark 都要支持**:`app/lark/client.py` 把 endpoint/域名做成可配置(`open.feishu.cn` ↔ `open.larksuite.com`,passport 同理),不硬编码。
> - §1.4 → PostgreSQL。§1.3 → 开发用 Docker Compose 起步。
> - §1.6 → Lark 自建应用已创建,`app_id/app_secret` 由产品负责人放入环境变量(不写入代码库)。
> - §1.5 → 未明确,暂按小团队 / monorepo / 单前端(`/m` 前缀)/ 8 周;如团队规模不同需重估 CI 与拆分。

以下为原始待决策清单(已由上方决策覆盖,保留备查):

### 1.1 技术栈是否复用现有项目?
- **A**:公司已有内部脚手架/中后台框架 → 把那个仓库连上,让 Claude Code 沿用
- **B**:全新项目 → 用本文档「推荐技术栈」一节

### 1.2 国内飞书 还是 海外 Lark?
两边 API endpoint 和域名不同(`open.feishu.cn` vs `open.larksuite.com`)。这会决定 OAuth 配置。

### 1.3 部署目标
- **A**:公司内网 K8s
- **B**:云厂商(阿里云/AWS)Docker
- **C**:本地服务器
- 如果是中小团队,建议先选 B 或 C,Docker Compose 起步。

### 1.4 数据库
- **PostgreSQL**(推荐,JSON 字段好用)
- MySQL(团队熟悉就选)

### 1.5 团队规模和工期
告诉 Claude Code 团队是 1 个人 / 2-3 个人 / 5+ 人,以及 Phase 1 期望几周交付。
影响是否需要拆 monorepo、是否需要单独的 admin 和 mobile 前端、CI 复杂度。

### 1.6 Lark 应用是否已经创建?
- 已有 `app_id` / `app_secret` → 提供给 Claude Code 加到环境变量
- 没有 → 需要先去 [开发者后台](https://open.feishu.cn) 创建自建应用

---

## 2. 推荐技术栈(全新项目)

PRD §11.1 推荐 **FastAPI + PostgreSQL + React Admin + Lark 自建应用**。我们在此基础上更具体:

### 2.1 后端

| 选择 | 技术 | 理由 |
|---|---|---|
| 语言/框架 | **Python 3.11 + FastAPI** | 团队规模小、原型快、PRD 推荐 |
| 备选 | Node.js 20 + NestJS | 如果团队是 JS 系 |
| ORM | **SQLAlchemy 2.0** + Alembic | FastAPI 标配 |
| 数据库 | PostgreSQL 16 | JSON 字段、好的全文搜索 |
| 缓存 | Redis 7 | 会话、限流、Lark token cache |
| 队列 | **Celery** + Redis | 异步发送 Lark 消息、定时任务 |
| 任务调度 | Celery Beat | 每周库存预警、盘点提醒 |
| API 文档 | FastAPI 自带 OpenAPI | 不用 swagger 额外配 |
| 鉴权 | JWT + Lark OAuth | 内部用 JWT,登录走 Lark |
| 文件存储 | MinIO(自托管 S3)或阿里云 OSS | 资产照片、发票附件 |
| 日志 | structlog + Sentry | 审计日志单独存 PG 表 |

### 2.2 前端

| 选择 | 技术 |
|---|---|
| 语言 | **TypeScript 5** |
| 框架 | **React 18 + Vite** |
| 路由 | React Router 6 或 TanStack Router |
| 状态 | TanStack Query(服务端态)+ Zustand(局部 UI 态) |
| UI 组件 | **Ant Design 5** 或 **Arco Design**(字节系,和 Lark 风格更贴) |
| 表单 | React Hook Form + Zod |
| 图表 | **ECharts**(donut + line + 后续报表)或 Recharts |
| 样式 | CSS Modules + 全局 CSS Variables(本文档 §5 token) |
| 国际化 | i18next + react-i18next |
| 图标 | **Lucide** 或 **Tabler**(线条风,贴近原型) |
| Lark JSSDK | `@larksuiteoapi/node-sdk`(后端)+ 浏览器端 `<script src="https://lf1-cdn-tos.bytegoofy.com/goofy/lark/op/h5-js-sdk-1.5.31.js"></script>`(免登) |

### 2.3 移动端(员工 H5)

复用主前端,**响应式 + 路由前缀 `/m`**。
不单独搭 RN/Flutter 项目 —— 员工端就 5-10 个页面,响应式 H5 足够,而且 Lark 工作台原生就是 webview。

### 2.4 基建

| 用途 | 工具 |
|---|---|
| 容器 | Docker + Docker Compose(开发)/ K8s(生产) |
| 反向代理 | Nginx |
| CI/CD | GitHub Actions / GitLab CI |
| 监控 | Prometheus + Grafana(可选)/ 简单从 Sentry 起步 |
| 备份 | pg_dump 定时 + S3 异地 |

---

## 3. 目录结构

monorepo 单仓库,前后端同代码库:

```
it-asset/
├── README.md                       ← 项目介绍 + 启动指南
├── docker-compose.yml              ← 本地开发:pg + redis + minio
├── docker-compose.prod.yml         ← 生产部署
├── .env.example                    ← 配置示例
├── Makefile                        ← make dev / make migrate / make seed
│
├── backend/
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── app/
│   │   ├── main.py                 ← FastAPI 入口
│   │   ├── config.py               ← 环境变量加载
│   │   ├── deps.py                 ← 依赖注入(db session、current user)
│   │   ├── core/
│   │   │   ├── security.py         ← JWT 签发/校验
│   │   │   ├── permissions.py      ← 角色权限装饰器
│   │   │   └── audit.py            ← 审计日志中间件
│   │   ├── lark/
│   │   │   ├── client.py           ← Lark SDK 封装
│   │   │   ├── auth.py             ← OAuth 免登
│   │   │   ├── messenger.py        ← 发卡片消息
│   │   │   └── webhook.py          ← 事件订阅接收
│   │   ├── modules/
│   │   │   ├── users/              ← 用户/部门同步
│   │   │   │   ├── models.py
│   │   │   │   ├── schemas.py      ← Pydantic
│   │   │   │   ├── service.py
│   │   │   │   ├── router.py
│   │   │   │   └── tasks.py        ← Celery 定时同步通讯录
│   │   │   ├── assets/             ← 固定资产
│   │   │   ├── inventory/          ← SKU / 库存
│   │   │   ├── approvals/          ← 审批流
│   │   │   ├── inspections/        ← 盘点
│   │   │   ├── repair/             ← 维修报废
│   │   │   └── reports/
│   │   └── alembic/                ← 数据库迁移
│   └── tests/
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── router.tsx              ← 路由配置
│   │   ├── api/                    ← API client (axios + react-query)
│   │   ├── hooks/
│   │   ├── stores/                 ← Zustand
│   │   ├── styles/
│   │   │   ├── tokens.css          ← ← 复制本仓库 design_handoff_it_asset/prototype/styles.css 的 token 部分
│   │   │   └── global.css
│   │   ├── i18n/
│   │   │   ├── zh-CN.json
│   │   │   └── en-US.json
│   │   ├── components/
│   │   │   ├── ui/                 ← StatusBadge / AssetTypeIcon / UserCell …
│   │   │   ├── layout/             ← Sidebar / Topbar / AppShell
│   │   │   └── charts/             ← Donut / Trend / DeptBar
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   │   ├── DashboardPage.tsx
│   │   │   │   ├── AssetListPage.tsx
│   │   │   │   ├── AssetDetailDrawer.tsx
│   │   │   │   ├── InventoryPage.tsx
│   │   │   │   ├── ApprovalsPage.tsx
│   │   │   │   ├── InspectionPage.tsx
│   │   │   │   └── …
│   │   │   └── mobile/             ← 路由 /m/*
│   │   │       ├── MobileHomePage.tsx
│   │   │       ├── RequestFlowPage.tsx
│   │   │       └── …
│   │   └── lark/
│   │       └── jssdk.ts            ← 浏览器侧免登封装
│   └── tests/
│
└── docs/
    ├── api.md                      ← OpenAPI 导出 + 业务说明
    └── deploy.md
```

---

## 4. 数据模型 → 数据库表

PRD §10 已经把所有表给齐了。Claude Code 应该按 PRD 把这些表落成 Alembic migration:

- §10.1 `assets`, `asset_types`, `asset_assignments`, `asset_change_logs`, `asset_accessories`
- §10.2 `users`, `departments`
- §10.3 `approval_requests`
- §10.4 `inventory_tasks`, `inventory_items`
- §10.5 `item_categories`, `skus`, `inventory_locations`, `inventory_stocks`, `inventory_transactions`, `inventory_orders`, `inventory_order_items`, `employee_item_issues`

**v0.2 关键点(对齐 PRD §10.1 / §13,务必按此落库)**:

```sql
-- assets:v0.2 字段(替代 v0.1 的 name/brand/model/sn/owner)
asset_class      text not null   -- 'personal' | 'infrastructure'
brand_model      text            -- 自由文本,不拆分,可空
spec             text            -- 配置自由文本,可空
serial_number    text            -- 可空,'无'→null
legacy_code      text            -- 旧临时编号(gw-1 等),可空
status           text not null   -- 仅 4 态 in_use/idle/maintenance/scrapped
owner_user_id    bigint          -- 可空
owner_name       text            -- 使用人原文兜底,可空
department_name  text            -- 部门原文兜底,可空
scrap_candidate  boolean default false
needs_review     boolean default false
-- 除 id/asset_code/asset_class/status/时间戳外,绝大多数字段允许 NULL(容脏)

-- 资产编号 sequence(PRD §13.1):每个前缀(PC/MON/NET…)一条 DB sequence
--   asset_code = printf('%s-%04d', prefix, nextval('asset_seq_<prefix>'))
--   禁止 max+1;前缀可配置扩展;不嵌年份

-- 额外建议字段
-- 所有表
created_at timestamp not null default now()
updated_at timestamp not null default now()
created_by text     -- 操作人 user_id
deleted_at timestamp  -- 软删除

-- assets 表加
qr_code_url text       -- 二维码图片 URL
photo_urls jsonb       -- 资产照片列表

-- audit_logs 单独建一张
id, actor_user_id, action, resource_type, resource_id, payload jsonb, ip, ua, created_at
```

---

## 5. Phase 1 任务清单(MVP)

按 PRD §12.1,**第一版必做**这 16 项。下面拆成可执行的 Sprint。

### Sprint 0(1 周):项目骨架
- [ ] Git 仓库初始化,`README.md` + `docker-compose.yml` + `.env.example`
- [ ] FastAPI 项目骨架 + 健康检查接口
- [ ] Vite + React + TS 项目骨架,引入 Ant Design + token CSS
- [ ] PostgreSQL + Redis 通过 Docker Compose 起得来
- [ ] Alembic 初始化,跑通一个空 migration
- [ ] CI:Lint(ruff + eslint)+ 单元测试入口

### Sprint 1(1 周):用户与 Lark 集成
- [ ] **创建 Lark 自建应用**,拿到 `app_id` / `app_secret`,配通讯录、机器人、事件订阅权限
- [ ] 后端 `lark/client.py`:获取 `tenant_access_token`(带 Redis 缓存)
- [ ] **Lark OAuth 免登流程**(前端 JSSDK → 后端换 token → 签 JWT)
- [ ] **同步通讯录**:Celery 定时任务,每天凌晨拉一次 users / departments
- [ ] 前端登录态守卫 + Topbar 显示当前用户
- [ ] 权限模型:roles(employee / manager / it_admin / finance / sys_admin)

### Sprint 2(2 周):资产台账核心
- [ ] 数据库:`assets / asset_types / asset_assignments / asset_change_logs / asset_accessories`
- [ ] 后端:资产 CRUD + 列表(带筛选/分页/搜索)+ 详情 + 分配/归还/报修/报废
- [ ] 前端:**资产台账列表页**(原型 §4.2)
- [ ] 前端:**资产详情抽屉**(原型 §4.3)
  - 基本信息 Tab
  - **生命周期 Tab(签名时刻)** ⭐ —— 用 React 组件复刻原型的 Timeline
  - **配件绑定 Tab(签名时刻)** ⭐ —— SVG 画树枝线
  - 附件 Tab 留占位
- [ ] 状态机校验:**仅 4 态 in_use/idle/maintenance/scrapped**,不允许非法跳转;`infrastructure` 类不开放分配/归还动作
- [ ] 操作日志自动落审计表

### Sprint 2.5(1 周):Phase 0 存量数据迁移(PRD §13)

> 排在此处(而非 Sprint 2 之前)是因为导入器依赖 Sprint 2 落好的 `assets` 表与编号 sequence。**必须在 Sprint 5 UAT 前完成**,否则没有真实数据可演示。

- [ ] 资产编号 sequence:按前缀(PC/MON/NET)建 DB sequence + `generate_asset_code(prefix)`(禁 max+1)
- [ ] Excel/云文档导入器:按 PRD §13.2 字段映射,**容脏**——绝大多数字段可空,脏数据置 `needs_review`,不卡门
  - 类型→`asset_class`(PC/显示器→personal;网络设备→infrastructure;新值→needs_review)
  - 序列号 `无`→null;`无,临时编号X`→`legacy_code`=X
  - 使用人匹配飞书用户失败→`owner_name` 留文本 + needs_review
  - 备注命中"建议报废/无法点亮/损坏/已超10年"→`scrap_candidate`=true
- [ ] 导入幂等:二次导入以真实 `serial_number` 或已生成 `asset_code` 为匹配键
- [ ] 导出带编号清单(供 IT 打印贴标)+ 编号回写流程说明
- [ ] `needs_review` 队列页(管理端筛选 chip)供 IT 逐步人工核对

### Sprint 3(1.5 周):库存物品
- [ ] 数据库:`skus / inventory_stocks / inventory_transactions / inventory_orders / inventory_order_items / employee_item_issues`
- [ ] 后端:SKU CRUD、入库、领用发放、库存流水、库存预警检测(定时任务每天扫一遍)
- [ ] 前端:**库存物品页**(原型 §4.4)—— SKU 卡片网格 + 预警 Banner
- [ ] 库存预警 Lark 消息(机器人推送给 IT 管理员群)

### Sprint 4(1.5 周):员工端 H5 + 申请流
- [ ] 后端:领用申请提交 + 审批接口
- [ ] 前端 `/m/*` 路由(响应式)
- [ ] **员工首页**(原型 §4.5)—— 我的资产、耗材记录、快捷入口
- [ ] **申请领用 3 步流**(原型 §4.5)—— 校验 + 步骤条 + 审批流预览
- [ ] 提交后:
  - 后端创建 `approval_requests` 记录
  - 通过 Lark 机器人发卡片消息给审批人(可点[同意][拒绝])
  - 接收 Lark 卡片回调,更新审批状态
- [ ] 管理端审批中心简单版:列表 + 同意/拒绝

### Sprint 5(1 周):工作台 + 收尾
- [ ] 后端:`/api/dashboard/overview` 一个 endpoint 把所有 KPI 算好
- [ ] 前端:**工作台 Dashboard**(原型 §4.1)
  - KPI 卡片
  - 状态分布甜甜圈(ECharts)
  - 12 周流转趋势(ECharts)
  - 待我审批 / 部门分布 / 库存预警三栏
  - 最近资产流转表
- [ ] 基础盘点确认:管理员发起任务 + 员工 Lark 卡片回「确认无误/信息有误」
- [ ] 操作日志列表页(系统设置下)
- [ ] 部署到测试环境,业务方走一遍 UAT

### 总计:9 周(8 周 MVP + 1 周 Phase 0 存量迁移)

---

## 6. 后端 API 接口清单(P0)

下面列 Phase 1 必须实现的接口,Claude Code 应当用 FastAPI 写出来并自动生成 OpenAPI。

### 6.1 鉴权与用户

```
POST /api/auth/lark/callback     { code }  → { token, user }
GET  /api/auth/me                       → { user, permissions }
POST /api/auth/logout
GET  /api/users?dept=&q=&page=
GET  /api/departments
POST /api/users/sync             # 手动触发通讯录同步(管理员)
```

### 6.2 资产

```
GET    /api/assets               ?status=&type=&dept=&q=&page=&size=
GET    /api/assets/:code         # 详情含 lifecycle + accessories
POST   /api/assets               # 新增
PUT    /api/assets/:code
POST   /api/assets/:code/assign  { user_id, deliver_to, note }
POST   /api/assets/:code/return  { condition, note }
POST   /api/assets/:code/repair  { reason }
POST   /api/assets/:code/scrap   { reason }
POST   /api/assets/:code/transfer { to_user_id, reason }
POST   /api/assets/:code/accessories  { child_codes: string[] }
DELETE /api/assets/:code/accessories/:child_code
GET    /api/assets/:code/qrcode  → image/svg
POST   /api/assets/import        # multipart Excel
GET    /api/assets/export        # CSV/XLSX
GET    /api/asset-types
```

### 6.3 库存

```
GET    /api/skus                 ?mode=&warning_only=&q=
POST   /api/skus
PUT    /api/skus/:sku
GET    /api/skus/:sku/transactions   # 流水
POST   /api/inventory/orders        { type: 'purchase_in' | 'issue' | …, items: [{sku, qty, price?}], … }
GET    /api/inventory/orders
POST   /api/inventory/orders/:id/confirm
GET    /api/inventory/stocks         # 余额
POST   /api/inventory/inspections    # 发起盘点
```

### 6.4 审批

```
GET    /api/approvals               ?status=pending&for_me=true
POST   /api/approvals               { type, target_id, payload, … }    # 员工端提交
POST   /api/approvals/:id/approve   { note }
POST   /api/approvals/:id/reject    { note }
POST   /api/lark/webhook            # 接收 Lark 卡片回调
```

### 6.5 盘点

```
POST   /api/inspections             # 发起盘点任务
GET    /api/inspections/:id
GET    /api/inspections/:id/items   # 各资产确认进度
POST   /api/inspections/:id/items/:asset_code/confirm    { status: 'ok'|'mismatch', note }
```

### 6.6 工作台

```
GET    /api/dashboard/overview      → { stats, trends, recent_approvals, recent_assignments, low_stock_skus, dept_distribution }
```

### 6.7 员工端专用

```
GET    /api/m/me                    → 我的资产 + 耗材记录 + 待办
GET    /api/m/skus                  → 可申请的 SKU 列表(过滤 stock>0)
POST   /api/m/requests              → 创建申请(包同上)
```

---

## 7. 关键技术点提醒

### 7.1 Lark token 缓存
`tenant_access_token` 有效期 2 小时,**必须** Redis 缓存 + 提前 5 分钟刷新,否则每次调用都换 token 会被限流。

### 7.2 库存并发安全
发放/入库要用数据库行级锁:
```sql
SELECT * FROM inventory_stocks WHERE sku_id = ? FOR UPDATE;
```
或者用乐观锁(version 字段)。Phase 1 用悲观锁简单可靠。

### 7.3 资产状态机
**强烈建议** 用 Python `transitions` 或自己写一个简单状态机类。不要散落 if/else,出 bug 难查。

### 7.4 审计日志
PRD §13 要求所有资产状态变化、库存变化都要留痕。建议用 SQLAlchemy 的 `event.listen(Session, 'after_flush')` 钩子统一拦截,不要让业务代码每次手写日志。

### 7.5 软删除
所有业务表加 `deleted_at`,查询统一过滤。资产不允许硬删除,只允许「报废」。

### 7.6 时区
所有 timestamp 用 UTC 存,展示时前端按用户时区转。Lark 国内用户基本都是 Asia/Shanghai。

### 7.7 二维码
资产编号生成时同步生成 QR(PNG/SVG)存对象存储,详情页直接展示。批量打印用前端 `<canvas>` 拼接或后端生成 PDF。

---

## 8. 协作节奏建议

| 节奏 | 你做的事 | Claude Code 做的事 |
|---|---|---|
| 启动 | 把 `design_handoff_it_asset/` 给它,回答 §1 的开放问题 | 读文档、产出 Sprint 0 PR |
| 每个 Sprint 开始 | 确认 Sprint 目标和范围 | 拆任务 → 写代码 → 出 PR |
| 每个 Sprint 结束 | UAT 验收一个可演示的 demo | 修 Bug、补单测、收尾 |
| 遇到设计问题 | 你拍板(回到原型对照) | 给出 2-3 个方案选择,不要自己决定 |
| 遇到业务规则问题 | 你/业务方确认 | 显式问出来,不要猜 |

### 给 Claude Code 的指令模板

启动时丢给它:

```
请阅读 design_handoff_it_asset/ 目录下的所有文件:
1. PRD.md(业务文档)
2. README.md(设计规格)
3. DEVELOPMENT_PLAN.md(本开发计划)
4. prototype/ 文件夹下的 HTML 原型

读完后,告诉我:
- 你对项目的整体理解
- §1「待决策事项」里你需要我先回答哪些问题
- Sprint 0 的具体任务和你计划的 PR 顺序

不要先写代码,先确认理解和澄清问题。
```

每个 Sprint 开始丢给它:

```
开始 Sprint N,目标见 DEVELOPMENT_PLAN.md §5。
请先列出本 Sprint 的所有任务,标记依赖关系,然后从第一个任务开始。
每完成一个独立任务出一个 PR,不要一次写完所有任务。
```

---

## 9. 不要做的事(防止 Claude Code 跑偏)

❌ 不要采用原型 `data.js` 里的旧 8 态 / 带年份编号(`IT-2025-0001`)/ `name/brand/model/sn` 字段 —— **唯一基准是 PRD v0.2**(4 态 + `PC-0001` + `brand_model/spec/...`)
❌ 不要把原型 HTML 直接搬过去当生产代码
❌ 不要在 Phase 1 引入 MDM / Jamf / CMDB / 财务系统对接(PRD §12.2 明确暂缓)
❌ 不要自己设计审批流编排引擎(用最简单的「主管→IT」两步固定流即可)
❌ 不要重新发明 UI 组件,用 Ant Design / Arco 已有的
❌ 不要把 Lark 调用塞进业务代码里,统一走 `app/lark/` 封装层
❌ 不要省略审计日志和操作日志,这是 PRD §13 硬要求
❌ 不要先实现报表 / 折旧 / 多仓库 —— Phase 1 不在范围

---

## 10. 验收标准(Phase 1 完成的定义)

8 周后,这些必须 work:

1. ✅ 员工打开 Lark 工作台进入应用,免登成功,看到首页
2. ✅ 员工提交「申请领用 USB-C 转 HDMI 转接头 × 1」,Lark 收到审批卡片
3. ✅ 部门主管在 Lark 卡片点「同意」,审批通过,IT 管理员收到「待发放」提醒
4. ✅ IT 管理员在 Web 后台「资产台账」筛选 `在用 in_use` 状态,搜索员工姓名,看到对应资产
4b. ✅ Phase 0 导入的存量资产已生成 `PC/MON/NET-####` 编号,`needs_review` 队列可见可核
5. ✅ 点击一条资产打开抽屉,看到完整生命周期 + 配件绑定
6. ✅ 工作台显示正确的 KPI 和图表
7. ✅ 库存预警 SKU 自动每周一推送给 IT 管理员
8. ✅ 资产/库存数据可导入 Excel、可导出
9. ✅ 所有操作有审计日志,可在系统设置里查
10. ✅ 部署到测试服务器,业务方可正常 UAT

---

## 11. 风险与降本提示

| 风险 | 应对 |
|---|---|
| Lark 通讯录权限审批慢 | Sprint 1 开始前就提交申请,平行推进 |
| 业务方对状态机有歧义 | 严格按 PRD §5.1 **v0.2 四态**(in_use/idle/maintenance/scrapped)实现;旧 8 态/已丢失/待报废一律不引入,有歧义找业务方拍板 |
| 二维码标签打印对接复杂 | Phase 1 只生成 QR 图,实物打印放 Phase 2 |
| 移动端在 Lark 内 webview 兼容 | 早期就在真机 Lark 里测,不要只在浏览器看 |
| 员工端中英双语翻译 | Phase 1 只做骨架,完整翻译让业务方提供 |

---

祝顺利。有问题随时回到原型对照 — 原型已经覆盖了 80% 的设计决策。
