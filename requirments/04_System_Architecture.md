# System Architecture — BrandCrew

## 1. Architecture Diagram

```
[ Campaign Operator ] 
        │
        ▼
┌───────────────────────────────────────────────┐
│           REACT DASHBOARD (Vercel/Static)      │
│  New Campaign · Review Queue · Post History ·  │
│  Accounts · Analytics · Traceability Panel      │
└───────────────────┬────────────────────────────┘
                     │ REST (JSON)
                     ▼
┌───────────────────────────────────────────────┐
│            FASTAPI BACKEND (Render)            │
│  Routes: /campaigns /agents/run /approve        │
│          /publish /accounts /analytics          │
└───────┬──────────────┬───────────────┬─────────┘
        │              │               │
        ▼              ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌────────────────────┐
│ INGESTION      │ │ RETRIEVAL      │ │ MULTI-AGENT PIPELINE│
│ - Brief parser │ │ - ChromaDB     │ │ (Orchestrator)      │
│ - PDF parsing  │ │   per-niche    │ │  Copywriter (Groq/  │
│   (brand docs) │ │   collections  │ │   Gemini)            │
│ - Image intake │ │ - Embeddings   │ │  Design (Pollinations│
│                │ │   (Sentence-   │ │   .ai / HF fallback) │
│                │ │   Transformers)│ │  Voice (edge-tts)    │
│                │ │ - Repetition   │ │  Video (MoviePy/     │
│                │ │   scoring      │ │   FFmpeg)             │
│                │ │                │ │  Critic/QA (rubric)  │
└───────┬────────┘ └───────┬────────┘ └──────────┬──────────┘
        │                  │                     │
        └──────────────────┴─────────────────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │  POSTGRES (Supabase)      │
              │  campaigns, accounts,     │
              │  post_history, embeddings │
              │  metadata, analytics       │
              └─────────────┬─────────────┘
                            │ on Approve
                            ▼
              ┌───────────────────────────┐
              │   PUBLISHER / DISPATCHER   │
              │  - Uploads .mp4 → Cloudinary│
              │  - Routes by niche account  │
              └──────┬───────┬───────┬─────┘
                     │       │       │
                     ▼       ▼       ▼
          ┌───────────┐ ┌───────────┐ ┌─────────────┐
          │Meta Graph │ │Meta Graph │ │YouTube Data │
          │API (IG    │ │API (FB    │ │API v3       │
          │Reels)     │ │Page)      │ │(Shorts)     │
          └───────────┘ └───────────┘ └─────────────┘

Scheduling: GitHub Actions cron → hits a backend trigger endpoint daily
to process campaigns in `scheduled` status.
```

Video path: the Orchestrator submits prompts to an internal Azure Container Apps Consumption GPU service (`Consumption-GPU-NC24ads-A100` primary for fast ~2.5–3 min inference, T4 as quota fallback). The service runs **LTX-Video Pro**, writes 720x1280, ≥ 10 second (default 10.04s, 241 frames @ 24fps) MP4 artifacts to Azure Blob Storage, and returns generation and cost telemetry to the backend.

## 2. Module-by-Module Description

### 2.1 Presentation Layer — React Dashboard
React 19 + Vite + Tailwind (matching the reference project's frontend stack). Hosted as a static build on Vercel or Render Static Site. Talks to the backend exclusively via REST/JSON. Owns: campaign brief form, review/approval queue, post history, account management, analytics, and the traceability panel.

### 2.2 API Layer — FastAPI Backend
Single FastAPI app exposing route groups for campaigns, agent execution, approval, publishing, accounts, and analytics (see API Contract doc). Acts as the boundary between the frontend and every internal service module — no frontend code talks to Groq, Cloudinary, Meta, or YouTube directly.

### 2.3 Ingestion Layer
Parses the structured campaign brief, extracts text from any uploaded brand-guideline PDF (PyMuPDF), and stores product image metadata. Structurally equivalent to the reference project's PDF-parsing ingestion step, just applied to brand assets instead of legal documents.

### 2.4 Retrieval Layer
Per-niche-account ChromaDB collections store embedded brand-guideline chunks and embedded past-post captions/scripts. Given a new brief, retrieves top-k relevant chunks (grounding) and computes a repetition score against recent posts (anti-repetition), directly analogous to the reference project's vector retrieval + re-ranking step.

### 2.5 Multi-Agent Generation Pipeline
An Orchestrator (CrewAI or smolagents) sequences Copywriter (LLM via Groq, Gemini fallback), Design (Pollinations.ai, HF fallback), Voice (edge-tts), self-hosted Video Generation (Azure Container Apps serverless GPU), Video Compositor (MoviePy/FFmpeg), and Critic/QA. The video service is an independently deployable container that accepts explicit frame/duration settings, generates 720x1280 portrait MP4 clips of ≥ 10 seconds (10–15s), stores them in Blob Storage, and returns an artifact reference plus generation telemetry.

### 2.6 Persistence Layer — Supabase Postgres
Stores campaigns, accounts/tokens, post history, and analytics (see Database Schema doc). Encrypted token storage. Chosen over Render's free Postgres specifically because Render's free database expires 30 days after creation — unsuitable for a multi-week project.

### 2.7 Publisher / Dispatcher
On campaign approval, uploads the rendered video to Cloudinary to obtain a public URL, then dispatches to the matching niche account's Instagram, Facebook, and YouTube via their official APIs, logging per-platform success/failure independently.

### 2.8 Scheduler
A GitHub Actions workflow on a cron schedule calls a protected backend endpoint daily to process any campaigns sitting in `scheduled` status — deliberately chosen over a Render background worker (which requires a paid plan on Render's free tier).

## 3. Key Architecture Decisions (and why)
- **GitHub Actions over Render background worker:** Render's free tier does not include background workers (requires $7/mo Starter); GitHub Actions cron is free and sufficient for a once-daily trigger.
- **Supabase over Render Postgres:** Render's free Postgres auto-deletes after 30 days; Supabase's free tier persists indefinitely (subject to a 7-day inactivity pause, mitigated by the daily scheduler itself).
- **Standard Access (no Meta App Review) for MVP:** because all accounts are team-owned/managed, the app only needs Standard Access under Meta's Instagram Platform rules — this was confirmed as sufficient for apps serving only accounts the developers have a role on, removing the biggest historical timeline risk for a project like this.
- **ChromaDB reused from the reference project:** keeps the team on a tool they may already have experience with, and is a direct architectural parallel to the RAG grounding pattern, just applied to brand voice instead of legal text.
- **Self-hosted video generation on Azure Container Apps (A100 primary):** avoids managed video API duration/provider limits, supports the required portrait and ≥ 10s output contract, completes inference in ~2.5–3 minutes, bills serverless GPU usage per second, and scales to zero between jobs.
- **LTX-Video Pro on A100 decision:** committed to LTX-Video Pro for native 10s single-continuous scene generation (241 frames @ 24fps) to achieve < 5 minute end-to-end generation; avoids the ~16–18 minute latency of Wan 14B while keeping total compute spend for ~60 videos under $20 against the $190 budget ceiling.
- **Blob-first artifact handoff:** Blob Storage is the generation output boundary; Cloudinary is used later only when an approved campaign needs a public publishing URL.
