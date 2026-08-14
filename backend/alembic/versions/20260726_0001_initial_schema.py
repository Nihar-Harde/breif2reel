"""initial schema

Revision ID: 20260726_0001
Revises:
Create Date: 2026-07-26 02:50:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260726_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

platform_enum = sa.Enum("instagram", "facebook", "youtube", name="platform_enum")
account_status_enum = sa.Enum("connected", "expired", "error", name="account_status_enum")
brand_asset_source_enum = sa.Enum("pdf", "text", "past_post", name="brand_asset_source_enum")
campaign_goal_enum = sa.Enum("awareness", "launch", "promotion", "engagement", name="campaign_goal_enum")
campaign_tone_enum = sa.Enum("playful", "formal", "bold", "minimal", name="campaign_tone_enum")
campaign_status_enum = sa.Enum(
    "draft",
    "generating",
    "needs_review",
    "approved",
    "scheduled",
    "published",
    "failed",
    "rejected",
    name="campaign_status_enum",
)
campaign_asset_type_enum = sa.Enum(
    "product_image", "brand_guideline_snippet", name="campaign_asset_type_enum"
)
post_status_enum = sa.Enum("success", "failed", "pending", name="post_status_enum")


def upgrade() -> None:
    bind = op.get_bind()
    platform_enum.create(bind, checkfirst=True)
    account_status_enum.create(bind, checkfirst=True)
    brand_asset_source_enum.create(bind, checkfirst=True)
    campaign_goal_enum.create(bind, checkfirst=True)
    campaign_tone_enum.create(bind, checkfirst=True)
    campaign_status_enum.create(bind, checkfirst=True)
    campaign_asset_type_enum.create(bind, checkfirst=True)
    post_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "niches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("niche_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform", platform_enum, nullable=False),
        sa.Column("platform_account_id", sa.Text(), nullable=False),
        sa.Column("access_token_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("refresh_token_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", account_status_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["niche_id"], ["niches.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_accounts_niche_platform", "accounts", ["niche_id", "platform"], unique=False)

    op.create_table(
        "brand_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("niche_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_type", brand_asset_source_enum, nullable=False),
        sa.Column("original_filename", sa.Text(), nullable=True),
        sa.Column("chroma_doc_id", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["niche_id"], ["niches.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("niche_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_name", sa.Text(), nullable=False),
        sa.Column("target_audience", sa.Text(), nullable=False),
        sa.Column("campaign_goal", campaign_goal_enum, nullable=False),
        sa.Column("tone", campaign_tone_enum, nullable=False),
        sa.Column("status", campaign_status_enum, nullable=False),
        sa.Column("generated_caption", sa.Text(), nullable=True),
        sa.Column("generated_script", sa.Text(), nullable=True),
        sa.Column("video_local_path", sa.Text(), nullable=True),
        sa.Column("cloudinary_url", sa.Text(), nullable=True),
        sa.Column("scheduled_publish_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["niche_id"], ["niches.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_campaigns_niche_status", "campaigns", ["niche_id", "status"], unique=False)

    op.create_table(
        "campaign_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("asset_type", campaign_asset_type_enum, nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "traceability_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("retrieved_chunks", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("repetition_score", sa.Numeric(5, 4), nullable=False),
        sa.Column("critic_scores", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("critic_justifications", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campaign_id"),
    )

    op.create_table(
        "post_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform", platform_enum, nullable=False),
        sa.Column("status", post_status_enum, nullable=False),
        sa.Column("external_post_id", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_post_history_campaign_id", "post_history", ["campaign_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_post_history_campaign_id", table_name="post_history")
    op.drop_table("post_history")
    op.drop_table("traceability_records")
    op.drop_table("campaign_assets")
    op.drop_index("ix_campaigns_niche_status", table_name="campaigns")
    op.drop_table("campaigns")
    op.drop_table("brand_assets")
    op.drop_index("ix_accounts_niche_platform", table_name="accounts")
    op.drop_table("accounts")
    op.drop_table("niches")

    bind = op.get_bind()
    post_status_enum.drop(bind, checkfirst=True)
    campaign_asset_type_enum.drop(bind, checkfirst=True)
    campaign_status_enum.drop(bind, checkfirst=True)
    campaign_tone_enum.drop(bind, checkfirst=True)
    campaign_goal_enum.drop(bind, checkfirst=True)
    brand_asset_source_enum.drop(bind, checkfirst=True)
    account_status_enum.drop(bind, checkfirst=True)
    platform_enum.drop(bind, checkfirst=True)

