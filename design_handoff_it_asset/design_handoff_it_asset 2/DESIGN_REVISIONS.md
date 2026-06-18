# 设计修订说明(Design Revisions)

> **本文档优先级最高**:与 `README.md`(原始设计规格)冲突时,以本文档为准。
>
> 这是 Phase 1 实施完成后回看,对原始设计的修订记录。原因有两类:
> 1. **PRD 演进** — 业务在开发过程中改了规则(标记 🟦)
> 2. **落地决策** — 实施时为了简化或对接现实而调整(标记 🟢)
>
> 后续 Phase 2 polish / Phase 3 新功能,**都按本文档的约定来**。

---

## 修订汇总(11 项)

| # | 类别 | 模块 | 修订内容 | 影响范围 |
|---|---|---|---|---|
| 1 | 🟦 PRD | 资产状态机 | 8 态 → **4 态** | 高(几乎所有屏)|
| 2 | 🟦 PRD | 资产分类 | 新增 `AssetClass` 个人 vs 基础设施 | 高 |
| 3 | 🟢 落地 | 资产编号格式 | `IT-YYYY-####` → `<前缀>-####` | 中(所有展示)|
| 4 | 🟢 落地 | 资产字段 | brand/model 合并为 `brand_model`,加 spec | 中 |
| 5 | 🟢 落地 | 数据迁移兜底 | 新增 `needs_review`、`owner_name`、`legacy_code` | 中(新增 UI)|
| 6 | 🟢 落地 | 用户角色 | 新增 `procurement` 角色 | 低 |
| 7 | 🟢 落地 | 库存位置 | 字符串 → `InventoryLocation` 表 | 中(预警/盘点)|
| 8 | 🟦 PRD | 耗材盘点 | 单独模块 → 复用「库存调整」+ 审计 | 低 |
| 9 | 🟢 落地 | 审计字段 | 字段名对齐:`actor_user_id` / `resource_type/id` / `payload` jsonb | 低 |
| 10 | 🟢 落地 | 资产照片 | 由 `photo_urls jsonb` 实现,多张 | 低 |
| 11 | 🟦 PRD | 配件绑定 | 已实现 `binding_type` (follow / independent) | 低 |

---

## 1. 资产状态机:8 态 → 4 态 🟦

### 旧设计
```
待入库 pending_in
库存中 stocked
已领用 assigned
维修中 repairing
闲置 idle
已丢失 lost
待报废 pending_scrap
已报废 scrapped
```

### 现实(PRD v0.2 §5.1)
```
在用    in_use          ← 已分配给员工/已部署的基础设施
闲置    idle            ← 含旧的"库存中"和"待入库"
维修中  maintenance     ← 含旧的"repairing"
已报废  scrapped        ← 终态
```

### 状态消失了去哪儿?

| 旧状态 | 新位置 |
|---|---|
| 待入库 | `idle` |
| 库存中 | `idle` |
| 已领用 | `in_use` |
| 维修中 | `maintenance` |
| 闲置 | `idle` |
| 已丢失 | `idle` + `needs_review=true`,备注里写说明(不再有独立状态)|
| 待报废 | 状态保持原样,**`scrap_candidate=true`** 标记,处置完才翻 `scrapped` |
| 已报废 | `scrapped` |

### 允许的状态跳转

仅以下转换合法,后端 `state_machine.py` 强制:
- `idle` → `in_use` / `maintenance` / `scrapped`
- `in_use` → `idle` / `maintenance` / `scrapped`
- `maintenance` → `idle` / `in_use` / `scrapped`
- `scrapped` → ❌ 终态,不可恢复

### 对设计的影响

- **资产台账 Tab 栏**:从 7 个状态 Tab → **4 个 Tab**(全部 / 在用 / 闲置 / 维修中 / 已报废)
- **状态徽章**配色(覆盖原 README §5.6):

