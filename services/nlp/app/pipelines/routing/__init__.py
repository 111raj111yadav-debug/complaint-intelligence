"""Department Recommendation & Routing Package."""

from app.pipelines.routing.router import (
    DEPARTMENTS,
    DepartmentInfo,
    DepartmentRecommendation,
    DepartmentRouter,
    department_router,
)

__all__ = [
    "DEPARTMENTS",
    "DepartmentInfo",
    "DepartmentRecommendation",
    "DepartmentRouter",
    "department_router",
]
