"""NLP Analysis Route Handler.

Provides the primary POST /api/v1/analyze endpoint coordinating text preprocessing,
category classification, sentiment analysis, emotion detection, urgency scoring,
and department recommendation.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status

from app.pipelines.classification.classifier import category_classifier
from app.pipelines.emotion.detector import emotion_detector
from app.pipelines.preprocessing.preprocessor import default_preprocessor
from app.pipelines.routing.router import department_router
from app.pipelines.sentiment.analyzer import sentiment_analyzer
from app.pipelines.urgency.assessor import urgency_assessor
from app.schemas.analysis import (
    AnalysisApiResponse,
    AnalysisData,
    AnalysisRequest,
    CategoryAnalysis,
    DepartmentRecommendation,
    EmotionAnalysis,
    SentimentAnalysis,
    UrgencyAnalysis,
    UrgencyReason,
)

logger = logging.getLogger("analysis_route")

router = APIRouter(prefix="/api/v1", tags=["Complaint Intelligence"])


@router.post(
    "/analyze",
    response_model=AnalysisApiResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze Customer Complaint",
    description=(
        "Executes text preprocessing, category classification, sentiment analysis, "
        "emotion detection, explainable urgency assessment, and department recommendation."
    ),
)
async def analyze_complaint(payload: AnalysisRequest) -> AnalysisApiResponse:
    """Analyze incoming customer complaint narrative."""
    # 1. Verify model availability
    if not category_classifier.is_loaded:
        logger.error("Category classifier model artifact is unavailable.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "MODEL_UNAVAILABLE",
                "message": (
                    "The classification model artifact is not loaded or "
                    "unavailable on this instance."
                ),
            },
        )

    # 2. Text Preprocessing & Quality Checks
    prep_result = default_preprocessor.preprocess(payload.text)
    if not prep_result.is_valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "TEXT_PREPROCESSING_FAILED",
                "message": prep_result.validation_error or "Invalid complaint text.",
            },
        )

    # 3. Model Inferences
    cat_pred = category_classifier.predict(prep_result.cleaned_text)
    sent_pred = sentiment_analyzer.analyze(prep_result.cleaned_text)
    emo_pred = emotion_detector.detect(prep_result.cleaned_text)
    urg_pred = urgency_assessor.assess(prep_result.cleaned_text)
    dept_rec = department_router.recommend(cat_pred.category)

    # Format text preview (up to 120 chars)
    preview = prep_result.cleaned_text[:120] + (
        "..." if len(prep_result.cleaned_text) > 120 else ""
    )

    analysis_data = AnalysisData(
        text_preview=preview,
        char_count=prep_result.char_count,
        word_count=prep_result.word_count,
        category=CategoryAnalysis(
            label=cat_pred.category,
            confidence=cat_pred.confidence,
            probabilities=cat_pred.probabilities,
            model_version=cat_pred.model_version,
        ),
        sentiment=SentimentAnalysis(
            label=sent_pred.label,
            score=sent_pred.score,
            compound=sent_pred.compound,
            scores=sent_pred.scores,
            model_identifier=sent_pred.model_identifier,
        ),
        emotion=EmotionAnalysis(
            primary=emo_pred.primary_emotion,
            confidence=emo_pred.confidence,
            scores=emo_pred.scores,
            secondary=emo_pred.secondary_emotions,
            model_identifier=emo_pred.model_identifier,
        ),
        urgency=UrgencyAnalysis(
            level=urg_pred.urgency_level,
            score=urg_pred.urgency_score,
            contributing_reasons=[
                UrgencyReason(
                    rule_id=r.rule_id,
                    rule_name=r.rule_name,
                    weight=r.weight,
                    matched_term=r.matched_term,
                    description=r.description,
                )
                for r in urg_pred.contributing_reasons
            ],
            human_review_required=urg_pred.human_review_required,
        ),
        recommended_department=DepartmentRecommendation(
            code=dept_rec.department_code,
            name=dept_rec.department_name,
            rationale=dept_rec.rationale,
            is_fallback=dept_rec.is_fallback,
        ),
        model_versions={
            "classification": cat_pred.model_version,
            "sentiment": sent_pred.model_identifier,
            "emotion": emo_pred.model_identifier,
            "urgency": "rules-engine-v1.0",
        },
        analysis_timestamp=datetime.now(UTC).isoformat(),
        status="success",
    )

    return AnalysisApiResponse(
        success=True,
        data=analysis_data,
        meta={
            "service": "complaint-nlp-service",
            "phase": "Phase 1 - Production Models",
        },
    )
