import logging
import os
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from starlette import status

from app.core.errors import ApiError
from app.db.session import SessionLocal, get_db
from app.models.campaign import Campaign
from app.models.campaign_asset import CampaignAsset
from app.models.enums import CampaignAssetTypeEnum, CampaignStatusEnum
from app.models.niche import Niche
from app.schemas.campaign import (
    CampaignCreate,
    CampaignCreateResponse,
    CampaignGenerateResponse,
    CampaignListItem,
    CampaignListResponse,
    CampaignRead,
    CampaignStatusUpdate,
    CampaignStatusUpdateResponse,
    TraceabilityRead,
)
from app.services.orchestrator import CampaignOrchestrator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/campaigns", tags=["campaigns"])
orchestrator = CampaignOrchestrator()


def _run_generation_task(campaign_id: UUID) -> None:
    """Run the generation pipeline in a background thread with full error handling."""
    import logging
    import traceback

    logger = logging.getLogger(__name__)
    db = SessionLocal()
    try:
        orchestrator.run_pipeline(db, campaign_id)
    except Exception:
        logger.error(
            "Background generation task FAILED for campaign %s:\n%s",
            campaign_id,
            traceback.format_exc(),
        )
        # Ensure the campaign is marked as failed so it doesn't stay stuck
        try:
            campaign = db.get(Campaign, campaign_id)
            if campaign and campaign.status == CampaignStatusEnum.generating:
                campaign.status = CampaignStatusEnum.failed
                db.commit()
        except Exception:
            logger.error("Could not mark campaign %s as failed: %s", campaign_id, traceback.format_exc())
    finally:
        db.close()


@router.post("", response_model=CampaignCreateResponse)
def create_campaign(payload: CampaignCreate, db: Session = Depends(get_db)) -> CampaignCreateResponse:
    niche = db.get(Niche, payload.niche_id)
    if not niche:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NICHE_NOT_FOUND",
            message="Niche does not exist",
        )

    campaign = Campaign(
        niche_id=payload.niche_id,
        product_name=payload.product_name,
        target_audience=payload.target_audience,
        campaign_goal=payload.campaign_goal,
        tone=payload.tone,
        brand_guideline_text=payload.brand_guideline_text,
        status=CampaignStatusEnum.draft,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return CampaignCreateResponse(campaign_id=campaign.id, status=campaign.status)


@router.post(
    "/{campaign_id}/generate",
    response_model=CampaignGenerateResponse,
)
def generate_campaign(campaign_id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> CampaignGenerateResponse:
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="CAMPAIGN_NOT_FOUND",
            message="Campaign not found",
        )

    campaign.status = CampaignStatusEnum.generating
    db.commit()
    background_tasks.add_task(_run_generation_task, campaign.id)
    return CampaignGenerateResponse(campaign_id=campaign.id, status=campaign.status)


@router.get("/{campaign_id}", response_model=CampaignRead)
def get_campaign(campaign_id: UUID, db: Session = Depends(get_db)) -> CampaignRead:
    stmt = (
        select(Campaign)
        .options(joinedload(Campaign.traceability_record))
        .where(Campaign.id == campaign_id)
    )
    campaign = db.execute(stmt).scalar_one_or_none()
    if not campaign:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="CAMPAIGN_NOT_FOUND",
            message="Campaign not found",
        )

    traceability = None
    if campaign.traceability_record:
        tr = campaign.traceability_record
        traceability = TraceabilityRead(
            retrieved_chunks=tr.retrieved_chunks,
            repetition_score=float(tr.repetition_score),
            critic_scores=tr.critic_scores,
            critic_justifications=tr.critic_justifications,
        )

    audio_url = f"/api/v1/campaigns/{campaign.id}/audio" if (campaign.generated_script or campaign.generated_caption) else None
    video_url = campaign.cloudinary_url or (f"/api/v1/campaigns/{campaign.id}/video" if (campaign.video_local_path and os.path.exists(campaign.video_local_path)) else None)

    return CampaignRead(
        id=campaign.id,
        niche_id=campaign.niche_id,
        product_name=campaign.product_name,
        target_audience=campaign.target_audience,
        campaign_goal=campaign.campaign_goal,
        tone=campaign.tone,
        brand_guideline_text=campaign.brand_guideline_text,
        status=campaign.status,
        generated_caption=campaign.generated_caption,
        generated_script=campaign.generated_script,
        cloudinary_url=campaign.cloudinary_url,
        created_at=campaign.created_at,
        updated_at=campaign.updated_at,
        traceability=traceability,
        audio_url=audio_url,
        video_url=video_url,
    )


