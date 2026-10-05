"""Publisher interface -- shared Protocol for all platform publishers."""

from typing import Protocol


class PublisherService(Protocol):
    def publish_campaign(self, campaign_id: str) -> dict:
        """Publish campaign artifacts to external platforms.

        Returns:
            {
                'campaign_id': str,
                'platforms': {
                    'instagram': {'status': 'success' | 'failed' | 'skipped', ...},
                    'youtube':   {'status': 'success' | 'failed' | 'skipped', ...},
                },
                'final_status': 'published' | 'failed',
            }
        """
