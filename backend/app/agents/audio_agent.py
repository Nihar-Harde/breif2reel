"""Audio Agent — converts voiceover scripts to MP3 using edge-tts."""

import asyncio
import logging
import os
import uuid
from pathlib import Path

import edge_tts
from app.core.retry import with_retry

logger = logging.getLogger(__name__)

# Directory where generated media artifacts are stored
MEDIA_OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "media_output"


class AudioAgent:
    """Generate voiceover audio from a script using Microsoft Edge TTS."""

    # Mapping of campaign tones to valid edge-tts voice names
    VOICE_MAP: dict[str, str] = {
        "playful": "en-US-JennyNeural",
        "formal": "en-US-GuyNeural",
        "bold": "en-US-ChristopherNeural",
        "minimal": "en-US-AriaNeural",
    }
    DEFAULT_VOICE = "en-US-JennyNeural"

    def generate(self, script: str, tone: str = "playful", campaign_id: str | None = None) -> str:
        """Generate an MP3 voiceover and return the file path."""
        output_dir = MEDIA_OUTPUT_DIR / "audio"
        output_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{campaign_id or uuid.uuid4()}.mp3"
        output_path = output_dir / filename

        voice = self.VOICE_MAP.get(tone, self.DEFAULT_VOICE)

        try:
            self._run_synthesis(script, voice, str(output_path))
            logger.info("AudioAgent: Generated voiceover at %s using %s", output_path, voice)
        except Exception as e:
            logger.warning("AudioAgent: Voice '%s' failed (%s), retrying with default voice '%s'...", voice, e, self.DEFAULT_VOICE)
            try:
                self._run_synthesis(script, self.DEFAULT_VOICE, str(output_path))
                logger.info("AudioAgent: Generated voiceover with fallback voice at %s", output_path)
            except Exception as exc:
                logger.error("AudioAgent: edge-tts synthesis failed completely: %s", exc)
                raise RuntimeError(f"Audio generation failed: {exc}") from exc

        return str(output_path)

    @staticmethod
    @with_retry(max_attempts=3, min_wait_seconds=1.0, max_wait_seconds=5.0)
    def _run_synthesis(text: str, voice: str, output_path: str) -> None:
        """Run edge-tts synthesis, handling both sync and async calling contexts.

        ``asyncio.run()`` fails when an event loop is already running
        (e.g. inside a FastAPI background task).  We therefore spin up a
        dedicated thread with its own event loop.
        """
        import concurrent.futures

        def _thread_target() -> None:
            loop = asyncio.new_event_loop()
            try:
                loop.run_until_complete(AudioAgent._synthesize(text, voice, output_path))
            finally:
                loop.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_thread_target)
            future.result()  # propagate any exception

    @staticmethod
    async def _synthesize(text: str, voice: str, output_path: str) -> None:
        """Run edge-tts communicate and save to disk."""
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)

