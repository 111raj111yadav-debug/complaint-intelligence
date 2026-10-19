"""Tests for health, readiness, and foundation endpoints of NLP Microservice."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health_check_liveness():
    """Test that the liveness probe returns 200 OK and status ok."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "complaint-nlp-service"
        assert "timestamp" in data


@pytest.mark.asyncio
async def test_readiness_probe_phase0():
    """Test that the readiness probe accurately reflects Phase 0 standby state."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "standby"
        assert data["models_loaded"] is False
        assert "Phase 0" in data["phase"]
        assert "details" in data


@pytest.mark.asyncio
async def test_foundation_ping_valid():
    """Test that the foundation ping endpoint echoes valid messages."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {"message": "Test ping message", "source": "unit-test"}
        response = await client.post("/api/v1/foundation/ping", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["echo"] == "Test ping message"
        assert data["received_from"] == "unit-test"
        assert "FOUNDATION_ONLY_ENDPOINT" in data["notice"]


@pytest.mark.asyncio
async def test_foundation_ping_invalid_schema():
    """Test that empty or malformed payloads return 422 unprocessable entity."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {"message": ""}  # violates min_length=1
        response = await client.post("/api/v1/foundation/ping", json=payload)
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"
