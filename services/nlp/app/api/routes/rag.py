"""FastAPI Routes for RAG Resolution Recommendations."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from app.pipelines.rag.engine import RAGRecommendationRequest, rag_engine
from app.schemas.rag import (
    RecommendationApiResponse,
    RecommendationDataSchema,
    RecommendationRequestSchema,
    SupportingSourceSchema,
)

logger = logging.getLogger("rag_route")

router = APIRouter(prefix="/api/v1/recommendations", tags=["RAG Recommendations"])


@router.post(
    "/generate",
    response_model=RecommendationApiResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Grounded RAG Resolution Recommendation",
    description=(
        "Combines complaint narrative, Phase 1 classification, semantic retrieval "
        "over verified playbooks, and evidence-grounded generation."
    ),
)
def generate_recommendation(payload: RecommendationRequestSchema) -> RecommendationApiResponse:
    """Execute end-to-end RAG recommendation generation."""
    try:
        req = RAGRecommendationRequest(
            complaint_text=payload.complaint_text,
            predicted_category=payload.predicted_category,
            urgency_level=payload.urgency_level,
            department_code=payload.department_code,
            similarity_threshold=payload.similarity_threshold,
            top_k=payload.top_k,
            force_provider=payload.force_provider,
        )

        res = rag_engine.generate_recommendation(req)

        sources = [
            SupportingSourceSchema(
                source_id=s.source_id,
                reference_code=s.reference_code,
                title=s.title,
                category=s.category,
                similarity_score=s.similarity_score,
                resolution_outcome=s.resolution_outcome,
            )
            for s in res.supporting_sources
        ]

        return RecommendationApiResponse(
            success=True,
            data=RecommendationDataSchema(
                suggested_steps=res.suggested_steps,
                rationale=res.rationale,
                supporting_sources=sources,
                evidence_strength=res.evidence_strength,
                confidence_score=res.confidence_score,
                evidence_limitations=res.evidence_limitations,
                human_review_required=res.human_review_required,
                review_reasons=res.review_reasons,
                model_provider=res.model_provider,
                model_identifier=res.model_identifier,
                prompt_version=res.prompt_version,
                retrieval_matched_count=res.retrieval_matched_count,
                total_latency_ms=res.total_latency_ms,
            ),
        )
    except Exception as exc:
        logger.error("RAG recommendation failure: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "RECOMMENDATION_ERROR", "message": f"Failed to generate recommendation: {exc}"},
        ) from exc
