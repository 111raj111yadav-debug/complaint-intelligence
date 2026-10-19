"""Integration tests for semantic retrieval, RAG recommendation engine, and FastAPI routes."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.pipelines.rag.engine import RAGRecommendationRequest, rag_engine
from app.pipelines.retrieval.retriever import semantic_retriever

client = TestClient(app)


def test_semantic_retriever_live_query():
    """Retriever should query pgvector and return relevant verified playbooks."""
    result = semantic_retriever.search(
        query="Dispute unauthorized charges on billing statement under Regulation Z",
        top_k=3,
        similarity_threshold=0.35,
    )
    assert not result.is_empty
    assert result.matched_count > 0
    assert len(result.results) <= 3
    top_match = result.results[0]
    assert top_match.similarity_score >= 0.35
    assert top_match.is_verified is True
    assert top_match.reference_code.startswith("KB-")


def test_semantic_retriever_threshold_empty_handling():
    """Unrelated gibberish query with high threshold should yield empty result cleanly."""
    result = semantic_retriever.search(
        query="xyzqwerty supernova quantum astrophysics black hole",
        top_k=3,
        similarity_threshold=0.85,
    )
    assert result.is_empty is True
    assert result.matched_count == 0
    assert len(result.results) == 0
    assert result.empty_reason is not None


def test_rag_engine_extractive_generation():
    """RAG engine should generate grounded action steps, rationale, and cite verified sources."""
    req = RAGRecommendationRequest(
        complaint_text="My credit card was charged $450 twice by an online retailer. Bank refused to reverse it.",
        predicted_category="credit_card",
        urgency_level="HIGH",
        department_code="DEPT_CARDS",
        similarity_threshold=0.35,
        top_k=2,
    )
    rec = rag_engine.generate_recommendation(req)

    assert len(rec.suggested_steps) >= 1
    assert rec.rationale
    assert rec.evidence_strength in ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"]
    assert 0.0 <= rec.confidence_score <= 1.0
    assert rec.model_provider in ["extractive_evidence_grounded", "openai"]
    assert len(rec.supporting_sources) >= 1


def test_rag_risk_rules_trigger_human_review():
    """Complaints mentioning lawsuits or legal counsel must mandate human review."""
    req = RAGRecommendationRequest(
        complaint_text="I have hired an attorney and intend to sue your bank in federal court for FCRA violations.",
        predicted_category="credit_reporting",
        urgency_level="CRITICAL",
        department_code="DEPT_CREDIT",
    )
    rec = rag_engine.generate_recommendation(req)

    assert rec.human_review_required is True
    assert any("Legal action" in reason or "lawsuit" in reason.lower() for reason in rec.review_reasons)


def test_fastapi_resolutions_search_endpoint():
    """POST /api/v1/resolutions/search should return structured search response."""
    response = client.post(
        "/api/v1/resolutions/search",
        json={
            "query": "Debt collection agency called my employer and harassed me",
            "top_k": 2,
            "similarity_threshold": 0.30,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "results" in data["data"]
    assert data["data"]["top_k"] == 2


def test_fastapi_recommendations_generate_endpoint():
    """POST /api/v1/recommendations/generate should return RAG recommendation."""
    response = client.post(
        "/api/v1/recommendations/generate",
        json={
            "complaint_text": "Debt collector sent letters demanding payment for medical debt that was already settled.",
            "predicted_category": "debt_collection",
            "urgency_level": "HIGH",
            "department_code": "DEPT_COLLECTIONS",
            "similarity_threshold": 0.35,
            "top_k": 2,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    rec = data["data"]
    assert "suggested_steps" in rec
    assert "evidence_strength" in rec
    assert "supporting_sources" in rec
