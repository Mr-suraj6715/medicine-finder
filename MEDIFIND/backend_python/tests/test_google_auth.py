import pytest
from unittest.mock import patch
from fastapi import HTTPException
import models
import auth

@pytest.fixture
def mock_google_client_id(monkeypatch):
    test_client_id = "test-google-client-id.apps.googleusercontent.com"
    monkeypatch.setenv("GOOGLE_CLIENT_ID", test_client_id)
    return test_client_id

def test_google_auth_missing_token(client, mock_google_client_id):
    """Fails when token/credential is missing."""
    res = client.post("/api/auth/google", json={})
    assert res.status_code in [400, 422]

def test_google_auth_missing_server_client_id(client, monkeypatch):
    """Fails with 500 configuration error if GOOGLE_CLIENT_ID is not configured."""
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    res = client.post("/api/auth/google", json={"credential": "sample_token"})
    assert res.status_code == 500
    assert "Missing GOOGLE_CLIENT_ID" in res.json()["detail"]

def test_google_auth_invalid_token(client, mock_google_client_id):
    """Fails when token cannot be verified."""
    res = client.post("/api/auth/google", json={"credential": "invalid_fake_token"})
    assert res.status_code == 401
    assert "Invalid Google ID token" in res.json()["detail"] or "failed" in res.json()["detail"]

def test_google_auth_unverified_email_fails(client, mock_google_client_id):
    """Fails if Google account email is not verified."""
    fake_payload = {
        "iss": "https://accounts.google.com",
        "sub": "google-sub-unverified",
        "email": "unverified@example.com",
        "email_verified": False,
        "name": "Unverified User"
    }
    with patch("routers.auth.google_id_token.verify_oauth2_token", return_value=fake_payload):
        res = client.post("/api/auth/google", json={"credential": "valid_token"})
        assert res.status_code == 400
        assert "not verified" in res.json()["detail"]

def test_google_auth_invalid_issuer_fails(client, mock_google_client_id):
    """Fails if token issuer is not Google."""
    fake_payload = {
        "iss": "https://malicious-issuer.com",
        "sub": "google-sub-123",
        "email": "test@example.com",
        "email_verified": True,
        "name": "Hacker"
    }
    with patch("routers.auth.google_id_token.verify_oauth2_token", return_value=fake_payload):
        res = client.post("/api/auth/google", json={"credential": "valid_token"})
        assert res.status_code == 401
        assert "Invalid token issuer" in res.json()["detail"]

def test_google_auth_new_customer_signup(client, mock_google_client_id):
    """Successfully signs up a new customer via Google and strictly assigns 'user' role."""
    fake_payload = {
        "iss": "https://accounts.google.com",
        "sub": "google-sub-new-12345",
        "email": "freshgoogle@test.com",
        "email_verified": True,
        "name": "Google Newbie",
        "picture": "https://lh3.googleusercontent.com/photo.jpg"
    }
    with patch("routers.auth.google_id_token.verify_oauth2_token", return_value=fake_payload):
        res = client.post("/api/auth/google", json={"credential": "valid_token", "role": "shop_owner"})
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["isNewUser"] is True
        assert "token" in data
        assert data["user"]["email"] == "freshgoogle@test.com"
        assert data["user"]["name"] == "Google Newbie"
        # Role must be strictly 'user' (Customer) even if request attempted shop_owner
        assert data["user"]["role"] == "user"
        assert data["user"]["avatar"] == "https://lh3.googleusercontent.com/photo.jpg"

def test_google_auth_returning_user_login(client, mock_google_client_id, db_session):
    """Existing Google user signs in successfully preserving their existing account data."""
    # Seed a user with googleId
    user = models.User(
        id="google-user-existing",
        name="Existing Google User",
        email="existinggoogle@test.com",
        role="user",
        googleId="google-sub-existing-999",
        authProvider="google",
        loyaltyPoints=45
    )
    db_session.add(user)
    db_session.commit()

    fake_payload = {
        "iss": "https://accounts.google.com",
        "sub": "google-sub-existing-999",
        "email": "existinggoogle@test.com",
        "email_verified": True,
        "name": "Existing Google User"
    }
    with patch("routers.auth.google_id_token.verify_oauth2_token", return_value=fake_payload):
        res = client.post("/api/auth/google", json={"credential": "valid_token"})
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["isNewUser"] is False
        assert data["user"]["id"] == "google-user-existing"
        assert data["user"]["loyaltyPoints"] == 45

def test_google_auth_email_collision_requires_password(client, mock_google_client_id):
    """If user@test.com exists from password signup without Google linked, reject automatic merging."""
    fake_payload = {
        "iss": "https://accounts.google.com",
        "sub": "unlinked-google-sub-888",
        "email": "user@test.com", # Already seeded in conftest.py
        "email_verified": True,
        "name": "Password User"
    }
    with patch("routers.auth.google_id_token.verify_oauth2_token", return_value=fake_payload):
        res = client.post("/api/auth/google", json={"credential": "valid_token"})
        assert res.status_code == 409
        assert "account with this email already exists" in res.json()["detail"].lower()
