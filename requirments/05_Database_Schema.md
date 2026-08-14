# Database Schema — BrandCrew (PostgreSQL via Supabase)

## Entity Overview
`niches` → `accounts` (1:many) → `campaigns` (1:many) → `post_history` (1:many)
`campaigns` → `campaign_assets` (1:many), `campaigns` → `traceability_records` (1:1)
`niches` → `brand_assets` (1:many, source docs embedded into ChromaDB, referenced by ID)

## Tables

### `niches`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text, unique | e.g. "Tech & Gadgets" |
| description | text | used as part of retrieval grounding context |
| created_at | timestamptz | default now() |

### `accounts`
One row per platform connection, scoped to a niche.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| niche_id | uuid FK → niches.id | |
| platform | text | enum: `instagram`, `facebook`, `youtube` |
| platform_account_id | text | IG Business Account ID / FB Page ID / YouTube Channel ID |
| access_token_encrypted | bytea | encrypted at rest (pgcrypto or app-level) |
| refresh_token_encrypted | bytea, nullable | for YouTube OAuth |
| token_expires_at | timestamptz, nullable | |
| status | text | enum: `connected`, `expired`, `error` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `brand_assets`
Metadata for uploaded brand-guideline docs; actual embeddings live in ChromaDB, referenced by `chroma_doc_id`.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| niche_id | uuid FK → niches.id | |
| source_type | text | enum: `pdf`, `text`, `past_post` |
| original_filename | text, nullable | |
| chroma_doc_id | text | ID used to look up the embedded chunks in ChromaDB |
| created_at | timestamptz | |

### `campaigns`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| niche_id | uuid FK → niches.id | |
| product_name | text | |
| target_audience | text | |
| campaign_goal | text | enum: `awareness`, `launch`, `promotion`, `engagement` |
| tone | text | enum: `playful`, `formal`, `bold`, `minimal` |
| status | text | enum: `draft`, `generating`, `needs_review`, `approved`, `scheduled`, `published`, `failed`, `rejected` |
| generated_caption | text, nullable | |
| generated_script | text, nullable | |
| video_local_path | text, nullable | |
| cloudinary_url | text, nullable | |
| scheduled_publish_at | timestamptz, nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `campaign_assets`
Raw uploaded inputs (product image, optional guideline snippet) tied to a specific campaign.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| campaign_id | uuid FK → campaigns.id | |
| asset_type | text | enum: `product_image`, `brand_guideline_snippet` |
| file_path | text | |
| created_at | timestamptz | |

### `traceability_records`
One row per campaign, capturing what informed generation.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| campaign_id | uuid FK → campaigns.id, unique | |
| retrieved_chunks | jsonb | array of {source, text, similarity_score} |
| repetition_score | numeric | |
| critic_scores | jsonb | {brand_voice_fit, claim_accuracy, caption_quality, engagement_heuristic, overall} |
| critic_justifications | jsonb | per-dimension short text explanation |
| created_at | timestamptz | |

### `post_history`
Per-platform publish outcome for a campaign; one campaign yields up to 3 rows (IG, FB, YouTube).
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| campaign_id | uuid FK → campaigns.id | |
| account_id | uuid FK → accounts.id | |
| platform | text | enum: `instagram`, `facebook`, `youtube` |
| status | text | enum: `success`, `failed`, `pending` |
| external_post_id | text, nullable | |
| error_message | text, nullable | |
| published_at | timestamptz, nullable | |
| created_at | timestamptz | |

## Notes
- Alembic migrations (as in the reference project) manage schema changes.
- `access_token_encrypted` / `refresh_token_encrypted`: use `pgcrypto`'s `pgp_sym_encrypt`/`pgp_sym_decrypt` with a key stored only in the backend's environment secrets, never in the DB itself.
- Indexes: `campaigns(niche_id, status)`, `post_history(campaign_id)`, `accounts(niche_id, platform)` for the dashboard's common query patterns.
