"""Department Routing & Recommendation Engine.

Maps predicted complaint categories and risk indicators to operational departments.
Provides explicit fallback handling for unmapped categories.
"""

from __future__ import annotations

import logging

from pydantic import BaseModel

logger = logging.getLogger("routing_pipeline")


class DepartmentInfo(BaseModel):
    """Department metadata and routing attributes."""

    code: str
    name: str
    description: str


class DepartmentRecommendation(BaseModel):
    """Structured department recommendation output."""

    department_code: str
    department_name: str
    rationale: str
    is_fallback: bool = False


# Canonical department definitions matching PostgreSQL reference data
DEPARTMENTS: dict[str, DepartmentInfo] = {
    "DEPT_CREDIT": DepartmentInfo(
        code="DEPT_CREDIT",
        name="Credit & Bureau Support",
        description=(
            "Handles credit reporting disputes, inaccurate personal reports, "
            "and bureau escalations."
        ),
    ),
    "DEPT_COLLECTIONS": DepartmentInfo(
        code="DEPT_COLLECTIONS",
        name="Collections & Dispute Support",
        description=(
            "Handles debt validation disputes, third-party collection inquiries, "
            "and harassment claims."
        ),
    ),
    "DEPT_LOANS": DepartmentInfo(
        code="DEPT_LOANS",
        name="Loan & Mortgage Servicing",
        description=(
            "Handles mortgage escrow disputes, loan servicing problems, "
            "interest calculations, and closing documents."
        ),
    ),
    "DEPT_CARDS": DepartmentInfo(
        code="DEPT_CARDS",
        name="Card Services & Billing",
        description=(
            "Handles credit and prepaid card unauthorized charges, "
            "rewards disputes, and billing corrections."
        ),
    ),
    "DEPT_BANKING": DepartmentInfo(
        code="DEPT_BANKING",
        name="Banking Operations",
        description=(
            "Handles retail checking/savings accounts, wire transfers, "
            "deposit delays, and ATM problems."
        ),
    ),
    "DEPT_GENERAL": DepartmentInfo(
        code="DEPT_GENERAL",
        name="General Customer Support",
        description=(
            "General customer inquiries, cross-functional triage, "
            "and unclassified concerns."
        ),
    ),
}

# Category to Department Routing Matrix
CATEGORY_TO_DEPT_MAP: dict[str, str] = {
    "credit_reporting": "DEPT_CREDIT",
    "debt_collection": "DEPT_COLLECTIONS",
    "mortgages_and_loans": "DEPT_LOANS",
    "credit_card": "DEPT_CARDS",
    "retail_banking": "DEPT_BANKING",
}


class DepartmentRouter:
    """Configurable routing rules engine."""

    def __init__(
        self,
        routing_map: dict[str, str] = CATEGORY_TO_DEPT_MAP,
        departments: dict[str, DepartmentInfo] = DEPARTMENTS,
        fallback_code: str = "DEPT_GENERAL",
    ) -> None:
        self.routing_map = routing_map
        self.departments = departments
        self.fallback_code = fallback_code

    def recommend(self, category: str | None) -> DepartmentRecommendation:
        """Recommend optimal department based on predicted complaint category."""
        if not category:
            fallback = self.departments[self.fallback_code]
            return DepartmentRecommendation(
                department_code=fallback.code,
                department_name=fallback.name,
                rationale="Empty or unspecified category routed to default triage.",
                is_fallback=True,
            )

        cat_normalized = str(category).strip().lower()
        dept_code = self.routing_map.get(cat_normalized)

        if dept_code and dept_code in self.departments:
            dept = self.departments[dept_code]
            return DepartmentRecommendation(
                department_code=dept.code,
                department_name=dept.name,
                rationale=f"Category '{cat_normalized}' mapped to {dept.name}.",
                is_fallback=False,
            )

        fallback = self.departments[self.fallback_code]
        return DepartmentRecommendation(
            department_code=fallback.code,
            department_name=fallback.name,
            rationale=(
                f"Category '{cat_normalized}' not recognized; routed to default support queue."
            ),
            is_fallback=True,
        )


# Global singleton instance
department_router = DepartmentRouter()
