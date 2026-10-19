"""Public Dataset Ingestion, Inspection, and Preprocessing Script.

Dataset: Consumer Complaints Dataset for NLP (Kaggle: shashwatwork/consume-complaints-dataset-fo-nlp)
Origin: U.S. Consumer Financial Protection Bureau (CFPB) Public Complaint Database

This script handles:
1. Automated retrieval of public dataset if not present locally
2. Comprehensive data quality inspection and statistical profiling
3. Whitespace and Unicode normalization with negation preservation
4. Stratified train/val/test splitting with complete leakage prevention
5. Artifact persistence for reproducible downstream training and evaluation
"""

from __future__ import annotations

import argparse
import io
import json
import logging
import re
import sys
import unicodedata
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ingest_dataset")

KAGGLE_DATASET_URL = (
    "https://www.kaggle.com/api/v1/datasets/download/shashwatwork/consume-complaints-dataset-fo-nlp"
)

# Standard label mapping from raw product values to normalized categories and departments
NORMALIZED_LABELS = {
    "credit_reporting": {
        "display_name": "Credit Reporting & Repair",
        "department_code": "DEPT_CREDIT",
        "department_name": "Credit & Bureau Support",
    },
    "debt_collection": {
        "display_name": "Debt Collection",
        "department_code": "DEPT_COLLECTIONS",
        "department_name": "Collections & Dispute Support",
    },
    "mortgages_and_loans": {
        "display_name": "Mortgages & Consumer Loans",
        "department_code": "DEPT_LOANS",
        "department_name": "Loan & Mortgage Servicing",
    },
    "credit_card": {
        "display_name": "Credit Card & Prepaid",
        "department_code": "DEPT_CARDS",
        "department_name": "Card Services & Billing",
    },
    "retail_banking": {
        "display_name": "Retail Banking Services",
        "department_code": "DEPT_BANKING",
        "department_name": "Banking Operations",
    },
}


def download_dataset(target_path: Path) -> Path:
    """Download the public Consumer Complaints dataset from Kaggle if absent."""
    target_path.parent.mkdir(parents=True, exist_ok=True)
    if target_path.exists() and target_path.stat().st_size > 0:
        logger.info("Local dataset already exists at %s (%d bytes).", target_path, target_path.stat().st_size)
        return target_path

    logger.info("Downloading public Consumer Complaints dataset from %s ...", KAGGLE_DATASET_URL)
    with httpx.Client(timeout=120.0, follow_redirects=True) as client:
        response = client.get(KAGGLE_DATASET_URL)
        if response.status_code != 200:
            raise RuntimeError(
                f"Failed to download dataset: HTTP {response.status_code} - {response.text[:200]}"
            )

        logger.info("Downloaded %d bytes. Extracting complaints_processed.csv ...", len(response.content))
        with zipfile.ZipFile(io.BytesIO(response.content)) as zf:
            file_names = zf.namelist()
            target_filename = next((n for n in file_names if n.endswith(".csv")), None)
            if not target_filename:
                raise RuntimeError(f"No CSV file located inside downloaded zip: {file_names}")

            with zf.open(target_filename) as src_file, open(target_path, "wb") as dst_file:
                dst_file.write(src_file.read())

    logger.info("Successfully extracted dataset to %s (%d bytes).", target_path, target_path.stat().st_size)
    return target_path


