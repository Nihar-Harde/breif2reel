# Task Breakdown / Sprint Plan — BrandCrew

Each ticket is scoped to be handed to GitHub Copilot as a single implementation prompt, referencing the FRS requirement ID(s) it implements. Group by role track; within a track, tickets are roughly in build order.

## Track A — Backend / Agents

**Week 1**
- A1. Scaffold FastAPI project structure (`app/routes`, `app/agents`, `app/retrieval`, `app/db`, `app/services`). Implement DB connection via SQLAlchemy + Alembic pointed at Supabase. *(supports FR-BRIEF-02)*
- A2. Implement `campaigns` table model + Alembic migration per Database Schema doc.
- A3. Implement Groq client wrapper (`app/services/llm_groq.py`) and Gemini fallback wrapper, both exposing a common `generate(prompt, ...)` interface.

**Week 2**
- A4. Implement Copywriter Agent (FR-AGENT-01): given a campaign brief dict, return structured JSON `{ caption, hashtags, voiceover_script, image_prompt }`.
- A5. Implement standalone MoviePy/FFmpeg compositing script: image + audio → captioned .mp4 (FR-AGENT-04), callable as a function, not yet wired to agents.

**Week 3**
- A6. Implement Design Agent (FR-AGENT-02): Pollinations.ai call with HF Inference fallback on timeout/error.
- A7. Implement Audio Agent (FR-AGENT-03): edge-tts script-to-mp3.
- A8. Implement Orchestrator (FR-AGENT-07) sequencing A4→A6→A7→A5, persisting each intermediate artifact to `campaign_assets`.

**Week 4**
- A9. Wire `/api/v1/campaigns/{id}/generate` to the Orchestrator; ensure milestone (product→video→post) works manually end-to-end with Track C's publish script.
- A10. Add retry/backoff wrapper for all external agent calls (NFR §2).

**Week 5**
- A11. Implement `brand_assets` PDF/text ingestion + chunking + embedding into ChromaDB per niche (FR-BRIEF-03).
- A12. Implement retrieval function (FR-RETRIEVE-01/02): top-k similarity search against a niche's ChromaDB collection.
- A13. Wire retrieved context into Copywriter Agent's prompt.

**Week 6**
- A14. Implement repetition scoring (FR-RETRIEVE-03) against last N posts; re-prompt Copywriter if above threshold.
- A15. Implement Critic/QA Agent (FR-AGENT-05) with rubric prompt returning structured per-dimension scores + justification.
- A16. Implement `traceability_records` persistence (FR-TRACE-01) capturing retrieved chunks + Critic output.

**Week 7 (buffer)**
- A17. Edge-case handling: empty/short briefs, agent timeouts, malformed LLM JSON output (add JSON-repair/retry logic).
- A18. Performance pass on video rendering time; offload to async task if needed.

**Week 8 (buffer)**
- A19. Final integration freeze; fix bugs surfaced by Track D's regression pass only.

## Track B — Frontend

**Week 1**
- B1. Set up React 19 + Vite + Tailwind project; build sidebar navigation shell (FR-UI-01).
- B2. Build Campaign Brief form component (FR-BRIEF-01), posting to `/api/v1/campaigns`.

**Week 2**
- B3. Wire form submission to a stub backend response; build campaign status polling hook.

**Week 3**
- B4. Build Content Preview card: video player, caption, hashtags (consumes `/api/v1/campaigns/{id}`).

**Week 4**
- B5. Build minimal single-campaign Approve screen for the milestone demo (FR-APPROVE-01/02, simplified).

**Week 5**
- B6. Build full Review Queue view grouped by niche with status badges (FR-UI-02).
- B7. Build Accounts view showing per-platform connection status (FR-ACCOUNT-03).

**Week 6**
- B8. Build Traceability Panel: retrieved chunks list, past-posts comparison, Critic scores with justification tooltips (FR-TRACE-01, FR-UI as core differentiator).
- B9. Build Post History timeline view (FR-UI-03).

