"""Training script for Complaint Category Classifier.

Architecture:
- Feature Extraction: TfidfVectorizer (unigrams & bigrams, sublinear TF scaling)
- Classifier: LogisticRegression with balanced class weights
- Packaged inside a unified scikit-learn Pipeline for consistent preprocessing & inference
- Artifacts saved to services/nlp/artifacts/
"""

from __future__ import annotations

import argparse
import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, f1_score
from sklearn.pipeline import Pipeline

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("train_classifier")

MODEL_VERSION = "1.0.0-tfidf-logreg"


def train_category_model(
    train_path: Path,
    val_path: Path,
    artifacts_dir: Path,
    max_features: int = 30000,
    random_seed: int = 42,
) -> dict[str, Any]:
    """Train and validate the TF-IDF + Logistic Regression classification pipeline."""
    if not train_path.exists() or not val_path.exists():
        raise FileNotFoundError(
            f"Training data not found at {train_path} or {val_path}. Run ingest_dataset.py first."
        )

    logger.info("Loading training data from %s ...", train_path)
    train_df = pd.read_csv(train_path).dropna(subset=["normalized_text", "category"])
    logger.info("Loaded %d training records.", len(train_df))

    logger.info("Loading validation data from %s ...", val_path)
    val_df = pd.read_csv(val_path).dropna(subset=["normalized_text", "category"])
    logger.info("Loaded %d validation records.", len(val_df))

    X_train = train_df["normalized_text"].astype(str)
    y_train = train_df["category"].astype(str)

    X_val = val_df["normalized_text"].astype(str)
    y_val = val_df["category"].astype(str)

    logger.info("Constructing scikit-learn Pipeline (TfidfVectorizer + LogisticRegression)...")
    pipeline = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    max_features=max_features,
                    sublinear_tf=True,
                    min_df=3,
                    strip_accents="unicode",
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    C=1.5,
                    max_iter=1000,
                    class_weight="balanced",
                    solver="lbfgs",
                    random_state=random_seed,
                    n_jobs=-1,
                ),
            ),
        ]
    )

    logger.info("Fitting classification pipeline on %d training samples...", len(X_train))
    start_time = datetime.now(UTC)
    pipeline.fit(X_train, y_train)
    fit_duration_seconds = (datetime.now(UTC) - start_time).total_seconds()
    logger.info("Pipeline fitting completed in %.2f seconds.", fit_duration_seconds)

    # Validation evaluation
    logger.info("Evaluating on held-out validation set (%d samples)...", len(X_val))
    val_preds = pipeline.predict(X_val)
    val_f1_macro = float(f1_score(y_val, val_preds, average="macro"))
    val_f1_weighted = float(f1_score(y_val, val_preds, average="weighted"))
    val_report = classification_report(y_val, val_preds, output_dict=True)

    logger.info(
        "Validation Performance -> Macro F1: %.4f | Weighted F1: %.4f",
        val_f1_macro,
        val_f1_weighted,
    )

    # Save model artifact and metadata
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    model_artifact_path = artifacts_dir / "category_model.joblib"
    metadata_path = artifacts_dir / "category_model_metadata.json"

    logger.info("Persisting model artifact to %s ...", model_artifact_path)
    joblib.dump(pipeline, model_artifact_path, compress=3)

    classes = [str(c) for c in pipeline.classes_]
    metadata = {
        "model_name": "complaint_category_classifier",
        "model_version": MODEL_VERSION,
        "algorithm": "TfidfVectorizer + LogisticRegression",
        "created_at": datetime.now(UTC).isoformat(),
        "random_seed": random_seed,
        "fit_duration_seconds": fit_duration_seconds,
        "classes": classes,
        "num_classes": len(classes),
        "hyperparameters": {
            "tfidf_max_features": max_features,
            "tfidf_ngram_range": [1, 2],
            "tfidf_sublinear_tf": True,
            "clf_C": 1.5,
            "clf_class_weight": "balanced",
            "clf_solver": "lbfgs",
        },
        "training_samples": len(X_train),
        "validation_samples": len(X_val),
        "validation_metrics": {
            "macro_f1": round(val_f1_macro, 4),
            "weighted_f1": round(val_f1_weighted, 4),
            "per_class": {
                cls: {
                    "precision": round(val_report[cls]["precision"], 4),
                    "recall": round(val_report[cls]["recall"], 4),
                    "f1_score": round(val_report[cls]["f1-score"], 4),
                    "support": int(val_report[cls]["support"]),
                }
                for cls in classes
                if cls in val_report
            },
        },
    }

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    logger.info("Model metadata saved to %s.", metadata_path)
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Train baseline TF-IDF Category Classifier.")
    parser.add_argument(
        "--train-data",
        type=Path,
        default=Path("data/processed/train.csv"),
        help="Path to preprocessed train.csv.",
    )
    parser.add_argument(
        "--val-data",
        type=Path,
        default=Path("data/processed/val.csv"),
        help="Path to preprocessed val.csv.",
    )
    parser.add_argument(
        "--artifacts-dir",
        type=Path,
        default=Path("services/nlp/artifacts"),
        help="Destination directory for trained model artifacts.",
    )
    parser.add_argument(
        "--max-features",
        type=int,
        default=30000,
        help="Maximum vocabulary features for TF-IDF.",
    )
    parser.add_argument(
        "--random-seed",
        type=int,
        default=42,
        help="Random seed for reproducibility.",
    )

    args = parser.parse_args()
    train_category_model(
        train_path=args.train_data,
        val_path=args.val_data,
        artifacts_dir=args.artifacts_dir,
        max_features=args.max_features,
        random_seed=args.random_seed,
    )


if __name__ == "__main__":
    main()
