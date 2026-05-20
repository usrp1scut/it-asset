# 部署 / UAT 指南

针对**内网服务器、IP + HTTP** 的测试部署形态。前置:目标机器装好 Docker 和 compose v2,能 `git pull` 本仓库,内网用户能通过 IP 访问该机器的 `HTTP_PORT`(默认 8080)。

> 登录方式:
> - **密码登录**:`.env` 里设 `INITIAL_ADMIN_EMAIL` + `INITIAL_ADMIN_PASSWORD`,首次启动后端会自动建出这个 IT 管理员(幂等)。
> - **Lark 免登**:内网 HTTP 也可用——Lark 客户端能访问该 IP、且 Lark 开发者后台「重定向 URL」配为 `http://<IP>:<PORT>/login`(完整路径精确匹配)即可。需在 `.env` 填齐 `LARK_APP_ID/SECRET` 等。
>
> **生产 `.env` 中 `APP_DEBUG` 必须 `false`** —— `true` 会重新打开 `/api/auth/dev-login` 那条"任填邮箱即登录"的调试路径。

---

## 1. 首次部署

```bash
# 在测试服务器上
git clone https://github.com/usrp1scut/it-asset.git
cd it-asset
cp .env.prod.example .env
# 编辑 .env:至少改 POSTGRES_PASSWORD、S3_ACCESS_KEY、S3_SECRET_KEY、JWT_SECRET、HTTP_PORT
# 改完后保持 .env 仅本机持有(已在 .gitignore 中)
```

生成强 JWT_SECRET 的快捷命令:

```bash
python -c "import secrets;print(secrets.token_urlsafe(48))"
```

启动:

```bash
docker compose -f docker-compose.prod.yml -p it-asset-prod --env-file .env up -d --build
```

后端容器首次启动会自动 `alembic upgrade head` 建表。状态查看:

```bash
docker compose -p it-asset-prod ps
docker compose -p it-asset-prod logs -f backend frontend
```

访问 `http://<服务器内网IP>:<HTTP_PORT>/`(默认 `http://x.x.x.x:8080/`)。

登录页输入 `.env` 里设的 `INITIAL_ADMIN_EMAIL` + `INITIAL_ADMIN_PASSWORD` 即可,该账号是 IT 管理员。**首次登录后立即改密码**(后续可通过 `POST /api/auth/change-password` 或后续提供的 UI 修改)。

```bash
# 改密码示例(也可在前端改)
TOKEN=$(curl -s -XPOST http://<IP>:<PORT>/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"<EMAIL>","password":"<INITIAL>"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -XPOST http://<IP>:<PORT>/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"old_password":"<INITIAL>","new_password":"<新密码,至少 8 位>"}'
```

其他员工通过 Lark 免登(若已配)或由管理员在「用户管理」页授予角色后再登录。

## 2. (可选)灌入 demo 演示数据

```bash
docker compose -p it-asset-prod exec backend python -m app.seed_demo
```

**会清空业务表**——首次空库时方便业务方有数据可试;一旦有真实数据就不要再跑。

## 3. 日常运维

| 操作 | 命令 |
|---|---|
| 查容器状态 | `docker compose -p it-asset-prod ps` |
| 查后端/前端/worker 日志 | `docker compose -p it-asset-prod logs -f backend` (按需替换服务名) |
| 进容器 | `docker compose -p it-asset-prod exec backend sh` |
| 手动跑迁移 | `docker compose -p it-asset-prod exec backend alembic upgrade head`(平时由入口脚本自动) |
| 重启某服务 | `docker compose -p it-asset-prod restart backend` |
| 停止全部(保留数据) | `docker compose -p it-asset-prod down` |
| 销毁含数据 | `docker compose -p it-asset-prod down -v` (谨慎!会删 pgdata/miniodata 卷) |

## 4. 更新部署

```bash
cd it-asset
git pull
docker compose -f docker-compose.prod.yml -p it-asset-prod --env-file .env up -d --build
```

后端入口会自动跑 `alembic upgrade head`,无需手动迁移。

## 5. 备份

数据全部落在两个命名卷里:

- `it-asset-prod_pgdata`(Postgres)
- `it-asset-prod_miniodata`(对象存储 / 附件)

简单备份:

```bash
docker run --rm -v it-asset-prod_pgdata:/v -v $PWD:/out alpine \
  tar czf /out/pgdata-$(date +%F).tgz -C /v .
docker run --rm -v it-asset-prod_miniodata:/v -v $PWD:/out alpine \
  tar czf /out/miniodata-$(date +%F).tgz -C /v .
```

或在 Postgres 容器内用 `pg_dump`,任选其一。

## 6. Lark 免登配置(内网 HTTP 同样适用)

填齐 `.env` 里的 `LARK_APP_ID/SECRET`,然后到 Lark 开发者后台(对应 variant):

- 网页能力 → 桌面端主页:`http://<内网IP>:<HTTP_PORT>/login`
- 安全设置 → H5 可信域名:`http://<内网IP>:<HTTP_PORT>`(只到端口,不带路径/斜杠)
- 安全设置 → 重定向 URL:`http://<内网IP>:<HTTP_PORT>/login`(**完整路径精确匹配**,这是踩过的坑)

完全退出 Lark 客户端重开,从工作台应用入口进。改完上面三个字段任意一个都要重启客户端。

> 如果将来接入 https(对外或希望统一加密),在本 compose 前面再叠一层反向代理(Caddy 自动签证书最省事),然后把上面三个 URL 改成 https 域名版本即可——其余不变。

## 7. 故障排查

| 现象 | 排查 |
|---|---|
| 浏览器打不开 | `docker compose -p it-asset-prod ps` 看 `frontend` 是否 `Up`;`curl -I http://localhost:${HTTP_PORT}` 在服务器本机自检;防火墙是否开了端口 |
| 页面打开但 `/api` 404 | 看 `backend` 日志、`alembic upgrade head` 是否成功 |
| 登录失败 | 确认 `INITIAL_ADMIN_EMAIL/PASSWORD` 设了;首次启动后端日志会显示是否新建了 admin;后端 401 看密码、500 看异常 |
| 附件上传 413 | nginx `client_max_body_size` 已设 16M,超大文件先压缩 |
| `worker` / `lark-ws` 反复重启 | `docker compose -p it-asset-prod logs lark-ws` 看是不是 `LARK_*` 凭据空 |
