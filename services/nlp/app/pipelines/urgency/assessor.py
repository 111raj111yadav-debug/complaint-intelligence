"""Explainable Urgency Assessment Pipeline for Customer Complaints.

Deterministic, auditable rule-scoring system evaluating operational risk, financial loss,
service lockouts, temporal deadlines, repeated failures, and security breaches.

Guardrails:
- Emotional words ("angry", "terrible") do NOT trigger urgency points.
- Negative sentiment alone never promotes a ticket to HIGH or CRITICAL.
- Every score is accompanied by the exact contributing rules and matched tokens.
- Tickets meeting critical thresholds flag human review requirement.
"""

from __future__ import annotations

import logging
import re
from typing import NamedTuple

from pydantic import BaseModel, Field

logger = logging.getLogger("urgency_pipeline")


class TriggerRule(NamedTuple):
    rule_id: str
    name: str
    weight: int
    pattern: re.Pattern[str]
    description: str


class ContributingReason(BaseModel):
    """Specific rule and trigger that contributed to the urgency score."""

    rule_id: str
    rule_name: str
    weight: int
    matched_term: str
    description: str


class UrgencyResult(BaseModel):
    """Structured result of urgency assessment."""

    urgency_level: str  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    urgency_score: int  # 0 to 100
    contributing_reasons: list[ContributingReason] = Field(default_factory=list)
    human_review_required: bool = False
    status: str = "success"


# Configured Assessment Rules
URGENCY_RULES = [
    TriggerRule(
        rule_id="SECURITY_SAFETY_BREACH",
        name="Security Breach or Identity Theft",
        weight=45,
        pattern=re.compile(
            r"\b(identity theft|identity stolen|compromised account|unauthorized access|"
            r"hacked|fraudulent activity|stolen credentials|security breach)\b",
            re.IGNORECASE,
        ),
        description=(
            "Explicit threat to account security, identity theft, or compromised credentials."
        ),
    ),
    TriggerRule(
        rule_id="FINANCIAL_LOSS_DUPLICATE_CHARGE",
        name="Direct Financial Loss or Double Charge",
        weight=35,
        pattern=re.compile(
            r"\b(deducted twice|charged double|duplicate charge|unauthorized withdrawal|"
            r"unauthorized charge|wrongful foreclosure|life savings|empty balance|"
            r"money was stolen|stolen funds|fraudulent transaction)\b",
            re.IGNORECASE,
        ),
        description="Direct un-remedied financial harm or erroneous multi-charge withdrawal.",
    ),
    TriggerRule(
        rule_id="SERVICE_OUTAGE_LOCKOUT",
        name="Essential Service Outage or Account Lockout",
        weight=30,
        pattern=re.compile(
            r"\b(account locked|card blocked|frozen account|cannot access funds|"
            r"locked out of account|stranded without money|denied access to my money|"
            r"unable to buy food|unable to pay rent)\b",
            re.IGNORECASE,
        ),
        description="Denial of access to critical funds or essential service functionality.",
    ),
    TriggerRule(
        rule_id="TIME_SENSITIVE_DEADLINE",
        name="Time-Sensitive or Explicit Deadline",
        weight=25,
        pattern=re.compile(
            r"\b(within 24 hours|within 48 hours|immediately|asap|urgent deadline|"
            r"before tomorrow|evicting me|court date|emergency|time sensitive|"
            r"auction date|before the end of the day)\b",
            re.IGNORECASE,
        ),
        description="Explicit external temporal urgency or irreversible deadline.",
    ),
    TriggerRule(
        rule_id="REPEATED_UNRESOLVED_ATTEMPTS",
        name="Repeated Unsuccessful Escalations",
        weight=20,
        pattern=re.compile(
            r"\b(called multiple times|called \d+ times|contacted \d+ times|"
            r"third attempt|fourth attempt|fifth attempt|no response for weeks|"
            r"ignored my emails|weeks with no update|months with no resolution|"
            r"repeatedly contacted|nobody responded)\b",
            re.IGNORECASE,
        ),
        description=(
            "Demonstrated breakdown in standard customer support channels across multiple attempts."
        ),
    ),
    TriggerRule(
        rule_id="REGULATORY_LEGAL_ESCALATION",
        name="Regulatory or Legal Escalation Signal",
        weight=20,
        pattern=re.compile(
            r"\b(attorney general|retaining counsel|my lawyer|small claims court|"
            r"formal legal notice|hiring an attorney|cfpb complaint|filing lawsuit)\b",
            re.IGNORECASE,
        ),
        description="Explicit consumer escalation to legal representation or enforcement bodies.",
    ),
]


class UrgencyAssessor:
    """Evaluates complaint text against deterministic urgency rules."""

    def __init__(self, rules: list[TriggerRule] = URGENCY_RULES) -> None:
        self.rules = rules

    def assess(self, text: str | None) -> UrgencyResult:
        """Calculate explainable urgency score and contributing reasons."""
        if not text or not str(text).strip():
            return UrgencyResult(
                urgency_level="LOW",
                urgency_score=0,
                contributing_reasons=[],
                human_review_required=False,
                status="success",
            )

        text_str = str(text)
        score = 0
        contributing: list[ContributingReason] = []
        has_security_breach = False

        for rule in self.rules:
            match = rule.pattern.search(text_str)
            if match:
                score += rule.weight
                matched_term = match.group(0)
                contributing.append(
                    ContributingReason(
                        rule_id=rule.rule_id,
                        rule_name=rule.name,
                        weight=rule.weight,
                        matched_term=matched_term,
                        description=rule.description,
                    )
                )
                if rule.rule_id == "SECURITY_SAFETY_BREACH":
                    has_security_breach = True

        # Clamp score between 0 and 100
        clamped_score = min(100, max(0, score))

        # Assign urgency level
        if clamped_score >= 75:
            level = "CRITICAL"
        elif clamped_score >= 50:
            level = "HIGH"
        elif clamped_score >= 25:
            level = "MEDIUM"
        else:
            level = "LOW"

        # Flag for human review
        human_review = level == "CRITICAL" or has_security_breach

        return UrgencyResult(
            urgency_level=level,
            urgency_score=clamped_score,
            contributing_reasons=contributing,
            human_review_required=human_review,
            status="success",
        )


# Global singleton instance
urgency_assessor = UrgencyAssessor()
