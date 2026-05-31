# Phase 2 设计补充 — Handoff Doc

> 这份文档是给已经完成 Phase 1 的开发同学(或 Claude Code)看的 Phase 2 设计补充。
> 后端基础已经在 `backend/app/modules/{inspections,assets,...}/` 里实现,前端也有基础 Ant Design 表格界面。
> **这份文档关注的是「视觉打磨」**:把现有功能性的表格 UI 升级为更易用、更直观的设计。

---

## 1. Phase 2 范围确认

按 PRD §15:**资产盘点 / 耗材盘点 / 维修 / 报废 / 审批流 / 二维码标签**。

当前实施状态(基于代码扫描):

| 模块 | 后端 | 前端(功能性) | 前端(视觉补充)|
|---|---|---|---|
| 盘点(资产) | ✅ `inspections/router.py` + 扫码确认 | ✅ `Inspections.tsx` 表格版 | 🎨 **本文档补充看板** |
| 维修工单 | ✅ `repair_workflow.py` + 状态机 | ✅ `RepairOrders.tsx` 表格版 | 🎨 **本文档补充状态机时间线** |
| 报废处置 | ✅ `scrap_workflow.py` + 财务审批 | ✅ `ScrapApprovals.tsx` 表格版 | 🎨 **本文档补充审批链可视化** |
| 审批流 | ✅ `approvals/` | ✅ `Approvals.tsx` | (Phase 1 已设计) |
| 二维码标签 | ✅ `labels.py` (A4 PDF) | ⚠️ 缺前端入口 | 🎨 **本文档补充批量选择 + 预览** |
| 审计日志 | ✅ `core/audit.py` | ✅ `AuditLogs.tsx` 表格版 | 🎨 **本文档补充时间线视图** |

> ⚠️ **耗材盘点**(consumable inspection)PRD §15 提到但后端没有专门模块;按现状用「库存调整 + 审计日志」实现。本文档不涉及。

---

## 2. 5 个新设计屏幕

打开 `prototype/Phase 2 设计补充.html` 直接看效果。下面是规格:

### 2.1 盘点看板(Inspection Kanban) ⭐ 签名时刻

**路径**:`/inspections`
**对应代码**:`frontend/src/pages/Inspections.tsx`

**核心理念**:不要再用「表格 + 状态 Tab」展示盘点 — 改成「按责任人分组的看板」,让 IT 管理员一眼看到:
- **谁还没确认**(红 / 黄 banner 标记)
- **谁的资产有差异**(看板内嵌差异备注)
- **每个人的完成率**(圆环进度)

**布局**(自上而下):
1. **任务大卡**(蓝色渐变,1/4 宽)+ 3 个 KPI 卡(已确认/差异/待确认)
2. 工具栏:搜索 + 状态分段控件(全部 / 待确认 / 已确认 / 差异)
3. **责任人分组**:每人一个大卡片
   - 左侧 3px 色条:橙(待确认)/ 红(差异)/ 绿(全部完成)
   - 头部:头像 + 姓名 + 部门角色 + 进度环 + 「催办」按钮
   - 网格内嵌:每件资产一个小卡,含状态点 + 差异备注

**API**(已有,见 `inspections/router.py`):
```
GET  /api/inspections                    → 任务列表
GET  /api/inspections/:id                → 任务详情(含 items)
POST /api/inspections                    → 发起盘点
POST /api/inspections/:id/items/:code/confirm  { status, remark }
POST /api/inspections/:id/close
```

**前端改造重点**(基于现有 `Inspections.tsx`):
1. 把 Tabs/Table 替换为 **分组渲染**(参考 `prototype/screen-inspections.jsx` 里的 `OwnerGroup`)
2. 计算 `byOwner` 分组(items 按 `expected_owner_id` 聚合)
3. 排序:有未确认的优先 → 有差异的 → 全部完成
4. 圆环进度组件:用 SVG `circle` + `strokeDasharray`(参考 `CircleProgress`)
5. 催办按钮调用 Lark 消息接口(让后端发个 reminder 卡片给指定 user)

### 2.2 维修工单流转(Repair Center)

**路径**:`/repair`
**对应代码**:`frontend/src/pages/RepairOrders.tsx`

**核心理念**:用「漏斗 + 工单卡片」替代纯表格,每张卡片把状态机进度可视化。

