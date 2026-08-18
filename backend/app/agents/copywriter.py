import json
import logging
import re
from app.services.llm_groq import LLMService

logger = logging.getLogger(__name__)


class CopywriterAgent:
    def __init__(self) -> None:
        self.llm_service = LLMService()

    def generate(
        self,
        product_name: str,
        target_audience: str,
        tone: str,
        campaign_goal: str | None = None,
        brand_guideline_text: str | None = None,
        retrieved_chunks: list[dict] | None = None,
    ) -> dict:
        """Generate a caption, voiceover script, image prompt, and hashtags for a campaign brief."""
        # Convert retrieved chunks to a formatted string
        chunks_str = ""
        if retrieved_chunks:
            chunks_str = "\n".join(
                f"- [Source: {c.get('source')}] {c.get('text')}"
                for c in retrieved_chunks
            )
        else:
            chunks_str = "None"

        system_instruction = (
            "You are an expert social media copywriter. Your goal is to generate marketing assets for short-form video campaigns (Instagram Reels, Facebook videos, YouTube Shorts).\n"
            "You must output a single, valid JSON object containing exactly the following keys:\n"
            '1. "caption": A catchy, punchy caption matching the product name and tone.\n'
            '2. "hashtags": A JSON list of 3-5 relevant hashtags (as strings, including the "#" symbol).\n'
            '3. "voiceover_script": A 15-20 second voiceover script. Ensure it sounds natural and fits the specified campaign goal and target audience.\n'
            '4. "image_prompt": A highly detailed prompt to generate a stunning visual representing the product (suitable for a text-to-image generator like Stable Diffusion). Focus on composition, style, and lighting. Do not include text in the image.\n\n'
            "Output ONLY valid JSON. Do not include markdown code block formatting (like ```json ... ```) or any pre/post commentary. Return raw JSON string."
        )

        prompt = (
            f"Product Name: {product_name}\n"
            f"Target Audience: {target_audience}\n"
            f"Tone: {tone}\n"
            f"Campaign Goal: {campaign_goal or 'awareness'}\n"
            f"Brand Guidelines: {brand_guideline_text or 'None'}\n"
            f"Grounding Context (Retrieved Chunks):\n{chunks_str}\n\n"
            "Generate the campaign assets:"
        )

        try:
            # Call LLM Service with JSON mode requested
            response_text = self.llm_service.generate(
                prompt=prompt,
                system_instruction=system_instruction,
                temperature=0.7,
                response_json=True,
            )

            # Clean markdown code block wraps if present
            cleaned_response = response_text.strip()
            if cleaned_response.startswith("```"):
                cleaned_response = re.sub(r"^```(?:json)?\n", "", cleaned_response)
                cleaned_response = re.sub(r"\n```$", "", cleaned_response)
                cleaned_response = cleaned_response.strip()

            parsed = json.loads(cleaned_response)

            # Ensure all required keys are present
            required_keys = ["caption", "hashtags", "voiceover_script", "image_prompt"]
            for key in required_keys:
                if key not in parsed:
                    raise KeyError(f"Missing required key in LLM response: {key}")

            # For compatibility with older structures
            parsed["script"] = parsed["voiceover_script"]
            return parsed

        except Exception as e:
            logger.error(f"CopywriterAgent LLM generation/parsing failed: {e}. Falling back to deterministic draft.")
            # Fallback to local draft generator for robustness
            base = f"{product_name} built for {target_audience}. Tone: {tone}."
            hashtags = ["#breif2reel", "#campaign"]
            caption = f"{base} {' '.join(hashtags)}"
            script = f"Meet {product_name}. Designed for {target_audience}. This is your next smart pick."
            image_prompt = f"Studio product shot of {product_name}, cinematic lighting, social media style"

            return {
                "caption": caption,
                "script": script,
                "voiceover_script": script,
                "image_prompt": image_prompt,
                "hashtags": hashtags,
            }


