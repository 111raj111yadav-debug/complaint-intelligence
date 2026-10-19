"""Evidence-Grounded Extractive Fallback Provider for RAG Recommendations."""

from __future__ import annotations

import logging
import time
from typing import Any

from app.pipelines.rag.prompts import RAG_PROMPT_VERSION
from app.pipelines.rag.providers.base import (
    BaseLLMProvider,
    LLMGenerationInput,
    LLMGenerationOutput,
)

logger = logging.getLogger("extractive_provider")


class ExtractiveEvidenceProvider(BaseLLMProvider):
    """Deterministic, evidence-grounded synthesizer that extracts verified steps

    from retrieved historical SOP playbooks with zero hallucination.
    """

    def is_available(self) -> bool:
        """Always available as local fallback."""
        return True

    def generate(self, payload: LLMGenerationInput) -> LLMGenerationOutput:
        """Synthesize action steps directly from verified retrieved evidence."""
        t0 = time.perf_counter()

        # Handle empty or insufficient evidence path
        if not payload.evidence_corpus or payload.evidence_strength == "INSUFFICIENT":
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            return LLMGenerationOutput(
                suggested_steps=[
                    "Route complaint directly to Senior Dispute Supervisor for manual assessment.",
                    "Contact the customer within 1 business day to request supporting transaction receipts and statement evidence.",
                    "Review internal core banking logs for unrecorded exceptions or pending ledger entries.",
                    "Do NOT approve monetary adjustments until customer documentation and core ledger entries are validated.",
                ],
                rationale=(
                    "No closely matching verified historical resolution or regulatory SOP was found in the "
                    "knowledge base exceeding the relevance threshold. To prevent unsupported actions or incorrect "
                    "monetary adjustments, standard supervisory triage is required."
                ),
                supporting_source_codes=[],
                evidence_limitations=[
                    "No historical resolution matches current complaint narrative with high confidence.",
                    "Absence of matching precedent requires manual investigation.",
                ],
                model_provider="extractive_evidence_grounded",
                model_identifier="rule-based-grounded-synthesizer-v1.0",
                prompt_version=RAG_PROMPT_VERSION,
                latency_ms=latency_ms,
                raw_response=None,
            )

        # Primary evidence from top retrieved resolution
        top_source = payload.evidence_corpus[0]
        top_code = top_source.get("reference_code", "UNKNOWN")
        top_title = top_source.get("title", "Standard Resolution")
        top_steps_raw = top_source.get("resolution_text", "")
        top_outcome = top_source.get("resolution_outcome", "CLOSED_WITH_EXPLANATION")

        # Parse numbered steps from resolution_text
        extracted_steps: list[str] = []
        for line in top_steps_raw.split("\n"):
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith("-")):
                # Clean leading numbering if present
                clean_step = line.lstrip("0123456789.-) ").strip()
                if clean_step:
                    extracted_steps.append(f"[{top_code}] {clean_step}")

        if not extracted_steps:
            extracted_steps = [
                f"[{top_code}] Follow verified operational procedure for {top_title}.",
                f"[{top_code}] Validate customer records against historical resolution precedent ({top_outcome}).",
                f"[{top_code}] Review transaction logs and execute verified outcome steps.",
            ]

        # Add human review step if flagged
        if payload.human_review_required:
            extracted_steps.append(
                "MANDATORY HUMAN REVIEW: Submit proposed resolution package to Compliance Officer for sign-off prior to execution."
            )

        rationale = (
            f"Grounding resolution in verified historical precedent [{top_code}] ({top_title}). "
            f"The consumer's reported issue aligns closely with established operational procedures for {payload.predicted_category}. "
            f"Historical precedent achieved {top_outcome.replace('_', ' ').title()}."
        )

        limitations = [
            f"Action steps are conditioned on customer verification matching [{top_code}] guidelines.",
            "Provisional credit and fee adjustments must be audited against active core transaction logs.",
        ]

        # Extract supporting source codes from available candidates
        supporting_codes = [
            item.get("reference_code")
            for item in payload.evidence_corpus[:2]
            if item.get("reference_code")
        ]

        latency_ms = round((time.perf_counter() - t0) * 1000, 2)

        return LLMGenerationOutput(
            suggested_steps=extracted_steps,
            rationale=rationale,
            supporting_source_codes=supporting_codes,
            evidence_limitations=limitations,
            model_provider="extractive_evidence_grounded",
            model_identifier="rule-based-grounded-synthesizer-v1.0",
            prompt_version=RAG_PROMPT_VERSION,
            latency_ms=latency_ms,
            raw_response=None,
        )
