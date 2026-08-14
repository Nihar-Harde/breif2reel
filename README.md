# BrandCrew MVP (Week 1–2 Vertical Slice)

This monorepo implements the Week 1–2 MVP slice from the provided PRD/FRS/NFR/schema/API docs.

## Monorepo Structure

- `backend/` — FastAPI + SQLAlchemy + Alembic
- `frontend/` — React (Vite) + Tailwind
- `evaluation/` — Evaluation scaffold
- `infra/` — GitHub Actions cron + local run scripts + env examples

## Implemented Scope (Week 1–2)

- Campaign brief intake API (`POST /api/v1/campaigns`)
- Campaign generation trigger (`POST /api/v1/campaigns/{id}/generate`)
- Campaign detail (`GET /api/v1/campaigns/{id}`)
- Campaign list/filter (`GET /api/v1/campaigns?niche_id=&status=`)
- DB models + initial Alembic migration for:
  - `niches`
  - `accounts`
  - `campaigns`
  - `campaign_assets`
  - `traceability_records`
  - `post_history`
  - `brand_assets`
- Team API key auth (`Authorization: Bearer <TEAM_API_KEY>`) on write routes
- Standardized API error shape: `{ "error": { "code": "...", "message": "..." } }`
- Placeholder orchestrator status transitions: `draft -> generating -> needs_review`
- Seed script for niches:
  - Tech & Gadgets
  - Home & Kitchen
  - Fitness
- Frontend:
  - New Campaign page wired to backend
  - Review Queue page with niche/status filters
- Scheduler scaffold:
  - GitHub Actions cron calling backend `/api/v1/publish/run`

## Backend Setup

> Recommended Python: **3.11 or 3.12** (some AI/media dependencies do not yet provide wheels for Python 3.14).

1. Create and activate a virtual environment.
2. Install dependencies:
   ```powershell
   cd backend
   pip install -r requirements.txt
   ```
3. Copy env file:
   ```powershell
   Copy-Item .env.example .env
   ```
4. Run DB migrations:
   ```powershell
   alembic upgrade head
   ```
5. Seed default niches:
   ```powershell
   python -m app.seed
   ```
6. Run backend:
   ```powershell
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

## Frontend Setup

1. Install dependencies:
   ```powershell
   cd frontend
   npm install
   ```
2. Copy env file:
   ```powershell
   Copy-Item .env.example .env
   ```
3. Run frontend:
   ```powershell
   npm run dev
   ```

## Scheduler Setup (GitHub Actions)

Workflow file (active for GitHub Actions): `.github/workflows/publish-cron.yml`  
Infra copy: `infra/github/workflows/publish-cron.yml`

Configure repo secrets:
- `BACKEND_BASE_URL` (e.g. `https://your-backend-url.onrender.com`)
- `SCHEDULER_SECRET` (same value as backend `SCHEDULER_SECRET`)

## Notes

- External publishing APIs are intentionally not implemented yet; only interfaces/scaffolds are included.
- Retrieval and generation are scaffolded with placeholders to preserve extensibility for upcoming sprints.

