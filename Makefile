.DEFAULT_GOAL := help
COMPOSE := docker compose

.PHONY: help up down logs migrate makemigration seed test lint fmt backend-sh

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Start all services (db, redis, minio, backend, frontend)
	$(COMPOSE) up -d --build

down: ## Stop all services
	$(COMPOSE) down

logs: ## Tail logs
	$(COMPOSE) logs -f

migrate: ## Apply DB migrations
	$(COMPOSE) run --rm backend alembic upgrade head

makemigration: ## Autogenerate a migration: make makemigration m="message"
	$(COMPOSE) run --rm backend alembic revision --autogenerate -m "$(m)"

test: ## Run backend tests
	$(COMPOSE) run --rm backend pytest -q

lint: ## Lint backend (ruff) + frontend (eslint + tsc)
	$(COMPOSE) run --rm backend ruff check .
	$(COMPOSE) run --rm frontend npm run lint
	$(COMPOSE) run --rm frontend npm run typecheck

fmt: ## Format backend with ruff
	$(COMPOSE) run --rm backend ruff format .

backend-sh: ## Shell into backend container
	$(COMPOSE) run --rm backend bash
