"""Campaign Orchestrator — full pipeline: Copywriter → Design → Audio → AI Video.

Video generation uses a multi-provider fallback chain:
  1. HuggingFace Space (Wan 2.1 T2V 1.3B on ZeroGPU)
  2. Google Colab API (CogVideoX-2b on free T4 GPU)
  3. Fal.ai Wan 2.1 (paid, if FAL_KEY is set)
  4. Local Cinematic Motion Engine (guaranteed fallback — image pan/zoom + voiceover)

Each stage is independently fault-tolerant. Text assets (caption/script) are committed
to the database immediately after the Copywriter step so they are never lost even if
downstream media agents fail.
"""

import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.agents.audio_agent import AudioAgent
from app.agents.copywriter import CopywriterAgent
from app.agents.critic_agent import CriticAgent
from app.agents.design_agent import DesignAgent
from app.agents.video_agent import VideoAgent
from app.models.campaign import Campaign
from app.models.campaign_asset import CampaignAsset
from app.models.enums import CampaignAssetTypeEnum, CampaignStatusEnum
from app.models.traceability_record import TraceabilityRecord
from app.retrieval.past_post_indexer import PastPostIndexer
from app.retrieval.vector_store import RetrievalStore

logger = logging.getLogger(__name__)


class CampaignOrchestrator:
    def __init__(self) -> None:
        self.copywriter = CopywriterAgent()
        self.design_agent = DesignAgent()
        self.audio_agent = AudioAgent()
        self.video_agent = VideoAgent()
        self.critic = CriticAgent()
        self.retrieval = RetrievalStore()
        self.past_post_indexer = PastPostIndexer(self.retrieval)

    def run_pipeline(self, db: Session, campaign_id: UUID) -> None:
        campaign = db.get(Campaign, campaign_id)
        if not campaign:
            return

        cid = str(campaign.id)

        # -----------------------------------------------------------
        # Step 1: Retrieve grounding context
        # -----------------------------------------------------------
        retrieved_chunks = self.retrieval.retrieve(
            str(campaign.niche_id), campaign.product_name, exclude_source="past_post"
        )

        # -----------------------------------------------------------
        # Step 2: Copywriter Agent → text assets & Repetition Guard (A14)
        # -----------------------------------------------------------
        logger.info("Pipeline [%s]: Running Copywriter Agent with Repetition Guard...", cid)
        max_reprompt_attempts = 2
        avoid_snippets: list[str] = []
        repetition_score = Decimal("0.0")
        repetition_data: dict = {}

        for attempt in range(max_reprompt_attempts + 1):
            generated = self.copywriter.generate(
                product_name=campaign.product_name,
                target_audience=campaign.target_audience,
                tone=campaign.tone.value,
                campaign_goal=campaign.campaign_goal.value,
                brand_guideline_text=campaign.brand_guideline_text,
                retrieved_chunks=retrieved_chunks,
                avoid_snippets=avoid_snippets if attempt > 0 else None,
                reprompt_attempt=attempt,
            )

            # Check repetition against past posts in this niche
            try:
                rep_result = self.past_post_indexer.compute_repetition_score(
                    niche_id=str(campaign.niche_id),
                    new_caption=generated.get("caption", ""),
                    new_script=generated.get("voiceover_script", generated.get("script", "")),
                    k=5,
                    threshold=0.85,
                )
                repetition_score = Decimal(str(round(rep_result["score"], 4)))
                repetition_data = rep_result

                if rep_result.get("is_repetitive") and attempt < max_reprompt_attempts:
                    logger.warning(
                        "Pipeline [%s]: Content is repetitive (score=%.4f >= 0.85). Re-prompting Copywriter (attempt %d/%d)...",
                        cid,
                        rep_result["score"],
                        attempt + 1,
                        max_reprompt_attempts,
                    )
                    top_matches = rep_result.get("top_matches", [])
                    avoid_snippets = [m.get("text", "") for m in top_matches if m.get("text")]
                    continue

                if rep_result.get("is_repetitive"):
                    logger.warning(
                        "Pipeline [%s]: Content remains repetitive (score=%.4f) after %d re-prompts. Proceeding.",
                        cid,
                        rep_result["score"],
                        max_reprompt_attempts,
                    )
                else:
                    logger.info("Pipeline [%s]: Repetition score=%.4f (OK).", cid, rep_result["score"])
                break
            except Exception as e:
                logger.error("Pipeline [%s]: Repetition check failed: %s", cid, e)
                break

        # Persist text assets immediately — never lose these even if media fails
        campaign.generated_caption = generated["caption"]
        campaign.generated_script = generated["script"]
        db.commit()
        logger.info("Pipeline [%s]: Caption and script persisted.", cid)

        # -----------------------------------------------------------
        # Step 3: Design Agent → product image
        # -----------------------------------------------------------
        image_path: str | None = None
        try:
            logger.info("Pipeline [%s]: Running Design Agent (Gemini Imagen)...", cid)
            image_path = self.design_agent.generate(
                image_prompt=generated["image_prompt"],
                campaign_id=cid,
            )
            db.add(
                CampaignAsset(
                    campaign_id=campaign.id,
                    asset_type=CampaignAssetTypeEnum.generated_image,
                    file_path=image_path,
                )
            )
            db.commit()
        except Exception as e:
            logger.error("Pipeline [%s]: Design Agent failed: %s", cid, e)

        # -----------------------------------------------------------
        # Step 4: Audio Agent → voiceover MP3
        # -----------------------------------------------------------
        audio_path: str | None = None
        try:
            logger.info("Pipeline [%s]: Running Audio Agent (edge-tts)...", cid)
            audio_path = self.audio_agent.generate(
                script=generated["voiceover_script"],
                tone=campaign.tone.value,
                campaign_id=cid,
            )
            db.add(
                CampaignAsset(
                    campaign_id=campaign.id,
                    asset_type=CampaignAssetTypeEnum.voiceover_audio,
                    file_path=audio_path,
                )
            )
            db.commit()
        except Exception as e:
            logger.error("Pipeline [%s]: Audio Agent failed: %s", cid, e)

        # -----------------------------------------------------------
        # Step 5: Video Agent → AI video reel
        #   Priority: HF Space (Wan 2.1) → Google Colab (CogVideoX) → Local Motion Engine
        # -----------------------------------------------------------
        video_path: str | None = None
        video_scene_desc = generated.get("video_scene_description", "")
        try:
            logger.info("Pipeline [%s]: Running Video Agent (HF Wan 2.1 / Colab / Local)...", cid)
            video_path = self.video_agent.generate(
                video_scene_description=video_scene_desc or f"Cinematic product commercial for {campaign.product_name}",
                campaign_id=cid,
                audio_path=audio_path,
                first_frame_image_path=image_path,
                caption_text=generated.get("caption", ""),
                script_text=generated.get("voiceover_script", generated.get("script", "")),
            )
            campaign.video_local_path = video_path
            db.add(
                CampaignAsset(
                    campaign_id=campaign.id,
                    asset_type=CampaignAssetTypeEnum.final_video,
                    file_path=video_path,
                )
            )
            db.commit()
        except Exception as e:
            logger.error("Pipeline [%s]: Video Agent failed: %s", cid, e)

        # -----------------------------------------------------------
        # Step 5.7: Critic / QA Agent (A15) — LLM-as-judge evaluation
        # -----------------------------------------------------------
        critic_scores: dict = {}
        critic_justifications: dict = {}
        try:
            logger.info("Pipeline [%s]: Running Critic Agent (LLM-as-judge)...", cid)
            critic_result = self.critic.evaluate(
                product_name=campaign.product_name,
                target_audience=campaign.target_audience,
                tone=campaign.tone.value,
                campaign_goal=campaign.campaign_goal.value,
                generated_caption=generated.get("caption", ""),
                voiceover_script=generated.get("voiceover_script", generated.get("script", "")),
                brand_guideline_text=campaign.brand_guideline_text,
                retrieved_chunks=retrieved_chunks,
            )
            critic_scores = critic_result["scores"]
            critic_justifications = critic_result["justifications"]
            logger.info(
                "Pipeline [%s]: Critic scores: overall=%d",
                cid,
                critic_scores.get("overall", 0),
            )
        except Exception as e:
            logger.error("Pipeline [%s]: Critic Agent failed: %s", cid, e)
            # Use minimal fallback so traceability record is never empty
            critic_scores = {
                "brand_voice_fit": 0,
                "claim_accuracy": 0,
                "caption_quality": 0,
                "engagement_heuristic": 0,
                "overall": 0,
            }
            critic_justifications = {k: "Evaluation unavailable." for k in critic_scores}

        # -----------------------------------------------------------
        # Step 6: Traceability & status update
        # -----------------------------------------------------------
        campaign.status = CampaignStatusEnum.needs_review

        agent_outputs = {
            "copywriter": generated,
            "design_agent": {"image_path": image_path},
            "audio_agent": {"audio_path": audio_path},
            "video_agent": {"video_path": video_path},
            "critic": {
                "scores": critic_scores,
                "justifications": critic_justifications,
            },
            "repetition": repetition_data,
        }

        existing_trace = campaign.traceability_record
        if existing_trace:
            existing_trace.retrieved_chunks = retrieved_chunks
            existing_trace.repetition_score = repetition_score
            existing_trace.critic_scores = critic_scores
            existing_trace.critic_justifications = critic_justifications
            existing_trace.agent_outputs = agent_outputs
        else:
            db.add(
                TraceabilityRecord(
                    campaign_id=campaign.id,
                    retrieved_chunks=retrieved_chunks,
                    repetition_score=repetition_score,
                    critic_scores=critic_scores,
                    critic_justifications=critic_justifications,
                    agent_outputs=agent_outputs,
                )
            )

        db.commit()

        # Index the newly published content for future repetition scoring
        try:
            indexed_count = self.past_post_indexer.index_campaign(
                niche_id=str(campaign.niche_id),
                campaign_id=cid,
                caption=campaign.generated_caption,
                script=campaign.generated_script,
            )
            logger.info("Pipeline [%s]: Indexed %d chunks into past-posts index.", cid, indexed_count)
        except Exception as e:
            logger.warning("Pipeline [%s]: Failed to index campaign into past-posts: %s", cid, e)

        logger.info(
            "Pipeline [%s]: COMPLETED — caption=%s, image=%s, audio=%s, video=%s, "
            "critic_overall=%s, repetition_score=%s",
            cid,
            "✓" if campaign.generated_caption else "✗",
            "✓" if image_path else "✗",
            "✓" if audio_path else "✗",
            "✓" if video_path else "✗",
            critic_scores.get("overall", "N/A"),
            float(repetition_score),
        )
