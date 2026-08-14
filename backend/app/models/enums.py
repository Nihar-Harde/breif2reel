import enum


class PlatformEnum(str, enum.Enum):
    instagram = "instagram"
    facebook = "facebook"
    youtube = "youtube"


class AccountStatusEnum(str, enum.Enum):
    connected = "connected"
    expired = "expired"
    error = "error"


class BrandAssetSourceEnum(str, enum.Enum):
    pdf = "pdf"
    text = "text"
    past_post = "past_post"


class CampaignGoalEnum(str, enum.Enum):
    awareness = "awareness"
    launch = "launch"
    promotion = "promotion"
    engagement = "engagement"


class CampaignToneEnum(str, enum.Enum):
    playful = "playful"
    formal = "formal"
    bold = "bold"
    minimal = "minimal"


class CampaignStatusEnum(str, enum.Enum):
    draft = "draft"
    generating = "generating"
    needs_review = "needs_review"
    approved = "approved"
    scheduled = "scheduled"
    published = "published"
    failed = "failed"
    rejected = "rejected"


class CampaignAssetTypeEnum(str, enum.Enum):
    product_image = "product_image"
    brand_guideline_snippet = "brand_guideline_snippet"


class PostStatusEnum(str, enum.Enum):
    success = "success"
    failed = "failed"
    pending = "pending"

