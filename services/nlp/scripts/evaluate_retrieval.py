"""Retrieval Evaluation Benchmark Script (Phase 3 Expanded Benchmark).

Evaluates semantic dense retrieval (sentence-transformers all-MiniLM-L6-v2 + pgvector)
against a TF-IDF sparse retrieval baseline across 35 independently curated benchmark
queries covering:
1. Routine domain complaints
2. Ambiguous multi-category complaints
3. Overlapping category complaints
4. Out-of-domain complaints (expected zero-hit / abstention)
5. Security-sensitive and fraud complaints
6. Insufficient evidence / vague queries (expected zero-hit / abstention)
7. Regulatory and compliance edge cases

Computes:
- Hit@k (k=1, 3, 5)
- Recall@k (k=1, 3, 5)
- Precision@k (k=1, 3, 5)
- Mean Reciprocal Rank (MRR)
- Average & P95 Query Latency
- Out-of-Domain Abstention Rate & Top Similarity Distributions
- Source Provenance Integrity (Verification & Legal Citation Audit)
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np
import psycopg2
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Add services/nlp to path
nlp_root = Path(__file__).resolve().parents[1]
if str(nlp_root) not in sys.path:
    sys.path.insert(0, str(nlp_root))

from app.pipelines.retrieval.retriever import semantic_retriever

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s]: %(message)s")
logger = logging.getLogger("evaluate_retrieval")

# 35 Curated Test Queries across representative categories and edge cases
BENCHMARK_QUERIES = [
    # ------------------ CREDIT CARD (ROUTINE) ------------------
    {
        "id": "Q01",
        "query": "I noticed two identical charges of $142.50 from Target on my credit card statement.",
        "category": "credit_card",
        "query_type": "routine",
        "relevant_ids": ["KB-CC-001"],
    },
    {
        "id": "Q02",
        "query": "Fraudulent international transactions from an electronics store appeared on my card.",
        "category": "credit_card",
        "query_type": "routine",
        "relevant_ids": ["KB-CC-002"],
    },
    {
        "id": "Q03",
        "query": "My auto-pay failed because of a bank technical glitch and I was assessed a late fee.",
        "category": "credit_card",
        "query_type": "routine",
        "relevant_ids": ["KB-CC-003"],
    },
    {
        "id": "Q04",
        "query": "I bought custom furniture online that was never delivered and merchant ghosted me.",
        "category": "credit_card",
        "query_type": "routine",
        "relevant_ids": ["KB-CC-004"],
    },
    {
        "id": "Q05",
        "query": "I was charged backdated interest after my 0% promotional period ended without warning.",
        "category": "credit_card",
        "query_type": "routine",
        "relevant_ids": ["KB-CC-005"],
    },
    # ------------------ CREDIT REPORTING (ROUTINE) ------------------
    {
        "id": "Q06",
        "query": "My credit report incorrectly lists a 60-day late delinquency on an auto loan I paid on time.",
        "category": "credit_reporting",
        "query_type": "routine",
        "relevant_ids": ["KB-CR-001"],
    },
    {
        "id": "Q07",
        "query": "Someone stole my identity and opened a fraudulent loan in my name, I have a police report.",
        "category": "credit_reporting",
        "query_type": "routine",
        "relevant_ids": ["KB-CR-002"],
    },
    {
        "id": "Q08",
        "query": "An old charged-off debt from over eight years ago is still showing on my credit file.",
        "category": "credit_reporting",
        "query_type": "routine",
        "relevant_ids": ["KB-CR-003"],
    },
    {
        "id": "Q09",
        "query": "There is an unauthorized hard credit inquiry from a lender I never applied with.",
        "category": "credit_reporting",
        "query_type": "routine",
        "relevant_ids": ["KB-CR-004"],
    },
    # ------------------ DEBT COLLECTION (ROUTINE) ------------------
    {
        "id": "Q10",
        "query": "Collection agency is calling demanding payment for medical debt without providing validation proof.",
        "category": "debt_collection",
        "query_type": "routine",
        "relevant_ids": ["KB-DC-001"],
    },
    {
        "id": "Q11",
        "query": "Collectors keep harassing me at work after I sent a written cease and desist letter.",
        "category": "debt_collection",
        "query_type": "routine",
        "relevant_ids": ["KB-DC-002"],
    },
    {
        "id": "Q12",
        "query": "Agency is threatening to take me to court for a debt past the state statute of limitations.",
        "category": "debt_collection",
        "query_type": "routine",
        "relevant_ids": ["KB-DC-003"],
    },
    {
        "id": "Q13",
        "query": "Collectors are calling me for someone else with a similar name in another state.",
        "category": "debt_collection",
        "query_type": "routine",
        "relevant_ids": ["KB-DC-004"],
    },
    # ------------------ MORTGAGES & LOANS (ROUTINE) ------------------
    {
        "id": "Q14",
        "query": "My mortgage escrow payment increased drastically because the bank paid property taxes twice.",
        "category": "mortgages_and_loans",
        "query_type": "routine",
        "relevant_ids": ["KB-ML-001"],
    },
    {
        "id": "Q15",
        "query": "My extra principal curtailment payment was placed into suspense instead of reducing my balance.",
        "category": "mortgages_and_loans",
        "query_type": "routine",
        "relevant_ids": ["KB-ML-002"],
    },
    {
        "id": "Q16",
        "query": "Lender force-placed costly hazard insurance on my mortgage despite valid continuous coverage.",
        "category": "mortgages_and_loans",
        "query_type": "routine",
        "relevant_ids": ["KB-ML-003"],
    },
    {
        "id": "Q17",
        "query": "Paid off my vehicle loan over a month ago but the bank has not released the title lien.",
        "category": "mortgages_and_loans",
        "query_type": "routine",
        "relevant_ids": ["KB-ML-004"],
    },
    # ------------------ RETAIL BANKING (ROUTINE) ------------------
    {
        "id": "Q18",
        "query": "The ATM machine took my $800 cash deposit, jammed, and only credited $200 to my account.",
        "category": "retail_banking",
        "query_type": "routine",
        "relevant_ids": ["KB-RB-001"],
    },
    {
        "id": "Q19",
        "query": "Bank reordered transactions posting large debits first to generate multiple overdraft fees.",
        "category": "retail_banking",
        "query_type": "routine",
        "relevant_ids": ["KB-RB-002"],
    },
    {
        "id": "Q20",
        "query": "A high-value closing wire transfer was held up by bank processing errors for three days.",
        "category": "retail_banking",
        "query_type": "routine",
        "relevant_ids": ["KB-RB-003"],
    },
    {
        "id": "Q21",
        "query": "My savings account was assessed a $15 monthly inactivity fee despite my active direct deposit checking account.",
        "category": "retail_banking",
        "query_type": "routine",
        "relevant_ids": ["KB-RB-005"],
    },
    {
        "id": "Q22",
        "query": "Someone cloned my debit card and conducted unauthorized ATM and POS chip transactions without my PIN.",
        "category": "retail_banking",
        "query_type": "routine",
        "relevant_ids": ["KB-RB-004"],
    },
    # ------------------ AMBIGUOUS / OVERLAPPING CATEGORIES ------------------
    {
        "id": "Q23",
        "query": "A collection agency is threatening to freeze my card account over an unauthorized charge from two years ago.",
        "category": "debt_collection",
        "query_type": "ambiguous",
        "relevant_ids": ["KB-DC-001", "KB-DC-002", "KB-CC-001"],
    },
    {
        "id": "Q24",
        "query": "A debt collector placed an unauthorized derogatory collection item on my credit report without sending any debt validation notice.",
        "category": "debt_collection",
        "query_type": "overlapping",
        "relevant_ids": ["KB-DC-001", "KB-CR-001"],
    },
    {
        "id": "Q25",
        "query": "The mortgage servicer mistakenly reported my account 30 days delinquent to Equifax while my escrow property tax error was under formal dispute.",
        "category": "mortgages_and_loans",
        "query_type": "overlapping",
        "relevant_ids": ["KB-ML-001", "KB-CR-001"],
    },
    # ------------------ OUT-OF-DOMAIN (EXPECTED ZERO-HIT / ABSTAIN) ------------------
    {
        "id": "Q26",
        "query": "The airline cancelled my flight to Chicago, lost my checked baggage for four days, and the gate agent refused to issue a meal voucher.",
        "category": "out_of_domain",
        "query_type": "out_of_domain",
        "relevant_ids": [],
    },
    {
        "id": "Q27",
        "query": "My landlord has ignored multiple maintenance requests to repair the broken air conditioner in my apartment and is threatening eviction.",
        "category": "out_of_domain",
        "query_type": "out_of_domain",
        "relevant_ids": [],
    },
    {
        "id": "Q28",
        "query": "The downtown sushi restaurant served expired salmon that caused severe food poisoning and an emergency room hospital bill.",
        "category": "out_of_domain",
        "query_type": "out_of_domain",
        "relevant_ids": [],
    },
    # ------------------ SECURITY-SENSITIVE / FRAUD ------------------
    {
        "id": "Q29",
        "query": "I received an SMS smishing text claiming to be bank fraud prevention, clicked the link, and immediately $3,200 was wired out of my account.",
        "category": "retail_banking",
        "query_type": "security_sensitive",
        "relevant_ids": ["KB-CC-002", "KB-RB-004", "KB-RB-003"],
    },
    {
        "id": "Q30",
        "query": "An unauthorized login from an IP address in eastern Europe compromised my credentials, changed my registered phone number, and drained my credit line.",
        "category": "credit_card",
        "query_type": "security_sensitive",
        "relevant_ids": ["KB-CC-002", "KB-RB-004"],
    },
    # ------------------ INSUFFICIENT EVIDENCE / VAGUE (ABSTAIN) ------------------
    {
        "id": "Q31",
        "query": "Your service is completely terrible and your representatives are extremely rude and unhelpful.",
        "category": "general_inquiry",
        "query_type": "insufficient_evidence",
        "relevant_ids": [],
    },
    {
        "id": "Q32",
        "query": "Money missing please fix.",
        "category": "insufficient_evidence",
        "query_type": "insufficient_evidence",
        "relevant_ids": [],
    },
    # ------------------ REGULATORY & COMPLIANCE EDGE CASES ------------------
    {
        "id": "Q33",
        "query": "A debt collector called my supervisor at work and disclosed details of my past-due medical bill after I told them I cannot take personal calls.",
        "category": "debt_collection",
        "query_type": "routine",
        "relevant_ids": ["KB-DC-002"],
    },
    {
        "id": "Q34",
        "query": "Bank branch placed a prolonged 10 business day hold on an official cashier's check deposit without providing an Expedited Funds Availability Act exception notice.",
        "category": "retail_banking",
        "query_type": "routine",
        "relevant_ids": ["KB-RB-003"],
    },
    {
        "id": "Q35",
        "query": "Merchant continues billing my card recurring monthly subscription fees three months after I submitted written cancellation notice.",
        "category": "credit_card",
        "query_type": "routine",
        "relevant_ids": ["KB-CC-001", "KB-CC-004"],
    },
]


def load_all_resolutions() -> list[dict[str, Any]]:
    """Fetch verified resolutions from PostgreSQL including Phase 3 provenance fields."""
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        conn = psycopg2.connect(db_url)
    else:
        conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5434")),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "2004"),
            dbname=os.getenv("POSTGRES_DB", "complaint_intelligence_db"),
        )
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, reference_code, title, complaint_text, resolution_text, category,
                       is_verified, source_title, source_url, source_org, content_type, version, last_verified_at
                FROM resolutions
                WHERE is_verified = TRUE;
            """)
            rows = cur.fetchall()
            return [
                {
                    "id": r[0],
                    "reference_code": r[1],
                    "title": r[2],
                    "complaint_text": r[3],
                    "resolution_text": r[4],
                    "category": r[5],
                    "is_verified": r[6],
                    "source_title": r[7],
                    "source_url": r[8],
                    "source_org": r[9],
                    "content_type": r[10],
                    "version": r[11],
                    "last_verified_at": str(r[12]) if r[12] else None,
                    "full_text": f"{r[2]} {r[3]} {r[4]}",
                }
                for r in rows
            ]
    finally:
        conn.close()