def inspect_dataset(df: pd.DataFrame, text_col: str, label_col: str) -> dict[str, Any]:
    """Calculate thorough dataset statistics and data quality metrics."""
    total_rows = len(df)
    missing_text = int(df[text_col].isnull().sum())
    missing_labels = int(df[label_col].isnull().sum())

    # Calculate duplicates
    duplicate_rows = int(df.duplicated(subset=[text_col]).sum())

    # Non-null text lengths
    valid_texts = df[text_col].dropna().astype(str)
    char_lengths = valid_texts.apply(len)
    word_lengths = valid_texts.apply(lambda t: len(t.split()))

    class_counts = df[label_col].value_counts().to_dict()
    class_proportions = (df[label_col].value_counts(normalize=True) * 100).round(2).to_dict()

    stats: dict[str, Any] = {
        "total_records": total_rows,
        "columns": list(df.columns),
        "text_column": text_col,
        "label_column": label_col,
        "data_quality": {
            "missing_text_count": missing_text,
            "missing_text_percent": round((missing_text / total_rows) * 100, 4) if total_rows else 0,
            "missing_label_count": missing_labels,
            "duplicate_text_count": duplicate_rows,
            "duplicate_text_percent": round((duplicate_rows / total_rows) * 100, 2) if total_rows else 0,
            "usable_unique_records": total_rows - missing_text - duplicate_rows,
        },
        "class_distribution": {
            cls: {
                "count": int(count),
                "percentage": float(class_proportions.get(cls, 0.0)),
            }
            for cls, count in class_counts.items()
        },
        "text_length_statistics": {
            "char_length": {
                "min": int(char_lengths.min()) if not char_lengths.empty else 0,
                "max": int(char_lengths.max()) if not char_lengths.empty else 0,
                "mean": float(round(char_lengths.mean(), 2)) if not char_lengths.empty else 0,
                "median": float(round(char_lengths.median(), 2)) if not char_lengths.empty else 0,
                "p95": float(round(char_lengths.quantile(0.95), 2)) if not char_lengths.empty else 0,
            },
            "word_count": {
                "min": int(word_lengths.min()) if not word_lengths.empty else 0,
                "max": int(word_lengths.max()) if not word_lengths.empty else 0,
                "mean": float(round(word_lengths.mean(), 2)) if not word_lengths.empty else 0,
                "median": float(round(word_lengths.median(), 2)) if not word_lengths.empty else 0,
                "p95": float(round(word_lengths.quantile(0.95), 2)) if not word_lengths.empty else 0,
            },
        },
    }
    return stats


def clean_text_conservative(text: str) -> str:
    """Apply conservative text normalization preserving negation and complaint context."""
    if not isinstance(text, str):
        return ""
    # Normalize Unicode (NFKC)
    text = unicodedata.normalize("NFKC", text)
    # Strip HTML tags if present
    text = re.sub(r"<[^>]+>", " ", text)
    # Normalize multiple whitespace, newlines, tabs
    text = re.sub(r"\s+", " ", text).strip()
    return text


