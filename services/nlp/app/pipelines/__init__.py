"""
NLP Pipelines Package for Complaint Intelligence Platform.

Phase 0 Status: Architectural scaffolding only.
Production model pipelines are implemented in Phase 1 (Preprocessing, Classification,
Sentiment, Emotion, Urgency) and Phase 2 (Dense Embeddings, Vector Retrieval, RAG).
"""

AVAILABLE_PIPELINES = [
    "preprocessing",
    "classification",
    "sentiment",
    "emotion",
    "urgency",
    "embeddings",
    "retrieval",
    "rag",
]
