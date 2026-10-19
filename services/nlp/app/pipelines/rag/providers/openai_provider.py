"""OpenAI LLM Provider Implementation for RAG Recommendations."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from app.pipelines.rag.prompts import RAG_PROMPT_VERSION, SYSTEM_INSTRUCTION, USER_PROMPT_TEMPLATE
from app.pipelines.rag.providers.base import (
    BaseLLMProvider,
    LLMGenerationInput,
    LLMGenerationOutput,
)

logger = logging.getLogger("openai_provider")


class OpenAIProvider(BaseLLMProvider):
    """Integrates with OpenAI chat completion API (e.g. gpt-4o-mini)."""

    def __init__(
        self,
        api_key: str | None = None,
        model_name: str | None = None,
        timeout_seconds: float = 12.0,
    ) -> None:
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.model_name = model_name or os.getenv("OPENAI_MODEL_NAME", "gpt-4o-mini")
        self.timeout_seconds = timeout_seconds

    def is_available(self) -> bool:
        """Check if OPENAI_API_KEY is configured with non-empty value."""
        return bool(self.api_key and self.api_key.strip() and not self.api_key.startswith("your_"))

    def generate(self, payload: LLMGenerationInput) -> LLMGenerationOutput:
        """Execute chat completion call with JSON schema response."""
        if not self.is_available():
            raise RuntimeError("OpenAI provider is unavailable: OPENAI_API_KEY is not configured.")

        # Format retrieved evidence text
        evidence_blocks: list[str] = []
        for idx, item in enumerate(payload.evidence_corpus, start=1):
            block = (
                f"Source [{item.get('reference_code', f'S{idx}')}]: {item.get('title')}\n"
                f"Category: {item.get('category')} | Department: {item.get('department_code')}\n"
                f"Verified Outcome: {item.get('resolution_outcome')}\n"
                f"Playbook Steps: {item.get('resolution_text')}\n"
            )
            evidence_blocks.append(block)

        evidence_str = "\n".join(evidence_blocks) if evidence_blocks else "NO VERIFIED HISTORICAL EVIDENCE FOUND."

        user_prompt = USER_PROMPT_TEMPLATE.format(
            category=payload.predicted_category,
            urgency_level=payload.urgency_level,
            department_code=payload.department_code,
            complaint_text=payload.complaint_text,
            retrieved_evidence_text=evidence_str,
        )

        t0 = time.perf_counter()
        try:
            import httpx

            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            body: dict[str, Any] = {
                "model": self.model_name,
                "messages": [
                    {"role": "system", "content": SYSTEM_INSTRUCTION},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
                "max_tokens": 800,
            }

            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.post(url, headers=headers, json=body)
                response.raise_for_status()
                data = response.json()

            raw_content = data["choices"][0]["message"]["content"]
            parsed = json.loads(raw_content)
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)

            # Validate extracted source codes against supplied evidence
            valid_codes = {s.reference_code for s in payload.retrieved_sources}
            filtered_codes = [c for c in parsed.get("supporting_source_codes", []) if c in valid_codes]

            return LLMGenerationOutput(
                suggested_steps=parsed.get("suggested_steps", []),
                rationale=parsed.get("rationale", ""),
                supporting_source_codes=filtered_codes,
                evidence_limitations=parsed.get("evidence_limitations", []),
                model_provider="openai",
                model_identifier=self.model_name,
                prompt_version=RAG_PROMPT_VERSION,
                latency_ms=latency_ms,
                raw_response=raw_content,
            )

        except Exception as exc:
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            logger.error("OpenAI API completion failure: %s", exc)
            raise RuntimeError(f"OpenAI completion request failed: {exc}") from exc
