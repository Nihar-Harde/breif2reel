"""add brand_guideline_text to campaigns

Revision ID: 20260817_0003
Revises: 20260815_0002
Create Date: 2026-08-17 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260817_0003"
down_revision: Union[str, None] = "20260815_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "campaigns",
        sa.Column("brand_guideline_text", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("campaigns", "brand_guideline_text")