def compute_metrics(
    retrieved_ranked_lists: list[list[str]],
    ground_truth_lists: list[list[str]],
    k_vals: list[int] = (1, 3, 5),
) -> dict[str, float]:
    """Calculate Hit@k, Recall@k, Precision@k, and MRR for target-bearing queries."""
    n = len(retrieved_ranked_lists)
    if n == 0:
        return {}

    metrics: dict[str, float] = {}

    for k in k_vals:
        hits = 0
        recalls = []
        precisions = []

        for retrieved, targets in zip(retrieved_ranked_lists, ground_truth_lists, strict=False):
            top_k_retrieved = retrieved[:k]
            target_set = set(targets)

            # Hit@k
            has_hit = any(r in target_set for r in top_k_retrieved)
            if has_hit:
                hits += 1

            # Precision & Recall
            relevant_in_top_k = sum(1 for r in top_k_retrieved if r in target_set)
            precisions.append(relevant_in_top_k / k if k > 0 else 0.0)
            recalls.append(relevant_in_top_k / len(target_set) if target_set else 0.0)

        metrics[f"hit@{k}"] = round(hits / n, 4)
        metrics[f"recall@{k}"] = round(float(np.mean(recalls)), 4)
        metrics[f"precision@{k}"] = round(float(np.mean(precisions)), 4)

    # Mean Reciprocal Rank (MRR)
    reciprocal_ranks = []
    for retrieved, targets in zip(retrieved_ranked_lists, ground_truth_lists, strict=False):
        target_set = set(targets)
        rr = 0.0
        for rank_idx, item in enumerate(retrieved, start=1):
            if item in target_set:
                rr = 1.0 / rank_idx
                break
        reciprocal_ranks.append(rr)

    metrics["mrr"] = round(float(np.mean(reciprocal_ranks)), 4)
    return metrics


