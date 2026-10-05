"""ChromaDB-backed retrieval store for niche-specific brand context.

Uses sentence-transformers (all-MiniLM-L6-v2) for embeddings and ChromaDB
for persistent vector storage.  Each niche gets its own collection so
retrieval is scoped to the correct brand universe.
"""

import logging
from pathlib import Path
from typing import Any

import chromadb

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_CHROMA_PERSIST_DIR = str(_BACKEND_DIR / "chroma_data")
_EMBEDDING_MODEL = "all-MiniLM-L6-v2"
_COLLECTION_PREFIX = "niche_"

# ---------------------------------------------------------------------------
# Lazy singletons — avoids loading the model at import time
# ---------------------------------------------------------------------------
_chroma_client: chromadb.ClientAPI | None = None
_embedding_fn: Any = None


def _get_embedding_fn() -> Any:
    """Lazily initialise the sentence-transformers embedding function."""
    global _embedding_fn  # noqa: PLW0603
    if _embedding_fn is None:
        from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

        logger.info("Loading embedding model '%s' …", _EMBEDDING_MODEL)
        _embedding_fn = SentenceTransformerEmbeddingFunction(model_name=_EMBEDDING_MODEL)
    return _embedding_fn


def _get_chroma_client() -> chromadb.ClientAPI:
    """Lazily create the persistent ChromaDB client."""
    global _chroma_client  # noqa: PLW0603
    if _chroma_client is None:
        logger.info("Initialising ChromaDB at '%s'", _CHROMA_PERSIST_DIR)
        _chroma_client = chromadb.PersistentClient(path=_CHROMA_PERSIST_DIR)
    return _chroma_client


def _collection_name(niche_id: str) -> str:
    """Deterministic collection name from a niche UUID string."""
    # ChromaDB collection names must match [a-zA-Z0-9_-] and be 3-63 chars
    sanitised = niche_id.replace("-", "_")
    return f"{_COLLECTION_PREFIX}{sanitised}"


