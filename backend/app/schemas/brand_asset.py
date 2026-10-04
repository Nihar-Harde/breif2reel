"""Pydantic schemas for the Brand Assets API."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import BrandAssetSourceEnum


class BrandAssetUploadText(BaseModel):
    """Payload for uploading raw text brand guidelines."""
    text: str = Field(min_length=10, max_length=50000, description="Raw brand guideline text to ingest")
    source_type: BrandAssetSourceEnum = BrandAssetSourceEnum.text


class BrandAssetRead(BaseModel):
    """Response model for a single brand asset."""
    id: UUID
    niche_id: UUID
    source_type: BrandAssetSourceEnum
    original_filename: str | None = None
    chroma_doc_id: str
    chunk_count: int = 0
    created_at: datetime


class BrandAssetListResponse(BaseModel):
    """Response model for listing brand assets."""
    items: list[BrandAssetRead]
    total_chunks: int = 0


class BrandAssetDeleteResponse(BaseModel):
    """Response after deleting a brand asset."""
    deleted: bool
    asset_id: UUID
    message: str
