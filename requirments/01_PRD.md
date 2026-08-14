# Product Requirements Document (PRD) — BrandCrew

## 1. Problem Statement
Small teams and niche brand accounts need to produce short-form social video content (Reels, Facebook video posts, YouTube Shorts) consistently, but manual content creation for multiple accounts and platforms does not scale with a small team. Generic AI content tools produce off-brand, repetitive, or unchecked output because they generate from a raw prompt with no grounding, no memory of past posts, and no quality gate before publishing.

## 2. Target User
- **Primary user (MVP):** the project team itself, acting as "Campaign Operators" managing a small portfolio of **team-owned** niche social media accounts (e.g., Tech & Gadgets, Home & Kitchen, Fitness).
- **Persona:** a non-designer, non-video-editor who wants to submit a structured product brief and get a ready-to-review short video + caption, tailored to a specific niche account's established voice, without repeating recent content.
- **Out of scope for MVP:** external paying customers connecting their own accounts (this is parked as future SaaS scope — see §6).

## 3. Goals
1. Turn a structured product brief into a polished 15–30s short-form video + caption within minutes, grounded in that niche account's brand voice and post history.
2. Publish that content to the correct Instagram, Facebook, and YouTube accounts for that niche, only after human approval.
3. Give the operator full traceability into why the content looks the way it does (what brand guidance and past posts informed it, and how it scored on the quality rubric).
4. Run entirely on free-tier infrastructure, with zero recurring cost.
5. Demonstrate a credible, defensible full-stack architecture for academic evaluation — matching the depth of a prior RAG-based reference project (real ingestion, grounding, retrieval, evaluation, persistence, traceability).

## 4. Success Metrics
| Metric | Target |
|---|---|
| End-to-end pipeline success rate (brief → published post) | ≥ 90% on happy path during demo |
| Time from brief submission to review-ready content | < 3 minutes |
| Content passing Critic/QA rubric threshold without manual edit | ≥ 60% (rest go through human edit, which is expected and desired) |
| Repetition rate (new post cosine-similarity to last 10 posts on same account) | Below a defined threshold, enforced by retrieval-aware generation |
| Platforms supported in MVP | 3 (Instagram Reels, Facebook video posts, YouTube Shorts) — non-negotiable, not descoped |
| Infrastructure cost | $0/month |

## 5. MVP Scope
- Structured campaign brief intake (product name, niche/category, target audience, campaign goal, tone, optional product image, optional brand-guideline text/PDF).
- Multi-agent generation pipeline: Copywriter → Design (image) → Voice (TTS) → Video Compositor → Critic/QA.
- Retrieval-augmented generation: brand-guideline chunks + past-post embeddings retrieved per niche account before content generation, to enforce brand-voice consistency and reduce repetition.
- Human-in-the-loop approval screen (approve / edit / reject) before anything is scheduled.
- Multi-account, multi-niche dispatch: each account (IG + linked FB Page + YouTube channel) belongs to exactly one niche; the dispatcher posts only to the matching account set.
- Scheduled daily/on-demand publishing via GitHub Actions cron trigger.
- Traceability panel showing retrieved sources, past posts compared against, and Critic rubric scores.
- Post-history and basic analytics persistence (what was posted, when, to which account, and its Critic score).

## 6. Future Scope (explicitly parked)
- Multi-tenant SaaS mode: external users connect their own accounts via "Connect with Instagram/Facebook/YouTube" OAuth flow (requires Meta Advanced Access / App Review).
- Closed-source/paid model upgrades (e.g., GPT-4-class models, premium image/video generation APIs) for higher content quality.
- Real engagement-based feedback loop (pulling actual likes/comments/views back into the retrieval store to reinforce what performs well).
- Support for additional platforms (TikTok, X/Twitter, LinkedIn).
- A/B variant generation and automatic best-variant selection.
- Paid, higher-limit infrastructure tiers once usage outgrows free-tier caps.

## 7. Constraints
- Zero budget: every tool must be free-tier or open-source (see Tech Stack / NFR docs).
- 8-week hard deadline, 4-person team, parallel workstreams.
- All 3 platforms must ship in MVP — no descoping to one platform.
- Accounts are team-owned; no automated account creation, no fake accounts, no ToS-violating automation.