class RetrievalStore:
    """Production retrieval interface backed by ChromaDB + sentence-transformers."""

    def __init__(self) -> None:
        self._client = _get_chroma_client()
        self._ef = _get_embedding_fn()

    # ------------------------------------------------------------------
    # Collection helpers
    # ------------------------------------------------------------------
    def _get_or_create_collection(self, niche_id: str) -> Any:
        """Return (and optionally create) the ChromaDB collection for a niche."""
        name = _collection_name(niche_id)
        return self._client.get_or_create_collection(
            name=name,
            embedding_function=self._ef,
            metadata={"hnsw:space": "cosine"},
        )

    # ------------------------------------------------------------------
    # Core retrieval — used by the orchestrator / copywriter
    # ------------------------------------------------------------------
    def retrieve(
        self,
        niche_id: str,
        query: str,
        k: int = 5,
        source_filter: str | None = None,
        exclude_source: str | None = None,
    ) -> list[dict[str, Any]]:
        """Retrieve the top-k most relevant chunks for *query* within *niche_id*.

        Supports optional source_filter (e.g. 'past_post') or exclude_source (e.g. 'past_post').
        Returns a list of dicts:
            {"source": ..., "text": ..., "similarity_score": float}
        Falls back to an empty list if the collection doesn't exist yet.
        """
        try:
            collection = self._get_or_create_collection(niche_id)
            if collection.count() == 0:
                logger.debug("Collection for niche %s is empty — returning no results.", niche_id)
                return []

            where_clause: dict[str, Any] | None = None
            if source_filter:
                where_clause = {"source": source_filter}
            elif exclude_source:
                where_clause = {"source": {"$ne": exclude_source}}

            # Check matching chunks for this where clause
            if where_clause:
                matched = collection.get(where=where_clause)
                matched_count = len(matched.get("ids", []))
                if matched_count == 0:
                    return []
                n_results = min(k, matched_count)
            else:
                n_results = min(k, collection.count())

            query_kwargs: dict[str, Any] = {
                "query_texts": [query],
                "n_results": n_results,
                "include": ["documents", "metadatas", "distances"],
            }
            if where_clause:
                query_kwargs["where"] = where_clause

            results = collection.query(**query_kwargs)

            chunks: list[dict[str, Any]] = []
            documents = results.get("documents", [[]])[0]
            metadatas = results.get("metadatas", [[]])[0]
            distances = results.get("distances", [[]])[0]

            for doc, meta, dist in zip(documents, metadatas, distances):
                # ChromaDB cosine distance is 1 − cosine_similarity
                similarity = round(1.0 - dist, 4) if dist is not None else 0.0
                chunks.append(
                    {
                        "source": meta.get("source", f"niche:{niche_id}"),
                        "text": doc,
                        "similarity_score": similarity,
                        "doc_id": meta.get("doc_id", ""),
                        "chunk_index": meta.get("chunk_index", 0),
                    }
                )

            logger.info(
                "Retrieved %d chunks for niche %s (query: '%.40s…')",
                len(chunks),
                niche_id,
                query,
            )
            return chunks

        except Exception:
            logger.exception("Retrieval failed for niche %s", niche_id)
            return []

    # ------------------------------------------------------------------
    # Write operations — used by the ingestion pipeline
    # ------------------------------------------------------------------
    def add_documents(
        self,
        niche_id: str,
        doc_id: str,
        chunks: list[str],
        source: str = "brand_asset",
        extra_metadata: dict[str, Any] | None = None,
    ) -> int:
        """Embed and upsert *chunks* into the niche's collection.

        Each chunk is stored with a deterministic id ``{doc_id}_chunk_{i}``
        so re-ingesting the same document replaces previous chunks.

        Returns the number of chunks added.
        """
        if not chunks:
            return 0

        collection = self._get_or_create_collection(niche_id)

        ids: list[str] = []
        documents: list[str] = []
        metadatas: list[dict[str, Any]] = []

        for idx, text in enumerate(chunks):
            chunk_id = f"{doc_id}_chunk_{idx}"
            meta: dict[str, Any] = {
                "doc_id": doc_id,
                "source": source,
                "chunk_index": idx,
            }
            if extra_metadata:
                meta.update(extra_metadata)

            ids.append(chunk_id)
            documents.append(text)
            metadatas.append(meta)

        collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
        logger.info(
            "Upserted %d chunks for doc %s into niche %s collection.",
            len(ids),
            doc_id,
            niche_id,
        )
        return len(ids)

    def delete_document(self, niche_id: str, doc_id: str) -> None:
        """Remove all chunks belonging to *doc_id* from the niche collection."""
        try:
            collection = self._get_or_create_collection(niche_id)
            # ChromaDB supports filtering on metadata
            collection.delete(where={"doc_id": doc_id})
            logger.info("Deleted all chunks for doc %s from niche %s.", doc_id, niche_id)
        except Exception:
            logger.exception("Failed to delete doc %s from niche %s", doc_id, niche_id)

    def prune_brand_asset_chunks(self, niche_id: str) -> None:
        """Remove any remaining brand asset chunks (excluding past_post) from the niche collection."""
        try:
            collection = self._get_or_create_collection(niche_id)
            if collection.count() > 0:
                collection.delete(where={"source": {"$ne": "past_post"}})
                logger.info("Pruned all brand asset chunks from niche %s.", niche_id)
        except Exception:
            logger.exception("Failed to prune brand asset chunks from niche %s", niche_id)

    def collection_count(self, niche_id: str, exclude_source: str | None = "past_post") -> int:
        """Return the number of brand guideline chunks stored for a niche.

        Excludes past_post chunks by default so campaign history does not inflate
        the brand asset chunk count.
        """
        try:
            collection = self._get_or_create_collection(niche_id)
            if collection.count() == 0:
                return 0
            if exclude_source:
                res = collection.get(where={"source": {"$ne": exclude_source}})
                return len(res.get("ids", []))
            return collection.count()
        except Exception:
            return 0
