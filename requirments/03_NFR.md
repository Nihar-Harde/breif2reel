# Non-Functional Requirements (NFR) — BrandCrew

## 1. Performance
- End-to-end generation shall be asynchronous and expose progress; the system shall record p50/p95 time from submission to review-ready output. The target is to complete in ~3–4 minutes when the GPU service is warm, and under 5 minutes including cold start.
- Video inference shall generate exactly 720x1280 portrait output of ≥ 10 seconds (default 10.04s, 241 frames at 24 fps), and video compositing (MoviePy/FFmpeg) shall target ≤ 30 seconds after inference completes. Long-running generation shall never block the live web request path.
- Dashboard views (Review Queue, Post History) shall load in under 2 seconds against a database of up to 500 campaigns (well within free-tier DB size).

## 2. Reliability
- Every external API call and video inference submission (Groq/Gemini, Pollinations.ai, Azure Container Apps video service, Azure Blob Storage, Meta Graph API, YouTube Data API, Cloudinary) shall be wrapped with retry-with-backoff (max 2 retries) and a documented fallback where one exists.
- Each frontend-triggered video request shall be idempotent, resumable after transient service failure, and isolated from other requests. Azure Container Apps shall control concurrency according to available GPU replicas; a single GPU replica shall not be overloaded with simultaneous model generations (`--max-replicas 1`, 1 job per GPU).
- A failure in one platform's publish step (FR-PUBLISH-05) shall never block or roll back successful publishes to the other two platforms — failures are isolated per platform.
- The backend and Azure video service may cold-start or scale to zero. The system shall surface a "starting GPU service" state in the UI rather than a silent failure/timeout; no keep-alive shall be used solely to avoid scale-to-zero billing.
- Supabase free-tier projects pause after 7 days without database activity; since the daily scheduled job writes to the DB on every run, this should not occur in practice, but a lightweight daily health-check write is added as a safety net.

## 3. Security
- **Token storage:** All platform access tokens (Meta long-lived tokens, YouTube OAuth refresh tokens) shall be stored encrypted at rest in Postgres (e.g., using `pgcrypto` or application-level encryption before insert), never in plaintext, never committed to source control, and never logged.
- Environment secrets (API keys, DB connection strings, encryption keys) shall be stored in platform-native secret managers (Render environment variables, GitHub Actions encrypted secrets) — never hardcoded.
- The backend API shall require authentication (e.g., a shared team API key or simple session auth) for all write endpoints; this is an internal team tool in MVP scope, not a public-facing multi-tenant service, so full user-account auth (OAuth login, RBAC) is explicitly out of MVP scope but the token-storage design must anticipate it (see PRD §6 future scope).
- File uploads (product images, brand-guideline PDFs) shall be validated for type and size before processing to avoid arbitrary file execution risks.

## 4. Compliance / Platform ToS
- No automated account creation, no credential scraping, no unofficial/private API wrappers (e.g., instagrapi) in the shipped system — only official Meta Graph API and YouTube Data API v3, per the architecture decision in Phase 1.
- Publishing frequency shall respect platform rate limits and avoid bulk/rapid-fire posting patterns; MVP targets at most one post per platform per account per day.
- Only team-owned or team-managed accounts (added as roles on the Meta Developer app / test users) are used in MVP — no third-party account onboarding, which keeps the system within Standard Access and avoids the Meta App Review requirement (see Tech Stack research).

## 5. Cost Ceiling
- Ongoing cash spend shall be zero; Azure GPU usage shall be bounded by the available $200 credit with a hard safety stop at **$190** for ~60 videos. The system shall log GPU-seconds, estimated cost, and cumulative budget consumption, with tiered alerts (50%, 75%, 90%, 100%).
- Any metered service (Azure GPU/Blob, Cloudinary credits, YouTube quota units, Groq/Gemini rate limits) shall have its usage logged so the team can detect approaching limits before a demo failure.
- Azure GPU pricing and meter availability shall be verified in Cost Management after deployment; documented estimates shall not be treated as billing guarantees.

## 6. Maintainability
- Backend organized as distinct service layers (agents, retrieval, dispatcher, scheduler trigger, API routes) — not a single script — mirroring the reference project's separation of ingestion/retrieval/generation/frontend/evaluation.
- Configuration (model names, rate-limit thresholds, retrieval k, Critic score thresholds) centralized in a config module/environment variables, not hardcoded across files.
- Each of the 4 role tracks (Backend/Agents, Frontend, Infra/DevOps/Publishing, QA/Evaluation) shall own a clearly bounded directory/module to minimize merge conflicts during parallel development.

## 7. Usability
- Dashboard shall clearly distinguish campaign states (draft, generating, needs_review, scheduled, published, failed, rejected) with consistent color-coded badges.
- The traceability panel (FR-TRACE-01) shall be visible without extra clicks on the review screen — it is a core differentiator, not a hidden debug view.
