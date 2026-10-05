"""Copywriter Agent — generates high-quality marketing copy for short-form video campaigns."""

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
        avoid_snippets: list[str] | None = None,
        reprompt_attempt: int = 0,
    ) -> dict:
        """Generate marketing copy assets for a campaign brief."""
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
            "You are a professional social media copywriter specialising in short-form vertical video "
            "(Instagram Reels, YouTube Shorts, TikTok). You craft engaging, clean, production-ready copy "
            "that balances hook retention, brand guidelines, and clear calls-to-action.\n\n"
            "RULES YOU MUST FOLLOW:\n"
            "1. Output ONLY a single valid JSON object. No markdown fences, no commentary before or after.\n"
            "2. The JSON must contain exactly these keys:\n\n"
            '  "caption" — A structured 2-3 sentence social media caption (25-45 words). '
            "Sentence 1 MUST hook the reader immediately with a relatable question, friction point, or bold premise. "
            "Sentence 2 presents the key product transformation or benefit in alignment with the specified tone. "
            "Sentence 3 MUST provide a clear, tone-appropriate call-to-action (CTA) (e.g. 'Tap link in bio to learn more', "
            "'Explore the collection at link in bio', 'Upgrade your daily routine today'). "
            "Do NOT include hashtags in the caption itself. Do NOT use markdown formatting, asterisks, bullet points, or emojis. "
            "Write clean plain text only.\n\n"
            '  "hashtags" — A JSON array of 4-6 relevant hashtags as strings (include the # symbol). '
            "Mix broad reach tags with niche-specific ones.\n\n"
            '  "voiceover_script" — A conversational 15-20 second voiceover script (35-50 words spoken aloud). '
            "Structure: "
            "(1) First 3 seconds: Start with a punchy pattern-interrupt hook or direct relatable statement "
            "(avoid generic overused phrases like 'Have you ever wondered' or 'Are you tired of'). "
            "(2) Middle 10 seconds: Describe the core experience or tactile benefit smoothly with natural conversational rhythm. "
            "(3) Last 3 seconds: Conclude with a strong punchline or spoken CTA. "
            "Write strictly the spoken words as someone would speak them aloud. No stage directions, no markdown, "
            "no asterisks, no brackets.\n\n"
            '  "image_prompt" — A detailed, specific prompt for an AI image generator. '
            f'The image MUST prominently feature the product "{product_name}" as the main subject. '
            "Describe the exact product appearance, camera angle (close-up, hero shot, flat lay), "
            "lighting style (studio, golden hour, neon), and background. "
            "Do NOT describe people as the main subject. The product must be clearly visible and centered.\n\n"
            '  "video_scene_description" — A vivid, cinematic description of a 5-8 second video scene '
            f'showcasing "{product_name}". Describe camera movement (slow zoom, pan, tracking shot), '
            "the environment, lighting, and any motion or action. This will be used by an AI video generator. "
            "Keep it to one continuous scene with no cuts. Include audio/sound design notes at the end.\n\n"
            "3. Match the specified tone throughout all outputs.\n"
            "4. Do NOT invent false claims about the product.\n"
        )

        prompt = (
            f"Product Name: {product_name}\n"
            f"Target Audience: {target_audience}\n"
            f"Tone: {tone}\n"
            f"Campaign Goal: {campaign_goal or 'awareness'}\n"
            f"Brand Guidelines: {brand_guideline_text or 'None'}\n"
            f"Grounding Context (Retrieved Chunks):\n{chunks_str}\n"
        )

        if avoid_snippets:
            avoid_str = "\n".join(f"- {s}" for s in avoid_snippets[:4])
            prompt += (
                f"\n[CRITICAL ANTI-REPETITION DIRECTIVE - ATTEMPT {reprompt_attempt + 1}]\n"
                f"Previous copy was flagged as repetitive compared to past published posts in this niche.\n"
                f"You MUST use a completely distinct hook, fresh angle, and different vocabulary.\n"
                f"AVOID duplicating phrases or concepts similar to:\n{avoid_str}\n"
            )

        prompt += "\nGenerate the campaign assets now:"

        try:
            response_text = self.llm_service.generate(
                prompt=prompt,
                system_instruction=system_instruction,
                temperature=0.7 + min(0.2, reprompt_attempt * 0.1),
                response_json=True,
            )

            parsed = self._parse_response(response_text)
            parsed = self._clean_and_validate(parsed, product_name, target_audience, tone)
            return parsed

        except Exception as e:
            logger.error("CopywriterAgent generation failed: %s. Using deterministic fallback.", e)
            return self._deterministic_fallback(product_name, target_audience, tone)

    @staticmethod
    def _parse_response(response_text: str) -> dict:
        """Parse the LLM response, stripping markdown fences if present."""
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
            cleaned = re.sub(r"\n?```$", "", cleaned)
            cleaned = cleaned.strip()
        return json.loads(cleaned)

    @staticmethod
    def _clean_and_validate(parsed: dict, product_name: str, target_audience: str, tone: str) -> dict:
        """Validate required keys, clean formatting artifacts, and ensure consistency."""
        required_keys = ["caption", "hashtags", "voiceover_script", "image_prompt", "video_scene_description"]
        for key in required_keys:
            if key not in parsed:
                raise KeyError(f"Missing required key in LLM response: {key}")

        # Clean caption — strip any accidentally included hashtags, markdown, or emojis
        caption = str(parsed["caption"])
        caption = re.sub(r"#\w+", "", caption).strip()  # remove inline hashtags
        caption = re.sub(r"[*_~`]", "", caption)  # remove markdown formatting
        caption = re.sub(r"\s{2,}", " ", caption)  # collapse multiple spaces
        parsed["caption"] = caption

        # Clean voiceover script — must be plain spoken text
        script = str(parsed["voiceover_script"])
        script = re.sub(r"[*_~`\[\]()]", "", script)  # strip markdown
        script = re.sub(r"\s{2,}", " ", script).strip()
        parsed["voiceover_script"] = script
        parsed["script"] = script  # backward compatibility

        # Ensure hashtags is a list of strings
        if isinstance(parsed["hashtags"], str):
            parsed["hashtags"] = [h.strip() for h in parsed["hashtags"].split() if h.startswith("#")]

        return parsed

    @staticmethod
    def _deterministic_fallback(product_name: str, target_audience: str, tone: str) -> dict:
        """Produce a basic fallback when LLM generation fails entirely."""
        caption = (
            f"Upgrade your routine with {product_name}. Thoughtfully engineered for {target_audience} "
            f"to deliver daily performance. Tap the link in bio to explore the collection."
        )
        script = (
            f"Tired of compromises in your daily setup? Meet {product_name}. "
            f"Designed specifically for {target_audience} to bring seamless reliability into your day. "
            f"Elevate your standards today."
        )
        image_prompt = (
            f"Professional studio product photograph of {product_name}, hero shot, "
            f"centered on a clean white surface, soft studio lighting with rim light, "
            f"shallow depth of field, commercial product photography style, 9:16 vertical"
        )
        video_desc = (
            f"Cinematic slow zoom into {product_name} sitting on a sleek surface. "
            f"Soft studio lighting gradually brightens as the camera moves closer. "
            f"The product catches highlights and reflections. "
            f"Audio: ambient electronic music, subtle whoosh sound effect."
        )
        return {
            "caption": caption,
            "script": script,
            "voiceover_script": script,
            "image_prompt": image_prompt,
            "video_scene_description": video_desc,
            "hashtags": [f"#{product_name.replace(' ', '')}", "#newproduct", "#musthave", "#trending"],
        }
