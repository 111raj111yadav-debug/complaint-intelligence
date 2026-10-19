"""Main application entry point for the Python FastAPI NLP Microservice."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import analysis, health, rag, retrieval
from app.core.config import settings
from app.core.logging import logger


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup and shutdown lifecycle management."""
    logger.info(
        "Starting Complaint NLP Service on %s:%s (Env: %s)",
        settings.HOST,
        settings.PORT,
        settings.ENVIRONMENT,
    )
    logger.info("Phase 2 Initialized: Semantic retrieval & RAG pipeline enabled.")
    try:
        from app.pipelines.embeddings.pipeline import embedding_pipeline

        logger.info("Pre-warming embedding model on startup...")
        embedding_pipeline._ensure_model_loaded()
        logger.info("Embedding model pre-warmed successfully.")
    except Exception as exc:
        logger.warning("Embedding model pre-warming skipped: %s", exc)
    yield
    logger.info("Shutting down Complaint NLP Service.")


app = FastAPI(
    title="Intelligent Customer Complaint NLP Microservice",
    description="NLP microservice for complaint classification, sentiment, urgency, and RAG.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    """Propagates X-Correlation-ID across distributed microservice boundaries."""
    import time
    import uuid

    correlation_id = (
        request.headers.get("x-correlation-id")
        or request.headers.get("x-request-id")
        or str(uuid.uuid4())
    )
    start_time = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start_time) * 1000
    response.headers["X-Correlation-ID"] = correlation_id
    response.headers["X-Request-ID"] = correlation_id
    logger.info(
        "[%s] %s %s -> %d (%.2fms)",
        correlation_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response



@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Standardized validation error handler."""
    logger.warning(
        "Validation failed for %s %s: %s",
        request.method,
        request.url.path,
        exc.errors(),
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "The request payload failed schema validation.",
                "details": exc.errors(),
            },
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Centralized internal error handler."""
    logger.error(
        "Unhandled exception processing %s %s: %s",
        request.method,
        request.url.path,
        str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred in the NLP microservice.",
            },
        },
    )


# Include health, analysis, semantic retrieval, embeddings, and RAG routes
app.include_router(health.router)
app.include_router(analysis.router)
app.include_router(retrieval.router)
app.include_router(retrieval.embeddings_router)
app.include_router(rag.router)


@app.get("/", tags=["Root"])
async def root():
    """Service metadata endpoint."""
    return {
        "service": "Intelligent Customer Complaint NLP Service",
        "version": "0.2.0",
        "phase": "Phase 2 - Semantic Retrieval & RAG",
        "documentation": "/docs",
    }
