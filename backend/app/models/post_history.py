import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import PlatformEnum, PostStatusEnum


class PostHistory(Base):
    __tablename__ = "post_history"
    __table_args__ = (Index("ix_post_history_campaign_id", "campaign_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    platform: Mapped[PlatformEnum] = mapped_column(Enum(PlatformEnum, name="platform_enum"), nullable=False)
    status: Mapped[PostStatusEnum] = mapped_column(Enum(PostStatusEnum, name="post_status_enum"), nullable=False)
    external_post_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    campaign = relationship("Campaign", back_populates="post_history_entries")
    account = relationship("Account", back_populates="post_history_entries")

