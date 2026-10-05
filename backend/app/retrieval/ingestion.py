"""Document ingestion pipeline — PDF/text → chunked embeddings in ChromaDB.

Supports two source types:
  - ``text``: raw brand guideline text passed directly
  - ``pdf``:  PDF files parsed with built-in Python tooling (PyPDF2 fallback to pdfminer)

Documents are chunked into ~400-token segments with 50-token overlap so
that retrieval returns focused, relevant passages rather than full docs.
"""

import logging
import re
import uuid
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Chunking parameters
# ---------------------------------------------------------------------------
_CHUNK_SIZE = 400       # approximate tokens (using word-split heuristic)
_CHUNK_OVERLAP = 50     # overlap in words to preserve context at boundaries


def _extract_text_from_pdf(file_path: str | Path) -> str:
    """Extract plain text from a PDF file.

    Tries PyPDF2 first (lightweight, usually in environment), then falls
    back to reading the file as raw text if PDF parsing fails.
    """
    try:
        import PyPDF2  # noqa: N813

        text_parts: list[str] = []
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        return "\n\n".join(text_parts)
    except ImportError:
        logger.warning("PyPDF2 not installed — attempting raw text read for %s", file_path)
    except Exception as exc:
        logger.warning("PDF parsing failed for %s: %s — attempting raw text", file_path, exc)

    # Fallback: treat as UTF-8 text
    return Path(file_path).read_text(encoding="utf-8", errors="replace")


def _clean_text(text: str) -> str:
    """Normalise whitespace, strip control chars, and collapse blank lines."""
    text = re.sub(r"[^\S\n]+", " ", text)        # collapse horizontal whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)        # max 2 newlines in a row
    return text.strip()


def chunk_text(text: str, chunk_size: int = _CHUNK_SIZE, overlap: int = _CHUNK_OVERLAP) -> list[str]:
    """Split *text* into overlapping chunks of approximately *chunk_size* words.

    Returns a list of non-empty string chunks.
    """
    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk.strip())
        start += chunk_size - overlap

    return chunks


class DocumentIngester:
    """Orchestrates the ingest-→-chunk-→-embed pipeline for brand assets."""

    def __init__(self, retrieval_store: Any) -> None:
        """
        Args:
            retrieval_store: A ``RetrievalStore`` instance (from vector_store.py)
                             used to upsert chunks into ChromaDB.
        """
        self.store = retrieval_store

    def ingest_text(
        self,
        niche_id: str,
        text: str,
        source_type: str = "text",
        original_filename: str | None = None,
        doc_id: str | None = None,
    ) -> dict[str, Any]:
        """Ingest a raw text string into the niche's vector collection.

        Returns a summary dict with ``doc_id``, ``chunk_count``, and ``source_type``.
        """
        doc_id = doc_id or str(uuid.uuid4())
        cleaned = _clean_text(text)
        chunks = chunk_text(cleaned)

        if not chunks:
            logger.warning("No chunks produced from text for niche %s (doc %s)", niche_id, doc_id)
            return {"doc_id": doc_id, "chunk_count": 0, "source_type": source_type}

        extra_meta: dict[str, Any] = {"source_type": source_type}
        if original_filename:
            extra_meta["filename"] = original_filename

        count = self.store.add_documents(
            niche_id=niche_id,
            doc_id=doc_id,
            chunks=chunks,
            source=source_type,
            extra_metadata=extra_meta,
        )

        logger.info(
            "Ingested %d chunks from %s '%s' for niche %s (doc_id=%s)",
            count,
            source_type,
            original_filename or "<inline>",
            niche_id,
            doc_id,
        )
        return {"doc_id": doc_id, "chunk_count": count, "source_type": source_type}

    def ingest_pdf(
        self,
        niche_id: str,
        file_path: str | Path,
        doc_id: str | None = None,
    ) -> dict[str, Any]:
        """Extract text from a PDF and ingest its chunks.

        Returns the same summary dict as ``ingest_text``.
        """
        path = Path(file_path)
        text = _extract_text_from_pdf(path)
        return self.ingest_text(
            niche_id=niche_id,
            text=text,
            source_type="pdf",
            original_filename=path.name,
            doc_id=doc_id,
        )

    def remove_document(self, niche_id: str, doc_id: str) -> None:
        """Remove all chunks for a previously ingested document."""
        self.store.delete_document(niche_id, doc_id)
