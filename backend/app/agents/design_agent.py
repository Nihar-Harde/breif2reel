"""Design Agent — generates product images using Gemini Imagen (with Pollinations.ai fallback)."""

import logging
import uuid
from pathlib import Path

import httpx
from google import genai
from google.genai import types

from app.core.config import get_settings
from app.core.retry import with_retry

logger = logging.getLogger(__name__)

MEDIA_OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "media_output"


class DesignAgent:
    """Generate a product image from a text prompt.

    Primary: Gemini ``gemini-2.0-flash`` with image generation.
    Fallback: Pollinations.ai (free, no API key).
    """

    # Portrait dimensions for 9:16 reels
    POLLINATIONS_WIDTH = 1080
    POLLINATIONS_HEIGHT = 1920
    POLLINATIONS_TIMEOUT = 90

    def __init__(self) -> None:
        settings = get_settings()
        self.gemini_api_key = settings.gemini_api_key
        self.gemini_client = None
        if self.gemini_api_key and self.gemini_api_key != "your-gemini-api-key-here":
            try:
                self.gemini_client = genai.Client(api_key=self.gemini_api_key)
                logger.info("DesignAgent: Gemini Imagen client initialized.")
            except Exception as e:
                logger.warning("DesignAgent: Could not init Gemini client: %s", e)

    def generate(self, image_prompt: str, campaign_id: str | None = None) -> str:
        """Generate an image and return the local file path."""
        output_dir = MEDIA_OUTPUT_DIR / "images"
        output_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{campaign_id or uuid.uuid4()}.png"
        output_path = output_dir / filename

        # Try Gemini Imagen first
        if self.gemini_client:
            try:
                image_bytes = self._generate_with_gemini(image_prompt)
                output_path.write_bytes(image_bytes)
                logger.info(
                    "DesignAgent: Generated image via Gemini Imagen at %s (%d bytes)",
                    output_path, len(image_bytes),
                )
                return str(output_path)
            except Exception as e:
                logger.warning("DesignAgent: Gemini Imagen failed: %s — falling back to Pollinations.", e)

        # Fallback to Pollinations.ai
        try:
            image_bytes = self._fetch_from_pollinations(image_prompt)
            output_path.write_bytes(image_bytes)
            logger.info(
                "DesignAgent: Generated image via Pollinations at %s (%d bytes)",
                output_path, len(image_bytes),
            )
            return str(output_path)
        except Exception as e:
            logger.error("DesignAgent: All image generation methods failed: %s", e)
            raise RuntimeError(f"Image generation failed: {e}") from e

    def _generate_with_gemini(self, prompt: str) -> bytes:
        """Generate an image using Gemini with image output modality if available."""
        enhanced_prompt = (
            f"Generate a high-quality, professional product photograph. {prompt}. "
            "The image should be in 9:16 portrait orientation, suitable for an Instagram Reel cover."
        )

        for model_name in ["imagen-3.0-generate-002", "gemini-2.0-flash-preview-image-generation"]:
            try:
                response = self.gemini_client.models.generate_content(
                    model=model_name,
                    contents=enhanced_prompt,
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE", "TEXT"],
                    ),
                )
                if response and response.candidates:
                    for part in response.candidates[0].content.parts:
                        if part.inline_data and part.inline_data.data:
                            logger.info("DesignAgent: Gemini Imagen returned image (%s).", part.inline_data.mime_type)
                            return part.inline_data.data
            except Exception as e:
                logger.debug("DesignAgent: Model %s unavailable: %s", model_name, e)
                continue

        raise RuntimeError("Gemini image generation models not available on current API key.")

    @with_retry(max_attempts=3, min_wait_seconds=1.0, max_wait_seconds=8.0)
    def _fetch_from_pollinations(self, prompt: str) -> bytes:
        """Fetch an image from the free Pollinations.ai endpoint."""
        encoded_prompt = httpx.URL(f"https://image.pollinations.ai/prompt/{prompt}").copy_merge_params(
            {
                "width": str(self.POLLINATIONS_WIDTH),
                "height": str(self.POLLINATIONS_HEIGHT),
                "nologo": "true",
                "seed": str(uuid.uuid4().int % 100000),
            }
        )

        with httpx.Client(timeout=self.POLLINATIONS_TIMEOUT, follow_redirects=True) as client:
            response = client.get(str(encoded_prompt))
            response.raise_for_status()

        content_type = response.headers.get("content-type", "")
        if "image" not in content_type and len(response.content) < 1000:
            raise RuntimeError(f"Pollinations returned non-image content: {content_type}")

        return response.content
