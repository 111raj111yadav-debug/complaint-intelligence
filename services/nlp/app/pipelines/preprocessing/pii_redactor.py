"""Personally Identifiable Information (PII) pattern detector and redactor.

Safely detects and redacts sensitive customer credentials, including:
- Social Security Numbers (SSN)
- Credit & Debit Card numbers
- Email addresses
- Phone numbers
- Bank Account numbers
"""

from __future__ import annotations

import re
from typing import NamedTuple


class RedactionResult(NamedTuple):
    text: str
    redaction_counts: dict[str, int]
    total_redacted: int


# Compiled regex patterns for PII detection
PATTERNS = {
    "SSN": re.compile(r"\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b"),
    "CARD": re.compile(r"\b(?:\d{4}[-.\s]?){3}\d{4}\b"),
    "EMAIL": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
    "PHONE": re.compile(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
    "ACCOUNT": re.compile(
        r"(?i)\b(?:account|acct|acc)(?:\s+(?:number|no|#))?[:\s#]*(\d{6,16})\b",
    ),
}


def redact_pii(text: str) -> RedactionResult:
    """Detect and redact sensitive customer PII tokens from complaint text."""
    if not text:
        return RedactionResult(text="", redaction_counts={}, total_redacted=0)

    counts: dict[str, int] = {}
    total = 0
    redacted = text

    for pii_type, pattern in PATTERNS.items():
        matches = list(pattern.finditer(redacted))
        if matches:
            counts[pii_type] = len(matches)
            total += len(matches)
            token = f"[REDACTED_{pii_type}]"
            if pii_type == "ACCOUNT":
                redacted = pattern.sub(
                    lambda m, tok=token: m.group(0).replace(m.group(1), tok),
                    redacted,
                )
            else:
                redacted = pattern.sub(token, redacted)

    return RedactionResult(
        text=redacted,
        redaction_counts=counts,
        total_redacted=total,
    )
