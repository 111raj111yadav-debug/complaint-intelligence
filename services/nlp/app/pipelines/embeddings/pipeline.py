"""Embedding Generation Pipeline.

Generates 384-dimensional dense sentence embeddings using sentence-transformers
(all-MiniLM-L6-v2) with strict PII redaction, input normalization, batching,
and retry fault tolerance.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from pydantic import BaseModel, Field

from app.pipelines.preprocessing.preprocessor import default_preprocessor

logger = logging.getLogger("embeddings_pipeline")

DEFAULT_MODEL_NAME = "all-MiniLM-L6-v2"
EXPECTED_EMBEDDING_DIM = 384


class EmbeddingResult(BaseModel):
    """Result of single text embedding generation."""

    text_preview: str
    embedding: list[float]
    dimension: int
    model_name: str
    pii_redacted: bool
    status: str = "success"  # success, error, empty_input
    error_message: str | None = None


class BatchEmbeddingResult(BaseModel):
    """Result of batch embedding generation."""

    embeddings: list[list[float]]
    dimensions: list[int]
    total_processed: int
    successful_count: int
    failed_count: int
    model_name: str
    errors: list[str] = Field(default_factory=list)


class EmbeddingPipeline:
    """Manages sentence embedding model lifecycle, normalization, and inference."""

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL_NAME,
        batch_size: int = 32,
        max_retries: int = 3,
        retry_delay_seconds: float = 1.0,
    ) -> None:
        self.model_name = model_name
        self.expected_dim = EXPECTED_EMBEDDING_DIM
        self.batch_size = batch_size
        self.max_retries = max_retries
        self.retry_delay_seconds = retry_delay_seconds
        self._model: Any = None
        self._is_loaded = False

    def _ensure_model_loaded(self) -> None:
        """Lazily load sentence-transformers model into memory."""
        if self._is_loaded and self._model is not None:
            return

        try:
            logger.info("Loading sentence-transformers model '%s'...", self.model_name)
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name)
            self._is_loaded = True
            logger.info(
                "Embedding model '%s' loaded successfully (dim=%d).",
                self.model_name,
                self.expected_dim,
            )
        except Exception as exc:
            logger.error(
                "Failed to load embedding model '%s': %s",
                self.model_name,
                exc,
                exc_info=True,
            )
            self._is_loaded = False
            self._model = None
            raise RuntimeError(f"Embedding model initialization failed: {exc}") from exc

    @property
    def is_loaded(self) -> bool:
        """Check whether the embedding model is loaded."""
        return self._is_loaded and self._model is not None

    def normalize_and_redact(self, text: str) -> tuple[str, bool]:
        """Normalize whitespace, unicode, and redact PII prior to embedding."""
        if not text or not text.strip():
            return "", False

        prep = default_preprocessor.preprocess(text)
        sanitized = prep.sanitized_text if prep.is_valid else text.strip()
        return sanitized, prep.pii_redacted

    def encode_text(self, text: str) -> EmbeddingResult:
        """Generate normalized 384-d embedding for a single text."""
        sanitized, pii_redacted = self.normalize_and_redact(text)
        preview = (sanitized[:80] + "...") if len(sanitized) > 80 else sanitized

        if not sanitized:
            return EmbeddingResult(
                text_preview=preview,
                embedding=[],
                dimension=0,
                model_name=self.model_name,
                pii_redacted=pii_redacted,
                status="empty_input",
                error_message="Input text is empty after preprocessing.",
            )

        self._ensure_model_loaded()

        attempts = 0
        last_error: Exception | None = None

        while attempts < self.max_retries:
            try:
                raw_emb = self._model.encode(
                    sanitized,
                    show_progress_bar=False,
                    convert_to_numpy=True,
                    normalize_embeddings=True,
                )
                emb_list = [float(val) for val in raw_emb]

                if len(emb_list) != self.expected_dim:
                    raise ValueError(
                        f"Unexpected embedding dimension: got {len(emb_list)}, "
                        f"expected {self.expected_dim}"
                    )

                return EmbeddingResult(
                    text_preview=preview,
                    embedding=emb_list,
                    dimension=len(emb_list),
                    model_name=self.model_name,
                    pii_redacted=pii_redacted,
                    status="success",
                    error_message=None,
                )
            except Exception as exc:
                attempts += 1
                last_error = exc
                logger.warning(
                    "Embedding encoding attempt %d/%d failed: %s",
                    attempts,
                    self.max_retries,
                    exc,
                )
                if attempts < self.max_retries:
                    time.sleep(self.retry_delay_seconds * attempts)

        logger.error(
            "All %d attempts to encode text failed. Last error: %s",
            self.max_retries,
            last_error,
        )
        return EmbeddingResult(
            text_preview=preview,
            embedding=[],
            dimension=0,
            model_name=self.model_name,
            pii_redacted=pii_redacted,
            status="error",
            error_message=str(last_error),
        )

    def encode_batch(self, texts: list[str]) -> BatchEmbeddingResult:
        """Generate normalized embeddings for a batch of texts with chunking."""
        if not texts:
            return BatchEmbeddingResult(
                embeddings=[],
                dimensions=[],
                total_processed=0,
                successful_count=0,
                failed_count=0,
                model_name=self.model_name,
                errors=[],
            )

        self._ensure_model_loaded()

        sanitized_texts: list[str] = []
        for text in texts:
            clean, _ = self.normalize_and_redact(text)
            sanitized_texts.append(clean if clean else " ")

        all_embeddings: list[list[float]] = []
        all_dimensions: list[int] = []
        errors: list[str] = []

        total = len(sanitized_texts)
        for i in range(0, total, self.batch_size):
            chunk = sanitized_texts[i : i + self.batch_size]
            attempts = 0
            chunk_success = False

            while attempts < self.max_retries and not chunk_success:
                try:
                    raw_embs = self._model.encode(
                        chunk,
                        batch_size=len(chunk),
                        show_progress_bar=False,
                        convert_to_numpy=True,
                        normalize_embeddings=True,
                    )
                    for raw in raw_embs:
                        emb = [float(v) for v in raw]
                        all_embeddings.append(emb)
                        all_dimensions.append(len(emb))
                    chunk_success = True
                except Exception as exc:
                    attempts += 1
                    logger.warning(
                        "Batch embedding chunk (%d-%d) attempt %d/%d failed: %s",
                        i,
                        i + len(chunk),
                        attempts,
                        self.max_retries,
                        exc,
                    )
                    if attempts < self.max_retries:
                        time.sleep(self.retry_delay_seconds * attempts)
                    else:
                        errors.append(f"Chunk {i}-{i+len(chunk)} failed: {exc}")
                        # Fill failed chunk with empty lists
                        for _ in chunk:
                            all_embeddings.append([])
                            all_dimensions.append(0)

        successful_count = sum(1 for d in all_dimensions if d == self.expected_dim)
        failed_count = total - successful_count

        return BatchEmbeddingResult(
            embeddings=all_embeddings,
            dimensions=all_dimensions,
            total_processed=total,
            successful_count=successful_count,
            failed_count=failed_count,
            model_name=self.model_name,
            errors=errors,
        )


# Global singleton instance
embedding_pipeline = EmbeddingPipeline()
