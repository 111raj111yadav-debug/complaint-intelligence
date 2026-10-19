"""Emotion Detection Pipeline for Customer Complaints.

Implements an emotion analysis framework based on the Plutchik / Ekman model,
specifically adapted for consumer disputes, financial anxiety, and service grievances.

Supported Emotion Classes:
- anger (outrage, frustration, perceived injustice)
- fear (financial distress, anxiety, fear of credit damage / repossession)
- sadness (helplessness, disappointment, despair)
- disgust (revulsion towards predatory/dishonest practices)
- surprise (shock at unexpected fees or sudden account lockouts)
- joy (relief, satisfaction, gratitude)
- neutral (factual reporting of transactions or account status)
"""

from __future__ import annotations

import logging
import math
import re
from typing import ClassVar

from pydantic import BaseModel, Field

from app.pipelines.preprocessing.preprocessor import default_preprocessor

logger = logging.getLogger("emotion_pipeline")

MODEL_IDENTIFIER = "lexicon/plutchik-complaint-v1.0"


class EmotionResult(BaseModel):
    """Structured response for emotion detection."""

    primary_emotion: str
    confidence: float
    scores: dict[str, float] = Field(default_factory=dict)
    secondary_emotions: list[str] = Field(default_factory=list)
    model_identifier: str = MODEL_IDENTIFIER
    status: str = "success"  # "success", "fallback", "error"
    error_message: str | None = None


