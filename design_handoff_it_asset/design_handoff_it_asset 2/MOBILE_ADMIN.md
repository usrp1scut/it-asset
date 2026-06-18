# 管理端移动版设计补充(Admin Mobile)

> 本文档配套 `prototype/IT 资产管理 · 完整版.html` 中的「管理端移动版」入口(左下角紫色卡片唤起)。
>
> **更新历史**:
> - v0.4 初版:首页 / 审批 / 扫码 / 库存(M1-M6 共 5 屏)
> - **v0.5 扩展**:加 **维修工单 / 离职归还 / Lark 消息**(M7-M9)
>
> PRD §13 原本只要求**员工侧**移动适配。但实际 IT 管理员高频痛点:出差/路上/不在工位时需要快速处理审批和扫码查资产 — 全屏 Web 后台不可用。本设计为 IT 管理员补充**轻量移动版**,覆盖**高频移动场景**,不追求功能完整。

---

## 1. 设计理念

### 1.1 不做什么
- **不做** Web 后台的简单响应式收缩(sidebar 折叠后表格仍然没法用)
- **不做** 复杂数据录入(新增资产、批量导入等仍需 PC)
- **不做** 完整图表 / 报表

### 1.2 做什么(IT 管理员移动版的 5 个高频场景)
1. **扫码查资产**(贴近场景:在仓库/客户现场需要快速核对资产归属)
2. **审批处理**(贴近场景:地铁上、午休、客户拜访间隙)
3. **库存预警快速看**(贴近场景:被员工催"什么时候有货"时即时回答)
4. **紧急事项推送**(贴近场景:逾期工单、维修异常)
5. **离职归还跟踪**(贴近场景:HR 临时通知某员工今天最后一天)

---

## 2. 屏幕清单

| # | 屏 | 路径 | 优先级 | 状态 |
|---|---|---|---|---|
| M1 | 首页(今日待办)| `/m/admin` | P0 | ✅ 已设计 |
| M2 | 审批列表 | `/m/admin/approvals` | P0 | ✅ 已设计 |
| M3 | 审批详情底部抽屉 | `/m/admin/approvals/:id` | P0 | ✅ 已设计 |
| M4 | 扫码查询 | `/m/admin/scan` | P0 | ✅ 已设计 |
| M5 | 扫码结果详情 | `/m/admin/scan/:code` | P0 | ✅ 已设计 |
| M6 | 库存预警 | `/m/admin/lowstock` | P1 | ✅ 已设计 |
| **M7** | **维修工单 + 详情底部抽屉** | `/m/admin/repair` | **P1** | ✅ **v0.5 新增** |
| **M8** | **离职归还 + 详情底部抽屉** | `/m/admin/offboarding` | **P1** | ✅ **v0.5 新增** |
| **M9** | **Lark 消息预览**(机器人卡片汇总)| `/m/admin/messages` | **P2** | ✅ **v0.5 新增** |

---

## 3. 关键设计决策

### 3.1 深色 Hero — 区分员工端

员工端 H5 用蓝色 Hero(品牌亲和)。管理端移动版用**深色 Hero**(`#1F2329 → #2E3440`),视觉上区分:这是"权限更高"的视图。右上角标 `ADMIN` 紫色徽标强化角色。

### 3.2 底部 Tab — 中间凸起的扫码按钮(签名时刻)⭐

5 个 Tab,中间「扫码」是**凸起 floating action button**(48×48 蓝色渐变圆,3px 白边,阴影):
```
首页    审批    [扫码]   库存    我的
```
这是 IT 管理员最高频的移动操作 — 给它最显眼的位置。

### 3.3 紧急事项卡片堆叠

首页第三屏是"🔥 紧急事项",直接列出 1-2 张**逾期审批**的卡片(红边 + 红色外发光),管理员可一眼判断要不要立即处理。

### 3.4 一键通过 + 详情双轨

审批卡片底部 3 个按钮:
- 「驳回」(白色边框,左)
- 「详情」(灰色窄按钮,中)— 查看完整信息
- **「一键通过」**(蓝色主按钮,右,宽)— 默认意见为空直接同意,适合标准化场景

这个组合让"看到就能处理"和"需要慎重看完再决定"两种心智都顺畅。

### 3.5 操作后乐观反馈

