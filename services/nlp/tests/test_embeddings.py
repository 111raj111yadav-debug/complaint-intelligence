"""Unit tests for embedding pipeline, normalization, and PII redaction."""

import numpy as np
import pytest

from app.pipelines.embeddings.pipeline import embedding_pipeline


def test_embedding_pipeline_dimension():
    """Embedding vector must have exact dimension 384 for all-MiniLM-L6-v2."""
    res = embedding_pipeline.encode_text("Unauthorized transaction on credit card")
    assert res.status == "success"
    assert res.dimension == 384
    assert len(res.embedding) == 384
    assert res.model_name == "all-MiniLM-L6-v2"


def test_embedding_l2_normalization():
    """Dense vector embeddings must be unit-normalized (L2 norm = 1.0)."""
    res = embedding_pipeline.encode_text("Late fee charged after statement payment")
    arr = np.array(res.embedding, dtype=np.float32)
    norm = np.linalg.norm(arr)
    assert np.isclose(norm, 1.0, atol=1e-3)


def test_pii_redaction_in_embedding_pipeline():
    """Text with SSN and card numbers must be sanitized before encoding."""
    text_with_pii = (
        "My SSN 123-45-6789 was used without consent to open card 4111-2222-3333-4444."
    )
    res = embedding_pipeline.encode_text(text_with_pii)
    assert res.status == "success"
    assert res.pii_redacted is True
    # Redacted text should not contain the original sensitive numbers
    assert "123-45-6789" not in res.text_preview
    assert "4111-2222-3333-4444" not in res.text_preview
    assert "[REDACTED_SSN]" in res.text_preview or "[REDACTED_CARD]" in res.text_preview


def test_batch_embedding_encoding():
    """Batch encoding should preserve sequence count and dimension."""
    texts = [
        "Card payment failed at POS terminal.",
        "Mortgage escrow calculation discrepancy.",
        "Debt collector calling outside permissible hours.",
    ]
    batch_res = embedding_pipeline.encode_batch(texts)
    assert batch_res.total_processed == 3
    assert batch_res.successful_count == 3
    assert len(batch_res.embeddings) == 3
    for emb in batch_res.embeddings:
        assert len(emb) == 384
