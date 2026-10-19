"""Text cleaning and normalization utilities for complaint text.

Preserves semantic negation, complaint details, and structural tokens while
cleaning formatting noise, control characters, and Unicode discrepancies.
"""

from __future__ import annotations

import html
import re
import unicodedata


def normalize_unicode(text: str) -> str:
    """Normalize Unicode characters using NFKC decomposition and composition."""
    if not text:
        return ""
    # NFKC normalizes compatibility characters into standard precomposed forms
    normalized = unicodedata.normalize("NFKC", text)
    # Strip non-printable and non-ASCII-compliant control characters except tabs/newlines
    cleaned = "".join(
        char
        for char in normalized
        if unicodedata.category(char)[0] != "C" or char in ("\n", "\t", " ")
    )
    return cleaned


def strip_html_and_markup(text: str) -> str:
    """Strip HTML tags and decode HTML entities safely."""
    if not text:
        return ""
    # Unescape HTML entities (e.g. &amp;, &lt;, &gt;, &#39;)
    text = html.unescape(text)
    # Remove HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Remove remaining lone ampersands or entity artifacts
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    return text


def normalize_whitespace(text: str) -> str:
    """Collapse repeated whitespace, carriage returns, and tabs to single spaces."""
    if not text:
        return ""
    # Normalize newline breaks to space
    text = text.replace("\r", " ").replace("\n", " ").replace("\t", " ")
    # Collapse multiple consecutive spaces
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def preserve_negations(text: str) -> str:
    """Normalize contraction forms of negation to ensure standard negation semantics."""
    if not text:
        return ""
    contractions = [
        (r"\bcan['’]t\b", "cannot"),
        (r"\bwon['’]t\b", "will not"),
        (r"\bdon['’]t\b", "do not"),
        (r"\bdidn['’]t\b", "did not"),
        (r"\bdoesn['’]t\b", "does not"),
        (r"\bhaven['’]t\b", "have not"),
        (r"\bhasn['’]t\b", "has not"),
        (r"\bhadn['’]t\b", "had not"),
        (r"\bwouldn['’]t\b", "would not"),
        (r"\bshouldn['’]t\b", "should not"),
        (r"\bcouldn['’]t\b", "could not"),
        (r"\bisn['’]t\b", "is not"),
        (r"\baren['’]t\b", "are not"),
        (r"\bwasn['’]t\b", "was not"),
        (r"\bweren['’]t\b", "were not"),
    ]
    for pattern, replacement in contractions:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text
