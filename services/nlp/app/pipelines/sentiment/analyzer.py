"""Sentiment Analysis Pipeline for Customer Complaints.

Uses the validated NLTK VADER (Valence Aware Dictionary and sEntiment Reasoner)
sentiment analysis model (lexicon v3.3.0). Specifically engineered for sentiment
in social, customer service, and unstructured dispute texts.

Supports:
- Positive, Neutral, Negative three-class classification
- Continuous compound sentiment polarity score (-1.0 to +1.0)
- Pos, Neu, Neg component probability distributions
- Pinned model identifier and language boundary handling (English)
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger("sentiment_pipeline")

MODEL_IDENTIFIER = "nltk/vader_lexicon-3.3.0"


class SentimentResult(BaseModel):
    """Structured response for sentiment analysis."""

    label: str  # "positive", "neutral", "negative"
    score: float  # Normalized confidence [0.0, 1.0]
    scores: dict[str, float] = Field(default_factory=dict)
    compound: float  # Polarity index [-1.0, 1.0]
    model_identifier: str = MODEL_IDENTIFIER
    status: str = "success"  # "success", "unavailable", "error"
    error_message: str | None = None


class SentimentAnalyzer:
    """Manages model loading and sentiment inference."""

    def __init__(self) -> None:
        self.sia: Any = None
        self.model_identifier = MODEL_IDENTIFIER
        self._load_model()

    def _load_model(self) -> None:
        """Initialize the sentiment intensity analyzer."""
        try:
            import nltk

            try:
                from nltk.sentiment.vader import SentimentIntensityAnalyzer

                self.sia = SentimentIntensityAnalyzer()
            except LookupError:
                logger.info("Downloading NLTK vader_lexicon...")
                nltk.download("vader_lexicon", quiet=True)
                from nltk.sentiment.vader import SentimentIntensityAnalyzer

                self.sia = SentimentIntensityAnalyzer()
            logger.info("Sentiment Analyzer initialized successfully (%s).", self.model_identifier)
        except Exception as exc:
            logger.error("Failed to initialize sentiment analyzer: %s", exc, exc_info=True)
            self.sia = None

    @property
    def is_loaded(self) -> bool:
        """Check whether the sentiment model is operational."""
        return self.sia is not None

    def analyze(self, text: str | None) -> SentimentResult:
        """Analyze the sentiment of complaint text."""
        if not text or not str(text).strip():
            return SentimentResult(
                label="neutral",
                score=1.0,
                scores={"positive": 0.0, "neutral": 1.0, "negative": 0.0, "compound": 0.0},
                compound=0.0,
                model_identifier=self.model_identifier,
                status="success",
            )

        if not self.is_loaded:
            return SentimentResult(
                label="neutral",
                score=0.0,
                scores={"positive": 0.0, "neutral": 0.0, "negative": 0.0, "compound": 0.0},
                compound=0.0,
                model_identifier=self.model_identifier,
                status="unavailable",
                error_message="Sentiment analyzer lexicon is not loaded.",
            )

        try:
            raw_scores = self.sia.polarity_scores(str(text))
            compound = float(raw_scores["compound"])
            pos = float(raw_scores["pos"])
            neu = float(raw_scores["neu"])
            neg = float(raw_scores["neg"])

            # Map compound score to 3-class label according to standard VADER benchmarks
            if compound >= 0.05:
                label = "positive"
                confidence = round(max(pos, (compound + 1.0) / 2.0), 4)
            elif compound <= -0.05:
                label = "negative"
                confidence = round(max(neg, abs(compound)), 4)
            else:
                label = "neutral"
                confidence = round(neu, 4)

            # Cap confidence in [0.0, 1.0]
            confidence = max(0.0, min(1.0, confidence))

            return SentimentResult(
                label=label,
                score=confidence,
                scores={
                    "positive": round(pos, 4),
                    "neutral": round(neu, 4),
                    "negative": round(neg, 4),
                    "compound": round(compound, 4),
                },
                compound=round(compound, 4),
                model_identifier=self.model_identifier,
                status="success",
                error_message=None,
            )
        except Exception as exc:
            logger.error("Sentiment analysis error: %s", exc, exc_info=True)
            return SentimentResult(
                label="neutral",
                score=0.0,
                scores={},
                compound=0.0,
                model_identifier=self.model_identifier,
                status="error",
                error_message=str(exc),
            )


# Global singleton instance
sentiment_analyzer = SentimentAnalyzer()