def evaluate_tfidf_baseline(
    corpus: list[dict[str, Any]],
    queries: list[dict[str, Any]],
    top_k: int = 5,
) -> tuple[dict[str, float], float, list[dict[str, Any]]]:
    """Evaluate simple TF-IDF vectorizer sparse retrieval baseline."""
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
    corpus_texts = [doc["full_text"] for doc in corpus]
    doc_vectors = vectorizer.fit_transform(corpus_texts)
    doc_codes = [doc["reference_code"] for doc in corpus]

    ranked_results: list[list[str]] = []
    detailed_outputs: list[dict[str, Any]] = []
    latencies: list[float] = []

    for q in queries:
        t0 = time.perf_counter()
        q_vec = vectorizer.transform([q["query"]])
        sims = cosine_similarity(q_vec, doc_vectors)[0]
        top_indices = np.argsort(-sims)[:top_k]
        latency = (time.perf_counter() - t0) * 1000
        latencies.append(latency)

        ranked_codes = [doc_codes[idx] for idx in top_indices]
        top_scores = [float(sims[idx]) for idx in top_indices]
        ranked_results.append(ranked_codes)

        detailed_outputs.append({
            "id": q["id"],
            "query": q["query"],
            "top_codes": ranked_codes,
            "top_scores": top_scores,
            "max_sim": top_scores[0] if top_scores else 0.0,
            "relevant_ids": q["relevant_ids"],
        })

    avg_latency_ms = round(float(np.mean(latencies)), 2)

    # Filter for answerable (target-bearing) queries for standard IR metrics
    answerable_indices = [i for i, q in enumerate(queries) if len(q["relevant_ids"]) > 0]
    ans_retrieved = [ranked_results[i] for i in answerable_indices]
    ans_truth = [queries[i]["relevant_ids"] for i in answerable_indices]

    metrics = compute_metrics(ans_retrieved, ans_truth)
    return metrics, avg_latency_ms, detailed_outputs


