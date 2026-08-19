# Brief2Reel

Brief2Reel is an automated marketing engine that converts product briefs into publish-ready short-form video assets (Instagram Reels, Facebook Videos, YouTube Shorts). The system coordinates niche-specific retrieval (RAG), multi-agent LLM generation for copy and scripts, quality evaluation scoring, and automated publishing pipelines.

---

## Repository Structure

```
.
├── backend/                  # FastAPI backend service
│   ├── alembic/              # Database migration scripts
│   ├── app/
│   │   ├── agents/           # Copywriting & generation agents
│   │   ├── core/             # Configuration, auth, and error handling
│   │   ├── db/               # Database engine & session management
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── retrieval/        # Vector search & grounding retrieval
│   │   ├── routes/           # API endpoints (campaigns, niches, publishing)
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── services/         # Orchestrator & LLM provider integrations
│   │   ├── main.py           # FastAPI application entry point
│   │   └── seed.py           # Database seeder for default niches
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React SPA (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── pages/            # New Campaign & Review Queue views
│   │   ├── api.js            # API client wrapper
│   │   ├── App.jsx           # Router & layout
│   │   └── main.jsx          # Frontend entry point
│   └── package.json
├── requirments/              # System architecture, PRD, FRS, and specs
├── evaluation/               # Pipeline evaluation scripts
└── infra/                    # Deployment configs & runner scripts
```

---

## Current Implementation Status

### Backend & Core Pipeline
- **REST API (`FastAPI`)**: Complete CRUD and orchestration endpoints for campaigns, niches, and automated scheduler triggers.
- **Relational Data Layer (`PostgreSQL` + `SQLAlchemy 2.0` + `Alembic`)**: Full schemas and migrations for niches, accounts, campaigns, campaign assets, traceability records, brand guidelines, and post history.
- **Multi-Provider LLM Integration**:
  - Primary provider: **Groq** (`llama-3.3-70b-versatile`) with structured JSON output enforcement.
  - Fallback provider: **Google Gemini** (`gemini-1.5-flash`).
  - Offline deterministic fallback for local testing without active API keys.
- **Copywriter Agent**: Generates short-form marketing copy (captions, hashtags, 15–20s voiceover scripts, and text-to-image prompts) grounded in product briefs and brand guidelines.
- **Asynchronous Orchestrator**: Background pipeline managing campaign lifecycle (`draft` → `generating` → `needs_review`), grounding context injection, and logging critic evaluation scores (brand voice fit, claim accuracy, engagement heuristic).
- **Security & Error Handling**: Team Bearer token authentication on write endpoints, scheduler token validation for automated cron tasks, and uniform error formatting.

### Frontend Dashboard
- **Campaign Intake Form**: Form with live niche fetching, audience targeting, tone selection, campaign goals, and custom brand guidelines.
- **Review Queue**: Filterable campaign list (by niche and status) with detailed modal inspection showing generated captions, voiceover scripts, image prompts, and audit metrics.

### Automation & CI/CD
- **Scheduled Publishing Scaffold**: GitHub Actions cron workflow (`publish-cron.yml`) to invoke backend publishing triggers.
- **Local Run Scripts**: PowerShell launcher scripts under `infra/scripts/`.

---

## Prerequisites

- **Python**: `3.11` or `3.12` (Python 3.14 is currently not supported by some AI/media dependencies)
- **Node.js**: `18.x` or `20.x` (with `npm`)
- **PostgreSQL**: Local or hosted instance (e.g. Supabase, Neon, or local Postgres service)
- **API Keys (Optional but recommended)**:
  - Groq API Key (for Llama 3.3 70B generation)
  - Gemini API Key (for fallback generation)

---

## Local Setup Instructions

### 1. Database Setup

Create a PostgreSQL database for the project:

```sql
CREATE DATABASE breif2reel;
```

### 2. Backend Setup

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv .venv
     .venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your database credentials and API keys:
   ```ini
   DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/breif2reel
   TEAM_API_KEY=your-team-secret-key
   SCHEDULER_SECRET=your-scheduler-secret
   BACKEND_CORS_ORIGINS=http://localhost:5173
   GROQ_API_KEY=your-groq-api-key
   GEMINI_API_KEY=your-gemini-api-key
   ```

5. Apply database migrations:
   ```bash
   alembic upgrade head
   ```

6. Seed initial niches (*Tech & Gadgets, Home & Kitchen, Fitness*):
   ```bash
   python -m app.seed
   ```

7. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
   The backend API will be available at `http://127.0.0.1:8000`. Interactive API docs can be accessed at `http://127.0.0.1:8000/docs`.

---

### 3. Frontend Setup

1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Verify that `frontend/.env` matches your backend configuration:
   ```ini
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   VITE_TEAM_API_KEY=your-team-secret-key
   ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## API Reference Summary

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/niches` | List available campaign niches | No |
| `GET` | `/api/v1/campaigns` | List campaigns with optional `niche_id` and `status` filters | No |
| `GET` | `/api/v1/campaigns/{id}` | Get full campaign details including audit trace and critic scores | No |
| `POST` | `/api/v1/campaigns` | Create a new campaign brief | Yes (`Bearer <TEAM_API_KEY>`) |
| `POST` | `/api/v1/campaigns/{id}/generate` | Trigger async AI copy and script generation pipeline | Yes (`Bearer <TEAM_API_KEY>`) |
| `POST` | `/api/v1/publish/run` | Scheduled publishing runner endpoint | Yes (`X-Scheduler-Secret`) |

---

## Next Steps / Upcoming Milestones

- **Media Generation Pipeline**: Text-to-Speech audio rendering via `edge-tts` and image generation / video assembly via `moviepy`.
- **RAG Enhancement**: Populate ChromaDB embeddings with high-performing niche reels and competitor hooks.
- **Social Media Publishing**: Direct platform publishing integration (Instagram Graph API / Meta Graph API).
- **Automated Critic Feedback Loop**: Dynamic LLM-as-a-judge scoring instead of static heuristics before pushing to review queue.
