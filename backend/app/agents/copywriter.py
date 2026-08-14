class CopywriterAgent:
    def generate(self, product_name: str, target_audience: str, tone: str) -> dict[str, str]:
        caption = (
            f"{product_name} built for {target_audience}. "
            f"Tone: {tone}. #BrandCrew #Campaign"
        )
        script = (
            f"Meet {product_name}. Designed for {target_audience}. "
            f"This is your next smart pick."
        )
        image_prompt = f"Studio product shot of {product_name}, cinematic lighting, social media style"
        return {"caption": caption, "script": script, "image_prompt": image_prompt}

