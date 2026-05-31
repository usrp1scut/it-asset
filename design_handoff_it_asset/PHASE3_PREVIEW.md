# Phase 3 设计预览(Phase 3 Design Preview)

> 本文档配套 `prototype/IT 资产管理 · 完整版.html`,新增两个屏:
> - **审批中心(完整实现)** — 替换 Phase 1 的占位
> - **离职归还(全新)** — PRD §8.4 提到但未独立设计的场景

---

## 1. 审批中心(Approval Center)

**路径**:`/admin/approvals`
**对应代码**:`frontend/src/pages/Approvals.tsx`(已有基础实现,需视觉升级)

### 1.1 核心理念
原 Phase 1 占位的审批中心,现在重新设计为「**待我处理**」为核心、围绕「卡片 + Lark 卡片预览」的审批流。

### 1.2 布局
1. **Header**:显示待办数 + 逾期数 + 本月已审批
2. **4 个 KPI**:待我处理 / 待他人处理 / 本月已审批 / 自动审批占比
3. **Tab**:待我处理 / 待他人处理 / 已通过 / 已驳回
4. **筛选行**:类型 / 紧急程度 / 提交时间
5. **批量操作浮条**(选中 >0 时)
6. **审批卡片列表** — 每张卡片包含:
   - 左:勾选框 + 类型图标 + 编号徽章 + 紧急标签
   - 中:目标 + 数量 + 事由摘要 + **审批流 mini view**(头像 + 状态徽标 + chevron)
   - 右:申请人头像 + SLA 进度条 + 通过/驳回快捷按钮

### 1.3 审批详情抽屉(820px 宽)

**Sections**:
1. **Hero**:类型大图标 + 编号 + 标签 + 目标名 + 申请人信息
2. **库存预警 Banner**(申请耗材时,如果对应 SKU 已告警)
3. **申请详情**:事由 + InfoGrid(类型 / 数量 / 紧急 / 交付方式)
4. **审批流程**:**完整审批链 vertical view**(48px 头像 + 状态徽标 + 操作意见 + 时间戳)
5. **Lark 卡片消息预览** ⭐ 签名时刻
6. **审批操作**(待我处理时):意见文本框 + 通过/驳回按钮 + 副作用提示

### 1.4 Lark 卡片预览(Signature Visual) ⭐

完整模拟 Lark 机器人消息卡片:
- 顶部:机器人头像 + "IT 资产管理" + 时间
- 中部:类型色块 header + 物品名
- 字段表:申请人 + 部门 + 事由 + 紧急程度
- 操作按钮:查看详情 / 同意 / 拒绝(蓝色主按钮 = Lark 标准)
- 底部:消息送达回执("已通过 Lark 推送给 XX,消息已读")

### 1.5 后端对接(已实现)
```
GET    /api/approvals?status=&for_me=true
GET    /api/approvals/:id
POST   /api/approvals/:id/approve   { note }
POST   /api/approvals/:id/reject    { note }
POST   /api/approvals/batch         { ids[], action, note }   # 新增,批量审批
GET    /api/approvals/lark-card/:id # 用于详情页预览 Lark 卡片渲染
```

---

## 2. 离职归还(Offboarding Center)

**路径**:`/admin/offboarding`(**新增**)
**对应代码**:**无,需新建**

### 2.1 业务场景

PRD §8.4 提到「离职资产归还提醒」,但没单独设计模块。
实际痛点:**员工离职时,IT 不知道谁名下还有什么没还,容易资产流失**。

### 1.2 触发方式
两条来源汇合:
- **Lark 通讯录事件订阅**:`user.left` 事件 → 系统自动创建工单
- **HR 手工录入**:在系统内填写离职信息(过渡期 / 没接通 Lark 事件时用)

### 2.3 布局(双栏)

**左栏(360px):工单列表**
- 每张工单卡:头像 + 姓名 + 部门角色 + 状态徽章 + 归还进度条 + 距离离职天数

**右栏:工单详情**

1. **Hero**:大头像 + 编号 + 状态 + 离职原因 + 最后工作日 + **4 格价值汇总卡**(总价值 / 已回收 / 待归还 / 完成度)
2. **6 步 Checklist**(签名时刻):HR 触发 → 资产清单 → Lark 通知 → 资产归还 → IT 验收 → 工单关闭
3. **名下资产列表**:每条资产带状态 + 验收选项(确认归还 / 登记丢失)
4. **耗材记录参考**(不强制归还,只展示)
5. **Action Bar**:挂起 / 申请丢失核销 / 确认完成

### 2.4 6 步流程 Checklist(Signature) ⭐

**5 步圆点 + 4 条连线** 的横向进度,每步包含:
- 实心绿圆 + 白对勾(已完成)/ 空圆数字(未完成)
- 步骤名(已完成则深色加粗)
- Hint(如 `共 4 件 · ¥41,896`)
- 时间戳

步骤定义:
1. HR 离职流程触发(Lark 事件或手动)
2. 资产清单核对(系统自动从台账拉)
3. 通知员工归还(Lark 卡片)
4. 资产全部归还(全部 returned 或 lost 才完成)
5. IT 验收 & 资产入库
6. 工单关闭 · 通知 HR

### 2.5 关键状态枚举

