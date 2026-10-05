"""Instagram Publisher (C7) — publish campaign video as an Instagram Reel.

Uses the Meta Graph API v20.0 two-step Reels publishing flow:
  1. POST /media        — create an upload container (returns container_id)
  2. Poll container status until FINISHED
  3. POST /media_publish — publish the container

Requirements:
  - A Business/Creator Instagram account connected to a Facebook Page
  - An access token with instagram_basic, instagram_content_publish,
    pages_show_list, pages_read_engagement scopes
  - The video must be publicly accessible (Cloudinary CDN URL)

Configuration (add to .env or Account model):
    INSTAGRAM_ACCESS_TOKEN=<long-lived-token>
    INSTAGRAM_ACCOUNT_ID=<ig_user_id>

See: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
"""

import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_GRAPH_URL = "https://graph.facebook.com/v20.0"
_MAX_POLL_ATTEMPTS = 15
_POLL_INTERVAL_SECONDS = 8


class InstagramPublisher:
    """Publishes short-form video content (Reels) to an Instagram account.

    Usage::

        publisher = InstagramPublisher(
            access_token="EAA...",
            ig_account_id="17841234567890",
        )
        result = publisher.publish_reel(
            video_url="https://res.cloudinary.com/.../video.mp4",
            caption="Check this out! #product #launch",
        )
        # result["post_id"] -> external Instagram media ID
    """

    def __init__(self, access_token: str, ig_account_id: str) -> None:
        self.access_token = access_token
        self.ig_account_id = ig_account_id
        self._client = httpx.Client(timeout=60)

    def publish_reel(
        self,
        video_url: str,
        caption: str,
        share_to_feed: bool = True,
        cover_url: str | None = None,
    ) -> dict:
        """Full end-to-end publish of a Reel.

        Args:
            video_url:     Public CDN URL of the video (MP4, max 15 min, 4 GB).
            caption:       Caption text including hashtags.
            share_to_feed: Whether to cross-share the Reel to the Feed grid.
            cover_url:     Optional cover image URL.

        Returns:
            {
                "post_id":      str,   # Instagram media ID of published post
                "permalink":    str,   # Public permalink (if available)
                "container_id": str,   # Container ID used in publish
            }

        Raises:
            RuntimeError on API errors or timeout.
        """
        logger.info(
            "InstagramPublisher: Creating Reels container for account %s...",
            self.ig_account_id,
        )

        # Step 1: Create media container
        container_id = self._create_reels_container(
            video_url=video_url,
            caption=caption,
            share_to_feed=share_to_feed,
            cover_url=cover_url,
        )

        # Step 2: Poll until processing is FINISHED
        self._wait_for_container_ready(container_id)

        # Step 3: Publish container
        post_id = self._publish_container(container_id)

        # Step 4: Fetch permalink (best-effort)
        permalink = self._fetch_permalink(post_id)

        logger.info(
            "InstagramPublisher: Published Reel — post_id=%s, permalink=%s",
            post_id,
            permalink,
        )
        return {
            "post_id": post_id,
            "permalink": permalink,
            "container_id": container_id,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _create_reels_container(
        self,
        video_url: str,
        caption: str,
        share_to_feed: bool,
        cover_url: str | None,
    ) -> str:
        """Step 1: POST /{ig_user_id}/media to create a Reels container."""
        payload: dict[str, Any] = {
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption,
            "share_to_feed": str(share_to_feed).lower(),
            "access_token": self.access_token,
        }
        if cover_url:
            payload["cover_url"] = cover_url

        response = self._client.post(
            f"{_GRAPH_URL}/{self.ig_account_id}/media",
            data=payload,
        )
        data = self._parse_graph_response(response, "create container")
        container_id = data.get("id")
        if not container_id:
            raise RuntimeError(f"No container_id in response: {data}")
        logger.info("InstagramPublisher: Container created — id=%s", container_id)
        return container_id

    def _wait_for_container_ready(self, container_id: str) -> None:
        """Step 2: Poll container status until STATUS_CODE == FINISHED."""
        for attempt in range(1, _MAX_POLL_ATTEMPTS + 1):
            response = self._client.get(
                f"{_GRAPH_URL}/{container_id}",
                params={
                    "fields": "status_code,status",
                    "access_token": self.access_token,
                },
            )
            data = self._parse_graph_response(response, "poll container status")
            status_code = data.get("status_code", "")
            logger.info(
                "InstagramPublisher: Container %s status = %s (attempt %d/%d)",
                container_id,
                status_code,
                attempt,
                _MAX_POLL_ATTEMPTS,
            )
            if status_code == "FINISHED":
                return
            if status_code == "ERROR":
                raise RuntimeError(
                    f"Instagram container processing failed: {data.get('status', 'unknown error')}"
                )
            time.sleep(_POLL_INTERVAL_SECONDS)

        raise RuntimeError(
            f"Instagram container {container_id} did not finish processing "
            f"after {_MAX_POLL_ATTEMPTS * _POLL_INTERVAL_SECONDS}s."
        )

    def _publish_container(self, container_id: str) -> str:
        """Step 3: POST /{ig_user_id}/media_publish to publish the container."""
        response = self._client.post(
            f"{_GRAPH_URL}/{self.ig_account_id}/media_publish",
            data={
                "creation_id": container_id,
                "access_token": self.access_token,
            },
        )
        data = self._parse_graph_response(response, "publish container")
        post_id = data.get("id")
        if not post_id:
            raise RuntimeError(f"No media id in publish response: {data}")
        logger.info("InstagramPublisher: Container published — post_id=%s", post_id)
        return post_id

    def _fetch_permalink(self, post_id: str) -> str:
        """Fetch the public permalink for the published post (best-effort)."""
        try:
            response = self._client.get(
                f"{_GRAPH_URL}/{post_id}",
                params={
                    "fields": "permalink",
                    "access_token": self.access_token,
                },
            )
            data = self._parse_graph_response(response, "fetch permalink")
            return data.get("permalink", "")
        except Exception as exc:
            logger.warning("InstagramPublisher: Could not fetch permalink: %s", exc)
            return ""

    @staticmethod
    def _parse_graph_response(response: httpx.Response, context: str) -> dict:
        """Parse a Graph API response, raising on errors."""
        try:
            data = response.json()
        except Exception:
            raise RuntimeError(
                f"InstagramPublisher [{context}]: Non-JSON response ({response.status_code})"
            )

        if "error" in data:
            err = data["error"]
            raise RuntimeError(
                f"InstagramPublisher [{context}] Graph API error {err.get('code')}: "
                f"{err.get('message', 'Unknown error')}"
            )

        if not response.is_success:
            raise RuntimeError(
                f"InstagramPublisher [{context}]: HTTP {response.status_code} — {data}"
            )

        return data

    def __del__(self) -> None:
        try:
            self._client.close()
        except Exception:
            pass