点击「一键通过」或「驳回」后,卡片**立即变为成功/驳回态**(绿色或红色背景 + 状态文字),并提供「撤销」选项 — 不强制弹窗确认,避免移动场景下多余的点击。

### 3.6 底部抽屉(Bottom Sheet)而非 Drawer

详情打开的是**底部抽屉**(从下往上 slide-up),高度 85% — 这是移动惯例。
顶部留一个灰色拖动条,可下拉关闭。

### 3.7 扫码屏的视觉

模拟摄像头取景:
- 黑色背景 + 中央取景框(240×240,4 个蓝色 L 形角标)
- 蓝色横向扫描线**上下来回动画**(2s)
- 底部 Hint:"对准资产标签二维码"
- 底部工具栏:手输编号 / 从相册选

扫码成功后:
- 顶部绿色成功 banner
- 资产卡片(基本信息 + 责任人 + 关键日期)
- 主要动作按钮:确认盘点 / 报修 / 查看完整详情 / 继续扫码

---

## 4. 数据契约

复用 Web 后台同一套接口,前端只换 UI:

| 接口 | 用途 |
|---|---|
| `GET /api/dashboard/overview` | 首页统计 |
| `GET /api/approvals?for_me=true&status=pending` | 审批列表 |
| `POST /api/approvals/:id/approve` | 一键通过 |
| `POST /api/approvals/:id/reject` | 驳回 |
| `GET /api/assets/:code` | 扫码后查资产 |
| `GET /api/skus?warning_only=true` | 库存预警 |
| `GET /api/notifications?role=it_admin` | 消息列表 |

---

## 5. 视觉令牌差异

延续 Phase 1 全部 token,但有 3 处特殊处理:

```css
/* Admin Mobile 专属 */
--admin-hero-bg: linear-gradient(180deg, #1F2329 0%, #2E3440 100%);
--admin-role-tag-bg: rgba(51,112,255,0.25);
--admin-role-tag-color: #9DC1FF;

/* Floating action button (扫码) */
--fab-shadow: 0 4px 14px rgba(51,112,255,0.4);
--fab-border: 3px solid #fff;

/* Bottom sheet drag handle */
--sheet-handle: #E5E6EB (4px height, 36px wide, 2px radius)
```

字号比 Web 大一档(移动可读性):
- 正文 13 → 12-13
- 标题 16-18(导航/卡片) → 14-16
- 大数字 32(Hero KPI)

---

## 6. 实施路线

### Phase 1 实施(P0 — 必须):
1. 在 `frontend/src/` 新建 `pages/mobile/admin/`
2. 路由 `/m/admin/*`,**复用同一份后端 API**
3. 按 React Router 嵌套路由设计:
   ```
   /m/admin              → MobileAdminHome
   /m/admin/approvals    → MobileAdminApprovals (list)
   /m/admin/approvals/:id → 弹出底部 Drawer
   /m/admin/scan         → MobileAdminScan
   /m/admin/scan/:code   → MobileAdminScanResult (route OR overlay)
   /m/admin/lowstock     → MobileAdminLowStock
   ```
4. **环境检测**:在 `AppLayout.tsx` 顶层根据 `window.innerWidth < 768` + 用户角色 = `it_admin` 自动重定向到 `/m/admin`;PC 上访问 `/m/admin` 也允许(用于演示/调试)
5. 顶层使用 `viewport` meta + `100dvh` 适配 Lark 内嵌 webview

### Phase 2 增强(P1):
6. 维修工单 mobile 视图(SLA 进度条 + 状态切换)
7. 离职归还 mobile 视图(卡片化每个 case + 滑动操作)
8. **Lark 卡片消息深链接** — 卡片上的"查看详情"直接打开 Lark H5 对应页

### Phase 3(P2):
9. 离线缓存(常用资产清单,断网仍能查)
10. 推送通知(Lark 卡片之外,可选直接推 iOS 通知)

---

## 7. 给开发的注意

- ⚠️ **不要**直接把现有 PC 页面包一层手机壳就上线,所有屏都要按移动重新设计
- ⚠️ **不要**用 Ant Design 桌面组件填充移动屏 — Ant Design Mobile / vant 等专用组件库,或者直接手写
- ✅ **要**沿用同一套 Design Tokens(`styles/tokens.css`)
- ✅ **要**在路由层做权限校验:`/m/admin/*` 必须 `role >= it_admin`
- ✅ **要**所有点击区域 ≥ 44×44(iOS HIG)

