# 基于 Lark 的 IT 资产与低值耗材管理系统初步设计文档

**版本**：v0.2  
**日期**：2026-05-18  
**定位**：固定资产 + 低值配件 + IT 耗材的一体化轻量管理系统  

> **v0.2 变更说明**：基于真实存量数据(原 Lark 云文档台账)修正三处与现实脱节的设计——
> 固定资产状态机由 8 态收敛为 4 态;数据模型改为"容脏"(绝大多数字段可空 + `needs_review`);
> 区分"个人发放资产"与"基础设施资产"两类;新增第 13 章"存量数据迁移与编号规则(Phase 0)"。

---

## 1. 背景与目标

企业 IT 资产通常分散在 Excel、飞书表格、人工登记或不同系统中，容易出现以下问题：

- 资产归属不清，员工离职时难以及时回收；
- 资产状态不透明，库存、闲置、维修、报废信息滞后；
- 鼠标、键盘、转接头、网线、硒鼓等低值配件和耗材缺乏库存管理；
- IT 管理员依赖线下沟通，审批、发放、盘点流程效率低；
- 缺少完整操作日志，难以审计和追溯。

本系统目标是建设一个可注册为 Lark/飞书企业自建应用的 IT 资产管理系统，实现 IT 固定资产、低值配件、耗材库存的统一管理，并通过 Lark 提供登录、通知、审批、员工自助申请和盘点确认能力。

一句话目标：

> 为企业提供 IT 资产从采购、入库、领用、变更、盘点、维修到报废的全生命周期管理，同时支持低值配件和耗材的库存、领用、预警与统计，并通过 Lark 应用完成员工侧操作和消息触达。

---

## 2. 系统范围

### 2.1 第一阶段建议覆盖

第一版建议聚焦以下范围：

1. 笔记本、台式机、显示器、手机、平板等固定资产；
2. 扩展坞、摄像头、耳机、移动硬盘、电源适配器等低值配件；
3. 鼠标、键盘、网线、电池、标签纸、硒鼓、墨盒、转接头等耗材或库存物品；
4. 员工通过 Lark 查看本人资产、申请领用、申请归还、申请维修、确认盘点；
5. IT 管理员通过 Web 后台管理资产台账、库存、发放、盘点和报表。

### 2.2 暂不纳入第一阶段

以下能力建议后续阶段再做：

- 财务折旧深度计算；
- 软件 License 管理；
- 云资源自动发现；
- CMDB 深度集成；
- MDM/Jamf/Intune 自动同步；
- 复杂采购流程和供应商管理；
- 多租户 SaaS 化。

---

## 3. 核心设计原则

系统中需要区分三类对象：

```text
1. 固定资产：一物一码，关注生命周期、责任人、状态变更和审计。
2. 低值配件：可一物一码，也可按库存管理，关注是否需要归还、是否绑定主资产。
3. 耗材库存：按 SKU 和数量管理，关注入库、发放、扣减、盘点和补货。
```

建议采用以下原则：

> 贵重且需要追责的，按“资产”管理；便宜且消耗快的，按“库存”管理；随主设备交付的，按“配件绑定”管理。

### 3.1 固定资产再分两类（v0.2 新增）

固定资产内部还需区分两类，两者流程完全不同：

```text
个人发放资产（asset_class = personal）
  例：笔记本、台式机、显示器、手机
  关注：责任人、领用/归还、离职回收
  走完整的 领用 → 使用 → 归还 流程

基础设施资产（asset_class = infrastructure）
  例：交换机、AP、路由器等网络设备
  无固定使用人，只关心位置和台账
  不走领用/归还流程，仅做台账登记 + 位置 + 状态
```

> 原则：**领用/归还/离职回收流程只对 `personal` 资产生效；`infrastructure` 资产只做台账与位置管理。**

### 3.2 “容脏”原则（v0.2 新增）