def run_ingestion(
    input_file: Path,
    output_dir: Path,
    sample_size: int | None = None,
    random_seed: int = 42,
    auto_download: bool = True,
) -> dict[str, Any]:
    """Execute end-to-end dataset ingestion, quality profiling, and stratified splitting."""
    if not input_file.exists() and auto_download:
        download_dataset(input_file)

    if not input_file.exists():
        raise FileNotFoundError(f"Dataset CSV not found at {input_file}. Run with --download.")

    logger.info("Loading dataset from %s ...", input_file)
    df = pd.read_csv(input_file)

    # Detect text and label columns
    text_col = "narrative" if "narrative" in df.columns else "Consumer complaint narrative"
    label_col = "product" if "product" in df.columns else "Product"

    if text_col not in df.columns or label_col not in df.columns:
        raise ValueError(
            f"Expected text and label columns not found. Present columns: {list(df.columns)}"
        )

    logger.info("Identified text column: '%s', label column: '%s'", text_col, label_col)

    # 1. Full Dataset Inspection
    inspection_stats = inspect_dataset(df, text_col=text_col, label_col=label_col)
    logger.info(
        "Dataset inspected: %d rows, %d missing narratives, %d duplicate texts.",
        inspection_stats["total_records"],
        inspection_stats["data_quality"]["missing_text_count"],
        inspection_stats["data_quality"]["duplicate_text_count"],
    )

    # 2. Filtering and Deduplication
    clean_df = df.dropna(subset=[text_col, label_col]).copy()
    clean_df = clean_df.drop_duplicates(subset=[text_col]).copy()

    # Preserve original text and add normalized text
    clean_df["original_text"] = clean_df[text_col].astype(str)
    clean_df["normalized_text"] = clean_df["original_text"].apply(clean_text_conservative)

    # Filter out empty strings after normalization
    clean_df = clean_df[clean_df["normalized_text"].str.len() >= 10].copy()
    clean_df["category"] = clean_df[label_col].astype(str).str.strip()

    logger.info("Unique clean records remaining: %d", len(clean_df))

    # Optional balanced/stratified subsampling for fast, reproducible training if requested
    if sample_size and sample_size < len(clean_df):
        logger.info("Subsampling %d records stratified across categories (seed=%d)...", sample_size, random_seed)
        clean_df = (
            clean_df.groupby("category", group_keys=False)
            .apply(lambda x: x.sample(int(np.rint(sample_size * len(x) / len(clean_df))), random_state=random_seed))
            .reset_index(drop=True)
        )
        logger.info("Subsampled shape: %s", clean_df.shape)

    # 3. Stratified Train / Validation / Test Splitting (70% train, 15% val, 15% test)
    train_df, temp_df = train_test_split(
        clean_df,
        test_size=0.30,
        random_state=random_seed,
        stratify=clean_df["category"],
    )
    val_df, test_df = train_test_split(
        temp_df,
        test_size=0.50,
        random_state=random_seed,
        stratify=temp_df["category"],
    )

    # 4. Leakage Verification Check
    train_set = set(train_df["original_text"])
    val_set = set(val_df["original_text"])
    test_set = set(test_df["original_text"])

    leak_train_val = len(train_set.intersection(val_set))
    leak_train_test = len(train_set.intersection(test_set))
    leak_val_test = len(val_set.intersection(test_set))

    if leak_train_val > 0 or leak_train_test > 0 or leak_val_test > 0:
        raise RuntimeError(
            f"Data leakage detected! Train/Val overlap: {leak_train_val}, "
            f"Train/Test overlap: {leak_train_test}, Val/Test overlap: {leak_val_test}"
        )
    logger.info("Zero data leakage verified across train (%d), val (%d), test (%d) sets.", len(train_df), len(val_df), len(test_df))

    # 5. Persist Output Files
    output_dir.mkdir(parents=True, exist_ok=True)

    columns_to_save = ["original_text", "normalized_text", "category"]
    train_path = output_dir / "train.csv"
    val_path = output_dir / "val.csv"
    test_path = output_dir / "test.csv"

    train_df[columns_to_save].to_csv(train_path, index=False)
    val_df[columns_to_save].to_csv(val_path, index=False)
    test_df[columns_to_save].to_csv(test_path, index=False)

    split_metadata = {
        "dataset_name": "Consumer Complaints Dataset for NLP",
        "source_url": "https://www.kaggle.com/datasets/shashwatwork/consume-complaints-dataset-fo-nlp",
        "ingestion_timestamp": datetime.now(UTC).isoformat(),
        "random_seed": random_seed,
        "split_ratio": {"train": 0.70, "validation": 0.15, "test": 0.15},
        "sample_counts": {
            "total_cleaned": len(clean_df),
            "train": len(train_df),
            "validation": len(val_df),
            "test": len(test_df),
        },
        "class_counts_by_split": {
            "train": train_df["category"].value_counts().to_dict(),
            "validation": val_df["category"].value_counts().to_dict(),
            "test": test_df["category"].value_counts().to_dict(),
        },
        "leakage_verification": {
            "train_val_overlap": leak_train_val,
            "train_test_overlap": leak_train_test,
            "val_test_overlap": leak_val_test,
            "leakage_detected": False,
        },
        "preprocessing_configuration": {
            "unicode_normalization": "NFKC",
            "html_stripping": True,
            "whitespace_normalization": True,
            "negation_preserved": True,
            "min_text_length": 10,
        },
    }

    with open(output_dir / "split_metadata.json", "w", encoding="utf-8") as f:
        json.dump(split_metadata, f, indent=2)

    with open(output_dir / "inspection_report.json", "w", encoding="utf-8") as f:
        json.dump(inspection_stats, f, indent=2)

    with open(output_dir / "label_mapping.json", "w", encoding="utf-8") as f:
        json.dump(NORMALIZED_LABELS, f, indent=2)

    logger.info("Split artifacts written to %s successfully.", output_dir)
    return split_metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Public dataset ingestion & splitting.")
    parser.add_argument(
        "--input-file",
        type=Path,
        default=Path("data/raw/complaints_processed.csv"),
        help="Path to input complaints CSV file.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/processed"),
        help="Destination directory for processed splits and metadata.",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=None,
        help="Optional stratified sample size for rapid experimentation.",
    )
    parser.add_argument(
        "--random-seed",
        type=int,
        default=42,
        help="Random seed for reproducible stratified splitting.",
    )
    parser.add_argument(
        "--download",
        action="store_true",
        help="Automatically download dataset from Kaggle if absent.",
    )

    args = parser.parse_args()
    try:
        run_ingestion(
            input_file=args.input_file,
            output_dir=args.output_dir,
            sample_size=args.sample_size,
            random_seed=args.random_seed,
            auto_download=args.download,
        )
    except Exception:
        logger.exception("Dataset ingestion failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
