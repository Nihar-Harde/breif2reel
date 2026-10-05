"""Index past campaign outputs (captions, scripts) into ChromaDB per niche.

This enables:
  1. **Repetition scoring** — compare new copy against previously published
     content to avoid re-using the same hooks / phrases.
  2. **Competitive context** — the Copywriter Agent can see what worked
     before and vary its creative direction.
"""

import logging
from typing import Any

from app.retrieval.ingestion import chunk_text

logger = logging.getLogger(__name__)


class PastPostIndexer:
    """Indexes published campaign text assets into the niche's ChromaDB collection."""

    def __init__(self, retrieval_store: Any) -> None:
        self.store = retrieval_store

    def index_campaign(
        self,
        niche_id: str,
        campaign_id: str,
        caption: str | None = None,
        script: str | None = None,
    ) -> int:
        """Embed and store a campaign's generated caption and/or script.

        Uses a deterministic doc_id based on campaign_id so re-indexing
        is idempotent (upsert semantics).

        Returns the total number of chunks indexed.
        """
        parts: list[str] = []
        if caption:
            parts.append(f"[CAPTION] {caption}")
        if script:
            parts.append(f"[SCRIPT] {script}")

        if not parts:
            return 0

        combined = "\n\n".join(parts)
        chunks = chunk_text(combined, chunk_size=200, overlap=30)

        if not chunks:
            return 0

        doc_id = f"campaign_{campaign_id}"
        count = self.store.add_documents(
            niche_id=niche_id,
            doc_id=doc_id,
            chunks=chunks,
            source="past_post",
            extra_metadata={
                "source_type": "past_post",
                "campaign_id": campaign_id,
            },
        )

        logger.info(
            "Indexed %d chunks from campaign %s into niche %s",
            count,
            campaign_id,
            niche_id,
        )
        return count

    def compute_repetition_score(
        self,
        niche_id: str,
        new_caption: str,
        new_script: str,
        k: int = 5,
        threshold: float = 0.85,
    ) -> dict[str, Any]:
        """Score how similar the new copy is to past posts in the niche.

        Returns:
            {
                "score": float,        # 0.0 (unique) → 1.0 (identical to past)
                "is_repetitive": bool,  # True if score >= threshold
                "top_matches": [...],   # most similar past chunks
            }
        """
        query = f"{new_caption} {new_script}"
        matches = self.store.retrieve(niche_id, query, k=k, source_filter="past_post")

        if not matches:
            return {
                "score": 0.0,
                "is_repetitive": False,
                "top_matches": [],
            }

        # Use the average similarity of top matches as the repetition score
        similarities = [m["similarity_score"] for m in matches]
        avg_similarity = sum(similarities) / len(similarities)

        return {
            "score": round(avg_similarity, 4),
            "is_repetitive": avg_similarity >= threshold,
            "top_matches": matches,
        }
