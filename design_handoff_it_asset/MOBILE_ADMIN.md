# 管理端移动版设计补充(Admin Mobile)

> 本文档配套 `prototype/IT 资产管理 · 完整版.html` 中的「管理端移动版」入口(左下角紫色卡片唤起)。
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

| # | 屏 | 路径 | 优先级 |
|---|---|---|---|
| M1 | 首页(今日待办)| `/m/admin` | P0 |
| M2 | 审批列表 | `/m/admin/approvals` | P0 |
| M3 | 审批详情底部抽屉 | `/m/admin/approvals/:id` | P0 |
| M4 | 扫码查询 | `/m/admin/scan` | P0 |
| M5 | 扫码结果详情 | `/m/admin/scan/:code` | P0 |
| M6 | 库存预警 | `/m/admin/lowstock` | P1 |
| M7 | 离职归还移动版(待补)| `/m/admin/offboarding` | P2 |

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
- [ ] 4 宫格快捷入口 + 紧急事项 + 系统概况 + 消息
- [ ] 底部 Tab,中间扫码按钮凸起为蓝色 FAB
- [ ] 点「审批」:看到 5 张待审批卡片,有 SLA 进度条
- [ ] 点任一卡片「一键通过」:卡片立刻变绿色成功态
- [ ] 点「详情」:从底部弹出 85% 高度的 Bottom Sheet
- [ ] 点「扫码」:看到扫码取景框 + 扫描线动画;等 2.5 秒后自动出结果
- [ ] 点「库存」:3 个预警 SKU 列表,每张可补货

---

完成。
