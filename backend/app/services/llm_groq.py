import os
import logging
from typing import Any, Optional
from groq import Groq
from google import genai
from google.genai import types
from app.core.config import get_settings

logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.groq_api_key = self.settings.groq_api_key or os.getenv("GROQ_API_KEY")
        self.gemini_api_key = self.settings.gemini_api_key or os.getenv("GEMINI_API_KEY")

        # Initialize Groq client
        self.groq_client = None
        if self.groq_api_key and self.groq_api_key != "your-groq-api-key-here":
            try:
                self.groq_client = Groq(api_key=self.groq_api_key)
                logger.info("Groq client initialized successfully.")
            except Exception as e:
                logger.error(f"Error initializing Groq client: {e}")
        else:
            logger.warning("GROQ_API_KEY is not set or placeholder.")

        # Initialize Gemini client
        self.gemini_client = None
        if self.gemini_api_key and self.gemini_api_key != "your-gemini-api-key-here":
            try:
                self.gemini_client = genai.Client(api_key=self.gemini_api_key)
                logger.info("Gemini API client initialized successfully.")
            except Exception as e:
                logger.error(f"Error configuring Gemini client: {e}")
        else:
            logger.warning("GEMINI_API_KEY is not set or placeholder.")

    def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        response_json: bool = False,
    ) -> str:
        """Generate content from an LLM.

        Primary: Groq (llama-3.3-70b-versatile)
        Fallback: Gemini (gemini-1.5-flash) if Groq fails or is unconfigured.
        """
        # Try Groq first
        if self.groq_client:
            try:
                logger.info("Attempting text generation with Groq (llama-3.3-70b-versatile)...")
                messages = []
                if system_instruction:
                    messages.append({"role": "system", "content": system_instruction})
                messages.append({"role": "user", "content": prompt})

                kwargs: dict[str, Any] = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": messages,
                    "temperature": temperature,
                }
                if max_tokens:
                    kwargs["max_tokens"] = max_tokens
                if response_json:
                    kwargs["response_format"] = {"type": "json_object"}

                response = self.groq_client.chat.completions.create(**kwargs)
                content = response.choices[0].message.content
                if content:
                    logger.info("Groq generation succeeded.")
                    return content
                raise RuntimeError("Groq returned empty response.")
            except Exception as e:
                logger.warning(f"Groq generation failed/timed out: {e}. Attempting fallback to Gemini...")

        # Fallback: Gemini
        if self.gemini_client:
            try:
                logger.info("Attempting text generation with Gemini (gemini-1.5-flash)...")
                config_kwargs: dict[str, Any] = {
                    "temperature": temperature,
                }
                if max_tokens:
                    config_kwargs["max_output_tokens"] = max_tokens
                if system_instruction:
                    config_kwargs["system_instruction"] = system_instruction
                if response_json:
                    config_kwargs["response_mime_type"] = "application/json"

                response = self.gemini_client.models.generate_content(
                    model="gemini-1.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(**config_kwargs),
                )
                if response and response.text:
                    logger.info("Gemini generation succeeded.")
                    return response.text
                raise RuntimeError("Gemini returned empty response.")
            except Exception as e:
                logger.error(f"Gemini generation failed: {e}")
                raise RuntimeError(f"All LLM generation providers failed. Gemini error: {e}")

        # If both fail or are unconfigured
        raise RuntimeError("No LLM services are configured or available. Please check GROQ_API_KEY and GEMINI_API_KEY in .env.")

