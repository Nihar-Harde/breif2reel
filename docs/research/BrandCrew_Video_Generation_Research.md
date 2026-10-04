# Video Generation Research — BrandCrew Project
*Exported chat log — compiled Sept 4, 2026*

## Requirement
- 720p, portrait (9:16), ≥ 10 seconds (default 10.04s, 241 frames @ 24 fps, range 10–15s)
- ~60 videos needed
- Must relate closely to the prompt (prompt adherence matters)
- Quality: good commercial-grade quality (fast DiT generation, no stutter, crisp geometry)
- Generation latency: ~3–4 minutes warm, < 5 minutes total end-to-end
- Budget: zero cash budget — working from a $200 Azure cloud credit with a hard safety stop at $190
- One request at a time via frontend UI (asynchronous polling), sequential batch script for offline evaluation

## Decision: Going with LTX-Video Pro on Azure Container Apps Serverless GPU (A100 Primary)

This route runs **LTX-Video Pro** (`Lightricks/LTX-Video` v0.9.5/v0.9.1) on Azure Container Apps serverless GPU infrastructure (`Consumption-GPU-NC24ads-A100` primary, with T4 as quota fallback):
- **Why LTX-Video over Wan 2.1 14B:** Wan 2.1 14B produces great video but takes 16–18 minutes per 10s reel on A100 (unacceptable for live major project demos and web UX). LTX-Video Pro completes a native 10s clip in ~150 seconds (2.5 minutes), bringing total end-to-end pipeline execution under 4 minutes.
- **Why LTX-Video over Wan 2.1 1.3B:** Wan 1.3B is locked to 81 frames (~5s) and degrades heavily when stretched to 10s. LTX-Video natively supports flexible durations via its $8n+1$ temporal DiT rule (241 frames @ 24fps = 10.04s).
- **GPU Profile:** A100 (80GB VRAM) holds the model in full `torch.bfloat16` with zero CPU offloading penalties or OOM risks.

### Action items, in order
1. **Request GPU quota immediately** — Request `Consumption-GPU-NC24ads-A100` (primary) and `Consumption-GPU-NC8as-T4` (fallback). Quota approval takes 1–5 business days.
2. Deploy a **Consumption workload profile** with GPU enabled (`gpu-a100` primary).
3. Package **LTX-Video** with PyTorch and Diffusers, pre-baking weights into the image to minimize cold start.
4. Containerize the HTTP inference service (`POST /generate`, `GET /generate/{job_id}`), writing directly to Azure Blob Storage.
5. Set up Azure Budget alert at $190 with an automated stop action.

### Confirmed pricing (Azure Container Apps Serverless GPU)
- **A100:** $0.000529/GPU-second ≈ $1.90/hour
- **T4:** under $1.00/hour (fallback)
- Billed **per-second**, **scales to zero** when idle.
- Cost estimate for 60 clips on A100: ~150s inference $\times$ $0.000529/s = ~$0.08/clip $\times$ 60 = **~$4.80** raw GPU compute. Factoring cold starts and testing, total spend is **~$15–$25**, well within the $190 safety cap.

---

## Reference: why AWS doesn't have an equivalent
Checked every angle for a "serverless GPU, not EC2" option on AWS:
- **SageMaker Serverless Inference** — explicitly excludes GPUs (confirmed in AWS's own feature-exclusion docs).
- **AWS Lambda** — no GPU resource type exists at all, no roadmap commitment.
- **AWS Fargate / ECS / EKS** — no GPU support without the EC2 launch type, i.e. the exact thing being avoided.
- **Bedrock Custom Model Import** — only supports specific text/LLM architectures (Llama, Mistral, Flan-T5, GPT-OSS). No diffusion/video architectures supported, so a custom video model can't be imported.
- Closest AWS gets: **SageMaker Asynchronous Inference** — managed instance lifecycle, scales to zero, but billed per GPU-instance-hour (g4dn/g5), not true per-second serverless. Functionally "managed EC2," not serverless GPU.

**Conclusion:** Azure is the only one of the two clouds with a genuine answer to this specific ask.

---

## Reference: earlier options considered (for context)

### Azure AI Foundry — Sora 2 (managed API)
- Only native video-gen model in Azure AI Foundry; Sora 1 is fully retired.
- Gated preview access, phased rollout.
- **Duration is fixed**: 4, 8, or 12 seconds only — no custom 15–18s option.
- Resolution: 720×1280 portrait, Standard tier (matches "low-to-medium" quality preference).
- Price: $0.10/sec → very affordable for 80 videos (~$96–$115 depending on duration).
- **Major risk:** Sora 2 on Azure is being sunset. OpenAI's own API sunsets Sept 24, 2026. Azure-specific retirement dates have varied by tenant/deployment, seen as early as June 2, 2026 and as late as Sept 14, 2026. **Check your own Foundry portal for your tenant's exact date before relying on this.**
- No replacement video model currently in Foundry (including newest MAI-family models, which are image/voice/text only, not video).

### AWS Bedrock — Nova Reel vs Luma Ray2 (managed APIs)
| | Nova Reel (v1.1) | Luma Ray2 |
|---|---|---|
| Duration | Flexible, 6s multiples from 12–120s (12s or 18s both work) | Fixed: 5s or 9s only — doesn't reach 12–18s |
| Portrait | **No** — hard-locked to 1280x720 landscape | Yes — 9:16 supported |
| Resolution | 720p only | 540p or 720p |
| Price | $0.08/sec → 18s = $1.44/video → ~$115 for 80 videos | $0.75–$1.50/sec → 9s = $6.75–$13.50/video → $300–$1,080 for 80 videos, blows past $140 budget |
| Status | Legacy tier; v1:0 has firm EOL Sept 30, 2026 | Active, no retirement flagged |

Neither AWS managed model satisfies all three requirements (portrait + 12–18s + 80 videos on budget) simultaneously.

---

## Notes for next session
- Confirm GPU quota approval status before writing any pipeline code.
- Decide between T4 (cheaper, slower) and A100 (faster, ~$1.90/hr) based on how long generation takes per clip once tested.
- LTX-Video vs Wan 2.2 — worth benchmarking both for speed/quality on the approved GPU tier before committing.
- Keep the Sora 2 / Nova Reel managed-API routes as documented fallbacks in case the self-hosted pipeline takes longer than expected to get working.
