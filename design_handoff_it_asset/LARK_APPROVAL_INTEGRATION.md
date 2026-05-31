# 飞书审批中心接入方案(设计稿,未实现)

> 目标:把员工的「领用申请」推成**飞书原生审批实例**,审批人在飞书工作台「审批」App 里处理;
> 我们系统**只读**镜像状态,不再承担"批不批"的交互。
>
> 决策(2026-05-31):**飞书为主、我们只读**。审批编排交给飞书(对齐 DEVELOPMENT_PLAN §9
> 「别自己造审批编排引擎」)。**仅"发放/扣库存"这一步仍在我们系统**,因为那是库存动作、飞书审批管不到。
>
> 现状基线:我们已自建审批(`approval_requests` 表 + 审批中心页 + 机器人**卡片消息** approve/reject 回调)。
> 本方案是把"审批决策"从我们这边迁到飞书审批 App;卡片消息流保留为**未配置时的回退**。

---

## 0. 一图流

```
员工在 /m 提交领用
   └─ 后端 create_request
        ├─(配了 LARK_APPROVAL_CODE)→ 调飞书「创建审批实例」→ 存 instance_code,本地 status=pending(镜像)
        │        └─ 审批人在飞书「审批」App 处理(同意/拒绝/转交/撤销)
        │               └─ 飞书推「审批实例状态变更」事件 → ws_client → 回写本地 status
        └─(没配)→ 走现有机器人卡片消息流(向后兼容)

本地 status=approved(飞书已通过) → IT 在我们系统点「发放」→ 扣库存 → status=fulfilled
```

我们的审批中心页变**只读**:展示状态 + 「去飞书审批」深链;去掉 通过/驳回/批量;**保留** IT「发放」。

---

## 1. 你需要在飞书后台做的事(阻塞项)

1. **开通审批应用权限(scope)**,并发布版本:
   - `approval:approval`(创建/管理审批实例)
   - 事件订阅:**审批实例状态变更**(approval instance event)
   - 应用「可用范围」覆盖会用到的部门。
2. **建一个审批定义(审批模板)** → 拿到 `approval_code`。建议表单控件:

   | 控件名 | 类型 | 对应我们的字段 |
   |---|---|---|
   | 申请类型 | 单选 | `request_type`(耗材/配件 · 固定资产) |
   | 物品明细 | 明细控件 或 多行文本 | `payload.items`(SKU 名 × 数量) |
   | 事由 | 多行文本 | `payload.reason` |
   | 紧急程度 | 单选 | `payload.urgency`(普通/加急) |
   | 交付方式 | 单选 | `payload.deliver_to` |

   审批流:**发起人直属上级 → (可选)IT 复核**。
3. **把这些给我**(实现时需要):
   - `approval_code`
   - 每个表单控件的 **control id + 类型**(创建实例时 form 要按控件 id 填值)
   - 是否要 IT 复核节点
   - 审批实例**深链 URL 格式**(用于"去飞书审批"按钮)

> ⚠️ 没有 `approval_code` + 控件 id,"创建实例"这步没法落地;在此之前一切自动走现有卡片流。

---

## 2. 飞书审批 v4 API(实现时对照官方文档确认精确字段)

- **创建实例**:`POST /open-apis/approval/v4/instances`
  body 关键:`approval_code`、`open_id`(发起人)、`form`(JSON 字符串,按控件 id 填值)、可选 `node_approver_open_id_list`(指定审批人=直属上级)。
  返回 `instance_code`。
- **查询实例**:`GET /open-apis/approval/v4/instances/{instance_code}` —— 用于事件漏发时的手动/定时对账。
- **撤销实例**:`POST /open-apis/approval/v4/instances/cancel` —— 若我们这边要支持撤回(可选)。
- **事件**:审批实例状态变更事件,经长连接(我们已有 `ws_client`)推送。SDK 注册方法名以当前 `lark-oapi` 版本为准(类似 `register_p2_approval_instance_xxx`);**防御式注册**(没有就跳过,沿用 user.deleted 的写法)。

---

## 3. 后端改动清单(本方案落地时)

- **config**:加 `lark_approval_code: str = ""` + 控件 id 映射(常量或配置)。空 → 走旧卡片流。
- **model**:`approval_requests` 加 `lark_instance_code: str | None`(独立于现有 `lark_message_id`)+ migration。
- **client**:`LarkClient.create_approval_instance(...)`、`get_approval_instance(...)`(no-op-safe)。
- **service.create_request**:配了 `approval_code` → 建飞书实例、存 `lark_instance_code`、本地 pending 镜像;否则现状不变。
- **事件回调**(新 service,如 `apply_instance_event`):按 `instance_code` 找本地 req → 映射状态回写。`ws_client` 注册审批事件 → 调它。
- **状态映射**:

  | 飞书审批实例 | 本地 `approval_requests.status` |
  |---|---|
  | PENDING | `pending` |
  | APPROVED | `approved`(待 IT 发放) |
  | REJECTED | `rejected` |
  | CANCELED | `rejected`(撤销) |
  | — IT 在我系统发放后 — | `fulfilled`(我们侧动作) |

- **只读化**:`approve`/`reject`/`batch` 端点在「飞书为主」模式下应**禁用或仅 sys_admin 兜底**(避免本地和飞书打架)。`fulfill` 保留。
- **对账兜底**:一个 Celery 任务定时拉取未决实例状态,补偿漏发的事件(可选,二期)。

## 4. 前端改动清单

- **审批中心页**:`pending`/`approved` 卡片去掉 通过/驳回/批量;改为状态展示 + **「去飞书审批」**深链按钮(用实例深链)。**保留** `approved` 的「发放」按钮(IT 环节)。
- 详情抽屉:Lark 卡片预览可保留(示意),但操作区换成"请在飞书审批中处理"。
- `/m` 员工端:提交后提示"已提交到飞书审批,请在飞书『审批』中跟进"。

---

## 5. 现实约束 / 风险

- **dev 无法 e2e**:需真实飞书租户 + 审批定义。代码 no-op-safe + 单测(mock Lark)为主,真验在配好 Lark 的环境。
- **一致性以飞书为准**:本地是镜像;事件漏发用查询 API 对账。撤销/转交/加签等飞书原生操作都会经事件回来,要覆盖到。
- **不可逆操作**:`fulfill` 扣库存只应在飞书 `APPROVED` 后允许;若飞书事后撤销 already-fulfilled 的单,需人工处理(本方案先不自动回滚库存)。
- **回退**:任何时候删掉 `LARK_APPROVAL_CODE` 即退回现有自审批卡片流,数据不丢。

---

## 6. 验收(配好 Lark 后)

1. 员工 `/m` 提交领用 → 飞书「审批」App 收到对应审批,表单字段正确。
2. 审批人在飞书点同意 → 我们审批中心该单变「待发放」(事件回写)。
3. IT 在我们系统点「发放」→ 扣库存、单变「已完成」。
4. 审批人在飞书拒绝/撤销 → 我们这边同步变「已驳回」。
5. 删除 `LARK_APPROVAL_CODE` → 新申请退回卡片消息流,旧实例不受影响。

---

## 7. 工作量预估(粗略)

- 后端骨架(client + create instance + 事件回写 + migration + 只读化 + 单测):中。
- 前端只读化 + 深链:小。
- **真实联调**:取决于飞书后台配置 + 权限审批速度(你那边),通常是主要不确定项。
