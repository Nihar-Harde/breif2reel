# API Contract — BrandCrew

## Part A — Internal REST API (Frontend ↔ FastAPI Backend)

All internal endpoints are prefixed `/api/v1`, return JSON, and require an `Authorization: Bearer <team_api_key>` header (see NFR §3).

### Campaigns
- **POST `/api/v1/campaigns`** — Create a new campaign from a brief.
  Body: `{ niche_id, product_name, target_audience, campaign_goal, tone, brand_guideline_text? }`
  Multipart companion endpoint for file upload: **POST `/api/v1/campaigns/{campaign_id}/assets`** with `file` (product image or PDF) and `asset_type`.
  Response: `{ campaign_id, status: "draft" }`

- **POST `/api/v1/campaigns/{campaign_id}/generate`** — Triggers the multi-agent pipeline (Orchestrator) for this campaign.
  Response: `{ campaign_id, status: "generating" }` (async; frontend polls or uses `/status`)

- **GET `/api/v1/campaigns/{campaign_id}`** — Full campaign detail including generated content, Critic scores, and traceability record.
  Response includes: `status`, `generated_caption`, `generated_script`, `cloudinary_url` (if published), `traceability: { retrieved_chunks, repetition_score, critic_scores, critic_justifications }`

- **GET `/api/v1/campaigns?niche_id=&status=`** — List/filter campaigns for the Review Queue and Post History views.

- **POST `/api/v1/campaigns/{campaign_id}/approve`** — Body: `{ action: "approve" | "edit" | "reject", edits?: { caption?, hashtags? }, scheduled_publish_at? }`
  On `approve`, campaign moves to `scheduled`. On `reject`, moves to `rejected`.

### Publishing (typically invoked by the scheduler, not the frontend directly)
- **POST `/api/v1/publish/run`** — Protected endpoint called by the GitHub Actions cron job. Processes all campaigns with `status = scheduled` and `scheduled_publish_at <= now()`. Requires a separate `X-Scheduler-Secret` header distinct from the team API key.
  Response: `{ processed: [{ campaign_id, platform_results: [{ platform, status, external_post_id? , error? }] }] }`

- **POST `/api/v1/campaigns/{campaign_id}/publish-now`** — Manual override for demo purposes; runs the dispatcher immediately for one campaign.

### Accounts
- **GET `/api/v1/accounts?niche_id=`** — List connection status per platform for a niche.
- **POST `/api/v1/accounts`** — Register a new account bundle (used during initial team setup, not by end-users): `{ niche_id, platform, platform_account_id, access_token, refresh_token? }` (tokens encrypted server-side before storage).
- **POST `/api/v1/accounts/{account_id}/refresh-token`** — Manually trigger a token refresh (mainly for YouTube's OAuth refresh flow).

### Analytics
- **GET `/api/v1/analytics/summary?niche_id=&range=`** — Returns posts-per-week, average Critic score trend, and per-platform publish success rate for the dashboard's Analytics view.

## Part B — External API Calls (Backend → Third Parties)

### Meta Graph API (Instagram Reels)
```
POST https://graph.facebook.com/v19.0/{ig-user-id}/media
  media_type=REELS
  video_url={cloudinary_url}
  caption={caption}
  access_token={token}
→ returns { id: container_id }

POST https://graph.facebook.com/v19.0/{ig-user-id}/media_publish
  creation_id={container_id}
  access_token={token}
```
Note: brief delay (poll or fixed wait, e.g. 15s) required between container creation and publish while Meta processes the video asset.

### Meta Graph API (Facebook Page video post)
```
POST https://graph.facebook.com/v19.0/{page-id}/videos
  file_url={cloudinary_url}
  description={caption}
  access_token={page_access_token}
```

### YouTube Data API v3 (Shorts upload)
Uses `google-api-python-client` with a stored OAuth refresh token (loaded via `client_secrets.json` / `token.json` pattern established during account setup).
```python
youtube.videos().insert(
    part="snippet,status",
    body={
        "snippet": {"title": ..., "description": caption, "tags": [...]},
        "status": {"privacyStatus": "public"}
    },
    media_body=MediaFileUpload(local_mp4_path)
)
```
Note: confirm current quota cost of `videos.insert` in Google Cloud Console before relying on a specific daily-upload-count assumption (see Tech Stack Research doc).

## Part C — Error Conventions
- All internal endpoints return `{ error: { code, message } }` on failure with appropriate HTTP status (400 validation, 401/403 auth, 404 not found, 502 for third-party API failures).
- Third-party failures (Meta/YouTube/Cloudinary) are caught, logged with the raw provider error, retried per NFR §2, and surfaced in `post_history.error_message` — never silently swallowed.
