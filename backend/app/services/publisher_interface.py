from typing import Protocol


class PublisherService(Protocol):
    def publish_campaign(self, campaign_id: str) -> dict:
        """Publish campaign artifacts to external platforms."""

