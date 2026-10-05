import os
import sys
import unittest
import uuid

# Ensure backend root is on sys.path for direct or discovered execution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.campaign import Campaign
from app.models.enums import CampaignGoalEnum, CampaignToneEnum


class CampaignBrandGuidelineTest(unittest.TestCase):
    def test_campaign_accepts_brand_guideline_text(self):
        campaign = Campaign(
            niche_id=uuid.uuid4(),
            product_name="Smart Blender",
            target_audience="Home cooks",
            campaign_goal=CampaignGoalEnum.awareness,
            tone=CampaignToneEnum.playful,
            brand_guideline_text="Keep messaging energetic and kitchen-focused.",
        )

        self.assertEqual(campaign.brand_guideline_text, "Keep messaging energetic and kitchen-focused.")


if __name__ == "__main__":
    unittest.main()
