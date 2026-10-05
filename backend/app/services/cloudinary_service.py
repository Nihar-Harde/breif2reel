"""Cloudinary Upload Service (C9) — upload campaign media to Cloudinary CDN.

Provides a thin wrapper around the Cloudinary Python SDK (cloudinary v2).
Uploads video/image files and returns public_url, secure_url and public_id
for downstream use (Instagram, YouTube, DB storage).

Configuration (add to .env):
    CLOUDINARY_CLOUD_NAME=your_cloud_name
    CLOUDINARY_API_KEY=your_api_key
    CLOUDINARY_API_SECRET=your_api_secret
"""

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


class CloudinaryService:
    """Uploads media files to Cloudinary and returns public CDN URLs.

    This service is used by the publishing pipeline to host campaign media
    before posting to Instagram / YouTube.
    """

    def __init__(self) -> None:
        self._configured = False
        self._try_configure()

    def _try_configure(self) -> None:
        """Attempt to configure the Cloudinary SDK from environment variables."""
        cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
        api_key = os.getenv("CLOUDINARY_API_KEY")
        api_secret = os.getenv("CLOUDINARY_API_SECRET")

        if not all([cloud_name, api_key, api_secret]):
            logger.warning(
                "CloudinaryService: CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET not set. "
                "Upload will be skipped."
            )
            return

        try:
            import cloudinary
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
                secure=True,
            )
            self._configured = True
            logger.info("CloudinaryService: SDK configured for cloud '%s'.", cloud_name)
        except ImportError:
            logger.error(
                "CloudinaryService: 'cloudinary' package not installed. "
                "Run: pip install cloudinary"
            )

    def upload(
        self,
        file_path: str,
        folder: str = "breif2reel",
        public_id: str | None = None,
        resource_type: str = "auto",
        overwrite: bool = True,
    ) -> dict:
        """Upload a file to Cloudinary.

        Args:
            file_path:     Absolute path to the local file.
            folder:        Cloudinary folder to store the file in.
            public_id:     Optional explicit public_id (without folder prefix).
            resource_type: 'auto' (default), 'video', or 'image'.
            overwrite:     If True, replace existing asset with the same public_id.

        Returns:
            {
                "public_id":   str,   # Cloudinary asset identifier
                "public_url":  str,   # http  CDN URL
                "secure_url":  str,   # https CDN URL
                "resource_type": str,
                "format":      str,   # file extension e.g. "mp4", "jpg"
                "bytes":       int,   # file size
                "duration":    float | None,  # video duration in seconds
            }

        Raises:
            RuntimeError: if Cloudinary is not configured or upload fails.
        """
        if not self._configured:
            raise RuntimeError(
                "CloudinaryService is not configured. "
                "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
            )

        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(f"File not found: {file_path}")

        upload_options: dict = {
            "folder": folder,
            "resource_type": resource_type,
            "overwrite": overwrite,
        }
        if public_id:
            upload_options["public_id"] = public_id

        try:
            import cloudinary.uploader

            logger.info(
                "CloudinaryService: Uploading '%s' to folder '%s'...",
                path.name,
                folder,
            )
            result = cloudinary.uploader.upload(str(path), **upload_options)

            upload_result = {
                "public_id": result.get("public_id", ""),
                "public_url": result.get("url", ""),
                "secure_url": result.get("secure_url", ""),
                "resource_type": result.get("resource_type", resource_type),
                "format": result.get("format", ""),
                "bytes": result.get("bytes", 0),
                "duration": result.get("duration"),
            }
            logger.info(
                "CloudinaryService: Upload successful — secure_url=%s",
                upload_result["secure_url"],
            )
            return upload_result

        except Exception as exc:
            logger.error("CloudinaryService: Upload failed for '%s': %s", file_path, exc)
            raise RuntimeError(f"Cloudinary upload failed: {exc}") from exc

    def upload_campaign_video(self, campaign_id: str, video_path: str) -> dict:
        """Convenience wrapper — upload a campaign video with a deterministic public_id."""
        return self.upload(
            file_path=video_path,
            folder="breif2reel/videos",
            public_id=f"campaign_{campaign_id}",
            resource_type="video",
            overwrite=True,
        )

    def upload_campaign_image(self, campaign_id: str, image_path: str) -> dict:
        """Convenience wrapper — upload a campaign product image."""
        return self.upload(
            file_path=image_path,
            folder="breif2reel/images",
            public_id=f"campaign_{campaign_id}_image",
            resource_type="image",
            overwrite=True,
        )
