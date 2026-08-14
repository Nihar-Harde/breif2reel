# Evaluation Plan — BrandCrew

The reference project (LexMind) validates RAG answer quality with a RAGAS-based evaluation pipeline. BrandCrew's content-generation domain has no direct RAGAS equivalent (there's no "correct answer" to grade against), so this plan defines an analogous, domain-appropriate evaluation approach: a rubric-based Critic score, an automated repetition/diversity check, and pipeline reliability metrics — run both online (in-pipeline, before every publish) and offline (batch, for the project report).

## 1. What Gets Evaluated
1. **Content quality** — does the generated caption/script/video match the brief and the niche account's brand voice?
2. **Groundedness** — is the generated content actually consistent with the retrieved brand-guideline chunks (not contradicting them)?
3. **Diversity / non-repetition** — is new content meaningfully different from the account's recent post history?
4. **Pipeline reliability** — does the multi-agent pipeline complete successfully, and how often does each agent fail or need a retry?
5. **Publish reliability** — per-platform publish success rate.

## 2. Online Evaluation (in-pipeline, every campaign)
Implemented as the Critic/QA Agent (FR-AGENT-05). For every generated campaign, the Critic LLM scores the draft on a 0–100 scale across four dimensions, with a short justification per dimension:
- **Brand-voice fit** — does tone/style match the retrieved brand guideline chunks and past posts?
- **Claim accuracy** — does the caption/script stay within the claims stated in the brief (no invented product features/benefits)?
- **Caption/hashtag quality** — is it well-formed, on-platform-convention, free of spam patterns?
- **Repetition score** (computed, not LLM-judged) — cosine similarity between new caption/script embedding and the last N published posts on that account; converted to a 0–100 "diversity score" (100 = fully novel).

An **overall score** is the average of the four; campaigns below a configured threshold (e.g., 65) are flagged `needs_review` in the UI but still shown to the human — the system never auto-blocks, it only flags, since human approval is mandatory regardless (FR-APPROVE-03).

## 3. Offline Evaluation (batch, for the project report)
A script (`evaluation/evaluate.py`, mirroring the reference project's evaluation script) runs a fixed batch of sample campaign briefs (e.g., 20–30 briefs spanning all niches and campaign goals) through the full pipeline without publishing, and reports:
- Distribution of Critic scores per dimension (mean, min, max) per niche.
- Distribution of repetition/diversity scores.
- Agent-level failure/retry rate (how often each agent needed a retry or fallback path).
- End-to-end generation time (p50/p95).
- A small human-reviewed sample (5–10 outputs) where a team member manually rates agreement with the Critic's scores, to sanity-check that the automated Critic isn't systematically over- or under-scoring — this substitutes for RAGAS's "faithfulness"-style check in a domain without ground-truth answers.

## 4. Publish Reliability Metrics
Tracked continuously via `post_history` (FR-PUBLISH-07):
- Publish success rate per platform (Instagram / Facebook / YouTube).
- Most common failure reasons per platform (e.g., token expiry, quota exceeded, malformed payload).
- Time from approval to successful publish.

## 5. Reporting
The final Evaluation Report (produced Week 8) includes: methodology, the rubric definition, aggregate scores from the offline batch run, the human-agreement spot-check results, publish reliability numbers, and a short discussion of known limitations (e.g., Critic is LLM-judged and not a ground-truth metric; free-tier rate limits capped batch size during evaluation). This report is the direct analog to the reference project's RAGAS evaluation output and is what elevates BrandCrew from "a demo that works once" to a system whose quality claims are actually measured.
