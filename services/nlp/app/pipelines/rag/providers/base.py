"""Base LLM Provider Abstraction for RAG Resolution Recommendations."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field


class SupportingSourceRef(BaseModel):
    """Reference to a historical resolution source used as evidence."""

    source_id: str
    reference_code: str
    title: str
    category: str
    similarity_score: float
    resolution_outcome: str


class LLMGenerationInput(BaseModel):
    """Structured context passed to LLM recommendation providers."""

    complaint_text: str
    predicted_category: str
    urgency_level: str
    department_code: str
    evidence_strength: str  # HIGH, MEDIUM, LOW, INSUFFICIENT
    retrieved_sources: list[SupportingSourceRef]
    evidence_corpus: list[dict[str, Any]]
    human_review_required: bool
    review_reasons: list[str] = Field(default_factory=list)


class LLMGenerationOutput(BaseModel):
    """Structured output returned by an LLM provider."""

    suggested_steps: list[str]
    rationale: str
    supporting_source_codes: list[str]
    evidence_limitations: list[str]
    model_provider: str
    model_identifier: str
    prompt_version: str
    latency_ms: float
    raw_response: str | None = None


class BaseLLMProvider(ABC):
    """Abstract interface for RAG LLM providers."""

    @abstractmethod
    def is_available(self) -> bool:
        """Check if provider has necessary credentials and dependencies configured."""
        ...

    @abstractmethod
    def generate(self, payload: LLMGenerationInput) -> LLMGenerationOutput:
        """Generate structured evidence-grounded recommendation."""
        ...
