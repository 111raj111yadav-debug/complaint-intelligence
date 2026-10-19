"""Pydantic schemas for semantic retrieval and embedding endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """Payload for semantic resolution search."""

    query: str = Field(min_length=3, max_length=10000, description="Complaint text to search for")
    top_k: int = Field(default=3, ge=1, le=20, description="Maximum number of results")
    similarity_threshold: float = Field(
        default=0.40, ge=0.0, le=1.0, description="Minimum cosine similarity threshold"
    )
    category_filter: str | None = Field(default=None, description="Optional category filter")
    department_filter: str | None = Field(default=None, description="Optional department code filter")
    only_verified: bool = Field(default=True, description="Filter for verified resolutions only")


class RetrievedItemSchema(BaseModel):
    """Schema for a single retrieved resolution."""

    id: str
    reference_code: str
    title: str
    complaint_text: str
    resolution_text: str
    resolution_outcome: str
    category: str
    department_code: str
    similarity_score: float
    is_verified: bool
    verification_status: str
    data_source: str
    provenance: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class SearchResponseData(BaseModel):
    """Data payload for search response."""

    query: str
    query_preview: str
    similarity_threshold: float
    top_k: int
    category_filter: str | None
    department_filter: str | None
    matched_count: int
    is_empty: bool
    empty_reason: str | None
    results: list[RetrievedItemSchema]


class SearchApiResponse(BaseModel):
    """Standardized API response envelope for semantic search."""

    success: bool = True
    data: SearchResponseData


class EmbeddingGenerationRequest(BaseModel):
    """Payload for raw embedding generation."""

    text: str | None = Field(default=None, description="Single text to encode")
    texts: list[str] | None = Field(default=None, description="Batch of texts to encode")


class EmbeddingGenerationData(BaseModel):
    """Data payload for embedding generation response."""

    model_name: str
    dimension: int
    count: int
    embeddings: list[list[float]]


class EmbeddingApiResponse(BaseModel):
    """Standardized API response for embedding generation."""

    success: bool = True
    data: EmbeddingGenerationData
