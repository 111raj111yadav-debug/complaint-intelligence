"""Integration tests for the /api/v1/analyze FastAPI endpoint."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_analyze_endpoint_valid_complaint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "text": (
                "My payment was deducted twice and my account has been locked. "
                "Please fix immediately!"
            )
        }
        response = await client.post("/api/v1/analyze", json=payload)
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        data = body["data"]

        # Validate category
        assert "category" in data
        assert data["category"]["label"] in [
            "credit_reporting",
            "debt_collection",
            "mortgages_and_loans",
            "credit_card",
            "retail_banking",
        ]
        assert 0.0 <= data["category"]["confidence"] <= 1.0

        # Validate sentiment
        assert data["sentiment"]["label"] in ["positive", "neutral", "negative"]
        assert "scores" in data["sentiment"]

        # Validate emotion
        assert "primary" in data["emotion"]
        assert "scores" in data["emotion"]

        # Validate urgency
        assert data["urgency"]["level"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        assert data["urgency"]["score"] >= 0
        assert len(data["urgency"]["contributing_reasons"]) >= 1

        # Validate department
        assert data["recommended_department"]["code"].startswith("DEPT_")


@pytest.mark.asyncio
async def test_analyze_endpoint_empty_text_fails_validation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {"text": ""}
        response = await client.post("/api/v1/analyze", json=payload)
        assert response.status_code == 422
        body = response.json()
        assert body["success"] is False
        assert body["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_analyze_endpoint_missing_payload():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/analyze", json={})
        assert response.status_code == 422
