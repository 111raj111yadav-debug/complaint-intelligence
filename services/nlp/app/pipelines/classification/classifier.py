"""Complaint Category Classification Pipeline.

Loads the trained TF-IDF + Logistic Regression artifact and provides inference
with confidence scoring, full class probability distributions, and graceful fallback handling.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import joblib
from pydantic import BaseModel, Field

from app.pipelines.preprocessing.preprocessor import default_preprocessor

logger = logging.getLogger("classification_pipeline")

DEFAULT_MODEL_PATH = Path("artifacts/category_model.joblib")
DEFAULT_METADATA_PATH = Path("artifacts/category_model_metadata.json")


class CategoryPrediction(BaseModel):
    """Structured response for category prediction."""

    category: str
    confidence: float
    probabilities: dict[str, float] = Field(default_factory=dict)
    model_version: str
    status: str = "success"  # "success", "unavailable", "empty_input", "error"
    error_message: str | None = None


class CategoryClassifier:
    """Manages the category classification lifecycle and inference."""

    def __init__(
        self,
        model_path: Path | str = DEFAULT_MODEL_PATH,
        metadata_path: Path | str = DEFAULT_METADATA_PATH,
    ) -> None:
        self.model_path = Path(model_path)
        self.metadata_path = Path(metadata_path)
        self.pipeline: Any = None
        self.metadata: dict[str, Any] = {}
        self.model_version: str = "1.0.0-tfidf-logreg"
        self.classes_: list[str] = []
        self._load_model()

    def _load_model(self) -> None:
        """Load model pipeline artifact and metadata into memory."""
        # Check relative to nlp root if path is relative
        candidate_paths = [
            self.model_path,
            Path(__file__).resolve().parent.parent.parent / self.model_path,
            Path("services/nlp") / self.model_path,
        ]

        found_path: Path | None = None
        for path in candidate_paths:
            if path.exists():
                found_path = path
                break

        if found_path:
            try:
                logger.info("Loading Category Classifier from %s ...", found_path)
                self.pipeline = joblib.load(found_path)
                self.classes_ = [str(c) for c in self.pipeline.classes_]
                self.model_path = found_path

                meta_candidate = found_path.parent / "category_model_metadata.json"
                if meta_candidate.exists():
                    with open(meta_candidate, encoding="utf-8") as f:
                        self.metadata = json.load(f)
                        self.model_version = self.metadata.get("model_version", self.model_version)
                logger.info(
                    "Category Classifier loaded successfully (v%s, classes=%s).",
                    self.model_version,
                    self.classes_,
                )
            except Exception as exc:
                logger.error(
                    "Failed to load category model from %s: %s", found_path, exc, exc_info=True
                )
                self.pipeline = None
        else:
            logger.warning("Category model artifact not found at candidates: %s", candidate_paths)
            self.pipeline = None

    @property
    def is_loaded(self) -> bool:
        """Check whether the classification pipeline is loaded and operational."""
        return self.pipeline is not None

    def predict(self, text: str) -> CategoryPrediction:
        """Predict the category of complaint text with confidence scores."""
        # 1. Validate input text
        if not text or not text.strip():
            return CategoryPrediction(
                category="unknown",
                confidence=0.0,
                probabilities={},
                model_version=self.model_version,
                status="empty_input",
                error_message="Complaint text is empty.",
            )

        # 2. Check model availability
        if not self.is_loaded:
            return CategoryPrediction(
                category="general_support",
                confidence=0.0,
                probabilities={},
                model_version=self.model_version,
                status="unavailable",
                error_message="Category classification model artifact is not loaded.",
            )

        try:
            # 3. Text Preprocessing
            prep = default_preprocessor.preprocess(text)
            input_text = prep.cleaned_text if prep.is_valid else text

            # 4. Model Inference
            probs = self.pipeline.predict_proba([input_text])[0]
            max_idx = int(probs.argmax())
            best_class = str(self.classes_[max_idx])
            best_confidence = float(round(probs[max_idx], 4))

            prob_dict = {
                str(cls_name): float(round(prob, 4))
                for cls_name, prob in zip(self.classes_, probs, strict=False)
            }

            return CategoryPrediction(
                category=best_class,
                confidence=best_confidence,
                probabilities=prob_dict,
                model_version=self.model_version,
                status="success",
                error_message=None,
            )
        except Exception as exc:
            logger.error("Inference failure for complaint text: %s", exc, exc_info=True)
            return CategoryPrediction(
                category="unknown",
                confidence=0.0,
                probabilities={},
                model_version=self.model_version,
                status="error",
                error_message=str(exc),
            )


# Global singleton instance
category_classifier = CategoryClassifier()
