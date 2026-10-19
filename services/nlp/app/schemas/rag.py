"""Pydantic schemas for RAG resolution recommendation endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class RecommendationRequestSchema(BaseModel):
    """Payload for RAG recommendation generation."""

    complaint_text: str = Field(min_length=5, max_length=15000, description="Complaint narrative")
    predicted_category: str | None = Field(default=None, description="Pre-computed category")
    urgency_level: str | None = Field(default=None, description="Pre-computed urgency level")
    department_code: str | None = Field(default=None, description="Pre-computed department code")
    similarity_threshold: float = Field(default=0.40, ge=0.0, le=1.0)
    top_k: int = Field(default=3, ge=1, le=10)
    force_provider: str | None = Field(default=None, description="Force 'openai' or 'extractive'")


class SupportingSourceSchema(BaseModel):
    """Schema for a supporting historical resolution reference."""

    source_id: str
    reference_code: str
    title: str
    category: str
    similarity_score: float
    resolution_outcome: str


class RecommendationDataSchema(BaseModel):
    """Data payload for recommendation response."""

    suggested_steps: list[str]
    rationale: str
    supporting_sources: list[SupportingSourceSchema]
    evidence_strength: str  # HIGH, MEDIUM, LOW, INSUFFICIENT
    confidence_score: float
    evidence_limitations: list[str]
    human_review_required: bool
    review_reasons: list[str]
    model_provider: str
    model_identifier: str
    prompt_version: str
    retrieval_matched_count: int
    total_latency_ms: float


class RecommendationApiResponse(BaseModel):
    """Standardized API envelope for recommendation response."""

    success: bool = True
    data: RecommendationDataSchema
