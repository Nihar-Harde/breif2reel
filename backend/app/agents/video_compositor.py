"""Video Compositor — assembles image + audio into a captioned short-form video.

Compatible with MoviePy v2.x (uses ``from moviepy import ...`` and ``with_*`` API).
"""

import logging
import uuid
from pathlib import Path

from moviepy import (
    AudioFileClip,
    CompositeVideoClip,
    ImageClip,
    TextClip,
)

logger = logging.getLogger(__name__)

MEDIA_OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "media_output"

# Reel dimensions (9:16 portrait)
VIDEO_WIDTH = 1080
VIDEO_HEIGHT = 1920
FPS = 24


class VideoCompositor:
    """Composite a background image, voiceover audio, and caption overlay into an MP4 reel."""

    def generate(
        self,
        image_path: str,
        audio_path: str,
        caption_text: str,
        campaign_id: str | None = None,
    ) -> str:
        """Create a short-form video reel.

        Parameters
        ----------
        image_path:
            Path to the background product image.
        audio_path:
            Path to the voiceover MP3 file.
        caption_text:
            Text to overlay on the video as a caption.
        campaign_id:
            Optional identifier for the output filename.

        Returns
        -------
        str
            Absolute path to the generated MP4 video.
        """
        output_dir = MEDIA_OUTPUT_DIR / "videos"
        output_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{campaign_id or uuid.uuid4()}.mp4"
        output_path = output_dir / filename

        try:
            video = self._compose(image_path, audio_path, caption_text)
            video.write_videofile(
                str(output_path),
                fps=FPS,
                codec="libx264",
                audio_codec="aac",
                logger=None,  # suppress moviepy's verbose output
            )
            video.close()
            logger.info("VideoCompositor: Generated reel at %s", output_path)
        except Exception as e:
            logger.error("VideoCompositor: Video assembly failed: %s", e)
            raise RuntimeError(f"Video compositing failed: {e}") from e

        return str(output_path)

    @staticmethod
    def _compose(image_path: str, audio_path: str, caption_text: str) -> CompositeVideoClip:
        """Build the composite video clip from image + audio + text."""
        audio_clip = AudioFileClip(audio_path)
        duration = audio_clip.duration

        # Background image stretched to reel dimensions for the audio's duration
        bg_clip = (
            ImageClip(image_path)
            .with_duration(duration)
            .resized((VIDEO_WIDTH, VIDEO_HEIGHT))
        )

        # Caption overlay — positioned at the lower third of the frame
        # Truncate very long captions for readability
        display_caption = caption_text[:200] + "..." if len(caption_text) > 200 else caption_text

        try:
            text_clip = (
                TextClip(
                    text=display_caption,
                    font_size=42,
                    color="white",
                    font="Arial-Bold",
                    method="caption",
                    size=(VIDEO_WIDTH - 120, None),  # horizontal padding
                    stroke_color="black",
                    stroke_width=2,
                    duration=duration,
                )
                .with_position(("center", VIDEO_HEIGHT - 350))
            )
        except Exception:
            # Fallback if preferred font is unavailable on this system
            logger.warning("VideoCompositor: Arial-Bold not found, falling back to default font.")
            text_clip = (
                TextClip(
                    text=display_caption,
                    font_size=42,
                    color="white",
                    method="caption",
                    size=(VIDEO_WIDTH - 120, None),
                    stroke_color="black",
                    stroke_width=2,
                    duration=duration,
                )
                .with_position(("center", VIDEO_HEIGHT - 350))
            )

        composite = CompositeVideoClip(
            [bg_clip, text_clip],
            size=(VIDEO_WIDTH, VIDEO_HEIGHT),
        ).with_audio(audio_clip)

        return composite
