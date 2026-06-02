# Lark / 飞书 登录(免登)接入指南

本系统的「使用 Lark 登录」走 Lark H5 **免登（requestAuthCode）** 流程，并兼容
国内飞书（`open.feishu.cn`）与海外 Lark（`open.larksuite.com`）——同一套代码靠
`LARK_VARIANT` 切换。本文档是换域名 / 换环境 / 排错时的对照清单。

> 邮箱密码登录（`POST /api/auth/login`）是不依赖 Lark 的兜底路径，`APP_DEBUG=false`
> 时它是唯一的非 Lark 登录方式。

---

## 1. 数据流一览

```
前端 (Login.tsx)                          后端 (/api/auth/*)                 Lark
─────────────────                         ──────────────────                ────
GET /auth/lark/config  ───────────────▶  返回 app_id/variant/jssdk_url
注入 <script src=jssdk_url>
h5sdk.ready()
  → tt.requestAuthCode({appId})  ─────────────────────────────────────────▶ 返回 code
POST /auth/lark/callback {code} ──────▶  exchange_login_code(code)
                                           ├─ get_app_access_token() ──────▶ app_access_token
                                           └─ POST authen/v1/access_token ─▶ 用户 profile
                                         upsert_user_from_lark(profile)
                                         签发本系统 JWT
        ◀──────────────────────────────  { token, user }
setAuth(token,user) → 按角色跳转(employee→/m，其余→/)
```

一句话：`app_id+secret → app_access_token`；前端 `requestAuthCode → code`；后端拿
`code + app_token` 换 `profile` → upsert 用户 → 发本系统 JWT。

---

## 2. 环境变量清单（后端 `.env`）

配置类无 `env_prefix`，字段名大写即环境变量名（大小写不敏感）。见 `backend/app/config.py`。

| 变量 | 必填 | 说明 |
|------|------|------|
| `LARK_VARIANT` | ✅ | `feishu`（国内）或 `lark`（国际）。决定 api_base / passport_base / JSSDK CDN |
| `LARK_APP_ID` | ✅ | 自建应用 App ID（`configured` 即据此判断） |
| `LARK_APP_SECRET` | ✅ | 自建应用 App Secret。**切勿入库 / 入代码 / 入记忆** |
| `LARK_JSSDK_URL` | — | 覆盖 JSSDK CDN，空则按 variant 取默认 |
| `LARK_API_BASE` | — | 覆盖 api_base，空则按 variant 取默认 |
| `LARK_PASSPORT_BASE` | — | 覆盖 passport_base，空则按 variant 取默认 |
| `LARK_ALERT_CHAT_ID` | — | 库存预警等机器人推送的群 id，空则跳过推送（与登录无关） |
| `LARK_VERIFICATION_TOKEN` | — | 事件订阅校验 token，生产必填（与登录无关，给 webhook 用） |
| `LARK_ENCRYPT_KEY` | — | 事件订阅加密 key（与登录无关） |
| `APP_DEBUG` | — | `true` 才开放 `/api/auth/dev-login` 调试登录；生产置 `false` |
| `PUBLIC_BASE_URL` | — | 部署公网地址，用于 QR 深链（与登录无关） |

变体默认端点（`config.py::_LARK_ENDPOINTS`）：

| | `feishu` | `lark` |
|------|------|------|
| api_base | `https://open.feishu.cn` | `https://open.larksuite.com` |
| JSSDK CDN | `…/goofy/lark/op/h5-js-sdk-1.5.36.js` | `…/goofy/ee/lark/h5jssdk/lark/js_sdk/h5-js-sdk-1.5.11.js` |

> ⚠️ 两个变体的 JSSDK **是不同构建**，不能混用——在 Lark 国际客户端里加载飞书那个
> `op` 构建，会让 `h5sdk.config` 永远报 errno 2601002「signature is expired」。

---

## 3. Lark 开发者后台配置清单

以部署域名 `https://assets.example.com`（SPA）为例。

1. **创建自建应用**，拿 `app_id` / `app_secret` 放进后端 `.env`。
2. **权限**：开通获取用户基本信息所需 scope（登录至少需 `contact:user.base:readonly`；
   通讯录同步另见 README 的权限批量 JSON）。
