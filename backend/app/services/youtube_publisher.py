"""YouTube Publisher (C8) — upload campaign video as a YouTube Short.

Uses the YouTube Data API v3 (videos.insert) with resumable upload protocol.
Supports OAuth2 refresh token flow for server-side publishing without
interactive browser authentication.

YouTube Shorts requirements:
  - Vertical video (9:16 aspect ratio recommended)
  - Duration <= 60 seconds
  - Title <= 100 characters, Description <= 5000 characters

Configuration (add to .env):
    YOUTUBE_CLIENT_ID=your_oauth2_client_id
    YOUTUBE_CLIENT_SECRET=your_oauth2_client_secret
    YOUTUBE_REFRESH_TOKEN=your_refresh_token   # from initial OAuth2 flow

To get refresh_token, run the OAuth2 flow once:
  https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps

See: https://developers.google.com/youtube/v3/docs/videos/insert
"""

import json
import logging
import os
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

_OAUTH2_TOKEN_URL = "https://oauth2.googleapis.com/token"
_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
_YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3"
_CHUNK_SIZE = 8 * 1024 * 1024  # 8 MB resumable upload chunks


class YouTubePublisher:
    """Uploads video files to YouTube using the Data API v3.

    Usage::

        publisher = YouTubePublisher(
            client_id="xxx.apps.googleusercontent.com",
            client_secret="GOCSPX-...",
            refresh_token="1//0...",
        )
        result = publisher.upload_short(
            video_path="/path/to/video.mp4",
            title="AquaMax Water Purifier — New Launch",
            description="Check out our new product! #Shorts",
            tags=["AquaMax", "WaterPurifier", "Shorts"],
        )
        # result["video_id"] -> YouTube video ID
    """

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        refresh_token: str | None = None,
    ) -> None:
        self.client_id = client_id or os.getenv("YOUTUBE_CLIENT_ID", "")
        self.client_secret = client_secret or os.getenv("YOUTUBE_CLIENT_SECRET", "")
        self.refresh_token = refresh_token or os.getenv("YOUTUBE_REFRESH_TOKEN", "")
        self._access_token: str | None = None
        self._http = httpx.Client(timeout=120)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def upload_short(
        self,
        video_path: str,
        title: str,
        description: str = "",
        tags: list[str] | None = None,
        category_id: str = "22",  # 22 = People & Blogs (common for Shorts)
        privacy_status: str = "public",
    ) -> dict:
        """Upload a video as a YouTube Short.

        Args:
            video_path:     Absolute local path to the MP4 file.
            title:          Video title (max 100 chars). '#Shorts' is appended
                            automatically if not present.
            description:    Video description (max 5000 chars).
            tags:           List of tag strings.
            category_id:    YouTube category ID string.
            privacy_status: 'public', 'private', or 'unlisted'.

        Returns:
            {
                "video_id":   str,   # YouTube video ID (e.g. "dQw4w9WgXcQ")
                "url":        str,   # Full watch URL
                "title":      str,   # Actual title used
                "status":     str,   # Upload status
            }

        Raises:
            RuntimeError on authentication or API errors.
        """
        path = Path(video_path)
        if not path.is_file():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        # Ensure #Shorts is in title for discovery
        if "#Shorts" not in title and "#shorts" not in title:
            title = f"{title} #Shorts"

        # Clamp title to 100 chars
        if len(title) > 100:
            title = title[:97] + "..."

        # Refresh the OAuth2 access token
        access_token = self._get_access_token()

        # Initiate the resumable upload session
        upload_url = self._initiate_resumable_upload(
            access_token=access_token,
            title=title,
            description=description,
            tags=tags or [],
            category_id=category_id,
            privacy_status=privacy_status,
        )

        # Stream the file in chunks
        video_id = self._execute_resumable_upload(
            upload_url=upload_url,
            file_path=path,
        )

        watch_url = f"https://www.youtube.com/watch?v={video_id}"
        logger.info("YouTubePublisher: Upload complete — video_id=%s, url=%s", video_id, watch_url)

        return {
            "video_id": video_id,
            "url": watch_url,
            "title": title,
            "status": "uploaded",
        }

    # ------------------------------------------------------------------
    # OAuth2
    # ------------------------------------------------------------------
    def _get_access_token(self) -> str:
        """Exchange the refresh token for a short-lived access token."""
        if not self.client_id or not self.client_secret or not self.refresh_token:
            raise RuntimeError(
                "YouTubePublisher: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and "
                "YOUTUBE_REFRESH_TOKEN must all be set."
            )

        response = self._http.post(
            _OAUTH2_TOKEN_URL,
            data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": self.refresh_token,
                "grant_type": "refresh_token",
            },
        )

        if not response.is_success:
            raise RuntimeError(
                f"YouTubePublisher: OAuth2 token refresh failed "
                f"({response.status_code}): {response.text[:300]}"
            )

        token_data = response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise RuntimeError(
                f"YouTubePublisher: No access_token in OAuth2 response: {token_data}"
            )

        logger.info("YouTubePublisher: OAuth2 access token obtained successfully.")
        return access_token

    # ------------------------------------------------------------------
    # Resumable upload
    # ------------------------------------------------------------------
    def _initiate_resumable_upload(
        self,
        access_token: str,
        title: str,
        description: str,
        tags: list[str],
        category_id: str,
        privacy_status: str,
    ) -> str:
        """POST to the upload endpoint to initiate a resumable session.

        Returns the resumable upload URL from the Location header.
        """
        metadata = {
            "snippet": {
                "title": title,
                "description": description,
                "tags": tags,
                "categoryId": category_id,
            },
            "status": {
                "privacyStatus": privacy_status,
                "selfDeclaredMadeForKids": False,
            },
        }

        response = self._http.post(
            _UPLOAD_URL,
            params={"uploadType": "resumable", "part": "snippet,status"},
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": "video/mp4",
            },
            content=json.dumps(metadata).encode(),
        )

        if not response.is_success:
            raise RuntimeError(
                f"YouTubePublisher: Failed to initiate upload "
                f"({response.status_code}): {response.text[:300]}"
            )

        upload_url = response.headers.get("location", "")
        if not upload_url:
            raise RuntimeError("YouTubePublisher: No 'location' header in upload initiation response.")

        logger.info("YouTubePublisher: Resumable upload session initiated.")
        return upload_url

    def _execute_resumable_upload(self, upload_url: str, file_path: Path) -> str:
        """Stream the file to the upload URL in chunks.

        Returns the YouTube video ID on success.
        """
        file_size = file_path.stat().st_size
        uploaded = 0

        with file_path.open("rb") as fh:
            while uploaded < file_size:
                chunk_data = fh.read(_CHUNK_SIZE)
                chunk_end = uploaded + len(chunk_data) - 1
                content_range = f"bytes {uploaded}-{chunk_end}/{file_size}"

                response = self._http.put(
                    upload_url,
                    headers={
                        "Content-Length": str(len(chunk_data)),
                        "Content-Range": content_range,
                    },
                    content=chunk_data,
                )

                # 308 Resume Incomplete — more chunks needed
                if response.status_code == 308:
                    range_header = response.headers.get("range", f"bytes=0-{chunk_end}")
                    uploaded = int(range_header.split("-")[-1]) + 1
                    logger.debug(
                        "YouTubePublisher: Uploaded %d/%d bytes (%.1f%%)",
                        uploaded,
                        file_size,
                        100.0 * uploaded / file_size,
                    )
                    continue

                # 200/201 — upload complete
                if response.status_code in (200, 201):
                    data = response.json()
                    video_id = data.get("id")
                    if not video_id:
                        raise RuntimeError(
                            f"YouTubePublisher: No video id in upload response: {data}"
                        )
                    logger.info("YouTubePublisher: Upload complete — video_id=%s", video_id)
                    return video_id

                raise RuntimeError(
                    f"YouTubePublisher: Unexpected status during upload "
                    f"({response.status_code}): {response.text[:300]}"
                )

        raise RuntimeError("YouTubePublisher: Upload loop exited without receiving video ID.")

    def __del__(self) -> None:
        try:
            self._http.close()
        except Exception:
            pass
