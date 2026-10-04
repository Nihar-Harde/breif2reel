# Copilot Context Prompt — Self-Hosted Video Generation Pipeline

Paste this into GitHub Copilot Chat (or drop it in as a `.github/copilot-instructions.md` file in the repo) to give it full context before asking it to help write code.

---

## Prompt to paste

I'm building a component of a larger project called **BrandCrew** — a niche-routed, retrieval-augmented multi-agent system for automated social media content generation. This specific piece is the **video generation module**. Help me build it step by step; ask me clarifying questions before writing large chunks of code.

**Goal:** Generate short AI videos from text prompts, one at a time (~60 videos), using a self-hosted open-source text-to-video model running on Azure's serverless GPU infrastructure (`Consumption-GPU-NC24ads-A100` primary, with T4 as quota fallback) — not a managed API like Sora or Nova Reel.

**Hard requirements:**
- Output: portrait orientation (9:16), 720p, ≥ 10 seconds per video (default 10.04s, 241 frames @ 24 fps)
- Generated videos must be closely faithful to the input prompt with commercial aesthetic quality
- Pipeline latency: under 5 minutes end-to-end (~3–4 minutes warm)
- Zero ongoing cash cost beyond a $200 Azure credit (with a hard safety stop at $190)
- Must NOT rely on manually provisioned/managed EC2 or Azure VMs — the compute layer should be **Azure Container Apps with serverless GPU** (Consumption workload profile, GPU-enabled), which bills per-second and scales to zero when idle
- GPU tier: NVIDIA A100 (`Consumption-GPU-NC24ads-A100`) as primary, with NVIDIA T4 as fallback

**Model choice:** We are committed to **LTX-Video Pro** (`Lightricks/LTX-Video` v0.9.5/v0.9.1) in `torch.bfloat16` precision. It natively supports variable temporal durations via its $8n+1$ DiT rule (241 frames @ 24fps = 10.04s) and generates in ~150s on A100.

**What I need help with, roughly in this order:**
1. A Dockerfile that packages LTX-Video + inference dependencies (PyTorch, diffusers, imageio-ffmpeg, CUDA base image) with weights pre-baked into the image to minimize cold start time for deployment to Azure Container Apps with GPU.
2. An inference script that:
   - Exposes HTTP endpoints (`POST /generate`, `GET /generate/{job_id}`)
   - Accepts a text prompt (and idempotency key)
   - Generates a video at 720x1280 (portrait), 241 frames at 24 fps (10.04 seconds)
   - Handles frame count / duration configuration explicitly
   - Writes the output video file to Azure Blob Storage and returns the blob URL
3. Guidance on Azure CLI commands to deploy the Container App with the GPU workload profile (`Consumption-GPU-NC24ads-A100`), with `--min-replicas 0 --max-replicas 1`
4. Error handling and retry logic for failed generations, plus logging of GPU-seconds and estimated cost against my $190 safety budget

**Context you should know:**
- I'm a B.Tech CSE (Data Science) student; this is a 7th-semester major project with an 8-week academic deadline
- My primary dev tool is GitHub Copilot — I want code that's well-commented and buildable incrementally, not a black-box scaffold
- I already have a separate pipeline for the rest of BrandCrew (CrewAI agents, FastAPI backend, Supabase, Cloudinary, React frontend) — this video module needs to output files in a way that's easy to hand off to that pipeline (S3/Blob URL or local path convention is fine, we'll wire it up later)
- I do not yet have GPU quota approved on Azure — assume that's pending, and don't let that block writing the code, just flag anywhere the code assumes quota is live

Start by asking me which of LTX-Video or Wan 2.2 I want to commit to, based on a quick comparison of VRAM needs and expected generation time per clip on a T4, then help me scaffold the Dockerfile.

---

*Reference: full research and decision log is in `BrandCrew_Video_Generation_Research.md` in this repo/session — Copilot can be pointed at that file for the pricing and platform-comparison background if needed.*