---

## 8. 验收清单

打开 `prototype/IT 资产管理 · 完整版.html` 左侧底部点「管理端移动版」:

- [ ] 首页:顶部深色 Hero,显示"待办 N 项"和逾期红标
- [ ] **2×4 宫格快捷入口**(扫码/审批/维修/库存预警/离职/Lark/盘点/更多)+ 紧急事项 + 系统概况 + 消息
- [ ] 底部 Tab,中间扫码按钮凸起为蓝色 FAB
- [ ] 点「审批」:看到 5 张待审批卡片,有 SLA 进度条
- [ ] 点任一卡片「一键通过」:卡片立刻变绿色成功态
- [ ] 点「详情」:从底部弹出 85% 高度的 Bottom Sheet
- [ ] 点「扫码」:看到扫码取景框 + 扫描线动画;等 2.5 秒后自动出结果
- [ ] 点「库存」:3 个预警 SKU 列表,每张可补货
- [ ] **点「维修」:看到 2 张进行中工单,带 5 段进度条 + 延期红标;点开抽屉看时间线**
- [ ] **点「离职」:看到 2 个进行中工单(胡涛 / 朱琳),含进度环 + mini 资产列表**
- [ ] **点「Lark 消息」:模拟收到 4 条机器人消息卡片(审批 / 库存预警 / 维修完成 / 离职提醒)**

---

## 9. v0.5 新增屏的设计要点

### M7 维修工单 Mobile

- **筛选 chip**:进行中 / 已延期(红) / 已完结
- **卡片关键信息**:资产卡片(类型图标 + 编号 + 状态 + 保修内徽章 + 延期红标)+ 报修原因 2 行截断 + **5 段进度条**(当前阶段着色)+ 服务方/预计返还
- **延期标红**:卡片整体红色阴影 + 文字明确显示"已延期 N 天"
- **底部抽屉详情**:Hero + 问题描述黄色卡片 + **完整时间线**(当前节点带光晕)+ Meta 信息 + 「更新进度 / 推进到下一步」操作

### M8 离职归还 Mobile

- **签名视觉**:头像 + **同心圆进度环**(完成度可视化)
- **倒计时标记**:今天最后一天 / N 天后离职 / 已离职 N 天(色彩区分)
- **Mini 资产列表**:卡片内嵌 3 项,每项一行(状态点 + 名称 + 标签),超过 3 项显示"还有 N 件"
- **快捷操作**:催办(白) + 扫码验收(蓝)
- **底部抽屉**:3 格价值汇总(总价值 / 已回收 / 待归还)+ **每件资产可单独操作**(确认归还 / 登记丢失)+ 全部归还后才能关闭工单

### M9 Lark 消息预览

- 这是设计上的**演示用屏**,实际生产里这就是 Lark 原生 IM,**前端不需要重新实现 Lark UI**
- 但保留这个屏的设计目的:**让产品/开发对齐 Lark 卡片消息的样式**,确保后端 `lark/messenger.py` 生成的卡片符合视觉规范
- 4 种典型卡片样式:**审批待办 / 库存预警 / 维修完成 / 离职提醒**
- 卡片结构:类型色 Header + 标题 + 字段表(50px 标签宽度)+ 操作按钮组(2-3 个,主按钮蓝色填充)
- 卡片高度受 Lark 移动端约束,**字段最多 3-4 行,事由用 line-clamp:2**

---

## 10. 后端配套(`lark/messenger.py` 接口)

```python
class LarkCardMessenger:
    def send_approval_card(self, approval_id: str, to_user_id: str) -> str:
        """发送审批待办卡片,返回 lark_message_id"""

    def send_lowstock_alert(self, sku: SKU, to_role: str = 'it_admin') -> str:
        """库存预警 → 推送给 IT 管理员群"""

    def send_repair_complete(self, order: RepairOrder) -> str:
        """维修完成通知 → 推送给报修人 + IT 管理员"""

    def send_offboarding_reminder(self, case: OffboardingCase) -> str:
        """离职提醒 → 推送给员工 + 主管 + IT"""
```

每个方法生成符合本文档 §9 M9 设计样式的 Lark 卡片 JSON,通过 `https://open.feishu.cn/open-apis/im/v1/messages` 发送。

完成。
