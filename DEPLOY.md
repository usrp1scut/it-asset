# 部署 / UAT 指南

针对**内网服务器、IP + HTTP** 的测试部署形态。前置:目标机器装好 Docker 和 compose v2,能 `git pull` 本仓库,内网用户能通过 IP 访问该机器的 `HTTP_PORT`(默认 8080)。

> 已知前提:Lark 免登服务端硬要求 https。本部署用 IP+HTTP,UAT 期间登录走 `dev-login`(输邮箱)。等接入 https 域名后,关掉 `APP_DEBUG`、把域名加进 Lark 后台 可信域名 / 重定向 URL,免登自动恢复——见末段「升级到 https」。

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

访问 `http://<服务器内网IP>:<HTTP_PORT>/`(默认 `http://x.x.x.x:8080/`)。登录页输邮箱,角色默认 employee;首个 IT 管理员可用接口直接造:

```bash
curl -X POST http://<IP>:<PORT>/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@yourco.com","name":"管理员","role":"it_admin"}'
```

返回的 token 可手动塞进浏览器 localStorage `it_asset_token`,或后续从登录页用同邮箱登录(已存在则复用账号)。

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

## 6. 升级到 https(免登恢复)

加 https 后,Lark 免登可用,可关 `dev-login`。最小改动:

1. 在 `nginx`(本 compose 内置那个)前面再放一层反向代理:**Caddy** 自动签证书最省事(只要域名 A 记录到该服务器、80/443 可达),或用你们已有的 nginx + 证书。
2. `.env` 中 `APP_DEBUG=false`、补齐 `LARK_APP_ID` / `LARK_APP_SECRET` / `LARK_VERIFICATION_TOKEN` / `LARK_ENCRYPT_KEY`。
3. Lark 开发者后台(对应 variant):
   - 网页能力 → 桌面端主页:`https://<your-domain>/login`
   - 安全设置 → H5 可信域名:`https://<your-domain>`(域名,不带路径/斜杠)
   - 安全设置 → 重定向 URL:`https://<your-domain>/login`(**完整路径精确匹配**,这是踩过的坑)
4. 完全退出 Lark 客户端重开,从工作台应用入口进。

## 7. 故障排查

| 现象 | 排查 |
|---|---|
| 浏览器打不开 | `docker compose -p it-asset-prod ps` 看 `frontend` 是否 `Up`;`curl -I http://localhost:${HTTP_PORT}` 在服务器本机自检;防火墙是否开了端口 |
| 页面打开但 `/api` 404 | 看 `backend` 日志、`alembic upgrade head` 是否成功 |
| 登录失败 | 确认 `APP_DEBUG=true`(无 https 阶段);后端日志看 401/500 |
| 附件上传 413 | nginx `client_max_body_size` 已设 16M,超大文件先压缩 |
| `worker` / `lark-ws` 反复重启 | `docker compose -p it-asset-prod logs lark-ws` 看是不是 `LARK_*` 凭据空 |