存量数据来自人工维护的电子表格，质量不可靠（编号缺失、序列号为“无”、采购日期/原值从未填写、品牌型号粒度混乱、部门/使用人大量空缺）。因此：

> **绝大多数字段可空；脏数据先进系统并打 `needs_review` 标记，后续人工核对，而不是卡在导入门口。** 系统的价值在于电子表格做不到的事（离职责任追溯、报废/超龄主动预警、Lark 员工自助），而非强制数据规整。

---

## 4. 用户角色与权限

| 角色 | 主要权限 |
|---|---|
| 普通员工 | 查看本人资产、查看本人耗材领用记录、申请领用、申请归还、申请维修、确认盘点 |
| 部门负责人 | 审批本部门员工申请、查看本部门资产概况 |
| IT 管理员 | 资产登记、入库、分配、回收、维修、报废、库存发放、库存盘点、库存预警处理 |
| 行政/采购 | 耗材入库、采购记录、库存查看、补货管理 |
| 财务 | 查看资产价值、采购价格、报废记录、成本统计 |
| 系统管理员 | 用户、部门、角色、权限、Lark 配置、系统参数、审计日志 |

---

## 5. 资产生命周期设计

### 5.1 固定资产状态（v0.2 收敛为 4 态）

真实台账实际只用到 在用 / 闲置 / 报废 三种状态，v0.1 的 8 态（待入库、库存中、已领用、已丢失、待报废 等）与现实脱节，徒增操作负担。v0.2 收敛为 4 态：

```text
in_use       在用     （已分配给人在用，或基础设施在线运行）
idle         闲置     （在库可分配 / 未分配，含 v0.1 的“库存中”）
maintenance  维修中
scrapped     已报废
```

> 细分原因（已超 10 年、损坏、丢失、待报废建议）不进状态机，统一放 `remark` 文本，并由 `scrap_candidate` 标记驱动“报废/超龄主动预警”。这样状态机简单、可枚举，又不丢失运维信息。

### 5.2 固定资产主流程

```text
采购/登记 → 入库 → 分配/领用 → 使用中 → 归还/转移/维修 → 盘点 → 报废
```

> 注：上述完整流程仅适用于 `personal`（个人发放）资产。`infrastructure`（基础设施，如网络设备）资产**不走分配/领用/归还**，生命周期简化为：`登记 → 在用 → 维修 → 报废`，只维护位置与状态。

### 5.3 典型流程

#### 5.3.1 资产入库

```text
IT 管理员录入资产
→ 生成资产编号/二维码
→ 设置状态为“库存中”
→ 记录入库日志
```

#### 5.3.2 资产领用

```text
员工在 Lark 应用中提交领用申请
→ 部门负责人审批，可选
→ IT 管理员分配资产
→ 员工确认领取
→ 资产状态变为“已领用”
→ 记录领用日志
```

#### 5.3.3 资产归还

```text
员工提交归还申请
→ IT 管理员验收
→ 根据验收结果设置为“库存中”或“维修中”
→ 记录归还日志
```

#### 5.3.4 资产维修

```text
员工提交报修
→ IT 管理员确认
→ 资产状态变为“维修中”
→ 记录维修过程、费用和结果
→ 维修完成后恢复库存或继续领用
```

#### 5.3.5 资产报废

```text
IT 管理员发起报废
→ 财务/负责人审批
→ 资产状态变为“已报废”
→ 保留报废原因、审批记录和审计日志
```

---

## 6. 低值配件与耗材管理设计

### 6.1 物品范围

| 类型 | 示例 | 管理方式 |
|---|---|---|
| 低值配件 | 鼠标、键盘、耳机、扩展坞、转接头、摄像头 | 可一物一码或按库存 |
| 耗材 | 网线、扎带、电池、标签纸、硒鼓、墨盒 | 按 SKU 库存管理 |
| 备件 | 电源适配器、内存条、硬盘、屏幕、键帽 | 可按库存，也可绑定设备 |
| 办公 IT 辅料 | 贴膜、保护壳、理线器、清洁套装 | 按库存管理 |

