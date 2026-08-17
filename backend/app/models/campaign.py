import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import CampaignGoalEnum, CampaignStatusEnum, CampaignToneEnum


class Campaign(Base):
    __tablename__ = "campaigns"
    __table_args__ = (Index("ix_campaigns_niche_status", "niche_id", "status"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    niche_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("niches.id"), nullable=False)
    product_name: Mapped[str] = mapped_column(Text, nullable=False)
    target_audience: Mapped[str] = mapped_column(Text, nullable=False)
    campaign_goal: Mapped[CampaignGoalEnum] = mapped_column(Enum(CampaignGoalEnum, name="campaign_goal_enum"), nullable=False)
    tone: Mapped[CampaignToneEnum] = mapped_column(Enum(CampaignToneEnum, name="campaign_tone_enum"), nullable=False)
    brand_guideline_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[CampaignStatusEnum] = mapped_column(
        Enum(CampaignStatusEnum, name="campaign_status_enum"),
        nullable=False,
        default=CampaignStatusEnum.draft,
    )
    generated_caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_script: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_local_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    cloudinary_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_publish_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    niche = relationship("Niche", back_populates="campaigns")
    assets = relationship("CampaignAsset", back_populates="campaign")
    traceability_record = relationship("TraceabilityRecord", back_populates="campaign", uselist=False)
    post_history_entries = relationship("PostHistory", back_populates="campaign")