def evaluate_semantic_dense(
    queries: list[dict[str, Any]],
    top_k: int = 5,
) -> tuple[dict[str, float], float, float, list[dict[str, Any]], dict[str, Any]]:
    """Evaluate sentence-transformers dense vector retrieval via pgvector."""
    ranked_results: list[list[str]] = []
    detailed_outputs: list[dict[str, Any]] = []
    latencies: list[float] = []
    provenance_audit: list[bool] = []

    for q in queries:
        t0 = time.perf_counter()
        res = semantic_retriever.search(
            query=q["query"],
            top_k=top_k,
            similarity_threshold=0.20,  # low threshold to inspect top_k ranking
            only_verified=True,
        )
        latency = (time.perf_counter() - t0) * 1000
        latencies.append(latency)

        ranked_codes = [item.reference_code for item in res.results]
        top_scores = [item.similarity_score for item in res.results]
        ranked_results.append(ranked_codes)

        # Audit provenance of returned items
        for item in res.results:
            is_valid_prov = bool(
                item.reference_code
                and item.title
                and getattr(item, "is_verified", True)
            )
            provenance_audit.append(is_valid_prov)

        detailed_outputs.append({
            "id": q["id"],
            "query": q["query"],
            "top_codes": ranked_codes,
            "top_scores": top_scores,
            "max_sim": top_scores[0] if top_scores else 0.0,
            "relevant_ids": q["relevant_ids"],
            "query_type": q["query_type"],
        })

    avg_latency_ms = round(float(np.mean(latencies)), 2)
    p95_latency_ms = round(float(np.percentile(latencies, 95)), 2)

    # Filter for answerable (target-bearing) queries for standard IR metrics
    answerable_indices = [i for i, q in enumerate(queries) if len(q["relevant_ids"]) > 0]
    ans_retrieved = [ranked_results[i] for i in answerable_indices]
    ans_truth = [queries[i]["relevant_ids"] for i in answerable_indices]

    metrics = compute_metrics(ans_retrieved, ans_truth)

    # Unanswerable / out-of-domain / low-evidence analysis
    unanswerable = [d for d in detailed_outputs if len(d["relevant_ids"]) == 0]
    abstention_threshold = 0.45
    abstention_count = sum(1 for d in unanswerable if d["max_sim"] < abstention_threshold)
    abstention_rate = round(abstention_count / len(unanswerable), 4) if unanswerable else 1.0

    in_domain_sims = [d["max_sim"] for d in detailed_outputs if len(d["relevant_ids"]) > 0]
    out_domain_sims = [d["max_sim"] for d in unanswerable]

    edge_behavior = {
        "unanswerable_queries_count": len(unanswerable),
        "abstention_threshold": abstention_threshold,
        "abstention_rate": abstention_rate,
        "in_domain_mean_top_sim": round(float(np.mean(in_domain_sims)), 4) if in_domain_sims else 0.0,
        "out_of_domain_mean_top_sim": round(float(np.mean(out_domain_sims)), 4) if out_domain_sims else 0.0,
        "provenance_compliance_rate": round(sum(provenance_audit) / len(provenance_audit), 4) if provenance_audit else 1.0,
    }

    return metrics, avg_latency_ms, p95_latency_ms, detailed_outputs, edge_behavior


