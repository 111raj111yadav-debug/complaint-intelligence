"""Vector Index Ingestion & Embedding Generation Script.

Reads verified resolution records from data/resolutions/verified_resolutions_kb.json,
upserts them into PostgreSQL, generates 384-dimensional dense sentence embeddings
using sentence-transformers (all-MiniLM-L6-v2), and indexes them in the pgvector
HNSW index.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2.extras import execute_batch

# Ensure nlp module is on python path
nlp_root = Path(__file__).resolve().parents[1]
if str(nlp_root) not in sys.path:
    sys.path.insert(0, str(nlp_root))

from app.pipelines.embeddings.pipeline import embedding_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
)
logger = logging.getLogger("build_vector_index")


def get_db_connection() -> psycopg2.extensions.connection:
    """Establish connection to PostgreSQL using environment variables."""
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return psycopg2.connect(db_url)

    host = os.getenv("POSTGRES_HOST", "localhost")
    port = int(os.getenv("POSTGRES_PORT", "5434"))
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "2004")
    dbname = os.getenv("POSTGRES_DB", "complaint_intelligence_db")

    return psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        dbname=dbname,
    )


def load_department_map(conn: psycopg2.extensions.connection) -> dict[str, str]:
    """Fetch existing departments to map department_code to department_id."""
    with conn.cursor() as cur:
        cur.execute("SELECT id, code FROM departments;")
        rows = cur.fetchall()
        return {code: id_ for id_, code in rows}


def build_and_index_resolutions(
    json_path: Path,
    force_rebuild: bool = False,
    batch_size: int = 16,
) -> dict[str, Any]:
    """Upsert resolutions and generate vector embeddings."""
    if not json_path.exists():
        raise FileNotFoundError(f"Knowledge base file not found at: {json_path}")

    with open(json_path, encoding="utf-8") as f:
        records: list[dict[str, Any]] = json.load(f)

    logger.info("Loaded %d resolution items from %s", len(records), json_path)

    conn = get_db_connection()
    try:
        dept_map = load_department_map(conn)
        logger.info("Found %d registered departments in database: %s", len(dept_map), list(dept_map.keys()))

        # 1. Upsert resolutions without embeddings first
        upsert_sql = """
            INSERT INTO resolutions (
                id, reference_code, title, complaint_text, resolution_text,
                resolution_outcome, category, department_code, department_id,
                is_verified, verification_status, data_source, provenance, metadata,
                embedding_model, embedding_status, updated_at
            ) VALUES (
                gen_random_uuid(), %(reference_code)s, %(title)s, %(complaint_text)s, %(resolution_text)s,
                %(resolution_outcome)s, %(category)s, %(department_code)s, %(department_id)s,
                %(is_verified)s, %(verification_status)s, %(data_source)s,
                %(provenance)s, %(metadata)s, %(embedding_model)s, 'PENDING', NOW()
            )
            ON CONFLICT (reference_code) DO UPDATE SET
                title = EXCLUDED.title,
                complaint_text = EXCLUDED.complaint_text,
                resolution_text = EXCLUDED.resolution_text,
                resolution_outcome = EXCLUDED.resolution_outcome,
                category = EXCLUDED.category,
                department_code = EXCLUDED.department_code,
                department_id = EXCLUDED.department_id,
                is_verified = EXCLUDED.is_verified,
                verification_status = EXCLUDED.verification_status,
                data_source = EXCLUDED.data_source,
                provenance = EXCLUDED.provenance,
                metadata = EXCLUDED.metadata,
                updated_at = NOW();
        """

        prepared_records = []
        for r in records:
            dept_code = r.get("department_code", "DEPT_GENERAL")
            dept_id = dept_map.get(dept_code)

            prepared_records.append({
                "reference_code": r["reference_code"],
                "title": r["title"],
                "complaint_text": r["complaint_text"],
                "resolution_text": r["resolution_text"],
                "resolution_outcome": r.get("resolution_outcome", "CLOSED_WITH_EXPLANATION"),
                "category": r["category"],
                "department_code": dept_code,
                "department_id": dept_id,
                "is_verified": bool(r.get("is_verified", True)),
                "verification_status": r.get("verification_status", "VERIFIED"),
                "data_source": r.get("data_source", "SOP_KNOWLEDGE_BASE"),
                "provenance": json.dumps(r.get("provenance", {})),
                "metadata": json.dumps(r.get("metadata", {})),
                "embedding_model": embedding_pipeline.model_name,
            })

        with conn.cursor() as cur:
            execute_batch(cur, upsert_sql, prepared_records)
            conn.commit()
            logger.info("Successfully upserted %d resolution records.", len(prepared_records))

        # 2. Select records that require embedding generation
        query_sql = """
            SELECT id, reference_code, title, complaint_text, resolution_text
            FROM resolutions
            WHERE is_verified = TRUE
        """
        if not force_rebuild:
            query_sql += " AND (embedding IS NULL OR embedding_status != 'GENERATED')"

        with conn.cursor() as cur:
            cur.execute(query_sql)
            pending = cur.fetchall()

        if not pending:
            logger.info("All verified resolution embeddings are up to date. Nothing to generate.")
            return {
                "total_records": len(records),
                "embedded_records": 0,
                "status": "already_up_to_date",
            }

        logger.info("Generating embeddings for %d records (force_rebuild=%s)...", len(pending), force_rebuild)

        # 3. Generate embeddings
        # We index a synthesized representation combining title, complaint problem narrative, and resolution action
        texts_to_embed = [
            f"Title: {row[2]}\nComplaint Issue: {row[3]}\nVerified Resolution: {row[4]}"
            for row in pending
        ]

        batch_result = embedding_pipeline.encode_batch(texts_to_embed)
        logger.info(
            "Batch encoding finished: %d successful, %d failed.",
            batch_result.successful_count,
            batch_result.failed_count,
        )

        # 4. Update embeddings in PostgreSQL
        update_sql = """
            UPDATE resolutions
            SET embedding = %s::vector,
                embedding_status = %s,
                updated_at = NOW()
            WHERE id = %s;
        """

        update_params = []
        for row, emb, dim in zip(pending, batch_result.embeddings, batch_result.dimensions, strict=False):
            res_id = row[0]
            if dim == 384:
                # Format vector as string: '[0.123, -0.456, ...]'
                vec_str = "[" + ",".join(f"{x:.6f}" for x in emb) + "]"
                update_params.append((vec_str, "GENERATED", res_id))
            else:
                update_params.append((None, "FAILED", res_id))

        with conn.cursor() as cur:
            execute_batch(cur, update_sql, update_params)
            conn.commit()
            logger.info("Updated %d resolution embeddings in PostgreSQL.", len(update_params))

        # 5. Verify HNSW index and vector count
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM resolutions WHERE embedding IS NOT NULL;")
            indexed_count = cur.fetchone()[0]
            logger.info("Total indexed vector records in database: %d", indexed_count)

        return {
            "total_records": len(records),
            "embedded_records": len(update_params),
            "successful_count": batch_result.successful_count,
            "failed_count": batch_result.failed_count,
            "total_indexed_in_db": indexed_count,
            "status": "success",
        }

    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Build and index resolution vector embeddings.")
    parser.add_argument(
        "--kb-file",
        type=str,
        default="data/resolutions/verified_resolutions_kb.json",
        help="Path to verified resolutions JSON file",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force regeneration of all embeddings even if already generated",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=16,
        help="Batch size for sentence embedding generation",
    )
    args = parser.parse_args()

    kb_path = Path(args.kb_file)
    result = build_and_index_resolutions(
        json_path=kb_path,
        force_rebuild=args.force,
        batch_size=args.batch_size,
    )
    print("\nVector Indexing Summary:")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