**布局**:
1. **状态漏斗**(顶部):已报修 → IT 受理 → 送修 → 维修中 → 已完结,每个阶段一个大数字
2. Tab:进行中 / 已完结 / 已取消
3. **工单卡**(每行):
   - 左侧:资产图标 + 工单号 + 状态徽章 + 资产名
   - 中间:**5 节点状态机进度条**(当前节点带光晕)+ 问题摘要
   - 右侧:预计返还时间 + 剩余天数 / 延期天数

**点击工单卡 → 打开「维修详情抽屉」**:
- Hero:资产图标 + 工单号 + 状态 + 费用(保修内显示绿色 ¥0)
- 问题描述区(黄色 banner)
- **维修时间线**(垂直):每个时间戳一个节点,操作人 + 备注
- 「当前」徽章标记最新节点
- 维修结论(完结时绿色卡片)

**状态机**(后端已实现,前端按此约束 UI):
```
opened → reviewed → shipped(外送)→ in_progress → returned → completed
                 → (in_house 直接到 in_progress)
任何阶段都可以 cancelled
```

**前端改造重点**:
1. 替换现有 `Tabs + Table` 为 **漏斗 + 卡片列表**(参考 `screen-repair.jsx` 的 `RepairCard`)
2. 状态机进度条用 5 个圆点 + 连线,reached/current/not-reached 3 态(参考 `RepairCard` 内的 fragment)
3. 详情抽屉用 Ant Design `Drawer` 包裹,但内容按 prototype 的 `RepairDetail` 复刻

### 2.3 报废审批流(Scrap Center)

**路径**:`/scrap`
**对应代码**:`frontend/src/pages/ScrapApprovals.tsx`

**核心理念**:报废涉及多方(IT 提案 → 财务审批 → 处置),用「头像审批链」让流程一目了然。

**布局**:
1. **状态漏斗**:IT 申请 → 财务审批 → 已批准 → 已处置
2. Tab:待审批 / 待处置 / 已处置 / 已驳回
3. **申请卡**(每行 3 列):
   - 左:资产信息 + 报废原因摘要
   - 中:**原值 → 账面残值**(带删除线 + 折旧进度条)
   - 右:**3 节点审批链**(头像 + 状态徽标 + 时间)

**点击 → 抽屉**:
- Hero:资产 + 申请号 + 状态 + 残值
- 报废原因
- **审批时间线**
- 根据状态显示不同操作区:
  - `pending` → 残值评估输入框 + 备注 + 批准/驳回
  - `approved` → 4 种处置方式选择(回收/转售/核销/换货)
  - `disposed` → 处置结果展示(绿色卡片,含回收金额)

**审批节点状态**:
- `completed`:绿环 + 头像 + 对勾徽标
- `current`:橙环 + 头像 + 时钟徽标(脉冲)
- `rejected`:红环 + 头像 + 叉徽标
- `pending`:灰环 + 占位头像

**处置方式**(枚举对齐 `DispositionMethod`):
- recycle(回收)· resale(转售)· writeoff(核销)· exchange(换货抵扣)· other

**前端改造重点**:参考 `screen-scrap.jsx` 的 `ScrapCard` + `ScrapApprovalNode`。

### 2.4 二维码标签批量打印(QR Labels)

**路径**:**新增** `/labels`(原代码没有前端入口)
**对应代码**:`backend/app/modules/assets/labels.py` (已实现 PDF 生成)

**核心理念**:让 IT 管理员能可视化预览 A4 标签纸,选择要打印的资产 + 布局密度,然后下载 PDF。

**布局**:左右分栏
- **左侧(380px)**:
  - 打印设置:布局选择(4×8 / 3×6 / 2×4)+ 含字段勾选
  - 待打印资产列表(可勾选)
- **右侧**:**模拟 A4 纸**(白底 + 阴影),按选定布局展示标签预览
  - 标签内容:QR 码 + 资产编号 + 资产名称 (+ 品牌 / 采购日期 视布局而定)
  - 标签间用虚线分隔(模拟标签纸切割线)

**布局选项**:
| 布局 | 单标签尺寸 | 每页数量 |
|---|---|---|
| 4 × 8 密 | 50 × 35 mm | 32 |
| 3 × 6 中 | 65 × 45 mm | 18 |
| 2 × 4 大 | 100 × 70 mm | 8 |