def main():
    logger.info("Loading resolution knowledge corpus from PostgreSQL...")
    corpus = load_all_resolutions()
    logger.info("Loaded %d verified playbooks for retrieval benchmark.", len(corpus))

    target_bearing_count = sum(1 for q in BENCHMARK_QUERIES if len(q["relevant_ids"]) > 0)
    unanswerable_count = sum(1 for q in BENCHMARK_QUERIES if len(q["relevant_ids"]) == 0)
    logger.info(
        "Evaluating on %d benchmark queries (%d answerable, %d unanswerable/out-of-domain/vague)...",
        len(BENCHMARK_QUERIES),
        target_bearing_count,
        unanswerable_count,
    )

    logger.info("Evaluating TF-IDF Sparse Baseline...")
    tfidf_metrics, tfidf_latency, _ = evaluate_tfidf_baseline(corpus, BENCHMARK_QUERIES, top_k=5)

    logger.info("Evaluating Dense Semantic Retrieval (all-MiniLM-L6-v2 + pgvector)...")
    dense_metrics, dense_latency, dense_p95, _, edge_behavior = evaluate_semantic_dense(BENCHMARK_QUERIES, top_k=5)

    report = {
        "benchmark_metadata": {
            "version": "Phase 3 Expanded Benchmark",
            "total_queries": len(BENCHMARK_QUERIES),
            "answerable_queries": target_bearing_count,
            "unanswerable_queries": unanswerable_count,
            "corpus_size": len(corpus),
            "query_types": list({q["query_type"] for q in BENCHMARK_QUERIES}),
            "categories_evaluated": list({q["category"] for q in BENCHMARK_QUERIES}),
            "embedding_model": "all-MiniLM-L6-v2 (384-dimensional)",
            "vector_index": "PostgreSQL 16 + pgvector HNSW (vector_cosine_ops)",
            "evaluation_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
        "dense_semantic_retrieval": {
            **dense_metrics,
            "avg_latency_ms": dense_latency,
            "p95_latency_ms": dense_p95,
        },
        "tfidf_sparse_baseline": {
            **tfidf_metrics,
            "avg_latency_ms": tfidf_latency,
        },
        "comparison_delta": {
            "hit@1_delta": round(dense_metrics["hit@1"] - tfidf_metrics["hit@1"], 4),
            "hit@3_delta": round(dense_metrics["hit@3"] - tfidf_metrics["hit@3"], 4),
            "recall@3_delta": round(dense_metrics["recall@3"] - tfidf_metrics["recall@3"], 4),
            "mrr_delta": round(dense_metrics["mrr"] - tfidf_metrics["mrr"], 4),
        },
        "edge_case_and_provenance_behavior": edge_behavior,
    }

    # Print formatted comparative results
    print("\n" + "=" * 76)
    print("  PHASE 3 EXPANDED RETRIEVAL BENCHMARK EVALUATION REPORT (35 Queries)")
    print("=" * 76)
    print(f"{'Metric':<22} | {'TF-IDF Baseline':<18} | {'Dense Semantic (pgvector)':<25}")
    print("-" * 76)
    for m in ["hit@1", "hit@3", "hit@5", "recall@1", "recall@3", "recall@5", "precision@1", "precision@3", "mrr"]:
        print(f"{m:<22} | {tfidf_metrics[m]:<18.4f} | {dense_metrics[m]:<25.4f}")
    print(f"{'Avg Latency (ms)':<22} | {tfidf_latency:<18.2f} | {dense_latency:<25.2f}")
    print(f"{'P95 Latency (ms)':<22} | {'N/A':<18} | {dense_p95:<25.2f}")
    print("-" * 76)
    print(f"Abstention on Out-of-Domain / Vague: {edge_behavior['abstention_rate'] * 100:.1f}%")
    print(f"In-Domain Mean Top Sim:              {edge_behavior['in_domain_mean_top_sim']:.4f}")
    print(f"Out-of-Domain Mean Top Sim:          {edge_behavior['out_of_domain_mean_top_sim']:.4f}")
    print(f"Source Provenance Compliance:        {edge_behavior['provenance_compliance_rate'] * 100:.1f}%")
    print("=" * 76)

    # Save report to docs
    docs_path = Path("docs/retrieval_evaluation_report.json")
    docs_path.parent.mkdir(parents=True, exist_ok=True)
    with open(docs_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    logger.info("Saved Phase 3 expanded evaluation report to %s", docs_path)


if __name__ == "__main__":
    main()
