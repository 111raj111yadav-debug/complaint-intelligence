"""Evaluation script for the Complaint Category Classifier on held-out test data.

Computes:
- Per-class Precision, Recall, F1-Score, Support
- Macro F1 and Weighted F1
- Confusion Matrix (raw and normalized)
- Comparison against Dummy (Majority-Class) Baseline
- Emits structured evaluation report for documentation and viva verification
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.metrics import classification_report, confusion_matrix, f1_score

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("evaluate_classifier")


def evaluate_model(
    model_path: Path,
    test_path: Path,
    output_report_path: Path,
) -> dict[str, Any]:
    """Execute evaluation on held-out test set."""
    if not model_path.exists():
        raise FileNotFoundError(f"Model artifact not found at {model_path}. Run train_classifier.py first.")

    if not test_path.exists():
        raise FileNotFoundError(f"Test dataset not found at {test_path}. Run ingest_dataset.py first.")

    logger.info("Loading model artifact from %s ...", model_path)
    pipeline = joblib.load(model_path)

    logger.info("Loading held-out test data from %s ...", test_path)
    test_df = pd.read_csv(test_path).dropna(subset=["normalized_text", "category"])
    logger.info("Loaded %d test samples.", len(test_df))

    X_test = test_df["normalized_text"].astype(str)
    y_test = test_df["category"].astype(str)

    logger.info("Running model predictions on test set...")
    y_pred = pipeline.predict(X_test)

    # Calculate metrics
    classes = [str(c) for c in pipeline.classes_]
    report_dict = classification_report(y_test, y_pred, target_names=classes, output_dict=True)
    f1_macro = float(f1_score(y_test, y_pred, average="macro"))
    f1_weighted = float(f1_score(y_test, y_pred, average="weighted"))
    cm = confusion_matrix(y_test, y_pred, labels=classes)
    cm_norm = confusion_matrix(y_test, y_pred, labels=classes, normalize="true")

    # Majority class baseline comparison
    dummy = DummyClassifier(strategy="most_frequent")
    dummy.fit(X_test, y_test)
    y_dummy_pred = dummy.predict(X_test)
    dummy_macro_f1 = float(f1_score(y_test, y_dummy_pred, average="macro"))
    dummy_weighted_f1 = float(f1_score(y_test, y_dummy_pred, average="weighted"))

    results: dict[str, Any] = {
        "evaluation_dataset": str(test_path),
        "total_test_samples": len(test_df),
        "model_path": str(model_path),
        "overall_metrics": {
            "macro_f1": round(f1_macro, 4),
            "weighted_f1": round(f1_weighted, 4),
            "accuracy": round(float(report_dict["accuracy"]), 4),
        },
        "majority_class_baseline": {
            "strategy": "most_frequent",
            "majority_class": str(dummy.classes_[0]),
            "macro_f1": round(dummy_macro_f1, 4),
            "weighted_f1": round(dummy_weighted_f1, 4),
            "f1_improvement_over_baseline": round(f1_macro - dummy_macro_f1, 4),
        },
        "per_class_metrics": {
            cls: {
                "precision": round(report_dict[cls]["precision"], 4),
                "recall": round(report_dict[cls]["recall"], 4),
                "f1_score": round(report_dict[cls]["f1-score"], 4),
                "support": int(report_dict[cls]["support"]),
            }
            for cls in classes
            if cls in report_dict
        },
        "confusion_matrix": {
            "labels": classes,
            "matrix_counts": cm.tolist(),
            "matrix_normalized": [[round(float(val), 4) for val in row] for row in cm_norm],
        },
    }

    output_report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    logger.info("Test Evaluation Finished:")
    logger.info("  -> Model Macro F1: %.4f | Baseline Macro F1: %.4f", f1_macro, dummy_macro_f1)
    logger.info("  -> Model Weighted F1: %.4f | Baseline Weighted F1: %.4f", f1_weighted, dummy_weighted_f1)
    logger.info("  -> Overall Accuracy: %.4f", report_dict["accuracy"])
    logger.info("Report saved to %s.", output_report_path)

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate category classifier on test data.")
    parser.add_argument(
        "--model-path",
        type=Path,
        default=Path("services/nlp/artifacts/category_model.joblib"),
        help="Path to trained model artifact.",
    )
    parser.add_argument(
        "--test-data",
        type=Path,
        default=Path("data/processed/test.csv"),
        help="Path to preprocessed test.csv.",
    )
    parser.add_argument(
        "--output-report",
        type=Path,
        default=Path("data/processed/test_evaluation_report.json"),
        help="Path to output JSON evaluation report.",
    )

    args = parser.parse_args()
    evaluate_model(
        model_path=args.model_path,
        test_path=args.test_data,
        output_report_path=args.output_report,
    )


if __name__ == "__main__":
    main()
