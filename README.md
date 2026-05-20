# 资产与耗材管理系统

基于 Lark/飞书的轻量资产与耗材库存管理系统。管理端 Web 后台 + 员工端 Lark H5。

> **设计与需求文档**(唯一基准 = PRD v0.2):
> - 业务需求:[`design_handoff_it_asset/PRD.md`](design_handoff_it_asset/PRD.md)
> - 设计规格 / 屏幕 / Design Tokens:[`design_handoff_it_asset/README.md`](design_handoff_it_asset/README.md)
> - 开发计划 / Sprint / 技术栈:[`design_handoff_it_asset/DEVELOPMENT_PLAN.md`](design_handoff_it_asset/DEVELOPMENT_PLAN.md)
> - 高保真原型(仅视觉/交互参考,不进生产):`design_handoff_it_asset/prototype/`

## 技术栈

- **后端**:Python 3.11 · FastAPI · SQLAlchemy 2.0 · Alembic · Celery · PostgreSQL 16 · Redis 7
- **前端**:TypeScript 5 · React 18 · Vite · Ant Design 5 · TanStack Query · Zustand
- **基建**:Docker Compose(开发)· MinIO(对象存储)

## 快速开始

前置:Docker + Docker Compose。

```bash
cp .env.example .env          # 按需修改配置(Lark app_id/secret 等)
make up                       # 起 postgres + redis + minio + backend + frontend
make migrate                  # 跑数据库迁移
```

启动后:

| 服务 | 地址 |
|---|---|
| 后端 API | http://localhost:8000 |
| API 文档 (OpenAPI) | http://localhost:8000/docs |
| 健康检查 | http://localhost:8000/health |
| 前端 | http://localhost:5173 |

常用命令见 `make help`。

## 目录结构

```
it-asset/
├── backend/                  FastAPI + SQLAlchemy + Alembic
├── frontend/                 Vite + React + TS + Ant Design
├── design_handoff_it_asset/  设计/需求/计划/原型(基准文档)
├── docker-compose.yml        本地开发编排
├── .env.example              配置示例
└── Makefile                  make up / migrate / test / lint
```

## 开发状态

Phase 1 MVP 开发中。进度见 [`DEVELOPMENT_PLAN.md` §5](design_handoff_it_asset/DEVELOPMENT_PLAN.md)。当前:**Sprint 0 — 项目骨架**。
