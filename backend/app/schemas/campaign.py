from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import CampaignGoalEnum, CampaignStatusEnum, CampaignToneEnum


class CampaignCreate(BaseModel):
    niche_id: UUID
    product_name: str = Field(min_length=1, max_length=200)
    target_audience: str = Field(min_length=1, max_length=300)
    campaign_goal: CampaignGoalEnum
    tone: CampaignToneEnum
    brand_guideline_text: str | None = Field(default=None, max_length=5000)


class CampaignCreateResponse(BaseModel):
    campaign_id: UUID
    status: CampaignStatusEnum


class CampaignGenerateResponse(BaseModel):
    campaign_id: UUID
    status: CampaignStatusEnum


class TraceabilityRead(BaseModel):
    retrieved_chunks: list[dict]
    repetition_score: float
    critic_scores: dict
    critic_justifications: dict


class CampaignRead(BaseModel):
    id: UUID
    niche_id: UUID
    product_name: str
    target_audience: str
    campaign_goal: CampaignGoalEnum
    tone: CampaignToneEnum
    status: CampaignStatusEnum
    generated_caption: str | None
    generated_script: str | None
    cloudinary_url: str | None
    created_at: datetime
    updated_at: datetime
    traceability: TraceabilityRead | None = None


class CampaignListItem(BaseModel):
    id: UUID
    niche_id: UUID
    product_name: str
    status: CampaignStatusEnum
    created_at: datetime
    updated_at: datetime


class CampaignListResponse(BaseModel):
    items: list[CampaignListItem]

