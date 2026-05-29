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

> 截至 2026-05。计划见 [`DEVELOPMENT_PLAN.md` §5](design_handoff_it_asset/DEVELOPMENT_PLAN.md);Phase 2/3 设计补充见同目录 `PHASE2_DESIGN.md` / `PHASE3_PREVIEW.md` / `MOBILE_ADMIN.md`。

**Phase 0 数据迁移** ✅ — 云文档/Excel 导入(容脏入库,脏数据进 `needs_review`)、`legacy_code`、报废候选标记、按类型前缀的编号 sequence。

**Phase 1 MVP** ✅ — 已完成:
- 用户/部门 + Lark 通讯录同步 + 免登(JSSDK)+ 密码登录 + 角色(employee/manager/it_admin/finance/procurement/sys_admin)
- 资产台账:CRUD、筛选/搜索/分页、详情抽屉(基本信息/生命周期/配件/附件)、分配/归还/转移/报修/报废、状态机、审计、QR、资产类型(含分类图标)
- 库存:SKU、入库、领用发放、流水、安全库存预警
- 审批流:员工端提交 + Lark 卡片消息 + webhook 回调
- 员工端 H5 `/m`、工作台 Dashboard、盘点(扫码确认)、审计日志

**Phase 2 流程化** 🟡 进行中:
- 后端全部就绪(维修工单状态机、报废财务审批、盘点、二维码标签 PDF);前端为功能性表格版
- ✅ 二维码标签前端(预览 + 布局选择)、移动管理台(首页 / 扫码资产详情 / 盘点列表 + 任务)
- ⬜ 视觉打磨版(盘点看板 / 维修漏斗+时间线 / 报废审批链 / 审计时间线);移动管理台审批列表、独立扫码屏、库存预警屏

**Phase 3 高级场景** ⬜ 未开始 — 审批中心重做(Lark 卡片预览 / 批量 / 自动审批)、离职归还(offboarding 模块 + `user.left` 事件)。