### 6.2 管理模式

#### A. 一物一码模式

适合扩展坞、高价值耳机、摄像头、移动硬盘、大容量 SSD、高价适配器等。

特点：

```text
每个实物有唯一编号
可以分配到员工
可以归还
可以维修/报废
```

#### B. SKU 库存模式

适合鼠标垫、网线、电池、标签纸、硒鼓、墨盒、转接头、扎带、清洁用品等。

特点：

```text
不追踪单个实物
只管理库存数量
领用后直接消耗或减少库存
通常不要求归还
```

#### C. 绑定主资产模式

适合笔记本电源适配器、鼠标键盘套装、显示器线缆、笔记本包、配套扩展坞等。

示例：

```text
MacBook Pro IT-2025-0001
├── 原装电源适配器
├── USB-C 数据线
├── 扩展坞
└── 笔记本包
```

### 6.3 耗材库存流程

#### 6.3.1 入库

```text
IT/行政采购耗材
→ 创建入库单
→ 选择 SKU
→ 填写数量、单价、供应商、位置
→ 库存增加
→ 生成库存流水
```

#### 6.3.2 员工申请领用

```text
员工在 Lark 应用中提交申请
→ 选择耗材/配件
→ 填写数量和用途
→ 系统判断库存是否充足
→ 可选审批
→ IT 发放
→ 库存扣减
→ 记录员工领用历史
```

#### 6.3.3 快速发放

```text
IT 管理员选择员工
→ 选择物品
→ 输入数量
→ 确认发放
→ 库存扣减
→ Lark 通知员工
```

这是高频场景，建议 MVP 纳入。

#### 6.3.4 退库/归还

```text
员工归还配件
→ IT 验收
→ 判断状态
   ├── 可用：库存增加
   ├── 损坏：报损
   └── 丢失：记录异常
```

#### 6.3.5 库存盘点

```text
IT 发起耗材盘点
→ 按仓库/位置盘点
→ 录入实盘数量
→ 系统计算盘盈/盘亏
→ 生成调整单和库存流水
```

#### 6.3.6 库存预警

每个 SKU 可设置：

```text
安全库存
最低库存
最高库存，可选
默认采购数量
```

低于阈值时发送 Lark 通知：

```text
库存预警：USB-C 转 HDMI 转接头当前库存仅剩 2 个，低于安全库存 5 个，请及时补货。
```

---

## 7. 功能模块设计

### 7.1 总体模块

```text
1. 资产台账
2. 资产分类
3. 员工与组织同步
4. 领用/归还/转移
5. 维修与报废
6. 盘点管理
7. 低值配件/耗材管理
8. 审批与通知
9. 报表与审计
10. 系统设置
```

### 7.2 固定资产功能

| 模块 | 功能 |
|---|---|
| 资产台账 | 新增、编辑、查询、导入、导出、二维码 |
| 分类管理 | 资产类型、品牌、型号、地点 |
| 领用管理 | 申请、审批、分配、确认 |
| 归还管理 | 归还申请、验收、状态变更 |
| 转移管理 | 员工间转移、部门转移 |
| 维修管理 | 报修、维修记录、费用、结果 |
| 报废管理 | 报废申请、审批、财务确认 |
| 盘点管理 | 发起盘点、员工确认、异常处理 |

### 7.3 耗材库存功能

| 模块 | 功能 |
|---|---|
| 物品目录/SKU | 维护物品名称、品牌、规格、单位、管理方式、安全库存 |
| 库存余额 | 查看各仓库/位置库存数量、可用数量、锁定数量、损坏数量 |
| 入库单 | 采购入库、手工入库 |
| 领用单 | 员工申请领用、IT 快速发放 |
| 退库单 | 配件归还、退回库存 |
| 调拨单 | 不同仓库或办公地点之间调拨 |
| 报损/报废 | 损坏、丢失、过期等处理 |
| 库存盘点 | 实盘录入、盘盈盘亏、库存调整 |
| 库存预警 | 低库存提醒、补货建议 |
| 消耗统计 | 按部门、人员、物品、时间统计领用和消耗 |

