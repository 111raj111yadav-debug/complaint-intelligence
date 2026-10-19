"""Pydantic schemas for the NLP Analysis endpoint."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AnalysisRequest(BaseModel):
    """Input payload for text complaint analysis."""

    text: str = Field(
        ...,
        min_length=5,
        max_length=10000,
        description="The customer complaint narrative to analyze.",
        examples=["My payment was deducted twice and my card has been locked."],
    )


class CategoryAnalysis(BaseModel):
    label: str
    confidence: float
    probabilities: dict[str, float] = Field(default_factory=dict)
    model_version: str


class SentimentAnalysis(BaseModel):
    label: str
    score: float
    compound: float
    scores: dict[str, float] = Field(default_factory=dict)
    model_identifier: str


class EmotionAnalysis(BaseModel):
    primary: str
    confidence: float
    scores: dict[str, float] = Field(default_factory=dict)
    secondary: list[str] = Field(default_factory=list)
    model_identifier: str


class UrgencyReason(BaseModel):
    rule_id: str
    rule_name: str
    weight: int
    matched_term: str
    description: str


class UrgencyAnalysis(BaseModel):
    level: str  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    score: int  # 0 to 100
    contributing_reasons: list[UrgencyReason] = Field(default_factory=list)
    human_review_required: bool = False


class DepartmentRecommendation(BaseModel):
    code: str
    name: str
    rationale: str
    is_fallback: bool = False


class AnalysisData(BaseModel):
    """Aggregated complaint intelligence analysis results."""

    text_preview: str
    char_count: int
    word_count: int
    category: CategoryAnalysis
    sentiment: SentimentAnalysis
    emotion: EmotionAnalysis
    urgency: UrgencyAnalysis
    recommended_department: DepartmentRecommendation
    model_versions: dict[str, str]
    analysis_timestamp: str
    status: str = "success"


class AnalysisApiResponse(BaseModel):
    """Standardized API response wrapper matching platform conventions."""

    success: bool = True
    data: AnalysisData
    meta: dict[str, Any] = Field(default_factory=dict)
