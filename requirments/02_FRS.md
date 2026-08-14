# Functional Requirements Specification (FRS) — BrandCrew

Numbered requirements grouped by module. Each requirement is written to be implementable as a scoped Copilot ticket. IDs are stable references for the Task Breakdown doc.

## Module: Campaign Brief Intake (FR-BRIEF)
- **FR-BRIEF-01:** System shall provide a form accepting: product name (string, required), niche/category (enum, required, matches an existing account niche), target audience (string), campaign goal (enum: awareness / launch / promotion / engagement), tone (enum: playful / formal / bold / minimal), optional product image upload (jpg/png, max 5MB), optional brand-guideline text or PDF upload.
- **FR-BRIEF-02:** On submission, backend shall persist the brief as a `campaigns` row with status `draft` and return a `campaign_id`.
- **FR-BRIEF-03:** If a brand-guideline PDF is uploaded, backend shall extract text (PyMuPDF or equivalent), chunk it, embed it (SentenceTransformers), and store it in the ChromaDB collection for that niche account.
- **FR-BRIEF-04:** If a product image is uploaded, backend shall store it and pass its description/tags (via a lightweight captioning step or user-provided alt text) into the Copywriter agent's prompt context.

## Module: Retrieval & Grounding (FR-RETRIEVE)
- **FR-RETRIEVE-01:** For a given niche account, system shall retrieve top-k (default k=5) most similar chunks from that account's ChromaDB collection (brand guidelines + past post captions/scripts) using the current brief as the query.
- **FR-RETRIEVE-02:** Retrieved chunks shall be attached to the generation request as grounding context and stored alongside the generated content for traceability (FR-TRACE-01).
- **FR-RETRIEVE-03:** System shall compute a repetition score (embedding cosine similarity) between the newly generated caption/script and the account's last N (default 10) published posts; if above a configured threshold, the Copywriter agent shall be re-prompted to diversify before passing to the Critic.

## Module: Multi-Agent Generation Pipeline (FR-AGENT)
- **FR-AGENT-01 (Copywriter Agent):** Given brief + retrieved grounding context, generate: (a) a caption with relevant hashtags, (b) a 15–20s voiceover script, (c) an image-generation prompt. Output as structured JSON.
- **FR-AGENT-02 (Design Agent):** Send the image-generation prompt to Pollinations.ai (primary) with Hugging Face Inference SDXL as fallback on failure/timeout; save the resulting image locally.
- **FR-AGENT-03 (Audio Agent):** Convert the voiceover script to an .mp3 via edge-tts.
- **FR-AGENT-04 (Video Compositor):** Using MoviePy/FFmpeg, combine the image (with subtle zoom/pan), the audio track, and animated caption overlays into a 15–30s .mp4.
- **FR-AGENT-05 (Critic/QA Agent):** Score the draft (caption + script + video metadata) against a fixed rubric (brand-voice fit, claim accuracy vs. brief, caption/hashtag quality, repetition score, estimated engagement heuristic) on a 0–100 scale per dimension; output structured scores + a short natural-language justification for each.
- **FR-AGENT-06:** If overall Critic score is below a configured threshold, flag the campaign as `needs_review` (still shown to human, but visually flagged) rather than blocking generation.
- **FR-AGENT-07 (Orchestrator):** Sequence FR-AGENT-01 → 05, handle retries on any agent failure (max 2 retries per agent), and persist intermediate outputs so a failed run can resume rather than restart from scratch.

## Module: Human-in-the-Loop Approval (FR-APPROVE)
- **FR-APPROVE-01:** Dashboard shall present generated content (video preview, caption, hashtags) alongside Critic scores and the traceability panel (FR-TRACE-01).
- **FR-APPROVE-02:** Operator can Approve (moves campaign to `scheduled`), Edit (caption/hashtags editable inline; video/audio regeneration re-triggers only the changed agent), or Reject (moves to `rejected`, archived).
- **FR-APPROVE-03:** No content may reach the Publisher/Dispatcher module without an explicit Approve action.

## Module: Traceability (FR-TRACE)
- **FR-TRACE-01:** For every generated campaign, system shall store and display: the exact retrieved chunks (brand guideline + past posts) used, the Critic's per-dimension scores and justifications, and which agent generated which artifact.
- **FR-TRACE-02:** Post-publish, the post history view shall link back to the original campaign's traceability record.

## Module: Account & Niche Management (FR-ACCOUNT)
- **FR-ACCOUNT-01:** System shall store, per niche, one account bundle: Instagram Business/Creator account ID, linked Facebook Page ID + access token, YouTube channel ID + OAuth refresh token.
- **FR-ACCOUNT-02:** Niche is a first-class field on `campaigns`; a campaign can only target the account bundle matching its niche.
- **FR-ACCOUNT-03:** Dashboard shall provide an account management screen to view connection status per platform per niche and re-authenticate expiring tokens.

## Module: Publisher / Dispatcher (FR-PUBLISH)
- **FR-PUBLISH-01:** On approval, Dispatcher shall upload the .mp4 to Cloudinary and obtain a public HTTPS URL.
- **FR-PUBLISH-02:** Dispatcher shall call Meta Graph API: create a REELS media container (`POST /{ig-user-id}/media`) then publish it (`POST /{ig-user-id}/media_publish`), using the niche account's stored token.
- **FR-PUBLISH-03:** Dispatcher shall call Meta Graph API to publish the same (or a Facebook-formatted) video to the linked Facebook Page.
- **FR-PUBLISH-04:** Dispatcher shall call YouTube Data API v3 `videos.insert` to upload the video as a Short, using the account's stored OAuth refresh token.
- **FR-PUBLISH-05:** On any platform publish failure, system shall log the error, retry up to 2 times with backoff, and if still failing, mark that platform's post status as `failed` without blocking the other two platforms.
- **FR-PUBLISH-06:** After successful publish (or final failure) on all platforms, Dispatcher shall delete the Cloudinary asset to conserve free-tier credits.
- **FR-PUBLISH-07:** All publish attempts and outcomes shall be persisted to `post_history` with platform, status, timestamp, and external post ID (if available).

## Module: Scheduling (FR-SCHED)
- **FR-SCHED-01:** A GitHub Actions scheduled workflow shall call a backend trigger endpoint on a configurable cron schedule (default: once daily) to process any `scheduled` campaigns ready to publish.
- **FR-SCHED-02:** Dashboard shall allow an operator to set a specific publish time per approved campaign, overriding the default daily batch.

## Module: Dashboard / Frontend (FR-UI)
- **FR-UI-01:** Sidebar navigation across: New Campaign, Review Queue, Post History, Accounts, Analytics.
- **FR-UI-02:** Review Queue shall show campaigns grouped by niche account with status badges (draft / generating / needs_review / scheduled / published / failed / rejected).
- **FR-UI-03:** Post History shall show a per-account timeline of published content with Critic scores and platform-level status.
- **FR-UI-04:** Analytics view shall show basic aggregate stats: posts per week per niche, average Critic score trend, publish success rate per platform.

## Module: Evaluation (FR-EVAL)
- **FR-EVAL-01:** An offline evaluation script shall run a batch of sample briefs through the pipeline and report aggregate Critic scores, repetition scores, and generation failure rates, producing a report artifact (see Evaluation Plan doc).