---

## 8. Lark 应用集成设计

### 8.1 应用类型

建议注册为 Lark/飞书企业自建应用。

### 8.2 集成能力

| Lark 能力 | 用途 |
|---|---|
| 企业自建应用 | 作为员工访问入口 |
| 免登登录 | 员工通过 Lark 打开应用自动登录 |
| 通讯录权限 | 同步员工、部门、主管关系 |
| 机器人消息 | 发送领用、审批、盘点、库存预警提醒 |
| 事件订阅 | 接收用户、部门、审批等事件 |
| 审批能力 | 可对接 Lark 原生审批，或系统内置审批 |
| 应用卡片 | 展示待确认资产、待审批申请、库存预警 |

### 8.3 Lark 应用入口

```text
IT 资产管理
├── 我的资产
├── 申请领用
├── 申请归还
├── 申请维修
├── 申请耗材/配件
├── 我的耗材领用记录
├── 盘点确认
└── 管理后台
```

### 8.4 典型消息模板

#### 资产领用审批

```text
你有一条 IT 资产领用申请待审批

申请人：张三
部门：研发部
资产类型：MacBook Pro
用途：新员工入职

[同意] [拒绝] [查看详情]
```

#### 盘点提醒

```text
请确认你当前名下资产：

1. MacBook Pro - IT-2025-0001
2. Dell 显示器 - IT-2025-0123

[确认无误] [信息有误]
```

#### 耗材申请结果

```text
你的耗材申请已发放：

物品：USB-C 转 HDMI 转接头
数量：1
发放人：王五
```

#### 库存预警

```text
库存预警：

物品：罗技 M185 鼠标
当前库存：3
安全库存：10
建议补货：20
```

#### 离职资产归还提醒

```text
员工李四已进入离职流程，名下仍有 3 件 IT 资产待归还。
```

---

## 9. 页面设计初稿

### 9.1 员工端页面

```text
我的资产
资产详情
申请领用
申请归还
申请维修
申请耗材/配件
我的耗材领用记录
我的待归还配件
盘点确认
```

### 9.2 管理端页面

```text
资产台账
资产入库
资产分配
领用记录
归还记录
维修记录
报废管理
资产盘点
员工资产视图
物品目录/SKU
库存余额
入库单
领用单
退库单
调拨单
库存盘点
库存预警
耗材统计
统计报表
系统设置
```

---

## 10. 数据模型初稿

### 10.1 固定资产相关表

#### assets：资产表（v0.2 修订）

```text
id
asset_code            -- 系统生成，规则见第 13 章；存量首次导入后回写云文档
asset_class           -- personal | infrastructure
asset_type_id
brand_model           -- 自由文本，原样保留，不拆分品牌/型号
spec                  -- 配置自由文本（如 cc150-32g-500g-1050ti），不结构化
serial_number         -- 可空；“无”→null
legacy_code           -- 旧临时编号（如 gw-1、x99-1），物理标过渡用
status                -- 枚举：in_use | idle | maintenance | scrapped
owner_user_id         -- 可空，匹配飞书用户
owner_name            -- 使用人原文兜底（如“实习生”/未匹配人名）
department_id         -- 可空
department_name       -- 部门原文兜底，导入后异步匹配
location
purchase_date         -- 可空，存量无数据不造假
purchase_price        -- 可空
warranty_expire_date  -- 可空
supplier              -- 可空
remark                -- 自由文本，原样保留
scrap_candidate       -- 布尔，备注命中“建议报废/损坏/无法点亮/已超10年”时置真
needs_review          -- 布尔，脏数据待人工核对标记
created_at
updated_at
```