**新增接口建议**(后端要加):
```python
# backend/app/modules/assets/router.py
@router.post("/labels/preview")
def labels_preview(codes: list[str], layout: str = "4x8"):
    """返回每张标签的位置信息,前端预览用"""

@router.post("/labels/print")
def labels_print(codes: list[str], layout: str = "4x8", fields: list[str]):
    """生成 PDF。当前 labels.py 写死 4x8,需要参数化"""
    return StreamingResponse(render_labels_pdf(codes, layout, fields), media_type="application/pdf")
```

**前端改造重点**:
1. 新建 `pages/QRLabels.tsx` + 路由 `/labels`
2. `Sidebar` 加菜单项(参考 `app-phase2.jsx` 的 `phase2NavItems`)
3. A4 预览组件:用 CSS Grid 模拟,QR 码用 `qrcode.react` 生成
4. 后端 `labels.py` 改造:支持 `layout` 参数(目前写死 `_COLS, _ROWS = 4, 8`)

### 2.5 审计日志时间线(Audit Logs)

**路径**:`/logs`
**对应代码**:`frontend/src/pages/AuditLogs.tsx`

**核心理念**:把表格升级为**按日分组的时间线**,每个动作有色彩区分,操作人 vs 系统一眼能看出。

**布局**:
1. 工具栏:操作类型 + 操作人筛选 + 导出
2. **按日分组**:每天一个 sticky header(日期 + 条数)
3. **日内列表**:每行包含
   - 时间(HH:MM:SS,等宽字体)
   - 操作类型彩色徽章 + 图标
   - 操作人头像(系统操作显示「系统」灰标)
   - 资源编号(蓝色等宽)
   - 备注
   - IP 地址(灰色等宽)

**操作类型 → 颜色映射**(可放到 `frontend/src/features/audit/types.ts`):
| 类别 | action 前缀 | 颜色 |
|---|---|---|
| 资产 | `asset.*`, `inventory.*` | blue |
| 完成 | `*.approve`, `*.complete`, `*.confirm` | success |
| 申请 | `request.*`, `repair.open`, `scrap.submit` | warning |
| 驳回 | `*.reject`, `*.cancel` | danger |
| 系统 | `celery.*`, `lark.webhook` | gray |

**前端改造重点**:
1. 现有 `AuditLogs.tsx` 替换 Table 为分组渲染(参考 `screen-labels-audit.jsx` 的 `AuditLogs` + `AuditRow`)
2. 后端如果还没暴露 IP/User Agent,在 `core/audit.py` 的 `write_audit` 里加上中间件捕获

---

## 3. 共享设计原则(Phase 2 延续 Phase 1)

### 3.1 状态机时间线模式

Phase 2 三个流程屏(盘点/维修/报废)都有**时间线**。统一规则:
- 节点圆形 28px + 2px 边框 + 14px 图标
- 图标颜色 + 14% 透明度底
- **垂直连线** 2px 灰 `var(--divider)`
- 「当前」节点带 4px `${color}33` 光晕
- 「最新」徽章 = 绿色填充 `success-bg`
- 操作人头像 16px + 名字 + 灰色时间戳(monospace)

可以抽 1 个公共 React 组件 `<WorkflowTimeline events={[]} />`,3 个屏共用。

### 3.2 流程漏斗模式

维修/报废顶部都有**状态漏斗**:
- 56px 圆角 14 卡片,2px 边框,大数字(22px 600)
- 卡片之间灰色连线 + 灰色 chevron
- 数字着色用同状态色

### 3.3 卡片 hover 模式

所有可点击卡片(工单卡 / 报废卡 / 资产卡):
- `:hover` 边框变蓝 `lark-blue-bg-strong` + 阴影 `0 2px 8px rgba(31,35,41,0.06)`
- 不要用 translateY(避免抖动)

### 3.4 头像审批链

报废审批用的「3 节点审批链」可以抽公共组件 `<ApprovalChain nodes={[]} />`:
- 头像 36px 包圈 + 状态徽标 12×12
- 节点间用虚线/实线(active/inactive)
- 适用场景:任何多人审批流程(以后可能加的采购审批、转岗审批…)

---

## 4. 新增 / 修改的设计令牌

Phase 1 的 token 完全复用。Phase 2 没引入新色,但有一些**语义补充**:

```css
/* 维修流程相关 */
--repair-opened-bg:     #FFF7E8;   /* = --warning-bg */
--repair-progress-bg:   #E8F1FF;   /* = --lark-blue-bg */
--repair-completed-bg:  #E8FFEA;   /* = --success-bg */

/* 报废处置 */
--scrap-disposal-recycle:  #00B42A; /* = --success */
--scrap-disposal-resale:   #3370FF; /* = --lark-blue */
--scrap-disposal-writeoff: #86909C; /* = --text-3 */
--scrap-disposal-exchange: #7E5EE5; /* = --purple */

/* 标签打印纸 */
--print-paper:        #FFFFFF;
--print-cut-line:     #D7D9DC;   /* 虚线裁切线 */
--print-shadow:       0 8px 32px rgba(0,0,0,0.12);
```

---

## 5. 前端文件改造清单

直接改这些已有文件(不要新建并行实现):

```diff
frontend/src/pages/
  Inspections.tsx         ← 替换 Tabs+Table 为 OwnerGroup 分组看板
  RepairOrders.tsx        ← 加状态漏斗 + 卡片化 + 详情抽屉重写
  ScrapApprovals.tsx      ← 加状态漏斗 + 头像审批链 + 详情抽屉重写
  AuditLogs.tsx           ← 替换 Table 为日期分组时间线
+ QRLabels.tsx (新增)     ← A4 预览 + 资产勾选

frontend/src/features/
+ inspections/
+   OwnerGroup.tsx
+   CircleProgress.tsx
+ repair/
+   RepairStepProgress.tsx     ← 可复用 5 节点状态条
+   RepairDetailDrawer.tsx
+   workflow.ts                ← REPAIR_STAGES 枚举
+ scrap/
+   ScrapApprovalChain.tsx     ← 头像审批链
+   ScrapDetailDrawer.tsx
+   workflow.ts                ← SCRAP_STAGES + DISPOSITION_META 枚举
+ workflow/
+   WorkflowTimeline.tsx       ← 公共时间线组件(3 个流程屏共用)
+ labels/
+   A4Preview.tsx              ← A4 纸 + 网格预览
+   LabelCell.tsx              ← 单标签
+   PrintSettings.tsx          ← 布局/字段选择

frontend/src/router.tsx
  + { path: '/labels', element: <QRLabels /> }

frontend/src/components/AppLayout.tsx
  + 侧边栏菜单加 NEW 徽标 / Phase 2 分组分隔(可选)
```

---

## 6. 后端需要补的小口子

| 接口 | 用途 | 状态 |
|---|---|---|
| `POST /api/inspections/:id/remind { user_id }` | 催办未确认员工(发 Lark 消息)| ❌ 待加 |
| `POST /api/labels/print` 支持 `layout` 参数 | 二维码标签 3 种布局 | ⚠️ 现写死 4×8 |
| `GET /api/audit-logs` 返回 IP / UA | 审计日志增强 | ⚠️ 视 `audit.py` 现状 |
| `GET /api/repair-orders/stats` | 维修漏斗数据(各状态计数)| 可前端聚合 |
| `GET /api/scrap-requests/stats` | 同上 | 可前端聚合 |

---

## 7. 可选 Phase 3 引子(本次不做,但留个口)

设计中体现了但代码未实现的:
- **耗材盘点**:`InspectionTask.scope_type` 加 `consumable`,扫码 SKU 实盘录入
- **离职 checklist**(PRD §8.4 已提到):员工 HR 状态变更触发资产归还提醒
- **报废处置导出清单**:对接财务系统(SAP / 用友)
- **维修 SLA 看板**:超期工单红灯

---

## 8. 验证清单

打开 `prototype/Phase 2 设计补充.html`,左侧导航点过 5 个 Phase 2 模块,确认:

- [ ] 盘点看板:能看到 4 个责任人分组,周明(u8)的卡片是橙色 banner
- [ ] 维修工单:点击 REP-2026-0042 打开抽屉,看到 5 节点时间线
- [ ] 报废处置:点击 SCR-2026-0006(approved),抽屉显示 4 种处置方式选择
- [ ] 二维码标签:切换 4×8 / 3×6 / 2×4,A4 预览同步变化
- [ ] 审计日志:按日期分组,celery.scheduled 显示「系统」标签

---

祝顺利。有疑问回到原型对照,或者直接 ping 设计同学。
