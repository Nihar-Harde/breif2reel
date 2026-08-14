# Non-Functional Requirements (NFR) — BrandCrew

## 1. Performance
- End-to-end generation (brief submitted → content ready for review) shall complete in under 3 minutes under normal conditions (excludes Render free-tier cold start, which is a separate, documented UX consideration).
- Video compositing (MoviePy/FFmpeg) shall target ≤ 60 seconds render time for a 15–30s clip on the deployed free-tier instance; if this is exceeded in practice, offload rendering to a GitHub Actions job runner instead of the live web request path.
- Dashboard views (Review Queue, Post History) shall load in under 2 seconds against a database of up to 500 campaigns (well within free-tier DB size).

## 2. Reliability
- Every external API call (Groq/Gemini, Pollinations.ai, Meta Graph API, YouTube Data API, Cloudinary) shall be wrapped with retry-with-backoff (max 2 retries) and a documented fallback where one exists (e.g., Gemini as LLM fallback, HF Inference as image-gen fallback).
- A failure in one platform's publish step (FR-PUBLISH-05) shall never block or roll back successful publishes to the other two platforms — failures are isolated per platform.
- The Render free-tier backend spins down after 15 minutes of inactivity (documented, 30–60s cold-start on next request). The system shall surface a "waking up" state in the UI rather than a silent failure/timeout, and the GitHub Actions cron trigger doubles as a natural keep-alive on its schedule.
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
- Total infrastructure cost: **$0/month**, hard ceiling for the academic project duration.
- Any tool with a metered free tier (Cloudinary credits, YouTube quota units, Groq/Gemini rate limits) shall have its usage logged so the team can detect approaching limits before they cause a demo failure.
- No tool requiring a credit card at signup is used unless explicitly flagged as a no-charge trial (none currently required in the recommended stack).

## 6. Maintainability
- Backend organized as distinct service layers (agents, retrieval, dispatcher, scheduler trigger, API routes) — not a single script — mirroring the reference project's separation of ingestion/retrieval/generation/frontend/evaluation.
- Configuration (model names, rate-limit thresholds, retrieval k, Critic score thresholds) centralized in a config module/environment variables, not hardcoded across files.
- Each of the 4 role tracks (Backend/Agents, Frontend, Infra/DevOps/Publishing, QA/Evaluation) shall own a clearly bounded directory/module to minimize merge conflicts during parallel development.

## 7. Usability
- Dashboard shall clearly distinguish campaign states (draft, generating, needs_review, scheduled, published, failed, rejected) with consistent color-coded badges.
- The traceability panel (FR-TRACE-01) shall be visible without extra clicks on the review screen — it is a core differentiator, not a hidden debug view.