说明：

```text
除 id / asset_code / asset_class / status / 时间戳 外，绝大多数字段允许为空（容脏原则，见 3.2）。
v0.1 的 name / brand / model 三字段合并为单一自由文本 brand_model；config 落入 spec。
status 为受控枚举，仅 4 态（见 5.1）。
```

#### asset_types：资产类型表

```text
id
name
parent_id
code_prefix
depreciation_years
```

#### asset_assignments：领用记录表

```text
id
asset_id
user_id
assigned_at
returned_at
status
operator_id
remark
```

#### asset_change_logs：资产变更日志表

```text
id
asset_id
action
from_status
to_status
from_owner_id
to_owner_id
operator_id
reason
created_at
```

#### asset_accessories：主资产配件绑定表

```text
id
asset_id
sku_id
asset_accessory_id
quantity
binding_type
need_return
remark
created_at
```

说明：

```text
asset_id：主资产，比如笔记本
sku_id：如果配件按库存管理
asset_accessory_id：如果配件本身也是一物一码资产
```

### 10.2 用户与组织相关表

#### users：用户表

```text
id
lark_open_id
lark_user_id
name
email
mobile
department_id
manager_user_id
status
created_at
updated_at
```

#### departments：部门表

```text
id
lark_department_id
name
parent_id
```

### 10.3 审批相关表

#### approval_requests：审批申请表

```text
id
request_type
requester_id
approver_id
status
lark_approval_instance_id
payload_json
created_at
updated_at
```

### 10.4 盘点相关表

#### inventory_tasks：盘点任务表

```text
id
name
scope_type
status
started_at
ended_at
created_by
```

#### inventory_items：盘点明细表

```text
id
task_id
asset_id
expected_owner_id
confirmed_by
confirm_status
confirmed_at
remark
```

### 10.5 耗材库存相关表

#### item_categories：物品分类表

```text
id
name
parent_id
management_mode
```

management_mode 建议枚举：

```text
asset
inventory
consumable
accessory
```

#### skus：物品 SKU 表

```text
id
sku_code
name
category_id
brand
model
spec
unit
management_mode
need_approval
need_return
safety_stock
default_location_id
status
created_at
updated_at
```

#### inventory_locations：库存地点表

```text
id
name
type
manager_id
address
remark
```

#### inventory_stocks：库存余额表

```text
id
sku_id
location_id
quantity_available
quantity_locked
quantity_damaged
updated_at
```

#### inventory_transactions：库存流水表

```text
id
sku_id
location_id
transaction_type
quantity
before_quantity
after_quantity
related_order_id
operator_id
remark
created_at
```

transaction_type 建议枚举：

```text
purchase_in
manual_in
issue_out
return_in
transfer_out
transfer_in
adjustment
damage_out
scrap_out
```

#### inventory_orders：库存单据表

```text
id
order_no
order_type
status
requester_id
approver_id
operator_id
source_location_id
target_location_id
remark
created_at
updated_at
```

order_type 建议枚举：

```text
purchase_in
issue
return
transfer
adjustment
damage
scrap
```

#### inventory_order_items：库存单据明细表

```text
id
order_id
sku_id
quantity
unit_price
remark
```

#### employee_item_issues：员工领用记录表

```text
id
user_id
sku_id
quantity
issue_order_id
need_return
expected_return_date
actual_return_date
status
created_at
```

status 建议枚举：

```text
issued
returned
consumed
lost
damaged
```

---

## 11. 系统架构初稿

```text
Lark/飞书
  ↓
Lark 自建应用 / 机器人 / 事件订阅
  ↓
API Gateway / Backend
  ↓
业务服务
  ├── 资产服务
  ├── 用户组织服务
  ├── 审批服务
  ├── 盘点服务
  ├── 库存服务
  ├── 通知服务
  └── 报表服务
  ↓
数据库 PostgreSQL / MySQL
  ↓
对象存储，可选：资产照片、附件、发票
```

