"""Publishing Pipeline Route (C7, C8, C9).

POST /publish/run  -- triggered by a scheduler (cron / Azure Container App job).
  1. Loads all campaigns with status='scheduled' and scheduled_publish_at <= now
  2. For each campaign:
     a. Uploads video to Cloudinary (C9) to get a public CDN URL
     b. Publishes to Instagram Reels (C7) via Meta Graph API
     c. Uploads to YouTube Shorts (C8) via YouTube Data API v3
     d. Records each platform result in PostHistory
     e. Transitions campaign status to 'published' or 'failed'

POST /publish/{campaign_id}/manual  -- manual publish trigger (no scheduler needed).
"""

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette import status

from app.core.config import get_settings
from app.core.errors import ApiError
from app.db.session import get_db
from app.models.account import Account
from app.models.campaign import Campaign
from app.models.campaign_asset import CampaignAsset
from app.models.enums import (
    CampaignAssetTypeEnum,
    CampaignStatusEnum,
    PlatformEnum,
    PostStatusEnum,
)
from app.models.post_history import PostHistory
from app.services.cloudinary_service import CloudinaryService
from app.services.instagram_publisher import InstagramPublisher
from app.services.youtube_publisher import YouTubePublisher

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/publish", tags=["publish"])

_cloudinary = CloudinaryService()


def _get_campaign_video_path(db: Session, campaign_id: UUID) -> str | None:
    stmt = (
        select(CampaignAsset)
        .where(
            CampaignAsset.campaign_id == campaign_id,
            CampaignAsset.asset_type == CampaignAssetTypeEnum.final_video,
        )
        .order_by(CampaignAsset.created_at.desc())
        .limit(1)
    )
    asset = db.execute(stmt).scalar_one_or_none()
    return asset.file_path if asset else None


def _publish_one_campaign(db: Session, campaign: Campaign) -> dict[str, Any]:
    cid = str(campaign.id)
    results: dict[str, Any] = {"campaign_id": cid, "platforms": {}}

    cloudinary_url: str | None = campaign.cloudinary_url
    video_path = _get_campaign_video_path(db, campaign.id)

    if not cloudinary_url and video_path:
        try:
            upload_result = _cloudinary.upload_campaign_video(campaign_id=cid, video_path=video_path)
            cloudinary_url = upload_result["secure_url"]
            campaign.cloudinary_url = cloudinary_url
            db.commit()
            logger.info("Publish [%s]: Cloudinary upload OK -- %s", cid, cloudinary_url)
        except Exception as exc:
            logger.error("Publish [%s]: Cloudinary upload FAILED: %s", cid, exc)
            results["cloudinary_error"] = str(exc)

    caption = campaign.generated_caption or campaign.product_name

    accounts_stmt = select(Account).where(Account.niche_id == campaign.niche_id)
    accounts = db.execute(accounts_stmt).scalars().all()

    for account in accounts:
        platform = account.platform
        try:
            access_token = account.access_token_encrypted.decode("utf-8", errors="replace")

            if platform == PlatformEnum.instagram and cloudinary_url:
                ig = InstagramPublisher(access_token=access_token, ig_account_id=account.platform_account_id)
                ig_result = ig.publish_reel(video_url=cloudinary_url, caption=caption)
                _record_post_history(db=db, campaign_id=campaign.id, account_id=account.id,
                    platform=platform, status=PostStatusEnum.success, external_post_id=ig_result.get("post_id", ""))
                results["platforms"][platform.value] = {"status": "success", "post_id": ig_result.get("post_id", ""), "permalink": ig_result.get("permalink", "")}
                logger.info("Publish [%s]: Instagram published -- post_id=%s", cid, ig_result.get("post_id"))

            elif platform == PlatformEnum.youtube and video_path:
                yt = YouTubePublisher()
                yt_result = yt.upload_short(video_path=video_path,
                    title=f"{campaign.product_name} -- {campaign.campaign_goal.value.capitalize()}",
                    description=caption, tags=[campaign.product_name, campaign.tone.value, "Shorts", "breif2reel"])
                _record_post_history(db=db, campaign_id=campaign.id, account_id=account.id,
                    platform=platform, status=PostStatusEnum.success, external_post_id=yt_result.get("video_id", ""))
                results["platforms"][platform.value] = {"status": "success", "video_id": yt_result.get("video_id", ""), "url": yt_result.get("url", "")}
                logger.info("Publish [%s]: YouTube uploaded -- video_id=%s", cid, yt_result.get("video_id"))

            else:
                results["platforms"][platform.value] = {"status": "skipped"}

        except Exception as exc:
            logger.error("Publish [%s]: Platform '%s' FAILED: %s", cid, platform.value, exc)
            _record_post_history(db=db, campaign_id=campaign.id, account_id=account.id,
                platform=platform, status=PostStatusEnum.failed, error_message=str(exc))
            results["platforms"][platform.value] = {"status": "failed", "error": str(exc)}

    platform_statuses = [v.get("status") for v in results["platforms"].values()]
    any_success = any(s == "success" for s in platform_statuses)
    campaign.status = CampaignStatusEnum.published if any_success else CampaignStatusEnum.failed
    db.commit()
    results["final_status"] = campaign.status.value
    return results


def _record_post_history(db, campaign_id, account_id, platform, status, external_post_id="", error_message=None):
    entry = PostHistory(
        campaign_id=campaign_id, account_id=account_id, platform=platform, status=status,
        external_post_id=external_post_id or None, error_message=error_message,
        published_at=datetime.now(timezone.utc) if status == PostStatusEnum.success else None,
    )
    db.add(entry)
    db.commit()


@router.post("/run")
def run_scheduled_publish(x_scheduler_secret: str | None = Header(default=None), db: Session = Depends(get_db)) -> dict:
    settings = get_settings()
    if not settings.scheduler_secret:
        raise ApiError(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, code="SCHEDULER_NOT_CONFIGURED", message="Scheduler secret is not configured")
    if x_scheduler_secret != settings.scheduler_secret:
        raise ApiError(status_code=status.HTTP_403_FORBIDDEN, code="SCHEDULER_FORBIDDEN", message="Invalid scheduler secret")
    now = datetime.now(timezone.utc)
    stmt = select(Campaign).where(Campaign.status == CampaignStatusEnum.scheduled, Campaign.scheduled_publish_at <= now).order_by(Campaign.scheduled_publish_at.asc())
    due_campaigns = db.execute(stmt).scalars().all()
    logger.info("Scheduled publish: %d campaign(s) due.", len(due_campaigns))
    processed = []
    for campaign in due_campaigns:
        try:
            processed.append(_publish_one_campaign(db, campaign))
        except Exception as exc:
            logger.error("Scheduled publish: Campaign %s failed: %s", campaign.id, exc)
            processed.append({"campaign_id": str(campaign.id), "error": str(exc), "final_status": "failed"})
    return {"processed": processed, "count": len(processed)}


@router.post("/{campaign_id}/manual")
def manual_publish(campaign_id: UUID, db: Session = Depends(get_db)) -> dict:
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ApiError(status_code=status.HTTP_404_NOT_FOUND, code="CAMPAIGN_NOT_FOUND", message="Campaign not found")
    if campaign.status not in {CampaignStatusEnum.approved, CampaignStatusEnum.scheduled}:
        raise ApiError(status_code=status.HTTP_400_BAD_REQUEST, code="INVALID_STATUS",
            message=f"Campaign must be 'approved' or 'scheduled' to publish. Current: '{campaign.status.value}'")
    return _publish_one_campaign(db, campaign)
