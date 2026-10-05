"""Brand Assets API — upload, list, and delete brand guidelines per niche.

These guidelines are chunked, embedded, and stored in ChromaDB so the
Copywriter Agent can ground its output in real brand context.
"""

import logging
import tempfile
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette import status

from app.core.errors import ApiError
from app.db.session import get_db
from app.models.brand_asset import BrandAsset
from app.models.enums import BrandAssetSourceEnum
from app.models.niche import Niche
from app.retrieval.ingestion import DocumentIngester
from app.retrieval.vector_store import RetrievalStore
from app.schemas.brand_asset import (
    BrandAssetDeleteResponse,
    BrandAssetListResponse,
    BrandAssetRead,
    BrandAssetUploadText,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/niches/{niche_id}/brand-assets", tags=["brand-assets"])

# Shared instances (cheap — lazy init happens inside)
_store = RetrievalStore()
_ingester = DocumentIngester(_store)


def _ensure_niche(db: Session, niche_id: UUID) -> Niche:
    """Return the niche or raise 404."""
    niche = db.get(Niche, niche_id)
    if not niche:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NICHE_NOT_FOUND",
            message="Niche does not exist",
        )
    return niche


# -----------------------------------------------------------------------
# POST  /niches/{niche_id}/brand-assets/text  — upload raw text
# -----------------------------------------------------------------------
@router.post("/text", response_model=BrandAssetRead, status_code=status.HTTP_201_CREATED)
def upload_text_asset(
    niche_id: UUID,
    payload: BrandAssetUploadText,
    db: Session = Depends(get_db),
) -> BrandAssetRead:
    """Ingest raw text brand guidelines into the niche's vector collection."""
    _ensure_niche(db, niche_id)

    doc_id = str(uuid.uuid4())
    result = _ingester.ingest_text(
        niche_id=str(niche_id),
        text=payload.text,
        source_type=payload.source_type.value,
        doc_id=doc_id,
    )

    asset = BrandAsset(
        niche_id=niche_id,
        source_type=payload.source_type,
        original_filename=None,
        chroma_doc_id=doc_id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    return BrandAssetRead(
        id=asset.id,
        niche_id=asset.niche_id,
        source_type=asset.source_type,
        original_filename=asset.original_filename,
        chroma_doc_id=asset.chroma_doc_id,
        chunk_count=result["chunk_count"],
        created_at=asset.created_at,
    )


# -----------------------------------------------------------------------
# POST  /niches/{niche_id}/brand-assets/upload  — upload PDF file
# -----------------------------------------------------------------------
@router.post("/upload", response_model=BrandAssetRead, status_code=status.HTTP_201_CREATED)
async def upload_file_asset(
    niche_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> BrandAssetRead:
    """Upload a PDF brand guideline file, extract text, chunk, and embed."""
    _ensure_niche(db, niche_id)

    if not file.filename:
        raise ApiError(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="NO_FILENAME",
            message="Uploaded file must have a filename",
        )

    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".pdf", ".txt", ".md"}:
        raise ApiError(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="UNSUPPORTED_FILE_TYPE",
            message=f"Unsupported file type '{suffix}'. Allowed: .pdf, .txt, .md",
        )

    doc_id = str(uuid.uuid4())

    # Write to a temp file for processing
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        if suffix == ".pdf":
            result = _ingester.ingest_pdf(
                niche_id=str(niche_id),
                file_path=tmp_path,
                doc_id=doc_id,
            )
        else:
            text = Path(tmp_path).read_text(encoding="utf-8", errors="replace")
            result = _ingester.ingest_text(
                niche_id=str(niche_id),
                text=text,
                source_type="text",
                original_filename=file.filename,
                doc_id=doc_id,
            )
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    source_type = BrandAssetSourceEnum.pdf if suffix == ".pdf" else BrandAssetSourceEnum.text
    asset = BrandAsset(
        niche_id=niche_id,
        source_type=source_type,
        original_filename=file.filename,
        chroma_doc_id=doc_id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    return BrandAssetRead(
        id=asset.id,
        niche_id=asset.niche_id,
        source_type=asset.source_type,
        original_filename=asset.original_filename,
        chroma_doc_id=asset.chroma_doc_id,
        chunk_count=result["chunk_count"],
        created_at=asset.created_at,
    )


# -----------------------------------------------------------------------
# GET   /niches/{niche_id}/brand-assets  — list ingested assets
# -----------------------------------------------------------------------
@router.get("", response_model=BrandAssetListResponse)
def list_brand_assets(
    niche_id: UUID,
    db: Session = Depends(get_db),
) -> BrandAssetListResponse:
    """List all brand assets for a niche."""
    _ensure_niche(db, niche_id)

    stmt = (
        select(BrandAsset)
        .where(BrandAsset.niche_id == niche_id)
        .order_by(BrandAsset.created_at.desc())
    )
    assets = db.execute(stmt).scalars().all()

    # If no brand assets exist in the database, brand guideline chunks are strictly 0
    if not assets:
        total_chunks = 0
    else:
        total_chunks = _store.collection_count(str(niche_id), exclude_source="past_post")

    items = [
        BrandAssetRead(
            id=a.id,
            niche_id=a.niche_id,
            source_type=a.source_type,
            original_filename=a.original_filename,
            chroma_doc_id=a.chroma_doc_id,
            chunk_count=0,  # individual chunk counts not tracked per-asset
            created_at=a.created_at,
        )
        for a in assets
    ]
    return BrandAssetListResponse(items=items, total_chunks=total_chunks)


# -----------------------------------------------------------------------
# DELETE /niches/{niche_id}/brand-assets/{asset_id}
# -----------------------------------------------------------------------
@router.delete("/{asset_id}", response_model=BrandAssetDeleteResponse)
def delete_brand_asset(
    niche_id: UUID,
    asset_id: UUID,
    db: Session = Depends(get_db),
) -> BrandAssetDeleteResponse:
    """Delete a brand asset and remove its chunks from ChromaDB."""
    _ensure_niche(db, niche_id)

    asset = db.get(BrandAsset, asset_id)
    if not asset or asset.niche_id != niche_id:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="ASSET_NOT_FOUND",
            message="Brand asset not found for this niche",
        )

    # Remove from ChromaDB first
    _ingester.remove_document(str(niche_id), asset.chroma_doc_id)

    # Remove from database
    db.delete(asset)
    db.commit()

    # If no more brand assets remain for this niche, prune any leftover brand asset chunks
    remaining = (
        db.execute(select(BrandAsset).where(BrandAsset.niche_id == niche_id))
        .scalars()
        .all()
    )
    if not remaining:
        _store.prune_brand_asset_chunks(str(niche_id))

    return BrandAssetDeleteResponse(
        deleted=True,
        asset_id=asset_id,
        message="Brand asset and its vector embeddings have been removed.",
    )