### 11.1 推荐技术栈

| 层 | 建议 |
|---|---|
| 前端 | React / Vue |
| 后端 | Node.js NestJS / Python FastAPI / Java Spring Boot |
| 数据库 | PostgreSQL 优先 |
| 缓存 | Redis，可选 |
| 部署 | Docker + Nginx |
| 登录 | Lark OAuth / 免登 |
| 通知 | Lark Bot API |
| 审批 | Lark Approval API 或系统自建审批 |

如果团队规模较小，建议：

> FastAPI 或 NestJS + PostgreSQL + React Admin + Lark 自建应用。

---

## 12. MVP 范围建议

### 12.1 第一版必须做

```text
1. Lark 登录
2. 用户/部门同步
3. 资产录入与资产台账
4. 资产分配给员工
5. 我的资产
6. 归还/维修申请
7. SKU 物品目录
8. 库存数量管理
9. 耗材入库
10. 耗材发放/领用
11. 员工耗材领用记录
12. 库存流水
13. 库存预警
14. 基础盘点确认
15. Lark 消息通知
16. 操作日志
```

### 12.2 第一版暂缓

```text
1. 多仓库复杂调拨
2. 批次管理
3. 成本核算和折旧
4. 自动采购建议
5. 复杂审批编排
6. 供应商管理
7. 条码/二维码批量打印
8. MDM/CMDB/财务系统集成
```

---

## 13. 存量数据迁移与编号规则（Phase 0）

存量资产当前由人工电子表格维护、无任何资产编号。新系统上线前必须先完成一次性迁移：**导入云文档 → 自动生成编号 → 导出带编号清单去贴标 → 编号回写云文档 → 之后以 `asset_code` 为稳定主键做增量，云文档退役。** 这是 Phase 0，排在 MVP 之前。

### 13.1 资产编号规则

```text
格式：  <类型前缀>-<4位序号>      例：PC-0001  MON-0001  NET-0001
```

- 按**类型前缀 + 各自独立序号**：PC（电脑）/ MON（显示器）/ NET（网络设备），可平滑扩展新前缀。
- 物理盘点时按前缀一眼分类，提高清点效率；前缀只代表身份不代表属性，类型改了编号不变。
- **不嵌年份**：存量资产无真实采购日期，塞年份等于造假数据；纯流水号最诚实。
- 序号由**数据库 sequence 按前缀生成**，禁止 `max+1`（并发会撞号）。
- 4 位 = 每类 9999 台，不够时平滑加位。

### 13.2 导入字段映射

| 云文档列 | 目标字段 | 清洗规则 |
|---|---|---|
| 资产编号 | `asset_code` | 空→系统生成；非空→保留并查重 |
| 类型 | `asset_type_id` / `asset_class` | PC/显示器→personal；网络设备→infrastructure；新值→`needs_review` |
| 品牌型号 | `brand_model` | 自由文本原样保留，**不拆分** |
| 配置 | `spec` | 自由文本原样保留，**不结构化** |
| 序列号 | `serial_number` / `legacy_code` | `无`→null；`无,临时编号gw-1`→serial=null，`legacy_code`=gw-1；真实串→serial，重复则提示冲突 |
| 所属部门 | `department_name` →异步匹配 `department_id` | 空→null；有值先存文本，匹配不上→`needs_review` |
| 使用人 | `owner_name` + `owner_user_id` | 空→null；“实习生”等角色词或离职/未匹配→存 `owner_name`，user_id 留空，`needs_review` |
| 状态 | `status` | 在用→`in_use`；闲置→`idle`；报废→`scrapped` |
| 采购日期 | `purchase_date` | 空→null（**不造假**） |
| 原值 | `purchase_price` | 空→null |
| 备注 | `remark` + `scrap_candidate` | 原样保留；命中“建议报废/无法点亮/损坏/已超10年”→`scrap_candidate`=true |