| 状态 | 后端值 | 背景 | 文字 | 圆点 | 中文 |
|---|---|---|---|---|---|
| 在用 | `in_use` | `#E8F1FF` | `#1A5BD0` | `#3370FF` | 在用 |
| 闲置 | `idle` | `#E8FFEA` | `#00863C` | `#00B42A` | 闲置 |
| 维修中 | `maintenance` | `#FFF7E8` | `#A66200` | `#FF8800` | 维修中 |
| 已报废 | `scrapped` | `#E5E6EB` | `#4E5969` | `#86909C` | 已报废 |

> 「在用」改为蓝色(原型里 assigned 也是蓝色,正好对应);「闲置」改为绿色(因为含了原"库存中",绿色更贴);维修橙、报废灰。

- **"待报废"标识**:`scrap_candidate=true` 时,在徽章旁加小红点提示「报废中」,链接到对应 `ScrapRequest`
- **"待复核"标识**:`needs_review=true`(见 §5),用浅紫色徽章

---

## 2. 资产分类:个人 vs 基础设施 🟦

### 现实
`Asset.asset_class` 枚举:
- `personal` — 个人发放(走领用 / 归还 / 离职回收),需要 `owner_user_id`
- `infrastructure` — 基础设施类(网络设备、会议室设备、打印机等),**不走个人分配**,仅维护台账 + 位置 + 状态

### 对设计的影响

1. **资产台账筛选**:新增「资产分类」筛选器(个人 / 基础设施)
2. **资产详情抽屉**:
   - personal:显示 `owner_user_id`、领用日期、归还按钮
   - infrastructure:**隐藏责任人区域**,改为「位置变更记录」,操作按钮只有「编辑位置 / 报修 / 报废」
3. **盘点 scope_type** 已经支持:`personal_in_use`、`infrastructure`、`by_location`
4. **基础设施类的列表样式**:可考虑稍弱化(灰色图标 + 蓝色「基设」徽章),区分核心个人资产
5. **新增资产表单**:第一步先选「资产分类」,再选「资产类型」

---

## 3. 资产编号格式:`IT-2025-0001` → `<前缀>-####` 🟢

### 现实
`asset_code = <code_prefix>-<padding 4 digits>`,前缀按资产类型走,例如:
- `PC-0001` 笔记本/台式机
- `MON-0001` 显示器
- `NET-0001` 网络设备
- `PHN-0001` 手机
- `TAB-0001` 平板
- `DOK-0001` 扩展坞
- `HP-0001` 耳机
- `CAM-0001` 摄像头

每个前缀**独立计数器**(`AssetCodeCounter`),并发安全。

### 对设计的影响

- **所有展示资产编号的地方**改用新格式:
  - 资产台账列表
  - 资产详情 Hero
  - 配件树
  - 工单卡 / 报废卡
  - 审计日志
  - QR 标签
- **不再有「年份」** — 原型里很多地方用 `IT-2025-` 前缀视觉对齐,可去掉
- **等宽字体保持**(`var(--font-mono)`),颜色保持蓝色链接 `var(--lark-blue)`

> ⚠️ 原型 `prototype/data.js` 仍是旧 `IT-2025-0001` 格式 — 视觉参考时心里换算就行,实际开发按数据库走。

---

## 4. 资产字段重组 🟢

| 原设计字段 | 实际字段 | 说明 |
|---|---|---|
| `name`、`brand`、`model` 三个独立 | **`brand_model`**(自由文本) | 不拆分,因为旧 Excel 数据无法可靠拆解 |
| - | **`spec`**(Text) | 自由文本配置:CPU/内存/硬盘等 |
| `sn` | `serial_number` | 不变 |
| - | **`legacy_code`** | 旧临时编号兜底(如 `gw-1`、`old-MBP-002`) |
| - | **`owner_name`** / `department_name` | 原文兜底(导入时 Lark 用户匹配失败的兜底)|
| - | **`needs_review`** | 数据质量待复核标记 |

### 对设计的影响

- 资产详情「规格与备注」section 改为:
  ```
  品牌型号 brand_model       (一行长字符串)
  规格配置 spec              (多行 Text,显示为段落)
  序列号 serial_number       (mono 等宽)
  旧编号 legacy_code         (灰色小字,有才显示)
  ```
