import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import BrandAssetSourceEnum


class BrandAsset(Base):
    __tablename__ = "brand_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    niche_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("niches.id"), nullable=False)
    source_type: Mapped[BrandAssetSourceEnum] = mapped_column(
        Enum(BrandAssetSourceEnum, name="brand_asset_source_enum"), nullable=False
    )
    original_filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    chroma_doc_id: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    niche = relationship("Niche", back_populates="brand_assets")

