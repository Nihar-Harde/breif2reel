# Brief2Reel

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12-blue?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_Store-FF6F00)](https://www.trychroma.com/)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-F05A28)](https://groq.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash_%7C_Imagen_3-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Brief2Reel** is an autonomous, full-stack marketing engine that converts structured product briefs into publish-ready **9:16 vertical short-form video reels** (Instagram Reels, YouTube Shorts). The platform couples **niche-scoped vector retrieval (RAG)**, an orchestrated **multi-agent generation loop with automated critic feedback (LLM-as-a-judge)**, dynamic audio-visual compositing, and automated multi-platform publishing.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Core Features & Engineering Highlights](#core-features--engineering-highlights)
- [Role of Google Gemini in the Architecture](#role-of-google-gemini-in-the-architecture)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Evaluation & Benchmark Telemetry](#evaluation--benchmark-telemetry)
- [Local Setup & Quickstart Guide](#local-setup--quickstart-guide)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Database Initialization](#2-database-initialization)
  - [3. Backend Configuration & Launch](#3-backend-configuration--launch)
  - [4. Frontend Studio Configuration & Launch](#4-frontend-studio-configuration--launch)
  - [5. Verification & Diagnostic Tests](#5-verification--diagnostic-tests)
  - [6. Automated Pipeline Evaluation](#6-automated-pipeline-evaluation)
- [API Reference Summary](#api-reference-summary)
- [System Specifications & Documentation](#system-specifications--documentation)
- [License](#license)

---

## System Architecture

<p align="center">
  <img src="docs/assets/architecture.jpg" alt="Brief2Reel System Architecture" width="100%" />
</p>

<details>
<summary><b>Click to expand Architectural Component Mapping (A &ndash; Q) &amp; Mermaid Specification</b></summary>

<br>

| Node | Architecture Component | Responsibility |
| :---: | :--- | :--- |
| **A** | **Operator Intake / React 18 Studio** | Structured brief intake with niche targeting, audience, tone, and brand document upload |
| **B** | **FastAPI Backend Engine** | REST API gateway, authentication middleware, and orchestration router |
| **C** | **Campaign Orchestrator** | Asynchronous state machine sequencing context retrieval, multi-agent generation, and persistence |
| **D** | **ChromaDB Vector Store** | Isolated per-niche vector collections using `all-MiniLM-L6-v2` embeddings |
| **E** | **Brand Guidelines / PDFs** | Automated document ingestion and chunking for zero-hallucination grounding |
| **F** | **Past Post Indexer** | Semantic anti-repetition guard measuring cosine distance against historical posts |
| **G** | **Copywriter Agent** | Structured marketing copy, hooks, and scene descriptions (Groq Llama 3.3 / Gemini fallback) |
| **H** | **Design Agent** | 9:16 portrait product visual generation via Gemini Imagen (`imagen-3.0-generate-002`) |
| **I** | **Audio Agent** | Voiceover audio synthesis mapped to tone profiles via Microsoft Edge-TTS |
| **J** | **Video Agent & Compositor** | Kinetic motion rendering, dynamic subtitle synchronization, and audio mixing |
| **K** | **Critic Agent (LLM-as-a-Judge)** | 5-dimension quality scoring rubric with stored written justifications |
| **L** | **PostgreSQL DB** | Relational state store for campaigns, assets, audit traces, and post history |
| **M** | **Review Queue & 9:16 Player** | Operator review studio with vertical video playback and traceability inspection |
| **N** | **Publishing Dispatcher** | Multi-platform publishing router with retry handling and media cleanup |
| **O** | **Cloudinary CDN** | Temporary media transcoding and public CDN hosting |
| **P** | **Instagram Reels** | Direct container creation and publishing via Meta Graph API |
| **Q** | **YouTube Shorts** | Resumable video upload via YouTube Data API v3 |

```mermaid
graph TD
    A[Operator Intake / React 18 Studio] -->|POST /api/v1/campaigns| B[FastAPI Backend Engine]
    B -->|Async Pipeline Trigger| C[Campaign Orchestrator]

    subgraph RAG & Knowledge Layer
        D[(ChromaDB Vector Store)] -->|Niche Collections| C
        E[Brand Guidelines / PDFs] -->|PyMuPDF + all-MiniLM-L6-v2| D
        F[Past Post Indexer] -->|Cosine Distance Guard| D
    end

    subgraph Multi-Agent Generation Pipeline
        C -->|1. Context Retrieval| D
        C -->|2. Structured Copy & Prompts| G[Copywriter Agent\nGroq Llama 3.3 / Gemini Fallback]
        G -->|Anti-Repetition Check| F
        C -->|3. 9:16 Visual Generation| H[Design Agent\nGemini Imagen 3.0 / Pollinations]
        C -->|4. Voiceover Audio Synthesis| I[Audio Agent\nMicrosoft Edge-TTS]
        C -->|5. Motion Video & Subtitles| J[Video Agent & Compositor\nMoviePy / FFmpeg / Cloud GPU]
        C -->|6. Quality Gate Assessment| K[Critic Agent\nLLM-as-a-Judge Rubric]
    end

    K -->|Audit Trace & Dimension Scores| L[(PostgreSQL DB)]
    C -->|Status: needs_review| M[Review Queue & 9:16 Player]
    M -->|Operator Approval| N[Publishing Dispatcher]

    subgraph Multi-Platform Publishing
        N -->|Media Upload| O[Cloudinary CDN]
        N -->|Graph API Container & Publish| P[Instagram Reels]
        N -->|Data API v3 Resumable Upload| Q[YouTube Shorts]
    end
```

</details>

---

## Core Features & Engineering Highlights

### 1. Niche-Scoped Vector Retrieval (RAG)
- **Isolated Collections**: Persistent vector store powered by **ChromaDB** with `sentence-transformers` (`all-MiniLM-L6-v2`), partitioned into dedicated collections per niche account (e.g., *Tech & Gadgets*, *Home & Kitchen*, *Fitness*).
- **Document Ingestion**: Automated PDF and raw text extraction ([`ingestion.py`](backend/app/retrieval/ingestion.py)) enabling brand guidelines, tone rules, and product spec sheets to be chunked, embedded, and injected as grounding context to prevent hallucinations.

### 2. Semantic Anti-Repetition Guard
- **Past-Post Memory**: Published captions and scripts are automatically embedded into a past-post index.
- **Cosine Distance Guard**: Before passing generated copy downstream, the system computes the maximum cosine similarity against historical posts. If similarity exceeds **0.85**, the Copywriter Agent is automatically re-prompted with negative constraint directives to ensure fresh, novel content.

### 3. Orchestrated Multi-Agent Generation Loop
- **Copywriter Agent** ([`copywriter.py`](backend/app/agents/copywriter.py)): Generates structured JSON marketing assets (hook, caption, hashtags, 15–20s voiceover script, image prompt, and video scene direction) grounded in retrieved context.
- **Critic / QA Agent (LLM-as-a-Judge)** ([`critic_agent.py`](backend/app/agents/critic_agent.py)): Enforces automated quality scoring across 5 rubric dimensions before review routing:
  - `brand_voice_fit` (30% weight) — conformity with brand guidelines and tone parameters.
  - `claim_accuracy` (25% weight) — strict verification that claims are grounded in retrieved context without hallucination.
  - `caption_quality` (25% weight) — hook punchiness, length, and CTA clarity.
  - `engagement_heuristic` (20% weight) — scroll-stopping potential for vertical video formats.
  - `overall` — weighted composite score with individual written justifications stored in `TraceabilityRecord`.
- **Design Agent** ([`design_agent.py`](backend/app/agents/design_agent.py)): Produces high-resolution 9:16 vertical product visuals using **Google Gemini Imagen** (`imagen-3.0-generate-002` / `gemini-2.0-flash`) with Pollinations.ai fallback.
- **Audio Agent** ([`audio_agent.py`](backend/app/agents/audio_agent.py)): Synthesizes natural voiceovers via Microsoft `edge-tts` mapped to custom campaign tone presets (`playful`, `bold`, `minimal`, etc.).
- **Video Agent & Compositor** ([`video_agent.py`](backend/app/agents/video_agent.py), [`video_compositor.py`](backend/app/agents/video_compositor.py)): Implements a prioritized generation chain:
  1. *Azure Container Apps Serverless GPU* (`LTX-Video Pro` DiT model on A100 / T4).
  2. *Hugging Face Space* (Wan 2.1 on ZeroGPU) / *Google Colab API*.
  3. *Local Cinematic Motion Engine* (MoviePy / FFmpeg Ken-Burns kinetic pan-and-zoom, dynamic subtitle synchronization, and audio ducking).

### 4. Direct Multi-Platform Publishing Dispatcher
- **Meta Graph API**: Two-phase container creation (`POST /{ig-user-id}/media`) and automated publication for Instagram Reels.
- **YouTube Data API v3**: Direct resumable upload pipeline targeting YouTube Shorts.
- **Cloudinary CDN**: Automated intermediate media transcoding, hosting, and post-publish asset cleanup.
- **Automated Cron Scheduling**: GitHub Actions cron workflow ([`publish-cron.yml`](.github/workflows/publish-cron.yml)) invoking scheduled release queues without requiring paid persistent workers.

### 5. High-Density Studio UI (React 18 + Vite + Tailwind CSS)
- **Campaign Intake Studio**: Dynamic niche fetching, audience targeting, tone selection pills, and brand guideline document uploads.
- **9:16 Vertical Video Player** ([`VideoPlayer916.jsx`](frontend/src/components/VideoPlayer916.jsx)): Native portrait video player with custom controls, subtitle overlays, and live platform preview modes (Instagram / Shorts).
- **Traceability Panel & Inspection Sheet** ([`TraceabilityPanel.jsx`](frontend/src/components/TraceabilityPanel.jsx)): Deep transparency showing retrieved RAG chunks, repetition similarity scores, and critic dimension cards with justifications.
- **Analytics Studio** ([`AnalyticsPage.jsx`](frontend/src/pages/AnalyticsPage.jsx)): Custom SVG chart visualizations for cross-platform reach, views, likes, shares, and conversion trends.

---

## Role of Google Gemini in the Architecture

Google Gemini is integrated into **two critical architectural layers** via the official `google-genai` SDK:

| Architectural Layer | Integration Point | Model(s) Used | Functional Responsibility |
| :--- | :--- | :--- | :--- |
| **Visual Generation Engine** | [`DesignAgent`](backend/app/agents/design_agent.py) | `imagen-3.0-generate-002`<br>`gemini-2.0-flash` | Generates 9:16 portrait product visuals using `response_modalities=["IMAGE", "TEXT"]`. The generated asset serves as the reel cover and primary visual base for the video compositor. |
| **Resilient Fallback LLM & Judge** | [`LLMService`](backend/app/services/llm_groq.py)<br>[`CriticAgent`](backend/app/agents/critic_agent.py) | `gemini-2.5-flash`<br>`gemini-1.5-flash` | Provides zero-downtime automated fallback if Groq encounters rate limits (HTTP 429), quotas, or timeouts. Powers structured JSON copy generation and LLM-as-a-judge rubric scoring. |

This dual-provider pattern guarantees high availability, cost efficiency, and fault tolerance during live video generation.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/) 0.115, [Uvicorn](https://www.uvicorn.org/), [Pydantic Settings](https://docs.pydantic.dev/) v2 |
| **Relational Data Layer** | [PostgreSQL](https://www.postgresql.org/), [SQLAlchemy](https://www.sqlalchemy.org/) 2.0 (ORM), [Alembic](https://alembic.sqlalchemy.org/) (Migrations), [psycopg 3](https://www.psycopg.org/) |
| **Vector Store & RAG** | [ChromaDB](https://www.trychroma.com/), [sentence-transformers](https://www.sbert.net/) (`all-MiniLM-L6-v2`), [PyPDF2](https://pypdf2.readthedocs.io/) |
| **LLMs & GenAI** | [Groq SDK](https://groq.com/) (`Llama-3.3-70b-versatile`), [google-genai](https://pypi.org/project/google-genai/) 2.18 (`Gemini 2.5 Flash`, `Imagen 3.0`) |
| **Audio & Video Processing** | [edge-tts](https://github.com/rany2/edge-tts), [MoviePy](https://zulko.github.io/moviepy/) 2.2, [imageio-ffmpeg](https://github.com/imageio/imageio-ffmpeg), [Pillow](https://python-pillow.org/) |
| **Media Hosting & Cloud** | [Cloudinary](https://cloudinary.com/), Azure Container Apps (GPU Workload Profiles / Blob Storage) |
| **Social Publishing APIs** | [Meta Graph API](https://developers.facebook.com/docs/graph-api/) (Instagram Reels / FB Video), [YouTube Data API v3](https://developers.google.com/youtube/v3) |
| **Frontend Stack** | [React](https://react.dev/) 18, [Vite](https://vitejs.dev/) 5, [Tailwind CSS](https://tailwindcss.com/) 3.4, [Lucide React](https://lucide.dev/), [React Router](https://reactrouter.com/) v6 |
| **CI/CD & Automation** | GitHub Actions (`publish-cron.yml`), PowerShell automation scripts |

---

## Repository Structure

```
breif2reel/
├── backend/                       # FastAPI application & agent engine
│   ├── alembic/                   # Database migration versions
│   │   └── versions/              # 0001_initial_schema, 0002_add_agent_outputs, etc.
│   ├── app/
│   │   ├── agents/                # Autonomous agent implementations
│   │   │   ├── copywriter.py      # Structured copywriter & hook generator
│   │   │   ├── critic_agent.py    # LLM-as-a-judge quality rubric evaluator
│   │   │   ├── design_agent.py    # Gemini Imagen & Pollinations visual engine
│   │   │   ├── audio_agent.py     # Edge-TTS script-to-speech synthesizer
│   │   │   ├── video_agent.py     # Multi-provider video dispatch
│   │   │   └── video_compositor.py# MoviePy/FFmpeg Ken-Burns & subtitle compositor
│   │   ├── core/                  # Auth middleware, config, retry handlers, error handling
│   │   ├── db/                    # SQLAlchemy database session & engine
│   │   ├── models/                # Database models (Campaign, Niche, Account, Traceability, etc.)
│   │   ├── retrieval/             # ChromaDB vector store, document ingestion, past-post indexer
│   │   ├── routes/                # REST endpoints: campaigns, niches, brand_assets, publish, analytics
│   │   ├── schemas/               # Pydantic request and response schemas
│   │   ├── services/              # Orchestrator, LLMService (Groq/Gemini), Cloudinary, Publishers
│   │   ├── main.py                # FastAPI entry point & CORS configuration
│   │   └── seed.py                # Database seeder for default niches
│   ├── tests/                     # Unit tests & diagnostic test suite
│   ├── chroma_data/               # Persistent local ChromaDB vector storage
│   ├── media_output/              # Local generated assets (images, audio, videos)
│   ├── colab_video_server.ipynb   # Standalone Colab T4 GPU video generation notebook
│   ├── hf_space_files/            # ZeroGPU Hugging Face Space deployment files
│   └── requirements.txt           # Python backend dependencies
├── frontend/                      # React 18 SPA (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/            # VideoPlayer916, TraceabilityPanel, InspectionSheet, SvgCharts, Sidebar
│   │   ├── pages/                 # NewCampaignPage, ReviewQueuePage, AnalyticsPage, AccountsPage, PostHistoryPage
│   │   ├── api.js                 # Centralized API client wrapper
│   │   ├── App.jsx                # Application routing & layout
│   │   └── index.css              # Custom styling, animations & theme tokens
│   └── package.json
├── evaluation/                    # Automated evaluation benchmark suite
│   ├── evaluate_pipeline.py       # Batch evaluation runner (mock & live LLM modes)
│   ├── evaluation_report.md       # Formatted benchmark evaluation report
│   └── evaluation_results.csv     # Raw tabular evaluation metrics
├── requirments/                   # Formal architectural specifications (PRD, FRS, NFR, etc.)
├── docs/                          # Runbooks, Azure Container Apps setup, research notes
└── infra/                         # Automation launcher scripts & GitHub Actions cron
```

---

## Evaluation & Benchmark Telemetry

The generation pipeline has been validated across 5 distinct industry niches using the automated evaluation suite ([`evaluation/evaluate_pipeline.py`](evaluation/evaluate_pipeline.py)):

| Metric Dimension | Benchmark Result | Target Threshold | Quality Status |
| :--- | :---: | :---: | :---: |
| **Pipeline Success Rate** | **100.0%** (5/5) | ≥ 90.0% | ✅ PASS |
| **Overall Critic Score** | **88 / 100** | ≥ 70.0 | ✅ PASS |
| **Brand Voice Fit** | **88 / 100** | ≥ 75.0 | ✅ PASS |
| **Claim Accuracy (Groundedness)** | **92 / 100** | ≥ 80.0 | ✅ PASS |
| **Caption Quality** | **86 / 100** | ≥ 75.0 | ✅ PASS |
| **Engagement Heuristic** | **85 / 100** | ≥ 70.0 | ✅ PASS |
| **Novelty / Repetition Score** | **0.057** | ≤ 0.85 (lower is more novel) | ✅ NOVEL |
| **Unit Test Suite** | **4 / 4 Passed** | 100% | ✅ PASS |

---

## Local Setup & Quickstart Guide

### 1. Prerequisites
- **Python**: `3.11` or `3.12`
- **Node.js**: `18.x` or `20.x` (with `npm`)
- **PostgreSQL**: Local instance or hosted service (e.g. Supabase, Neon)
- **API Keys** *(Optional for offline mock testing; required for live generation)*:
  - `GROQ_API_KEY` (Llama 3.3 70B generation)
  - `GEMINI_API_KEY` (Google Gemini fallback & Imagen 3.0 visuals)
  - `CLOUDINARY_URL` / Cloudinary credentials (for public video hosting)

---

### 2. Database Initialization

Create a PostgreSQL database for the application:

```sql
CREATE DATABASE breif2reel;
```

---

### 3. Backend Configuration & Launch

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv .venv
     .venv\Scripts\Activate.ps1
     ```
   - **Linux / macOS**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Install required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `backend/.env` with your database credentials and API keys:
   ```ini
   APP_NAME="breif2reel Backend"
   DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/breif2reel
   TEAM_API_KEY=your-team-secret-key
   SCHEDULER_SECRET=your-scheduler-secret
   BACKEND_CORS_ORIGINS=http://localhost:5173

   # LLM & Visual Providers
   GROQ_API_KEY=your-groq-api-key
   GEMINI_API_KEY=your-gemini-api-key

   # Cloudinary Media Hosting
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-cloudinary-api-key
   CLOUDINARY_API_SECRET=your-cloudinary-api-secret

   # Video Generation Engine (Defaults to Local Cinematic Compositor if unconfigured)
   VIDEO_PROVIDER=inference_service
   ```

5. Run database migrations:
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
   Interactive Swagger documentation will be available at **`http://127.0.0.1:8000/docs`**.

---

### 4. Frontend Studio Configuration & Launch

1. Open a new terminal and navigate to `frontend`:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure frontend environment variables:
   ```bash
   cp .env.example .env
   ```
   Ensure `frontend/.env` matches your backend configuration:
   ```ini
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   VITE_TEAM_API_KEY=your-team-secret-key
   ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Access the dashboard at **`http://localhost:5173`**.

---

### 5. Verification & Diagnostic Tests

Run the backend unit test suite:
```bash
# Run from within the backend directory
python -m unittest discover -s tests
```

Execute the independent pipeline diagnostic test:
```bash
python tests/diagnostic_test.py
```

---

### 6. Automated Pipeline Evaluation

Run the automated evaluation benchmark across sample product briefs:
```bash
# Offline verification mode (zero API credit consumption):
python evaluation/evaluate_pipeline.py --samples 5 --mock

# Live LLM evaluation mode:
python evaluation/evaluate_pipeline.py --samples 5
```
Results will be output to [`evaluation/evaluation_results.csv`](evaluation/evaluation_results.csv) and [`evaluation/evaluation_report.md`](evaluation/evaluation_report.md).

---

## API Reference Summary

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/health` | Service health status | No |
| `GET` | `/api/v1/niches` | List all campaign niches | No |
| `POST` | `/api/v1/niches/{id}/brand-assets/text` | Upload brand guideline text into ChromaDB | Yes (`Bearer`) |
| `POST` | `/api/v1/niches/{id}/brand-assets/pdf` | Upload and chunk brand guideline PDF | Yes (`Bearer`) |
| `GET` | `/api/v1/campaigns` | List campaigns with niche & status filtering | No |
| `POST` | `/api/v1/campaigns` | Create a new structured campaign brief | Yes (`Bearer`) |
| `GET` | `/api/v1/campaigns/{id}` | Get full campaign details & audit trace | No |
| `POST` | `/api/v1/campaigns/{id}/generate` | Trigger async multi-agent generation pipeline | Yes (`Bearer`) |
| `POST` | `/api/v1/campaigns/{id}/approve` | Approve content and transition to `scheduled` | Yes (`Bearer`) |
| `POST` | `/api/v1/publish/run` | Scheduled publishing runner endpoint | Yes (`X-Scheduler-Secret`) |
| `POST` | `/api/v1/publish/{id}/manual` | Manually dispatch campaign to social platforms | Yes (`Bearer`) |
| `GET` | `/api/v1/analytics/summary` | Aggregate campaign, platform, and reach telemetry | No |
| `GET` | `/api/v1/posts/history` | Historical timeline of published posts | No |

---

## System Specifications & Documentation

Comprehensive architectural design and engineering requirements are documented under [`requirments/`](requirments/) and [`docs/`](docs/):

- [`01_PRD.md`](requirments/01_PRD.md) — Product Requirements Document (Problem statement, target user, success metrics).
- [`02_FRS.md`](requirments/02_FRS.md) — Functional Requirements Specification (Numbered module tickets).
- [`03_NFR.md`](requirments/03_NFR.md) — Non-Functional Requirements (Latency budgets, security, cost bounds).
- [`04_System_Architecture.md`](requirments/04_System_Architecture.md) — System Architecture & Component Interactions.
- [`05_Database_Schema.md`](requirments/05_Database_Schema.md) — Relational Entity Relationships & Table Specs.
- [`06_API_Contract.md`](requirments/06_API_Contract.md) — Complete REST Endpoint Contracts & Schemas.
- [`07_Task_Breakdown_Sprint_Plan.md`](requirments/07_Task_Breakdown_Sprint_Plan.md) — Sprint Backlog & Milestones.
- [`08_Evaluation_Plan.md`](requirments/08_Evaluation_Plan.md) — Multi-Agent QA Rubric & Evaluation Methodology.
- [`AZURE_SETUP.md`](docs/AZURE_SETUP.md) — Azure Container Apps Serverless GPU Deployment Runbook.

---

## License

This project is licensed under the [MIT License](LICENSE).