- 列表里**资产名称那一列**直接用 `brand_model` 整串(原来「名称 / 品牌·型号」两行展示要合并为一行)
- 兜底名称展示:`owner_user_id` 为空但 `owner_name` 有值时,显示 `owner_name + 「待匹配」灰色徽章`

---

## 5. 数据迁移与「待复核」 🟢

### 现实
- `importer.py` 实现 Excel 批量导入
- `matching.py` 做 Lark 用户名 → user_id 模糊匹配
- 匹配失败 / 字段缺失 / 状态异常 → 自动标 `needs_review = true`

### 对设计的影响(**这是设计需要新增的部分**)

#### 5.1 资产台账加快速筛选 chip
顶部 Tab 右侧加一个**特别筛选**:
```
[ ⚠ 待复核 (12) ]
```
点击 → 等价于 `?needs_review=true`,展示所有待复核资产。

#### 5.2 待复核标记 UI
资产行内,资产名称右侧加紫色小徽章:
```
紫色徽章 "待复核 · 责任人未匹配"
```
鼠标 hover 显示具体原因(从 `payload_json` 来,如「Excel 里写"张伟",但部门内有 2 个张伟,无法确定」)。

#### 5.3 详情抽屉加「数据来源」section
显示:
- 导入来源(`IT资产台账.xlsx`、手工录入、API…)
- 导入时间
- 匹配状态(自动 / 手动复核 / 待处理)
- 「标记已核实」按钮(清除 needs_review)

#### 5.4 资产编辑表单
导入字段有 fallback 时,编辑表单显示:
```
责任人(Lark)  [↓ 下拉选择] · 原始文本: "张伟"
```
让管理员能看到原始数据并选择正确的 Lark 用户。

---

## 6. 用户角色多了 `procurement` 🟢

### 现实
PRD §4 角色表,实际实现里 IT 部行政 / 采购合并为一个角色:`procurement`。

完整角色清单(`Role` 枚举):
- `employee` — 员工
- `manager` — 部门主管
- `it_admin` — IT 管理员
- `procurement` — **行政/采购**(新增)
- `finance` — 财务
- `sys_admin` — 系统管理员

### 对设计的影响

- 任何角色相关的 UI(如审批人选择器、权限说明)都要加 procurement
- **报废审批流**可由 `finance` 或 `procurement` 处理 — 原型里默认显示 finance,实际后端两者都行
- 入库操作可由 `it_admin` 或 `procurement` 执行 — 库存页「入库」按钮的权限校验对齐

---

## 7. 库存位置实体化 🟢

### 现实
原型把 `location` 当字符串(`'IT 仓库·B 区'`),实际有专门的 `InventoryLocation` 表:

```python
InventoryLocation:
  id, name, type ('warehouse' | 'office' | ...),
  manager_id, address, remark

InventoryStock:
  sku_id, location_id, quantity_available, quantity_locked, quantity_damaged
  # 联合唯一 (sku_id, location_id)
```

也就是说:**库存余额按 (SKU × 位置) 维度管理**,一个 SKU 可以在多个仓库各有库存。

### 对设计的影响

- **库存物品页**:每个 SKU 卡片下方加位置切换 chip(如「B 区 28 个 / C 区 0 个」)
- **入库/发放表单**:多一个「位置」选择器
- **库存预警**:按 `(sku, location)` 维度算 — 同一个 SKU 在 A 区告警不影响 B 区
- **盘点 scope `by_location`** 已经支持 — 设计原型里没体现,可以加一个「按地点盘点」入口

> 但 Phase 1 实际只有 1 个默认位置(`IT 仓库·B 区`),设计上**可暂时不展示位置切换**,等真有 2+ 个仓库再加。

---

## 8. 耗材盘点:不做独立模块 🟦

### 旧 PRD §6.3.5
有「耗材库存盘点」流程:发起 → 录入实盘 → 系统计算盘盈盘亏 → 调整单。

### 现实
没单独做。复用现有的「库存调整」(`adjustment` 交易类型)+ 审计日志。
IT 管理员看到对账有差异时,手工录一笔 `adjustment` 即可。

