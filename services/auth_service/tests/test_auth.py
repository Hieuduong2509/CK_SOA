import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_signup():
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "email": "test@example.com",
            "password": "testpass123",
            "name": "Test User",
            "role": "client",
            "phone": "+84123456789",
            "headline": "Client account"
        }
    )
    if response.status_code == 201:
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["role"] == "client"
    else:
        assert response.status_code == 400


def test_login():
    # First signup
    client.post(
        "/api/v1/auth/signup",
        json={
            "email": "testlogin@example.com",
            "password": "testpass123",
            "name": "Test User",
            "role": "client"
        }
    )

    # Then login
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "testlogin@example.com",
            "password": "testpass123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "testlogin@example.com"


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

