"""Video Agent — Generates short-form reels through a configurable inference service.

The inference service URL, model, GPU profile, and storage credentials are
configuration values. The service can therefore be moved to a replacement
cloud account without changing this module.
"""

import logging
import os
import re
import shutil
import subprocess
import time
import urllib.request
import uuid
from pathlib import Path

import httpx
import imageio_ffmpeg

from app.core.config import get_settings
from app.core.retry import with_retry

logger = logging.getLogger(__name__)

MEDIA_OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "media_output"
VIDEO_WIDTH = 720
VIDEO_HEIGHT = 1280
FPS = 24


class VideoAgent:
    """Generate vertical video through a replaceable inference-service boundary."""

    def __init__(self) -> None:
        settings = get_settings()
        self.fal_key = settings.fal_key or os.getenv("FAL_KEY")
        _colab_url = settings.colab_video_api_url or os.getenv("COLAB_VIDEO_API_URL")
        self.colab_url = _colab_url.rstrip("/") if _colab_url else None
        self.hf_space_id = settings.hf_space_id or os.getenv("HF_SPACE_ID")
        self.hf_token = settings.hf_token or os.getenv("HF_TOKEN")
        self.video_provider = settings.video_provider.lower()
        self.video_inference_url = (settings.video_inference_url or "").rstrip("/")
        self.video_inference_api_key = settings.video_inference_api_key
        self.video_model = settings.video_model
        self.video_gpu_profile = settings.video_gpu_profile
        self.video_width = settings.video_width
        self.video_height = settings.video_height
        self.video_fps = settings.video_fps
        self.video_duration_seconds = settings.video_duration_seconds
        self.video_num_frames = settings.video_num_frames
        self.video_num_steps = settings.video_num_steps
        self.video_request_timeout_seconds = settings.video_request_timeout_seconds
        self.ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    def _is_inference_service_healthy(self) -> bool:
        """Fast non-blocking check (<= 2.5s) to verify remote GPU inference service availability."""
        if not self.video_inference_url:
            return False
        try:
            with httpx.Client(timeout=2.5, follow_redirects=True) as client:
                resp = client.get(f"{self.video_inference_url}/health")
                return resp.status_code == 200
        except Exception as e:
            logger.debug("Inference service health check failed: %s", e)
            return False

    def generate(
        self,
        video_scene_description: str,
        campaign_id: str | None = None,
        audio_path: str | None = None,
        first_frame_image_path: str | None = None,
        caption_text: str | None = None,
        script_text: str | None = None,
    ) -> str:
        """Generate a vertical short-form video reel and return the file path."""
        output_dir = MEDIA_OUTPUT_DIR / "videos"
        output_dir.mkdir(parents=True, exist_ok=True)

        cid = campaign_id or str(uuid.uuid4())
        final_video_path = output_dir / f"{cid}.mp4"

        # The inference service is the primary cloud provider.
        # Uses circuit-breaker so unallocated GPU quota never blocks local pipeline execution.
        providers = []

        if self.video_provider in {"inference_service", "http"} and self.video_inference_url:
            if self._is_inference_service_healthy():
                providers.append(("Configured video inference service", self._generate_with_inference_service))
            else:
                logger.warning(
                    "VideoAgent [%s]: Remote GPU service at %s is offline or GPU quota unallocated. "
                    "Fast-bypassing cloud inference to Local Studio Kinetic Motion Engine.",
                    cid,
                    self.video_inference_url,
                )

        if self.video_provider == "legacy" and self.hf_space_id and self.hf_space_id != "your-hf-space-here":
            providers.append((f"HF Space ({self.hf_space_id})", self._generate_with_hf_space))

        if self.video_provider == "legacy" and self.colab_url and self.colab_url != "your-colab-url-here":
            providers.append(("Google Colab API", self._generate_with_colab))

        if self.video_provider == "legacy" and self.fal_key and self.fal_key != "your-fal-key-here":
            providers.append(("Fal.ai Wan 2.1", self._generate_with_fal))

        for name, provider_fn in providers:
            try:
                logger.info("VideoAgent [%s]: Trying %s...", cid, name)
                raw_path = provider_fn(video_scene_description, cid)
                self._finalize_video(raw_path, audio_path, str(final_video_path))
                logger.info("VideoAgent [%s]: SUCCESS via %s", cid, name)
                return str(final_video_path)
            except Exception as e:
                logger.warning("VideoAgent [%s]: %s failed: %s", cid, name, e)

        # Final fallback — local kinetic motion engine (guaranteed & GPU-free)
        logger.info("VideoAgent [%s]: Generating studio-grade local kinetic motion reel.", cid)
        self._generate_local_motion_video(
            image_path=first_frame_image_path,
            audio_path=audio_path,
            output_path=str(final_video_path),
            caption_text=caption_text,
            script_text=script_text or video_scene_description,
        )
        return str(final_video_path)

    @with_retry(max_attempts=3, min_wait_seconds=2.0, max_wait_seconds=15.0)
    def _generate_with_inference_service(self, prompt: str, campaign_id: str) -> str:
        """Submit one generation request to the configured cloud service.

        The service owns model loading and Blob upload. This client only knows
        the stable HTTP contract, so changing Azure accounts is configuration-only.
        """
        headers = {"Content-Type": "application/json"}
        if self.video_inference_api_key:
            headers["Authorization"] = f"Bearer {self.video_inference_api_key}"

        payload = {
            "idempotency_key": campaign_id,
            "campaign_id": campaign_id,
            "prompt": prompt,
            "model": self.video_model,
            "gpu_profile": self.video_gpu_profile,
            "width": self.video_width,
            "height": self.video_height,
            "fps": self.video_fps,
            "num_frames": self.video_num_frames,
            "duration_seconds": self.video_duration_seconds,
            "num_steps": self.video_num_steps,
        }

        with httpx.Client(timeout=self.video_request_timeout_seconds, follow_redirects=True) as client:
            response = client.post(f"{self.video_inference_url}/generate", json=payload, headers=headers)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")
            if content_type.startswith("video/"):
                result = response.content
            else:
                result_payload = response.json()
                video_url = (
                    result_payload.get("blob_url")
                    or result_payload.get("video_url")
                    or result_payload.get("url")
                    or result_payload.get("path")
                )
                if not video_url:
                    raise RuntimeError(f"Inference service returned no video artifact: {result_payload}")
                if video_url.startswith(("http://", "https://")):
                    artifact_response = client.get(video_url, headers=headers)
                    artifact_response.raise_for_status()
                    result = artifact_response.content
                else:
                    local_result = Path(video_url)
                    if not local_result.exists():
                        raise RuntimeError(f"Inference service returned missing local artifact: {video_url}")
                    result = local_result.read_bytes()

        if len(result) < 1000:
            raise RuntimeError("Inference service returned an invalid or empty video")

        temp_path = MEDIA_OUTPUT_DIR / "videos" / f"{campaign_id}_inference.mp4"
        temp_path.write_bytes(result)
        logger.info("VideoAgent: Inference artifact saved at %s (%d KB)", temp_path, len(result) // 1024)
        return str(temp_path)

    # ── Provider 1: Fal.ai ───────────────────────────────────────

    def _generate_with_fal(self, prompt: str, campaign_id: str) -> str:
        import fal_client

        os.environ["FAL_KEY"] = self.fal_key
        result = fal_client.subscribe(
            "fal-ai/wan-t2v",
            arguments={
                "prompt": f"{prompt}, 9:16 vertical, cinematic lighting, 4k",
                "aspect_ratio": "9:16",
            },
            with_logs=True,
        )
        video_url = result.get("video", {}).get("url")
        if not video_url:
            raise RuntimeError(f"Fal.ai returned no video URL: {result}")

        temp_path = str(MEDIA_OUTPUT_DIR / "videos" / f"{campaign_id}_fal.mp4")
        urllib.request.urlretrieve(video_url, temp_path)
        return temp_path

    # ── Provider 2: Google Colab API ─────────────────────────────

    def _generate_with_colab(self, prompt: str, campaign_id: str) -> str:
        """Call the CogVideoX-2b server running on Google Colab."""
        # Health check first
        try:
            health = httpx.get(f"{self.colab_url}/health", timeout=10)
            health.raise_for_status()
            logger.info("VideoAgent: Colab server healthy: %s", health.json())
        except Exception as e:
            raise RuntimeError(f"Colab server not reachable: {e}") from e

        # Generate video
        response = httpx.post(
            f"{self.colab_url}/generate",
            json={
                "prompt": f"{prompt}, vertical 9:16, cinematic product commercial, high quality",
                "num_frames": 24,
                "num_steps": 30,
                "guidance_scale": 6.0,
            },
            timeout=300,  # 5 min timeout for generation
        )
        response.raise_for_status()

        # Save the returned video file
        temp_path = str(MEDIA_OUTPUT_DIR / "videos" / f"{campaign_id}_colab.mp4")
        with open(temp_path, "wb") as f:
            f.write(response.content)

        if os.path.getsize(temp_path) < 1000:
            os.remove(temp_path)
            raise RuntimeError("Colab returned invalid/empty video")

        logger.info("VideoAgent: Colab video saved (%d KB)", os.path.getsize(temp_path) // 1024)
        return temp_path

    # ── Provider 3: Your Own HuggingFace Space ───────────────────

    def _generate_with_hf_space(self, prompt: str, campaign_id: str) -> str:
        """Call YOUR custom Space that runs Wan 2.1 locally on ZeroGPU.

        Your Space uses a direct generate_video function (not the DashScope async API).
        """
        from gradio_client import Client

        space_id = self.hf_space_id
        logger.info("VideoAgent: Connecting to your HF Space '%s'...", space_id)

        # Set HF token via env var for authentication (gives higher ZeroGPU quota)
        if self.hf_token:
            os.environ["HF_TOKEN"] = self.hf_token

        client = Client(space_id)

        # Call the direct generate_video endpoint
        # This matches the Gradio interface in hf_space_files/app.py
        result = client.predict(
            prompt=f"{prompt}, vertical composition, cinematic, product commercial",
            negative_prompt="blurry, distorted, low quality, watermark",
            height=480,
            width=832,
            num_frames=33,
            num_steps=30,
            guidance_scale=5.0,
            seed=-1,
            api_name="/generate_video",
        )

        # result is the path to the generated video file
        if not result:
            raise RuntimeError(f"HF Space '{space_id}' returned no result")

        temp_path = str(MEDIA_OUTPUT_DIR / "videos" / f"{campaign_id}_hf.mp4")
        video_path = str(result)

        if os.path.exists(video_path):
            shutil.copy2(video_path, temp_path)
        else:
            # It might be a URL from the Space
            urllib.request.urlretrieve(video_path, temp_path)

        if not os.path.exists(temp_path) or os.path.getsize(temp_path) < 1000:
            raise RuntimeError(f"HF Space video file is empty or missing")

        logger.info("VideoAgent: HF Space video saved (%d KB)", os.path.getsize(temp_path) // 1024)
        return temp_path

    # ── Provider 4: Public HuggingFace Space (Wan-AI/Wan2.1) ─────

    def _generate_with_hf_public(self, prompt: str, campaign_id: str) -> str:
        """Call the original public Wan-AI/Wan2.1 Space (DashScope async API)."""
        from gradio_client import Client

        space_id = "Wan-AI/Wan2.1"
        logger.info("VideoAgent: Connecting to public HF Space '%s'...", space_id)
        client = Client(space_id)

        # Submit async generation (DashScope-style API)
        client.predict(
            prompt=f"{prompt}, vertical 9:16, cinematic, product commercial",
            size="720*1280",
            watermark_wan=False,
            seed=-1,
            api_name="/t2v_generation_async",
        )

        # Poll for completion
        max_wait = 300
        start = time.time()
        video_result = None

        while time.time() - start < max_wait:
            time.sleep(10)
            try:
                result = client.predict(api_name="/status_refresh")
                if result and isinstance(result, (tuple, list)) and len(result) > 0:
                    video_data = result[0]
                    if (isinstance(video_data, dict)
                            and video_data.get("video")
                            and not video_data.get("__type__")):
                        video_result = video_data["video"]
                        break

                    progress = 0
                    if len(result) > 3 and isinstance(result[3], (int, float)):
                        progress = result[3]
                    logger.info("VideoAgent: HF public progress: %.0f%%, elapsed: %.0fs",
                                progress, time.time() - start)
            except Exception as e:
                logger.debug("VideoAgent: HF poll error: %s", e)

        if not video_result:
            raise RuntimeError(f"Public HF Space timed out after {max_wait}s")

        temp_path = str(MEDIA_OUTPUT_DIR / "videos" / f"{campaign_id}_hf.mp4")
        if os.path.exists(str(video_result)):
            shutil.copy2(str(video_result), temp_path)
        else:
            urllib.request.urlretrieve(str(video_result), temp_path)

        return temp_path

    # ── Provider 5: Local Cinematic Motion Engine ────────────────

    def _build_ass_subtitles(self, text: str, duration: float, ass_file_path: Path) -> bool:
        """Create a styled ASS subtitle file with timed phrase chunks."""
        clean = re.sub(r"\[.*?\]|\(.*?\)", " ", text or "")
        clean = re.sub(r"\s+", " ", clean).strip()
        if not clean:
            return False

        clauses = re.split(r"(?<=[.?!,;—\n])\s+", clean)
        clauses = [c.strip() for c in clauses if c.strip()]
        chunks = []
        for clause in clauses:
            words = clause.split()
            if not words:
                continue
            chunk_size = 5 if len(words) > 6 else len(words)
            for i in range(0, len(words), chunk_size):
                chunk = " ".join(words[i : i + chunk_size])
                if chunk:
                    chunks.append(chunk)

        if not chunks:
            chunks = [clean]

        total_chunks = len(chunks)
        safe_dur = max(duration - 0.6, 1.0)
        chunk_dur = safe_dur / total_chunks

        dialogues = []
        for i, chunk in enumerate(chunks):
            start_sec = 0.2 + (i * chunk_dur)
            end_sec = min(start_sec + chunk_dur, duration)
            start_m, start_s = divmod(start_sec, 60)
            start_h, start_m = divmod(start_m, 60)
            start_str = f"{int(start_h):01d}:{int(start_m):02d}:{start_s:05.2f}"
            end_m, end_s = divmod(end_sec, 60)
            end_h, end_m = divmod(end_m, 60)
            end_str = f"{int(end_h):01d}:{int(end_m):02d}:{end_s:05.2f}"
            safe_text = chunk.replace("\\", "").replace("{", "").replace("}", "")
            dialogues.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{safe_text}")

        ass_content = (
            "[Script Info]\n"
            "ScriptType: v4.00+\n"
            f"PlayResX: {VIDEO_WIDTH}\n"
            f"PlayResY: {VIDEO_HEIGHT}\n"
            "ScaledBorderAndShadow: yes\n\n"
            "[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            "Style: Default,Arial,34,&H00FFFFFF,&H0000FFFF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,3,4,0,2,36,36,170,1\n\n"
            "[Events]\n"
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
            + "\n".join(dialogues)
        )
        ass_file_path.write_text(ass_content, encoding="utf-8")
        return True

    def _generate_local_motion_video(
        self,
        image_path: str | None,
        audio_path: str | None,
        output_path: str,
        caption_text: str | None = None,
        script_text: str | None = None,
    ) -> None:
        """Generate a 9:16 vertical video with kinetic zoom, voiceover, and styled subtitles using ffmpeg."""
        raw_duration = self._get_audio_duration(audio_path) if audio_path else 10.0
        # Ensure output complies with PRD >= 10s rule
        duration = max(raw_duration, 10.0)

        output_file = Path(output_path).resolve()
        output_dir = output_file.parent
        output_dir.mkdir(parents=True, exist_ok=True)

        # Build timed subtitles if script or caption text is available
        text_source = script_text or caption_text or ""
        ass_file_name = f"{output_file.stem}_subtitles.ass"
        ass_file_path = output_dir / ass_file_name
        has_subtitles = False
        if text_source:
            try:
                has_subtitles = self._build_ass_subtitles(text_source, duration, ass_file_path)
            except Exception as e:
                logger.warning("VideoAgent: Could not build subtitle file: %s", e)

        # Base filter: scale & crop to portrait 720x1280 with Ken-Burns pan/zoom
        has_image = image_path and os.path.exists(image_path)
        filter_parts = [
            f"scale={VIDEO_WIDTH}:{VIDEO_HEIGHT}:force_original_aspect_ratio=increase",
            f"crop={VIDEO_WIDTH}:{VIDEO_HEIGHT}",
            f"zoompan=z='min(zoom+0.0006,1.15)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={VIDEO_WIDTH}x{VIDEO_HEIGHT}:fps={FPS}",
        ]
        if has_subtitles:
            filter_parts.append(f"subtitles={ass_file_name}")

        vf_str = ",".join(filter_parts)

        cmd = [self.ffmpeg_exe, "-y"]
        if has_image:
            cmd.extend(["-loop", "1", "-i", str(Path(image_path).resolve())])
        else:
            cmd.extend(["-f", "lavfi", "-i", f"color=c=0x111827:s={VIDEO_WIDTH}x{VIDEO_HEIGHT}:d={duration}:r={FPS}"])

        has_audio = audio_path and os.path.exists(audio_path)
        if has_audio:
            cmd.extend(["-i", str(Path(audio_path).resolve())])
            cmd.extend([
                "-filter_complex", f"[0:v]{vf_str}[v]",
                "-map", "[v]", "-map", "1:a",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
                "-c:a", "aac", "-b:a", "192k", "-shortest",
            ])
        else:
            cmd.extend([
                "-vf", vf_str,
                "-t", str(duration),
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
            ])

        cmd.append(str(output_file))

        try:
            subprocess.run(cmd, cwd=str(output_dir), capture_output=True, text=True, check=True, timeout=120)
            logger.info("VideoAgent: Generated local kinetic reel at %s (%.1fs)", output_path, duration)
        except subprocess.CalledProcessError as e:
            logger.warning("VideoAgent: Primary kinetic render failed (%s), attempting simple fallback...", e)
            # Fallback without zoompan in case of unusual image dimensions
            simple_vf = f"scale={VIDEO_WIDTH}:{VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop={VIDEO_WIDTH}:{VIDEO_HEIGHT}"
            if has_subtitles:
                simple_vf += f",subtitles={ass_file_name}"
            cmd_fallback = [self.ffmpeg_exe, "-y"]
            if has_image:
                cmd_fallback.extend(["-loop", "1", "-t", str(duration), "-i", str(Path(image_path).resolve())])
            else:
                cmd_fallback.extend(["-f", "lavfi", "-i", f"color=c=0x111827:s={VIDEO_WIDTH}x{VIDEO_HEIGHT}:d={duration}:r={FPS}"])
            if has_audio:
                cmd_fallback.extend(["-i", str(Path(audio_path).resolve())])
                cmd_fallback.extend(["-filter_complex", f"[0:v]{simple_vf}[v]", "-map", "[v]", "-map", "1:a", "-c:a", "aac", "-b:a", "192k", "-shortest"])
            else:
                cmd_fallback.extend(["-vf", simple_vf, "-t", str(duration)])
            cmd_fallback.extend(["-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", str(output_file)])
            subprocess.run(cmd_fallback, cwd=str(output_dir), capture_output=True, text=True, check=True, timeout=120)
            logger.info("VideoAgent: Fallback reel rendered at %s (%.1fs)", output_path, duration)
        finally:
            if ass_file_path.exists():
                try:
                    ass_file_path.unlink()
                except Exception:
                    pass

    # ── Utilities ────────────────────────────────────────────────

    def _finalize_video(self, raw_path: str, audio_path: str | None, final_path: str) -> None:
        """Merge voiceover audio into the AI video, or just rename it."""
        if audio_path and os.path.exists(audio_path):
            try:
                self._merge_audio(raw_path, audio_path, final_path)
                if os.path.exists(raw_path) and raw_path != final_path:
                    os.remove(raw_path)
            except Exception as e:
                logger.warning("VideoAgent: Audio merge failed: %s — using raw.", e)
                if os.path.exists(raw_path):
                    os.rename(raw_path, final_path)
        else:
            os.rename(raw_path, final_path)

    def _merge_audio(self, video_path: str, audio_path: str, output_path: str) -> None:
        """Mix AI video audio (lowered) with voiceover on top."""
        cmd = [
            self.ffmpeg_exe, "-y",
            "-i", video_path, "-i", audio_path,
            "-filter_complex",
            "[0:a]volume=0.3[bg];[1:a]volume=1.0[vo];[bg][vo]amix=inputs=2:duration=shortest[aout]",
            "-map", "0:v", "-map", "[aout]",
            "-c:v", "copy", "-c:a", "aac", "-shortest", output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            cmd_simple = [
                self.ffmpeg_exe, "-y",
                "-i", video_path, "-i", audio_path,
                "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-c:a", "aac", "-shortest", output_path,
            ]
            subprocess.run(cmd_simple, capture_output=True, text=True, check=True, timeout=120)

    def _get_audio_duration(self, audio_path: str) -> float:
        """Get audio duration in seconds via ffmpeg."""
        try:
            cmd = [self.ffmpeg_exe, "-i", audio_path, "-f", "null", "-"]
            proc = subprocess.run(cmd, capture_output=True, text=True)
            match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", proc.stderr)
            if match:
                h, m, s = map(float, match.groups())
                return h * 3600 + m * 60 + s
        except Exception:
            pass
        return 6.0
