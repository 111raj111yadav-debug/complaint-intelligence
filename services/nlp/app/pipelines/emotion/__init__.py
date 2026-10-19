"""Emotion Detection Package."""

from app.pipelines.emotion.detector import (
    EmotionDetector,
    EmotionResult,
    emotion_detector,
)

__all__ = [
    "EmotionDetector",
    "EmotionResult",
    "emotion_detector",
]
