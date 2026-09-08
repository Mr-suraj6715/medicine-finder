import pytest

def test_signup_creates_user(client):
    response = client.post(
        "/api/auth/signup",
        json={
            "name": "New User",
            "email": "newuser@test.com",
            "password": "securepassword123",
            "phone": "+91 99999 99999",
            "location": "Delhi, India"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "token" in data
    assert data["user"]["email"] == "newuser@test.com"
    assert data["user"]["role"] == "user" # Enforced server-side

def test_signup_duplicate_email_fails(client):
    # Try to signup with user@test.com (seeded in conftest.py)
    response = client.post(
        "/api/auth/signup",
        json={
            "name": "Another Name",
            "email": "user@test.com",
            "password": "anotherpassword123"
        }
    )
    assert response.status_code == 400
    assert "Email already in use" in response.json()["detail"]

def test_login_valid_credentials(client):
    response = client.post(
        "/api/auth/login",
        json={
            "email": "user@test.com",
            "password": "password123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "token" in data
    assert data["user"]["role"] == "user"

def test_login_wrong_password_fails(client):
    response = client.post(
        "/api/auth/login",
        json={
            "email": "user@test.com",
            "password": "wrongpassword"
        }
    )
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]

def test_protected_route_no_token_fails(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401

def test_protected_route_valid_token_succeeds(client, auth_headers):
    headers = auth_headers("user@test.com")
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["user"]["email"] == "user@test.com"

def test_role_enforcement_rider_fails_for_user(client, auth_headers):
    headers = auth_headers("user@test.com")
    response = client.get("/api/rider/profile?userId=test-rider-id", headers=headers)
    assert response.status_code == 403

def test_role_enforcement_rider_succeeds_for_rider(client, auth_headers):
    headers = auth_headers("rider@test.com")
    response = client.get("/api/rider/profile?userId=test-rider-id", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["id"] == "test-rider-id"

def test_demo_login_succeeds(client):
    response = client.post(
        "/api/auth/login",
        json={
            "email": "demo@medstore.com",
            "password": ""
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "token" in data
    assert data["user"]["role"] == "user"