**工单状态**:
- `in_progress` 进行中(蓝)
- `overdue` 已逾期(红)— 过了 lastDay 还有 return_pending 的资产
- `completed` 已完成(绿)

**资产状态**(item.status):
- `return_pending` 待归还
- `returned` 已归还(可补充 `condition: good/damaged`)
- `lost` 丢失登记(需财务核销)
- `consumed` 消耗品 · 不需归还(纯参考)

### 2.6 数据模型(后端待新增)

```python
# backend/app/modules/offboarding/models.py
class OffboardingCase(Base):
    id: str  # OFF-YYYY-####
    user_id: str
    last_day: date
    notified_at: datetime
    hr_channel: str  # 'lark_event:user.left' | 'manual'
    status: enum  # in_progress / overdue / completed
    reason: str
    assigned_it_id: str
    completed_at: datetime | None
    items: List[OffboardingItem]    # 一对多

class OffboardingItem(Base):
    case_id: FK
    asset_code: FK  # 关联资产
    snapshot_value: int     # 创建时的资产价值快照(避免后续报废后查不到)
    status: enum   # return_pending / returned / lost / consumed
    returned_at: datetime
    condition: enum  # good / damaged
    handler_id: str
    remark: str
```

### 2.7 后端接口(待加)

```
POST  /api/lark/webhook/user-left       # Lark 事件订阅入口
GET   /api/offboarding?status=
GET   /api/offboarding/:id
POST  /api/offboarding                   # 手工创建
POST  /api/offboarding/:id/items/:code/return   { condition, remark }
POST  /api/offboarding/:id/items/:code/lost     { remark }
POST  /api/offboarding/:id/remind        # 催办员工归还(Lark 卡片)
POST  /api/offboarding/:id/close         # 关闭工单
```

### 2.8 自动化逻辑

| 触发 | 系统行为 |
|---|---|
| Lark `user.left` 事件 | 1. 拉取员工名下所有 `in_use` 资产<br>2. 创建 `OffboardingCase` + items<br>3. Lark 卡片通知员工"请归还以下资产"<br>4. Lark 通知员工直属上级 |
| 每日 Celery 任务 | 扫描所有 `in_progress` 工单,如 `lastDay` 已过 + 仍有 `return_pending` → 标记为 `overdue`,Lark 推送 IT 管理员 |
| IT 点击「确认归还」 | item.status → returned,资产 status 从 `in_use` → `idle`,触发审计日志 |
| IT 点击「登记丢失」 | item.status → lost,资产 status 保持(等财务核销才 scrapped),触发审计 + 通知财务 |
| IT 点击「确认完成 · 关闭工单」 | 校验:所有 items 都不是 return_pending → case.status = completed,Lark 通知 HR |

### 2.9 与已有模块的关系

- 资产分配 / 归还接口 **复用** Phase 1 现有的(`POST /api/assets/:code/return`)
- 离职归还**不是新流程**,只是把多个 return 操作组织成一个 case 视角
- "登记丢失"会创建一个 `ScrapRequest`(reason="员工离职丢失")走财务核销

---

## 3. 视觉细节继承

两个新屏完全复用 Phase 1 + Phase 2 已有的视觉系统:
- **状态徽章** — Lark 风格小标签
- **审批节点** — 头像 + 徽标 + 状态环(报废处置已有)
- **横向 stepper** — 圆点 + 连线 + 状态色(资产生命周期、维修流转、报废流转一致)
- **进度条** — 4px 渐变彩条 + 安全线标记(库存物品已有)
- **Hero header** — 大图标 + 编号徽章 + 状态徽章 + 主标题 + 副信息

唯一新增的视觉模式:
- **Lark 卡片消息**(审批详情里) — 上窄下宽的圆角卡片 + 顶部机器人 header + 类型色块 + 操作按钮 + 送达回执
- **离职工单价值汇总**(4 格小卡) — 灰底 + 上标小字 + 大数字 + 色彩区分(可作为通用「数据汇总条」组件)

---

## 4. 给开发的实施清单

按优先级:

### P0
1. **审批中心整体重做** — `pages/Approvals.tsx` 按 §1 重写
2. **离职归还新模块** — 数据库迁移 + Router + Service + Page

### P1
3. **Lark 卡片预览组件** — 抽 `<LarkCardPreview>` 通用组件,后续报废、维修也能用
4. **Lark webhook 接收** — `lark/webhook.py` 加 `user.left` 处理
5. **Celery 任务** — 每日扫描逾期工单

### P2
6. **批量审批** — `POST /api/approvals/batch` 接口 + 前端浮条
7. **自动审批规则** — 部分场景(如耗材 ≤ 阈值)可配置自动通过

---

## 5. 验证清单

打开 `prototype/IT 资产管理 · 完整版.html`,左侧导航测试:
- [ ] 审批中心 → 5 张待我处理的卡片,有 SLA 进度条 / 逾期红边
- [ ] 点击一张卡片 → 抽屉打开,看到 Lark 卡片预览
- [ ] 离职归还 → 左侧 2 个进行中工单(胡涛 / 朱琳)
- [ ] 选中朱琳 → 右侧看到「已逾期」红色 banner + 2 件待归还
- [ ] Checklist 显示 3/6 步完成