**Week 7 (buffer)**
- B10. Build Analytics view (FR-UI-04) consuming `/api/v1/analytics/summary`.
- B11. UI polish: loading states for cold-start backend, animated transitions, empty states.

**Week 8 (buffer)**
- B12. Final demo dry-run polish; fix any UI bugs from regression pass.

## Track C — Infra / DevOps / Publishing

**Week 1**
- C1. Create Supabase project; note pause behavior and schedule accordingly (NFR §2).
- C2. Create Cloudinary account; store credentials in Render/GitHub secrets.
- C3. Set up GitHub repo, branch protections, GitHub Actions skeleton workflow (no-op cron for now).
- C4. Create Meta Developer app; add team members as roles; confirm Standard Access is sufficient (non-blocking task, do not wait on this before continuing other work).

**Week 2**
- C5. Convert test Instagram account to Business/Creator, link to a Facebook Page; obtain Page Access Token + IG Business Account ID.
- C6. Set up Google Cloud project, enable YouTube Data API v3, complete OAuth consent screen, obtain `client_secrets.json` and a working refresh token via a one-time local script.

**Week 3**
- C7. Implement and test standalone Meta Graph API publish script (container create → publish) against the test IG account (FR-PUBLISH-02).
- C8. Implement and test standalone YouTube upload script (FR-PUBLISH-04).

**Week 4**
- C9. Implement Cloudinary upload step (FR-PUBLISH-01) and wire into the milestone end-to-end path with Track A.
- C10. Turn on the GitHub Actions cron schedule pointing at `/api/v1/publish/run` (initially manual-trigger only, then scheduled).

**Week 5**
- C11. Implement multi-account token registry setup flow (`accounts` table population) for all niche account bundles (FR-ACCOUNT-01).
- C12. Implement niche-based dispatcher routing logic (FR-PUBLISH: route to correct account bundle).

**Week 6**
- C13. Implement per-platform independent error handling/retry in the dispatcher (FR-PUBLISH-05).
- C14. Implement Cloudinary cleanup step post-publish (FR-PUBLISH-06) and set up basic usage/quota logging for Cloudinary credits, YouTube quota units, and Groq/Gemini request counts (NFR §5).

**Week 7 (buffer)**
- C15. Token refresh handling and expiry alerts (FR-ACCOUNT-03).
- C16. Load-test the scheduler against multiple simultaneous campaigns; verify per-platform isolation holds (NFR §2).

**Week 8 (buffer)**
- C17. Pre-warm Render service ahead of the demo slot; final smoke test of the full publish path across all 3 platforms/all niche accounts.

## Track D — QA / Evaluation / Docs

**Week 1**
- D1. Finalize PRD/FRS/NFR based on team review; set up a shared test-niche-account list.
- D2. Draft Critic/QA rubric v0 (dimensions, scoring scale, example justifications).

**Week 2**
- D3. Write manual test cases for the "one product → one video" happy path.

**Week 3**
- D4. Execute first manual end-to-end test against Track A/C's early scripts; log defects.

**Week 4**
- D5. Verify and sign off on the Week 4 milestone (single product → single video → post on all 3 platforms); document known gaps.

**Week 5**
- D6. Finalize Critic rubric prompts for Track A's implementation; begin building the offline evaluation script (FR-EVAL-01).

**Week 6**
- D7. Run the evaluation script against a batch of sample briefs; produce first Evaluation Report draft (see Evaluation Plan doc) covering Critic scores, repetition scores, failure rates.

**Week 7 (buffer)**
- D8. Full regression pass across all modules against the FRS; log and prioritize bugs for Tracks A/B/C.
- D9. Update all docs with real screenshots/output examples.

**Week 8 (buffer)**
- D10. Finalize Evaluation Report, write demo script/runbook, assemble final presentation deck and README.