### 对设计的影响
- 盘点模块**只设计资产盘点看板**,不需要做耗材盘点
- 如果业务方未来要做耗材盘点,新增 `InspectionTask.scope_type = 'consumable'` 即可

---

## 9. 审计日志字段对齐 🟢

### 现实(`audit_logs` 表)
```python
AuditLog:
  id
  actor_user_id        # 操作人(可空,系统操作时空)
  action               # 'asset.assign'、'inventory.issue' …(同 prototype 设计)
  resource_type        # 'asset' / 'sku' / 'approval' / 'inspection' / 'repair_order' …
  resource_id          # 字符串形式,可以是 asset_code 或 numeric id
  payload              # jsonb,存任意上下文(from/to_status、reason 等)
  ip
  ua                   # User Agent
  created_at
```

### 对设计的影响
- 时间线时间格式取 `created_at`
- 「资源编号」一列展示 `resource_type:resource_id`,如 `asset:PC-0001`
- 「备注」从 `payload` 里挑关键字段(如 `payload.reason` 或 `payload.note`)
- IP 直接从 `ip` 字段取
- 操作人:`actor_user_id` 为空 → 「系统」标签;有值 → 头像 + 名字

---

## 10. 资产照片 🟢

### 现实
`Asset.photo_urls = jsonb` 存数组,如 `["s3://...", "s3://..."]`

### 对设计的影响
- 资产详情「附件 / 照片」Tab **实际是网格展示**(原型里是占位)
- 支持拖拽上传 → 走对象存储(`storage.py` 已有 put_object)
- 单张点击 → 全屏预览

---

## 11. 配件绑定:`binding_type` 🟦

### 现实
`AssetAccessory.binding_type` 有 2 种:
- `follow` — 跟随主资产流转(默认,设计原型已体现)
- `independent` — **独立分配**(配件可以单独再分给别人)

### 对设计的影响
- 配件树里,`independent` 类型的配件不画那条「跟随主资产」灰标签,改画「独立绑定」
- 解绑 UI 已经在「⋯」菜单里实现

---

## 视觉调整清单(优先级)

下面是设计层面具体要改的事。按优先级排:

### P0 — 必改(否则 UI 与现实对不上)

1. **资产状态徽章**:替换为 4 态新色板(§1)
2. **资产编号格式**:从 `IT-YYYY-####` 换为 `<前缀>-####`(§3)
3. **资产台账 Tab**:7 → 4 个(§1)
4. **资产名称列**:合并 `brand_model` 为一行(§4)
5. **资产详情 Hero**:删除 SN 后面的 `model` 分隔(§4)

### P1 — 建议加(对应已实现功能)

6. **「待复核」筛选 chip** + 行内紫色徽章(§5)
7. **资产分类筛选 + 详情区分**(§2)
8. **数据来源 section**(详情抽屉,§5.3)
9. **资产照片网格**(§10)

### P2 — 优化(数据足够多时再做)

10. **位置切换**(库存物品页,§7)— 等有 2+ 仓库
11. **「按地点盘点」入口**(§7)
12. **`independent` 配件的视觉区分**(§11)

---

## 给 Claude Code 的指令(改造 Phase 1 UI)

```
请阅读 design_handoff_it_asset/DESIGN_REVISIONS.md。

把现有前端代码按文档 §"视觉调整清单" P0 部分逐项对齐:
1. 更新 features/assets/StatusBadge.tsx — 新色板
2. 检查所有列表/卡片/详情里资产编号的展示,确认用 brand_model + 新格式
3. 资产台账 (pages/Assets.tsx) Tab 改为 4 个 + 全部
4. 资产详情抽屉的字段渲染对齐 §4

P1 部分一并做(待复核、资产分类区分、数据来源)。

每改完一个文件就出一个独立 PR,不要一次改完。
```

---

## Phase 2 polish 同步

`PHASE2_DESIGN.md` 里的状态徽章 / 资产编号样例都用了旧格式。Claude Code 实施时按本文档替换即可,**不用回头改 PHASE2_DESIGN.md**(那个是视觉风格参考)。
