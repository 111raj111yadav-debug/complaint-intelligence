"""Semantic Retrieval Service for Resolution Knowledge Base.

Executes vector similarity search against PostgreSQL with pgvector, applying
pii redaction, cosine similarity ranking, eligibility filters (verified only),
category reranking, and threshold-based empty result handling.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import psycopg2
from pydantic import BaseModel, Field

from app.pipelines.embeddings.pipeline import embedding_pipeline

logger = logging.getLogger("retrieval_pipeline")

DEFAULT_SIMILARITY_THRESHOLD = 0.40
DEFAULT_TOP_K = 3


class RetrievedResolution(BaseModel):
    """Structured representation of a retrieved historical resolution."""

    id: str
    reference_code: str
    title: str
    complaint_text: str
    resolution_text: str
    resolution_outcome: str
    category: str
    department_code: str
    similarity_score: float
    is_verified: bool
    verification_status: str
    data_source: str
    provenance: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RetrievalResult(BaseModel):
    """Complete structured response for semantic retrieval."""

    query: str
    query_preview: str
    similarity_threshold: float
    top_k: int
    category_filter: str | None = None
    department_filter: str | None = None
    matched_count: int
    is_empty: bool
    empty_reason: str | None = None
    results: list[RetrievedResolution] = Field(default_factory=list)


class SemanticRetriever:
    """Retriever service executing parameterized pgvector queries."""

    def __init__(
        self,
        default_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
        default_top_k: int = DEFAULT_TOP_K,
    ) -> None:
        self.default_threshold = default_threshold
        self.default_top_k = default_top_k

    def _get_connection(self) -> psycopg2.extensions.connection:
        """Create PostgreSQL connection from environment settings."""
        db_url = os.getenv("DATABASE_URL")
        if db_url:
            return psycopg2.connect(db_url)

        host = os.getenv("POSTGRES_HOST", "localhost")
        port = int(os.getenv("POSTGRES_PORT", "5434"))
        user = os.getenv("POSTGRES_USER", "postgres")
        password = os.getenv("POSTGRES_PASSWORD", "2004")
        dbname = os.getenv("POSTGRES_DB", "complaint_intelligence_db")

        return psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname=dbname,
        )

    def search(
        self,
        query: str,
        top_k: int | None = None,
        similarity_threshold: float | None = None,
        category_filter: str | None = None,
        department_filter: str | None = None,
        only_verified: bool = True,
    ) -> RetrievalResult:
        """Search historical resolutions using pgvector cosine similarity."""
        k = top_k if top_k is not None and top_k > 0 else self.default_top_k
        threshold = (
            similarity_threshold
            if similarity_threshold is not None
            else self.default_threshold
        )

        # 1. Input validation
        if not query or not query.strip():
            return RetrievalResult(
                query="",
                query_preview="",
                similarity_threshold=threshold,
                top_k=k,
                matched_count=0,
                is_empty=True,
                empty_reason="Search query is empty or whitespace.",
                results=[],
            )

        # 2. Normalize and redact query text
        sanitized_query, _ = embedding_pipeline.normalize_and_redact(query)
        preview = (
            (sanitized_query[:80] + "...")
            if len(sanitized_query) > 80
            else sanitized_query
        )

        if not sanitized_query:
            return RetrievalResult(
                query=query,
                query_preview=preview,
                similarity_threshold=threshold,
                top_k=k,
                matched_count=0,
                is_empty=True,
                empty_reason="Query contains no valid text after PII redaction.",
                results=[],
            )

        # 3. Generate query vector embedding (384 dimensions)
        emb_res = embedding_pipeline.encode_text(sanitized_query)
        if emb_res.status != "success" or not emb_res.embedding:
            logger.error("Failed to generate embedding for query: %s", emb_res.error_message)
            return RetrievalResult(
                query=query,
                query_preview=preview,
                similarity_threshold=threshold,
                top_k=k,
                matched_count=0,
                is_empty=True,
                empty_reason=f"Embedding generation failed: {emb_res.error_message}",
                results=[],
            )

        vec_str = "[" + ",".join(f"{x:.6f}" for x in emb_res.embedding) + "]"

        # 4. Execute pgvector parameterized query
        # Cosine similarity is 1 - (embedding <=> query_vec)
        sql = """
            SELECT
                id, reference_code, title, complaint_text, resolution_text,
                resolution_outcome, category, department_code,
                is_verified, verification_status, data_source, provenance, metadata,
                (1 - (embedding <=> %(query_vec)s::vector)) AS similarity
            FROM resolutions
            WHERE embedding IS NOT NULL
              AND (%(only_verified)s = FALSE OR is_verified = TRUE)
              AND (%(category)s IS NULL OR category = %(category)s)
              AND (%(department)s IS NULL OR department_code = %(department)s)
              AND (1 - (embedding <=> %(query_vec)s::vector)) >= %(threshold)s
            ORDER BY embedding <=> %(query_vec)s::vector ASC
            LIMIT %(limit)s;
        """

        params = {
            "query_vec": vec_str,
            "only_verified": only_verified,
            "category": category_filter if category_filter else None,
            "department": department_filter if department_filter else None,
            "threshold": threshold,
            "limit": k,
        }

        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()

            matched_results: list[RetrievedResolution] = []
            for r in rows:
                sim_score = float(round(r[13], 4))
                matched_results.append(
                    RetrievedResolution(
                        id=str(r[0]),
                        reference_code=str(r[1]),
                        title=str(r[2]),
                        complaint_text=str(r[3]),
                        resolution_text=str(r[4]),
                        resolution_outcome=str(r[5]),
                        category=str(r[6]),
                        department_code=str(r[7]),
                        is_verified=bool(r[8]),
                        verification_status=str(r[9]),
                        data_source=str(r[10]),
                        provenance=r[11] if isinstance(r[11], dict) else {},
                        metadata=r[12] if isinstance(r[12], dict) else {},
                        similarity_score=sim_score,
                    )
                )

            is_empty = len(matched_results) == 0
            empty_reason = (
                f"No verified resolutions found exceeding similarity threshold of {threshold:.2f}."
                if is_empty
                else None
            )

            logger.info(
                "Retrieval executed for query '%s': matched %d items (threshold=%.2f, k=%d)",
                preview,
                len(matched_results),
                threshold,
                k,
            )

            return RetrievalResult(
                query=query,
                query_preview=preview,
                similarity_threshold=threshold,
                top_k=k,
                category_filter=category_filter,
                department_filter=department_filter,
                matched_count=len(matched_results),
                is_empty=is_empty,
                empty_reason=empty_reason,
                results=matched_results,
            )

        except Exception as exc:
            logger.error("Error executing semantic retrieval: %s", exc, exc_info=True)
            return RetrievalResult(
                query=query,
                query_preview=preview,
                similarity_threshold=threshold,
                top_k=k,
                category_filter=category_filter,
                department_filter=department_filter,
                matched_count=0,
                is_empty=True,
                empty_reason=f"Database retrieval failure: {exc}",
                results=[],
            )
        finally:
            conn.close()


# Global singleton instance
semantic_retriever = SemanticRetriever()
