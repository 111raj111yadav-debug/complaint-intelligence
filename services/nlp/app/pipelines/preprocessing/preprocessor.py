"""Modular Text Preprocessor for Complaint Intelligence.

Combines Unicode normalization, HTML stripping, negation preservation,
length boundaries, and PII redaction into an auditable processing pipeline.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.pipelines.preprocessing.cleaner import (
    normalize_unicode,
    normalize_whitespace,
    preserve_negations,
    strip_html_and_markup,
)
from app.pipelines.preprocessing.pii_redactor import redact_pii


class PreprocessingResult(BaseModel):
    """Structured result of text preprocessing operations."""

    original_text: str
    cleaned_text: str
    sanitized_text: str
    char_count: int
    word_count: int
    pii_redacted: bool
    redaction_counts: dict[str, int] = Field(default_factory=dict)
    is_valid: bool = True
    validation_error: str | None = None


class TextPreprocessor:
    """Configurable text preprocessing engine."""

    def __init__(
        self,
        min_length: int = 5,
        max_length: int = 10000,
        redact_sensitive_pii: bool = True,
        preserve_negation: bool = True,
    ) -> None:
        self.min_length = min_length
        self.max_length = max_length
        self.redact_sensitive_pii = redact_sensitive_pii
        self.preserve_negation = preserve_negation

    def preprocess(self, text: str | None) -> PreprocessingResult:
        """Execute full preprocessing pipeline on incoming complaint text."""
        # Validate missing / null input
        if text is None or not isinstance(text, str) or not text.strip():
            return PreprocessingResult(
                original_text="" if text is None else str(text),
                cleaned_text="",
                sanitized_text="",
                char_count=0,
                word_count=0,
                pii_redacted=False,
                is_valid=False,
                validation_error="Complaint text is empty or missing.",
            )

        original = text

        # Check maximum length before expensive transformations
        if len(text) > self.max_length:
            text = text[: self.max_length]

        # 1. Unicode normalization (NFKC)
        cleaned = normalize_unicode(text)

        # 2. HTML stripping
        cleaned = strip_html_and_markup(cleaned)

        # 3. Negation preservation
        if self.preserve_negation:
            cleaned = preserve_negations(cleaned)

        # 4. Whitespace normalization
        cleaned = normalize_whitespace(cleaned)

        # Length validation
        if len(cleaned) < self.min_length:
            return PreprocessingResult(
                original_text=original,
                cleaned_text=cleaned,
                sanitized_text=cleaned,
                char_count=len(cleaned),
                word_count=len(cleaned.split()),
                pii_redacted=False,
                is_valid=False,
                validation_error=(
                    f"Complaint text is too short ({len(cleaned)} chars < "
                    f"{self.min_length} required)."
                ),
            )

        # 5. PII Redaction for sanitized representation
        if self.redact_sensitive_pii:
            redaction = redact_pii(cleaned)
            sanitized = redaction.text
            pii_redacted = redaction.total_redacted > 0
            redaction_counts = redaction.redaction_counts
        else:
            sanitized = cleaned
            pii_redacted = False
            redaction_counts = {}

        return PreprocessingResult(
            original_text=original,
            cleaned_text=cleaned,
            sanitized_text=sanitized,
            char_count=len(cleaned),
            word_count=len(cleaned.split()),
            pii_redacted=pii_redacted,
            redaction_counts=redaction_counts,
            is_valid=True,
            validation_error=None,
        )


# Global default instance
default_preprocessor = TextPreprocessor()
