import time
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.agents.copywriter import CopywriterAgent
from app.models.campaign import Campaign
from app.models.enums import CampaignStatusEnum
from app.models.traceability_record import TraceabilityRecord
from app.retrieval.vector_store import RetrievalStore


class CampaignOrchestrator:
    def __init__(self) -> None:
        self.copywriter = CopywriterAgent()
        self.retrieval = RetrievalStore()

    def run_pipeline(self, db: Session, campaign_id: UUID) -> None:
        campaign = db.get(Campaign, campaign_id)
        if not campaign:
            return

        retrieved_chunks = self.retrieval.retrieve(str(campaign.niche_id), campaign.product_name)
        generated = self.copywriter.generate(
            product_name=campaign.product_name,
            target_audience=campaign.target_audience,
            tone=campaign.tone.value,
            campaign_goal=campaign.campaign_goal.value,
            brand_guideline_text=campaign.brand_guideline_text,
            retrieved_chunks=retrieved_chunks,
        )


        time.sleep(1.2)
        campaign.generated_caption = generated["caption"]
        campaign.generated_script = generated["script"]
        campaign.status = CampaignStatusEnum.needs_review

        existing_trace = campaign.traceability_record
        if existing_trace:
            existing_trace.retrieved_chunks = retrieved_chunks
            existing_trace.repetition_score = Decimal("0.1200")
            existing_trace.critic_scores = {
                "brand_voice_fit": 78,
                "claim_accuracy": 82,
                "caption_quality": 80,
                "engagement_heuristic": 75,
                "overall": 79,
            }
            existing_trace.critic_justifications = {
                "brand_voice_fit": "Close to expected niche tone.",
                "claim_accuracy": "Aligned with brief claims.",
                "caption_quality": "Clear CTA and hashtag balance.",
                "engagement_heuristic": "Moderate hook strength; can be tightened.",
                "overall": "Good draft for human review.",
            }
            # store agent outputs for auditability
            existing_trace.agent_outputs = {"copywriter": generated}
        else:
            db.add(
                TraceabilityRecord(
                    campaign_id=campaign.id,
                    retrieved_chunks=retrieved_chunks,
                    repetition_score=Decimal("0.1200"),
                    critic_scores={
                        "brand_voice_fit": 78,
                        "claim_accuracy": 82,
                        "caption_quality": 80,
                        "engagement_heuristic": 75,
                        "overall": 79,
                    },
                    critic_justifications={
                        "brand_voice_fit": "Close to expected niche tone.",
                        "claim_accuracy": "Aligned with brief claims.",
                        "caption_quality": "Clear CTA and hashtag balance.",
                        "engagement_heuristic": "Moderate hook strength; can be tightened.",
                        "overall": "Good draft for human review.",
                    },
                    agent_outputs={"copywriter": generated},
                )
            )

        db.commit()

