#!/usr/bin/env python3
"""
Diagnostic Test — tests each pipeline stage independently.

Run from the backend directory:
    python diagnostic_test.py

Requires: .env with GEMINI_API_KEY (and optionally GROQ_API_KEY).
"""

import json
import os
import sys
import time

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()


# ── Helpers ──────────────────────────────────────────────────────────────

import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

PASS = "[PASS]"
FAIL = "[FAIL]"
WARN = "[WARN]"

def section(title: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def result(label: str, ok: bool, detail: str = "") -> None:
    status = PASS if ok else FAIL
    print(f"  {status}  {label}")
    if detail:
        for line in detail.split("\n"):
            print(f"         {line}")


# ── Test Configuration ───────────────────────────────────────────────────

SAMPLE_PRODUCT = "AeroBlend Pro Blender"
SAMPLE_AUDIENCE = "Health-conscious millennials who love smoothies"
SAMPLE_TONE = "playful"
SAMPLE_GOAL = "awareness"


# ── Stage 1: LLM Service ────────────────────────────────────────────────

def test_llm_service() -> bool:
    section("Stage 1: LLM Service (Groq / Gemini)")
    try:
        from app.services.llm_groq import LLMService
        svc = LLMService()

        providers = []
        if svc.groq_client:
            providers.append("Groq")
        if svc.gemini_client:
            providers.append("Gemini")
        result("Provider availability", bool(providers), f"Available: {', '.join(providers) or 'NONE'}")

        if not providers:
            result("Text generation", False, "No LLM providers configured")
            return False

        resp = svc.generate(
            prompt="Say 'hello world' in JSON format: {\"message\": \"...\"}",
            response_json=True,
            temperature=0.1,
        )
        parsed = json.loads(resp)
        result("Text generation", True, f"Response: {json.dumps(parsed)[:100]}")
        return True
    except Exception as e:
        result("Text generation", False, str(e))
        return False


# ── Stage 2: Copywriter Agent ───────────────────────────────────────────

def test_copywriter() -> dict | None:
    section("Stage 2: Copywriter Agent")
    try:
        from app.agents.copywriter import CopywriterAgent
        agent = CopywriterAgent()

        t0 = time.time()
        output = agent.generate(
            product_name=SAMPLE_PRODUCT,
            target_audience=SAMPLE_AUDIENCE,
            tone=SAMPLE_TONE,
            campaign_goal=SAMPLE_GOAL,
        )
        elapsed = time.time() - t0

        # Validate all keys
        required = ["caption", "hashtags", "voiceover_script", "image_prompt", "video_scene_description"]
        missing = [k for k in required if k not in output]
        result("All required keys present", not missing, f"Missing: {missing}" if missing else f"Keys: {list(output.keys())}")

        # Caption quality checks
        caption = output.get("caption", "")
        has_hashtag_in_caption = "#" in caption
        has_markdown = any(c in caption for c in ["*", "_", "~", "`"])
        result("Caption clean (no hashtags inline)", not has_hashtag_in_caption, f"Caption: {caption[:120]}")
        result("Caption clean (no markdown)", not has_markdown, f"Caption: {caption[:120]}")

        # Script quality
        script = output.get("voiceover_script", "")
        result("Voiceover script present", len(script) > 20, f"Script ({len(script)} chars): {script[:120]}")

        # Image prompt quality
        img_prompt = output.get("image_prompt", "")
        mentions_product = SAMPLE_PRODUCT.lower().split()[0] in img_prompt.lower()
        result("Image prompt mentions product", mentions_product, f"Prompt: {img_prompt[:120]}")

        # Video scene description
        video_desc = output.get("video_scene_description", "")
        result("Video scene description present", len(video_desc) > 20, f"Scene: {video_desc[:120]}")

        result("Generation time", True, f"{elapsed:.1f}s")

        print(f"\n  Full output:\n{json.dumps(output, indent=2)[:800]}")
        return output
    except Exception as e:
        result("Copywriter generation", False, str(e))
        return None


# ── Stage 3: Design Agent (Gemini Imagen) ────────────────────────────────

def test_design_agent(image_prompt: str) -> str | None:
    section("Stage 3: Design Agent (Gemini Imagen)")
    try:
        from app.agents.design_agent import DesignAgent
        agent = DesignAgent()

        result("Gemini Imagen client", agent.gemini_client is not None,
               "Gemini client initialized" if agent.gemini_client else "MISSING — will fall back to Pollinations")

        t0 = time.time()
        path = agent.generate(image_prompt=image_prompt, campaign_id="diagnostic_test")
        elapsed = time.time() - t0

        size_kb = os.path.getsize(path) / 1024
        result("Image generated", True, f"Path: {path}")
        result("Image file size", size_kb > 5, f"{size_kb:.1f} KB")
        result("Generation time", True, f"{elapsed:.1f}s")
        return path
    except Exception as e:
        result("Image generation", False, str(e))
        return None


# ── Stage 4: Audio Agent (edge-tts) ─────────────────────────────────────

def test_audio_agent(script: str) -> str | None:
    section("Stage 4: Audio Agent (edge-tts)")
    try:
        from app.agents.audio_agent import AudioAgent
        agent = AudioAgent()

        t0 = time.time()
        path = agent.generate(script=script, tone=SAMPLE_TONE, campaign_id="diagnostic_test")
        elapsed = time.time() - t0

        size_kb = os.path.getsize(path) / 1024
        result("Audio generated", True, f"Path: {path}")
        result("Audio file size", size_kb > 5, f"{size_kb:.1f} KB")
        result("Generation time", True, f"{elapsed:.1f}s")
        return path
    except Exception as e:
        result("Audio generation", False, str(e))
        return None


# ── Stage 5: Video Agent ─────────────────────────────────────────────────

def test_video_agent(
    video_desc: str,
    audio_path: str | None,
    image_path: str | None,
    caption: str = "",
    script: str = "",
) -> str | None:
    section("Stage 5: Video Agent (Circuit-Breaker Cloud / Local Studio Kinetic Motion)")
    try:
        from app.agents.video_agent import VideoAgent
        agent = VideoAgent()

        configured = []
        if agent.video_provider in {"inference_service", "http"} and agent.video_inference_url:
            configured.append(f"Inference Service (Healthcheck: {'HEALTHY' if agent._is_inference_service_healthy() else 'UNREACHABLE/BYPASS'})")
        if agent.video_provider == "legacy" and agent.hf_space_id and agent.hf_space_id != "your-hf-space-here":
            configured.append(f"HF Space ({agent.hf_space_id})")
        if agent.video_provider == "legacy" and agent.colab_url and agent.colab_url != "your-colab-url-here":
            configured.append("Google Colab API")
        configured.append("Local Studio Kinetic Motion Engine (Ken-Burns + Synced Subtitles)")

        result("Video Generation Engines", True, f"Priority Chain: {' -> '.join(configured)}")

        t0 = time.time()
        path = agent.generate(
            video_scene_description=video_desc,
            campaign_id="diagnostic_test",
            audio_path=audio_path,
            first_frame_image_path=image_path,
            caption_text=caption,
            script_text=script or video_desc,
        )
        elapsed = time.time() - t0

        size_kb = os.path.getsize(path) / 1024
        result("Video generated", True, f"Path: {path}")
        result("Video file size", size_kb > 50, f"{size_kb:.1f} KB")
        result("Generation time", True, f"{elapsed:.1f}s")
        return path
    except Exception as e:
        result("Video generation", False, str(e))
        return None


# ── Main ─────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("  BRIEF2REEL — PIPELINE DIAGNOSTIC TEST")
    print(f"  Product: {SAMPLE_PRODUCT}")
    print(f"  Audience: {SAMPLE_AUDIENCE}")
    print(f"  Tone: {SAMPLE_TONE}")
    print("=" * 60)

    total_start = time.time()

    # Stage 1: LLM
    llm_ok = test_llm_service()
    if not llm_ok:
        print("\n❌ LLM service is not working. Fix API keys before continuing.")
        sys.exit(1)

    # Stage 2: Copywriter
    copywriter_output = test_copywriter()
    if not copywriter_output:
        print("\n❌ Copywriter failed. Cannot continue.")
        sys.exit(1)

    # Stage 3: Image
    image_path = test_design_agent(copywriter_output["image_prompt"])

    # Stage 4: Audio
    audio_path = test_audio_agent(copywriter_output["voiceover_script"])

    # Stage 5: AI Video
    video_desc = copywriter_output.get("video_scene_description", "")
    video_path = test_video_agent(
        video_desc=video_desc,
        audio_path=audio_path,
        image_path=image_path,
        caption=copywriter_output.get("caption", ""),
        script=copywriter_output.get("voiceover_script", ""),
    )

    # Summary
    total_elapsed = time.time() - total_start
    section("DIAGNOSTIC SUMMARY")
    print(f"  {'[PASS]' if llm_ok else '[FAIL]'}  LLM Service")
    print(f"  {'[PASS]' if copywriter_output else '[FAIL]'}  Copywriter Agent")
    print(f"  {'[PASS]' if image_path else '[FAIL]'}  Design Agent (Gemini Imagen)")
    print(f"  {'[PASS]' if audio_path else '[FAIL]'}  Audio Agent (edge-tts)")
    print(f"  {'[PASS]' if video_path else '[FAIL]'}  Video Agent")
    print(f"\n  Total time: {total_elapsed:.1f}s")

    if all([llm_ok, copywriter_output, image_path, audio_path, video_path]):
        print("\n  ALL STAGES PASSED -- Pipeline is fully operational!")
    else:
        print("\n  Some stages failed. Check the output above for details.")

    print("=" * 60)


if __name__ == "__main__":
    main()
