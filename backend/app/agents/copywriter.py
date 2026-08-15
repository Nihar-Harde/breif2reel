class CopywriterAgent:
    def generate(self, product_name: str, target_audience: str, tone: str, brand_guidelines: str | None = None, retrieved_chunks: list | None = None) -> dict:
        """Generate a short caption, voiceover script, image prompt and hashtags for a product brief.

        This is a lightweight, deterministic generator suitable for local dev and testing. In future
        iterations it will call an LLM and use retrieved context to ground claims.
        """
        base = f"{product_name} built for {target_audience}. Tone: {tone}."
        hashtags = ["#breif2reel", "#campaign"]
        caption = f"{base} {' '.join(hashtags)}"

        # Simple voiceover/script output
        script = (
            f"Meet {product_name}. Designed for {target_audience}. This is your next smart pick."
        )

        image_prompt = f"Studio product shot of {product_name}, cinematic lighting, social media style"

        return {
            "caption": caption,
            "script": script,
            "image_prompt": image_prompt,
            "hashtags": hashtags,
        }