@router.get("/{campaign_id}/audio")
def stream_campaign_audio(campaign_id: UUID, db: Session = Depends(get_db)):
    """Stream or on-demand synthesize the campaign script voiceover MP3."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="CAMPAIGN_NOT_FOUND",
            message="Campaign not found",
        )

    # 1. Check if a voiceover asset is already registered
    asset = db.execute(
        select(CampaignAsset).where(
            CampaignAsset.campaign_id == campaign_id,
            CampaignAsset.asset_type == CampaignAssetTypeEnum.voiceover_audio,
        )
    ).scalars().first()

    audio_file_path = None
    if asset and asset.file_path and os.path.exists(asset.file_path):
        audio_file_path = asset.file_path
    else:
        from app.agents.audio_agent import MEDIA_OUTPUT_DIR
        default_p = MEDIA_OUTPUT_DIR / "audio" / f"{campaign_id}.mp3"
        if default_p.exists():
            audio_file_path = str(default_p)

    # 2. If not on disk, synthesize on-demand using AudioAgent (edge-tts)
    if not audio_file_path:
        script_to_speak = campaign.generated_script or campaign.generated_caption
        if not script_to_speak:
            raise ApiError(
                status_code=status.HTTP_404_NOT_FOUND,
                code="NO_SCRIPT_AVAILABLE",
                message="No script available to generate audio for this campaign",
            )
        try:
            from app.agents.audio_agent import AudioAgent
            audio_agent = AudioAgent()
            tone_val = campaign.tone.value if campaign.tone else "playful"
            audio_file_path = audio_agent.generate(
                script=script_to_speak,
                tone=tone_val,
                campaign_id=str(campaign_id),
            )
            if not asset:
                db.add(
                    CampaignAsset(
                        campaign_id=campaign.id,
                        asset_type=CampaignAssetTypeEnum.voiceover_audio,
                        file_path=audio_file_path,
                    )
                )
                db.commit()
        except Exception as e:
            logger.error("On-demand audio synthesis failed for campaign %s: %s", campaign_id, e)
            raise ApiError(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                code="AUDIO_SYNTHESIS_FAILED",
                message=f"Failed to synthesize audio: {e}",
            )

    return FileResponse(
        audio_file_path,
        media_type="audio/mpeg",
        headers={"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=3600"},
        filename=f"{campaign_id}.mp3",
    )


@router.get("/{campaign_id}/video")
def stream_campaign_video(campaign_id: UUID, db: Session = Depends(get_db)):
    """Stream the generated campaign video MP4 or redirect to Cloudinary."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="CAMPAIGN_NOT_FOUND",
            message="Campaign not found",
        )

    if campaign.cloudinary_url:
        return RedirectResponse(campaign.cloudinary_url)

    if campaign.video_local_path and os.path.exists(campaign.video_local_path):
        return FileResponse(
            campaign.video_local_path,
            media_type="video/mp4",
            headers={"Accept-Ranges": "bytes"},
            filename=f"{campaign_id}.mp4",
        )

    raise ApiError(
        status_code=status.HTTP_404_NOT_FOUND,
        code="VIDEO_NOT_FOUND",
        message="Video not generated or found for this campaign",
    )


@router.get("", response_model=CampaignListResponse)
def list_campaigns(
    niche_id: UUID | None = Query(default=None),
    status_filter: CampaignStatusEnum | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> CampaignListResponse:
    stmt = select(Campaign).order_by(Campaign.created_at.desc())
    if niche_id:
        stmt = stmt.where(Campaign.niche_id == niche_id)
    if status_filter:
        stmt = stmt.where(Campaign.status == status_filter)

    campaigns = db.execute(stmt).scalars().all()
    items = [
        CampaignListItem(
            id=campaign.id,
            niche_id=campaign.niche_id,
            product_name=campaign.product_name,
            status=campaign.status,
            created_at=campaign.created_at,
            updated_at=campaign.updated_at,
        )
        for campaign in campaigns
    ]
    return CampaignListResponse(items=items)


@router.patch(
    "/{campaign_id}/status",
    response_model=CampaignStatusUpdateResponse,
)
def update_campaign_status(
    campaign_id: UUID,
    payload: CampaignStatusUpdate,
    db: Session = Depends(get_db),
) -> CampaignStatusUpdateResponse:
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="CAMPAIGN_NOT_FOUND",
            message="Campaign not found",
        )

    allowed_transitions = {
        CampaignStatusEnum.needs_review: {CampaignStatusEnum.approved, CampaignStatusEnum.rejected},
        CampaignStatusEnum.approved: {CampaignStatusEnum.scheduled},
        CampaignStatusEnum.rejected: {CampaignStatusEnum.draft},
    }

    if payload.status not in allowed_transitions.get(campaign.status, set()):
        raise ApiError(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_STATUS_TRANSITION",
            message=f"Cannot transition from '{campaign.status.value}' to '{payload.status.value}'",
        )

    campaign.status = payload.status
    db.commit()
    return CampaignStatusUpdateResponse(
        campaign_id=campaign.id,
        status=campaign.status,
        message=f"Campaign status updated to '{campaign.status.value}'",
    )
