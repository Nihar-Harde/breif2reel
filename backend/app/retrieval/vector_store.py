from typing import Any


class RetrievalStore:
    """Placeholder retrieval interface for ChromaDB + sentence-transformers integration."""

    def retrieve(self, niche_id: str, query: str, k: int = 5) -> list[dict[str, Any]]:
        return [
            {
                "source": f"niche:{niche_id}",
                "text": f"Mock retrieved context for query: {query}",
                "similarity_score": 0.82,
            }
        ][:k]

