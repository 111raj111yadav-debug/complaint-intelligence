"""Health and foundation verification routes."""

from datetime import UTC, datetime

from fastapi import APIRouter, status

from app.core.config import settings
from app.core.logging import logger
from app.schemas.health import (
    FoundationPingRequest,
    FoundationPingResponse,
    HealthResponse,
    ReadinessResponse,
)

router = APIRouter(tags=["Health & Status"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Microservice Liveness Probe",
)
async def get_health() -> HealthResponse:
    """Verifies that the FastAPI process is running and responding to requests."""
    return HealthResponse(
        status="ok",
        service="complaint-nlp-service",
        timestamp=datetime.now(UTC).isoformat(),
    )


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    status_code=status.HTTP_200_OK,
    summary="Microservice Readiness Probe",
)
async def get_readiness() -> ReadinessResponse:
    """
    Verifies service operational readiness.
    Accurately reports that NLP models are not loaded during Phase 0.
    """
    logger.debug("Readiness check executed. Models loaded: %s", settings.MODELS_LOADED)

    # In Phase 0, models are deliberately not loaded. The service is structurally ready.
    status_state = "ready" if settings.MODELS_LOADED else "standby"

    return ReadinessResponse(
        status=status_state,
        service="complaint-nlp-service",
        models_loaded=settings.MODELS_LOADED,
        phase="Phase 0: Foundation",
        details={
            "environment": settings.ENVIRONMENT,
            "pipelines_status": "scaffolded_unloaded",
            "active_modules": [
                "preprocessing",
                "classification",
                "sentiment",
                "emotion",
                "urgency",
                "embeddings",
                "retrieval",
                "rag",
            ],
            "notice": "Phase 0 foundational state: service operational, models unloaded.",
        },
    )


@router.post(
    "/api/v1/foundation/ping",
    response_model=FoundationPingResponse,
    status_code=status.HTTP_200_OK,
    summary="Service Communication Verification (Foundation Only)",
)
async def foundation_ping(payload: FoundationPingRequest) -> FoundationPingResponse:
    """
    Foundation-only endpoint to verify inter-service communication from Node.js Express API.
    Validates request body and returns structured echo response.
    NOTE: Not a working complaint analysis endpoint.
    """
    logger.info("Foundation ping received from: %s, message: %s", payload.source, payload.message)
    return FoundationPingResponse(
        status="success",
        echo=payload.message,
        received_from=payload.source,
        notice="FOUNDATION_ONLY_ENDPOINT: ML models and NLP pipelines are not active in Phase 0.",
    )