3. **网页 / URL 配置**（三个字段匹配规则不同，是踩坑重灾区）：
   | 字段 | 匹配规则 | 填什么 |
   |------|---------|--------|
   | 可信域名 | 按**域名**匹配（路径无关，管 JSSDK 能否加载） | `https://assets.example.com` |
   | 重定向 URL | 按**完整 URL 含路径精确匹配** | `https://assets.example.com/login` |
   | 网页能力 → 桌面端主页 | 入口直达 | `https://assets.example.com/login` |
4. **发布**：「创建版本 → 发布 / 设可用范围」后才生效；改完 URL 需**完全退出 Lark
   客户端再重开**。

> 免登实际发生在 SPA 的 `/login` 路由，所以重定向 URL 必须带 `/login` 路径；
> 只填裸域名会报 `invalid url` / **error code 10236**。

---

## 4. 后端代码位置

- `backend/app/config.py` — 变体端点矩阵 + 凭据 + 解析属性（`lark_jssdk_url_resolved` /
  `lark_api_base_url` / `lark_passport_base_url`）。
- `backend/app/lark/client.py`
  - `get_app_access_token()` → `auth/v3/app_access_token/internal`（**换登录码必须用它**）
  - `exchange_login_code(code)` → `POST /open-apis/authen/v1/access_token`
    （`grant_type=authorization_code`），返回 profile
  - `get_tenant_access_token()` / `get_jsapi_ticket()` — 通讯录 / 消息 / JSAPI 能力签名用
- `backend/app/modules/users/router.py`（前缀 `/api/auth`）
  - `GET /lark/config` — 返回**非密** `{app_id, variant, configured, jssdk_url}`
  - `POST /lark/callback {code}` — 换 profile → upsert → 签发 JWT
  - `GET /lark/jssdk-sign` — 给 `tt.scanCode` 等能力签名（**与登录无关**）
- `backend/app/modules/users/service.py::upsert_user_from_lark` — 按 `union_id → open_id`
  幂等匹配；Lark 是身份字段真相源，**角色 / 状态本地管理不动**；按 `department_ids` 关联部门。

---

## 5. 前端代码位置

- `frontend/src/pages/Login.tsx`
  - `loadJssdk(url)`：动态注入 `<script>`，去重 + 轮询 `window.h5sdk`
  - `larkLogin()`：拉 config → 载 JSSDK → `h5sdk.ready()` 内 `tt.requestAuthCode({appId})`
    → `POST /auth/lark/callback` → `setAuth` → 跳转
  - **自动免登**：UA 命中 `/Lark|Feishu/` 时 `useEffect` 自动跑；否则展示按钮
  - **诊断面板**：访问 `…/login?diag=1` 显示 `href/origin/ua/h5sdk/config`，排 10236 用
- `frontend/src/lark-jssdk.d.ts` — `window.h5sdk` / `window.tt` 的 TS 类型声明

---

## 6. 排错速查

| 现象 | 多半原因 | 处理 |
|------|---------|------|
| `invalid url` / **10236** | 重定向 URL 没含 `/login` 完整路径 | 把 `https://域名/login` 整条加进重定向 URL，重启 Lark 客户端 |
| JSSDK 加载失败 | 不在 Lark 客户端内打开，或可信域名没配 | 在 Lark 内打开；可信域名填裸域名 |
| `h5sdk.config` errno **2601002** signature is expired | ① 用错变体的 JSSDK 构建；② timestamp 单位；③ URL 不一致 | 核对 `LARK_VARIANT` 对应 CDN；签名 timestamp 用**毫秒**（见 router 注释）；签名 URL 用 `location.href.split('#')[0]` |
| 内网 HTTP 能否免登 | 可以 | Lark 客户端能访问 `IP:PORT` 且重定向 URL 配完整 `http://IP:PORT/login` 即可；`localhost` 不行 |
| 改了后台仍不生效 | 没发版本 / 客户端缓存 | 创建版本并发布；**完全退出** Lark 客户端重开 |

---

## 7. 换域名 / 换环境的最小步骤

1. 后端 `.env` 改 `LARK_VARIANT`（如需）；`LARK_APP_ID` / `LARK_APP_SECRET` 一般不变。
2. Lark 后台三处 URL（可信域名 / 重定向 URL `/login` / 桌面端主页）同步改为新域名。
3. 发布新版本 → 完全退出并重开 Lark 客户端。
4. 新域名 `…/login?diag=1` 自检：`config.configured=true`、`h5sdk=true`、`href` 与重定向 URL 一致。