class EmotionDetector:
    """Multi-class emotion detector calibrated for customer complaint narratives."""

    # Lexical patterns for emotion indicators
    EMOTION_PATTERNS: ClassVar[dict[str, list[str]]] = {
        "anger": [
            r"\bangry\b",
            r"\bfurious\b",
            r"\boutraged\b",
            r"\bunacceptable\b",
            r"\bridiculous\b",
            r"\bharass(?:ment|ing)?\b",
            r"\bthreat(?:en|ened|ening)?\b",
            r"\blie[sd]?\b",
            r"\bly(?:ing)?\b",
            r"\bcheat(?:ed|ing)?\b",
            r"\bscam(?:med|mer)?\b",
            r"\bpredatory\b",
            r"\bextort(?:ion)?\b",
            r"\brip[- ]?off\b",
            r"\bfed up\b",
            r"\bsue\b",
            r"\blawsuit\b",
            r"\billegal\b",
            r"\bcriminal\b",
            r"\bviolat(?:ion|ed)?\b",
            r"\bincompetent\b",
            r"\brefuse[sd]?\b",
            r"\bunfair\b",
            r"\brobbed\b",
            r"\bstole[n]?\b",
        ],
        "fear": [
            r"\bafraid\b",
            r"\bterrified\b",
            r"\bpanic\b",
            r"\banxious\b",
            r"\banxiety\b",
            r"\bworr(?:y|ied|ying)\b",
            r"\bdesperate\b",
            r"\bhelpless\b",
            r"\bruin(?:ed)?\b",
            r"\bhomeless\b",
            r"\bforeclos(?:ure|ed)?\b",
            r"\bevict(?:ion|ed)?\b",
            r"\bbankrupt(?:cy)?\b",
            r"\blosing everything\b",
            r"\blivelihood\b",
            r"\bdistress\b",
            r"\bfear(?:ful)?\b",
            r"\bscared\b",
            r"\bdestroy(?:ed)? my credit\b",
            r"\bvulnerable\b",
        ],
        "sadness": [
            r"\bsad\b",
            r"\bdepressed\b",
            r"\bheartbroken\b",
            r"\bdisappoint(?:ed|ing|ment)?\b",
            r"\bgrief\b",
            r"\bdevastat(?:ed|ing)?\b",
            r"\bhopeless\b",
            r"\bsorrow\b",
            r"\bcrying\b",
            r"\btears\b",
            r"\bregret\b",
            r"\bashamed\b",
            r"\bmiserable\b",
            r"\bexhausted\b",
            r"\bdefeat(?:ed)?\b",
            r"\bpainful\b",
        ],
        "disgust": [
            r"\bdisgust(?:ed|ing)?\b",
            r"\bsick(?:ening)?\b",
            r"\bappall(?:ed|ing)?\b",
            r"\brepuls(?:ive)?\b",
            r"\bvile\b",
            r"\bshameful\b",
            r"\bgross\b",
            r"\bdeceit(?:ful)?\b",
            r"\bcorrupt\b",
            r"\bslimy\b",
        ],
        "surprise": [
            r"\bshock(?:ed|ing)?\b",
            r"\bstunned\b",
            r"\bbaffled\b",
            r"\bunexpected(?:ly)?\b",
            r"\bunbelievable\b",
            r"\bastonished\b",
            r"\bbewildered\b",
            r"\bcaught off guard\b",
            r"\bout of nowhere\b",
            r"\bsudden(?:ly)?\b",
            r"\bsurprise[d]?\b",
        ],
        "joy": [
            r"\bthankful\b",
            r"\bgrateful\b",
            r"\bpleased\b",
            r"\bdelighted\b",
            r"\bhappy\b",
            r"\bappreciat(?:e|ed|ion)\b",
            r"\bsatisfied\b",
            r"\brelief\b",
            r"\bglad\b",
            r"\bwonderful\b",
            r"\bexcellent\b",
        ],
    }

    # Negation words that flip nearby emotion triggers
    NEGATION_WORDS = {"not", "never", "cannot", "no", "hardly", "barely", "scarcely"}

    def __init__(self) -> None:
        self.model_identifier = MODEL_IDENTIFIER
        self._compiled_patterns = {
            emotion: [re.compile(p, re.IGNORECASE) for p in patterns]
            for emotion, patterns in self.EMOTION_PATTERNS.items()
        }
        logger.info("Emotion Detector initialized (%s).", self.model_identifier)

    @property
    def is_loaded(self) -> bool:
        """Check whether the emotion detector is operational."""
        return True

    def detect(self, text: str | None) -> EmotionResult:
        """Detect probabilistic emotion signals and scores from complaint text."""
        if not text or not str(text).strip():
            return EmotionResult(
                primary_emotion="neutral",
                confidence=1.0,
                scores={
                    "anger": 0.0,
                    "fear": 0.0,
                    "sadness": 0.0,
                    "disgust": 0.0,
                    "surprise": 0.0,
                    "joy": 0.0,
                    "neutral": 1.0,
                },
                secondary_emotions=[],
                model_identifier=self.model_identifier,
                status="success",
            )

        try:
            prep = default_preprocessor.preprocess(text)
            cleaned = prep.cleaned_text.lower()

            raw_scores: dict[str, float] = {
                "anger": 0.0,
                "fear": 0.0,
                "sadness": 0.0,
                "disgust": 0.0,
                "surprise": 0.0,
                "joy": 0.0,
                "neutral": 0.5,  # Baseline neutral weight
            }

            # Check for emotion occurrences with basic negation window check
            for emotion, regexes in self._compiled_patterns.items():
                for regex in regexes:
                    for match in regex.finditer(cleaned):
                        start_char = match.start()
                        # Extract preceding 4 words for negation
                        preceding_text = cleaned[max(0, start_char - 30) : start_char]
                        preceding_words = set(preceding_text.split()[-3:])

                        if preceding_words.intersection(self.NEGATION_WORDS):
                            # Suppress or downweight negated emotion
                            raw_scores[emotion] = max(0.0, raw_scores[emotion] - 0.5)
                        else:
                            raw_scores[emotion] += 1.2

            # Softmax normalization to produce calibrated probabilistic scores
            exp_scores = {e: math.exp(score) for e, score in raw_scores.items()}
            sum_exp = sum(exp_scores.values())
            normalized_scores = {
                e: round(exp_score / sum_exp, 4) for e, exp_score in exp_scores.items()
            }

            # Identify primary and secondary emotions
            sorted_emotions = sorted(normalized_scores.items(), key=lambda kv: kv[1], reverse=True)
            primary_emotion, primary_confidence = sorted_emotions[0]

            # Secondary emotions: non-neutral emotions with significant probability (>= 0.15)
            secondary = [e for e, s in sorted_emotions[1:] if e != "neutral" and s >= 0.15]

            return EmotionResult(
                primary_emotion=primary_emotion,
                confidence=primary_confidence,
                scores=normalized_scores,
                secondary_emotions=secondary,
                model_identifier=self.model_identifier,
                status="success",
                error_message=None,
            )
        except Exception as exc:
            logger.error("Emotion detection error: %s", exc, exc_info=True)
            return EmotionResult(
                primary_emotion="neutral",
                confidence=0.0,
                scores={},
                secondary_emotions=[],
                model_identifier=self.model_identifier,
                status="error",
                error_message=str(exc),
            )


# Global singleton instance
emotion_detector = EmotionDetector()
