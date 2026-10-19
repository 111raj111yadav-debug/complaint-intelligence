"""Schemas for health, readiness, and foundation verification endpoints."""

from typing import Any

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Liveness check response."""

    status: str = Field(default="ok", description="Service liveness status")
    service: str = Field(default="complaint-nlp-service", description="Service identifier")
    timestamp: str = Field(description="ISO timestamp of the health check")


class ReadinessResponse(BaseModel):
    """Readiness check response indicating component readiness."""

    status: str = Field(description="Overall readiness state (ready or degraded/initializing)")
    service: str = Field(default="complaint-nlp-service", description="Service identifier")
    models_loaded: bool = Field(default=False, description="Whether ML models are loaded in memory")
    phase: str = Field(default="Phase 0: Foundation", description="Current development phase")
    details: dict[str, Any] = Field(default_factory=dict, description="Component level status")


class FoundationPingRequest(BaseModel):
    """Request schema for validating communication between Node API and Python NLP."""

    message: str = Field(..., min_length=1, max_length=500, description="Ping message to echo")
    source: str | None = Field(default="express-api", description="Calling service name")


class FoundationPingResponse(BaseModel):
    """Response schema for communication validation (foundation-only)."""

    status: str = Field(default="success")
    echo: str = Field(description="Echoed message")
    received_from: str | None = Field(description="Caller source")
    notice: str = Field(
        default="FOUNDATION_ONLY_ENDPOINT: ML models and NLP pipelines are not active in Phase 0."
    )
