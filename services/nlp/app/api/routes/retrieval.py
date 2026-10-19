"""FastAPI Routes for Semantic Retrieval and Embedding Generation."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from app.pipelines.embeddings.pipeline import embedding_pipeline
from app.pipelines.retrieval.retriever import semantic_retriever
from app.schemas.retrieval import (
    EmbeddingApiResponse,
    EmbeddingGenerationData,
    EmbeddingGenerationRequest,
    RetrievedItemSchema,
    SearchApiResponse,
    SearchRequest,
    SearchResponseData,
)

logger = logging.getLogger("retrieval_route")

router = APIRouter(prefix="/api/v1/resolutions", tags=["Semantic Retrieval"])


@router.post(
    "/search",
    response_model=SearchApiResponse,
    status_code=status.HTTP_200_OK,
    summary="Semantic Resolution Search",
    description="Searches historical verified resolutions using pgvector cosine similarity.",
)
def search_resolutions(payload: SearchRequest) -> SearchApiResponse:
    """Execute vector similarity search across historical resolutions."""
    try:
        result = semantic_retriever.search(
            query=payload.query,
            top_k=payload.top_k,
            similarity_threshold=payload.similarity_threshold,
            category_filter=payload.category_filter,
            department_filter=payload.department_filter,
            only_verified=payload.only_verified,
        )

        items = [
            RetrievedItemSchema(
                id=r.id,
                reference_code=r.reference_code,
                title=r.title,
                complaint_text=r.complaint_text,
                resolution_text=r.resolution_text,
                resolution_outcome=r.resolution_outcome,
                category=r.category,
                department_code=r.department_code,
                similarity_score=r.similarity_score,
                is_verified=r.is_verified,
                verification_status=r.verification_status,
                data_source=r.data_source,
                provenance=r.provenance,
                metadata=r.metadata,
            )
            for r in result.results
        ]

        return SearchApiResponse(
            success=True,
            data=SearchResponseData(
                query=result.query,
                query_preview=result.query_preview,
                similarity_threshold=result.similarity_threshold,
                top_k=result.top_k,
                category_filter=result.category_filter,
                department_filter=result.department_filter,
                matched_count=result.matched_count,
                is_empty=result.is_empty,
                empty_reason=result.empty_reason,
                results=items,
            ),
        )
    except Exception as exc:
        logger.error("Error handling /resolutions/search: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "SEARCH_ERROR", "message": f"Semantic search failed: {exc}"},
        ) from exc


embeddings_router = APIRouter(prefix="/api/v1/embeddings", tags=["Embeddings"])


@embeddings_router.post(
    "/generate",
    response_model=EmbeddingApiResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate 384-d Vector Embeddings",
    description="Generates normalized sentence embeddings using all-MiniLM-L6-v2.",
)
def generate_embeddings(payload: EmbeddingGenerationRequest) -> EmbeddingApiResponse:
    """Generate dense embeddings for a single text or batch of texts."""
    try:
        if payload.text is not None:
            res = embedding_pipeline.encode_text(payload.text)
            if res.status == "error":
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={"code": "EMBEDDING_ERROR", "message": res.error_message},
                )
            return EmbeddingApiResponse(
                success=True,
                data=EmbeddingGenerationData(
                    model_name=res.model_name,
                    dimension=res.dimension,
                    count=1 if res.dimension > 0 else 0,
                    embeddings=[res.embedding] if res.embedding else [],
                ),
            )
        elif payload.texts is not None:
            batch_res = embedding_pipeline.encode_batch(payload.texts)
            return EmbeddingApiResponse(
                success=True,
                data=EmbeddingGenerationData(
                    model_name=batch_res.model_name,
                    dimension=embedding_pipeline.expected_dim,
                    count=batch_res.successful_count,
                    embeddings=batch_res.embeddings,
                ),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "VALIDATION_ERROR", "message": "Either 'text' or 'texts' must be provided."},
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Embedding generation error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "EMBEDDING_ERROR", "message": str(exc)},
        ) from exc
