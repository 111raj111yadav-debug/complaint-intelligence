"""RAG Resolution Recommendation Engine.

Coordinates complaint analysis, semantic evidence retrieval, risk-based human review
assessment, and evidence-grounded generation via OpenAI or offline extractive provider.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Any

from pydantic import BaseModel, Field

from app.pipelines.classification.classifier import category_classifier
from app.pipelines.preprocessing.preprocessor import default_preprocessor
from app.pipelines.rag.prompts import RAG_PROMPT_VERSION
from app.pipelines.rag.providers.base import (
    BaseLLMProvider,
    LLMGenerationInput,
    LLMGenerationOutput,
    SupportingSourceRef,
)
from app.pipelines.rag.providers.extractive_provider import ExtractiveEvidenceProvider
from app.pipelines.rag.providers.openai_provider import OpenAIProvider
from app.pipelines.retrieval.retriever import semantic_retriever
from app.pipelines.routing.router import department_router
from app.pipelines.urgency.assessor import urgency_assessor

logger = logging.getLogger("rag_engine")

HIGH_THRESHOLD = 0.70
MEDIUM_THRESHOLD = 0.55
MINIMUM_THRESHOLD = 0.40

# Risk indicator patterns
LEGAL_KEYWORDS_PATTERN = re.compile(
    r"\b(sue|suing|lawsuit|attorney|lawyer|legal counsel|court|litigation|arbitration)\b",
    re.IGNORECASE,
)
REGULATORY_AGENCY_PATTERN = re.compile(
    r"\b(cfpb|occ|fdic|ftc|federal reserve|attorney general|regulatory complaint)\b",
    re.IGNORECASE,
)
IDENTITY_THEFT_PATTERN = re.compile(
    r"\b(identity theft|stolen identity|synthetic identity|fraudulent account opened|impersonat)\b",
    re.IGNORECASE,
)


class RAGRecommendationRequest(BaseModel):
    """Payload for generating a RAG resolution recommendation."""

    complaint_text: str
    predicted_category: str | None = None
    urgency_level: str | None = None
    department_code: str | None = None
    similarity_threshold: float = MINIMUM_THRESHOLD
    top_k: int = 3
    force_provider: str | None = None


class RAGRecommendationResponse(BaseModel):
    """Validated structured recommendation output."""

    suggested_steps: list[str]
    rationale: str
    supporting_sources: list[SupportingSourceRef] = Field(default_factory=list)
    evidence_strength: str  # HIGH, MEDIUM, LOW, INSUFFICIENT
    confidence_score: float  # Calibrated evidence score
    evidence_limitations: list[str] = Field(default_factory=list)
    human_review_required: bool
    review_reasons: list[str] = Field(default_factory=list)
    model_provider: str
    model_identifier: str
    prompt_version: str
    retrieval_matched_count: int
    total_latency_ms: float


class RAGEngine:
    """Orchestrates retrieval-augmented resolution generation."""

    def __init__(
        self,
        openai_provider: BaseLLMProvider | None = None,
        extractive_provider: BaseLLMProvider | None = None,
    ) -> None:
        self.openai_provider = openai_provider or OpenAIProvider()
        self.extractive_provider = extractive_provider or ExtractiveEvidenceProvider()

    def generate_recommendation(
        self,
        request: RAGRecommendationRequest,
    ) -> RAGRecommendationResponse:
        """Execute full RAG workflow for incoming complaint narrative."""
        t0 = time.perf_counter()

        # 1. Text preprocessing & PII redaction
        prep = default_preprocessor.preprocess(request.complaint_text)
        cleaned_text = prep.cleaned_text if prep.is_valid else request.complaint_text
        sanitized_text = prep.sanitized_text if prep.is_valid else request.complaint_text

        # 2. Derive category, urgency, and routing if not provided
        category = request.predicted_category
        if not category:
            cat_pred = category_classifier.predict(cleaned_text)
            category = cat_pred.category

        urgency = request.urgency_level
        if not urgency:
            urg_pred = urgency_assessor.assess(cleaned_text)
            urgency = urg_pred.urgency_level

        department = request.department_code
        if not department:
            dept_rec = department_router.recommend(category)
            department = dept_rec.department_code

        # 3. Retrieve relevant verified historical resolutions
        retrieval_res = semantic_retriever.search(
            query=sanitized_text,
            top_k=request.top_k,
            similarity_threshold=request.similarity_threshold,
            category_filter=category,
            only_verified=True,
        )

        # Fallback to unrestricted search if category-restricted search is empty
        if retrieval_res.is_empty:
            retrieval_res = semantic_retriever.search(
                query=sanitized_text,
                top_k=request.top_k,
                similarity_threshold=request.similarity_threshold,
                category_filter=None,
                only_verified=True,
            )

        # 4. Compute Calibrated Evidence Strength & Confidence
        matched_count = len(retrieval_res.results)
        top_similarity = retrieval_res.results[0].similarity_score if matched_count > 0 else 0.0

        if matched_count == 0 or top_similarity < MINIMUM_THRESHOLD:
            evidence_strength = "INSUFFICIENT"
            confidence_score = 0.0
        elif top_similarity >= HIGH_THRESHOLD:
            evidence_strength = "HIGH"
            confidence_score = round(top_similarity, 4)
        elif top_similarity >= MEDIUM_THRESHOLD:
            evidence_strength = "MEDIUM"
            confidence_score = round(top_similarity, 4)
        else:
            evidence_strength = "LOW"
            confidence_score = round(top_similarity, 4)

        # 5. Risk & Human Review Rules Assessment
        human_review_required = False
        review_reasons: list[str] = []

        if urgency in ("HIGH", "CRITICAL"):
            human_review_required = True
            review_reasons.append(f"Complaint urgency is classified as {urgency}.")

        if LEGAL_KEYWORDS_PATTERN.search(cleaned_text):
            human_review_required = True
            review_reasons.append("Consumer mentions legal counsel, lawsuit, or court litigation.")

        if REGULATORY_AGENCY_PATTERN.search(cleaned_text):
            human_review_required = True
            review_reasons.append("Consumer mentions regulatory agency filing (CFPB, FTC, or AG).")

        if IDENTITY_THEFT_PATTERN.search(cleaned_text):
            human_review_required = True
            review_reasons.append("Potential identity theft, account takeover, or synthetic fraud.")

        if evidence_strength == "INSUFFICIENT":
            human_review_required = True
            review_reasons.append("No verified historical resolutions exceeded minimum relevance threshold (0.40).")

        # 6. Build supporting sources references
        supporting_sources: list[SupportingSourceRef] = []
        evidence_corpus: list[dict[str, Any]] = []

        for r in retrieval_res.results:
            source_ref = SupportingSourceRef(
                source_id=r.id,
                reference_code=r.reference_code,
                title=r.title,
                category=r.category,
                similarity_score=r.similarity_score,
                resolution_outcome=r.resolution_outcome,
            )
            supporting_sources.append(source_ref)
            evidence_corpus.append({
                "id": r.id,
                "reference_code": r.reference_code,
                "title": r.title,
                "category": r.category,
                "department_code": r.department_code,
                "resolution_text": r.resolution_text,
                "resolution_outcome": r.resolution_outcome,
                "similarity_score": r.similarity_score,
            })

        gen_input = LLMGenerationInput(
            complaint_text=sanitized_text,
            predicted_category=category,
            urgency_level=urgency,
            department_code=department,
            evidence_strength=evidence_strength,
            retrieved_sources=supporting_sources,
            evidence_corpus=evidence_corpus,
            human_review_required=human_review_required,
            review_reasons=review_reasons,
        )

        # 7. Execute Generation via selected provider
        output: LLMGenerationOutput | None = None

        use_openai = (
            request.force_provider == "openai"
            or (self.openai_provider.is_available() and request.force_provider != "extractive")
        )

        if use_openai:
            try:
                logger.info("Generating recommendation via OpenAI provider...")
                output = self.openai_provider.generate(gen_input)
            except Exception as exc:
                logger.warning(
                    "OpenAI provider failed (%s); failing over to extractive provider.",
                    exc,
                )
                output = None

        if output is None:
            logger.info("Generating recommendation via ExtractiveEvidenceProvider...")
            output = self.extractive_provider.generate(gen_input)

        total_latency_ms = round((time.perf_counter() - t0) * 1000, 2)

        # 8. Align supporting sources to only those cited and verified
        cited_codes = set(output.supporting_source_codes)
        matched_supporting_sources = [
            s for s in supporting_sources if s.reference_code in cited_codes
        ]
        if not matched_supporting_sources and supporting_sources and evidence_strength != "INSUFFICIENT":
            # Fallback to top retrieved source if provider didn't explicitly format the code
            matched_supporting_sources = supporting_sources[:2]

        return RAGRecommendationResponse(
            suggested_steps=output.suggested_steps,
            rationale=output.rationale,
            supporting_sources=matched_supporting_sources,
            evidence_strength=evidence_strength,
            confidence_score=confidence_score,
            evidence_limitations=output.evidence_limitations,
            human_review_required=human_review_required,
            review_reasons=review_reasons,
            model_provider=output.model_provider,
            model_identifier=output.model_identifier,
            prompt_version=output.prompt_version,
            retrieval_matched_count=matched_count,
            total_latency_ms=total_latency_ms,
        )


# Global singleton instance
rag_engine = RAGEngine()