### 13.3 迁移闭环

```text
1. 导入云文档原表（容脏，不卡门）
2. 按 13.1 规则为每条生成 asset_code
3. 导出带编号清单 → IT 据此打印并粘贴物理标签
4. 将 asset_code 回写云文档对应行
5. 云文档冻结/退役，之后所有增量以系统 asset_code 为主键
6. needs_review 队列由 IT 逐步人工核对清零
```

> 幂等：首次导入是一次性播种；二次导入以 `serial_number`（真实且非“无”）或已生成的 `asset_code` 为匹配键，避免重复建档。

---

## 14. 非功能需求

| 类型 | 要求 |
|---|---|
| 权限 | 普通员工只能看自己资产和本人领用记录 |
| 审计 | 所有资产状态变化、库存变化必须保留日志 |
| 安全 | 使用 Lark 身份校验，关键操作校验角色权限 |
| 可追溯 | 每件固定资产可查看完整生命周期 |
| 库存准确性 | 所有库存变化必须通过单据和流水产生 |
| 导入导出 | 支持资产、SKU、库存数据 Excel 导入导出 |
| 性能 | 支持至少几万条资产记录和库存流水 |
| 移动端 | 员工侧操作需适配手机 |
| 备份 | 数据库定期备份 |
| 可扩展 | 后续可扩展软件资产、云资产、MDM、CMDB |

---

## 15. 需求确认清单

### 15.1 业务问题

1. 现在资产数据在哪里？Excel、飞书表格、ERP，还是没有？
2. 是否已有资产编号规则？
3. 是否需要打印二维码/标签？
4. 哪些资产必须一物一码？哪些可以按库存数量管理？
5. 员工领用是否必须审批？
6. 审批人是部门主管，还是 IT/行政？
7. 离职资产归还是否需要和 HR 流程联动？
8. 盘点频率是月度、季度还是年度？
9. 是否需要记录采购价格和折旧？
10. 是否需要和财务系统对接？
11. 哪些耗材需要安全库存预警？
12. 是否存在多个办公地点或仓库？
13. 是否需要区分行政耗材和 IT 耗材？

### 15.2 Lark 问题

1. 使用的是飞书国内版还是 Lark 国际版？
2. 企业是否允许创建自建应用？
3. 是否能开通通讯录权限？
4. 是否需要上架企业工作台？
5. 审批用 Lark 原生审批，还是系统内审批？
6. 消息是否允许机器人主动推送？
7. 是否需要移动端适配？
8. 是否需要接收员工离职、部门变化等事件？

---

## 16. 阶段路线图

### Phase 0：存量数据迁移

```text
导入云文档台账 + 生成资产编号 + 贴标 + 编号回写 + needs_review 人工核对（详见第 13 章）
```

### Phase 1：MVP

```text
资产台账 + Lark 登录 + 用户同步 + 我的资产 + 领用/归还 + SKU 库存 + 耗材发放 + 通知
```

### Phase 2：流程完善

```text
资产盘点、耗材盘点、维修、报废、审批流、二维码标签
```

### Phase 3：管理增强

```text
报表、折旧、采购管理、离职联动、批量导入导出、多仓库调拨
```

### Phase 4：集成扩展

```text
MDM、Jamf、Intune、LDAP、财务系统、云资产同步、CMDB
```

---

## 17. 初步结论

建议将产品定义为：

> 一个基于 Lark 的轻量 IT 资产与库存管理系统，第一阶段聚焦硬件资产台账、员工领用、归还、维修、盘点、低值配件/耗材库存、发放和库存预警，不做复杂 CMDB 和财务折旧深度管理。

这样既能覆盖 IT 管理的高频痛点，也能避免第一版范围过大，便于快速落地和后续扩展。
