from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from starlette import status

from app.core.errors import ApiError
from app.db.session import SessionLocal, get_db
from app.models.campaign import Campaign
from app.models.enums import CampaignStatusEnum
from app.models.niche import Niche
from app.schemas.campaign import (
    CampaignCreate,
    CampaignCreateResponse,
    CampaignGenerateResponse,
    CampaignListItem,
    CampaignListResponse,
    CampaignRead,
    TraceabilityRead,
)
from app.services.orchestrator import CampaignOrchestrator

router = APIRouter(prefix="/campaigns", tags=["campaigns"])
orchestrator = CampaignOrchestrator()


def _run_generation_task(campaign_id: UUID) -> None:
    db = SessionLocal()
    try:
        orchestrator.run_pipeline(db, campaign_id)
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

    return CampaignRead(
        id=campaign.id,
        niche_id=campaign.niche_id,
        product_name=campaign.product_name,
        target_audience=campaign.target_audience,
        campaign_goal=campaign.campaign_goal,
        tone=campaign.tone,
        status=campaign.status,
        generated_caption=campaign.generated_caption,
        generated_script=campaign.generated_script,
        cloudinary_url=campaign.cloudinary_url,
        created_at=campaign.created_at,
        updated_at=campaign.updated_at,
        traceability=traceability,
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
