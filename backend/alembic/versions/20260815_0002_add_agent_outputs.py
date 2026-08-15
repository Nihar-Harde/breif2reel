"""add agent_outputs to traceability_records

Revision ID: 20260815_0002
Revises: 20260726_0001
Create Date: 2026-08-15 19:40:00.000000
"""

from typing import Union, Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260815_0002"
down_revision: Union[str, None] = "20260726_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add agent_outputs JSONB column with default empty object for backwards compatibility
    op.add_column(
        "traceability_records",
        sa.Column(
            "agent_outputs",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("traceability_records", "agent_outputs")
