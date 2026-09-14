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

def test_forgot_password_flow_complete(client):
    from email_service import DEV_LAST_RESET_LINKS

    # 1. Request reset link for user@test.com with role "user"
    resp = client.post(
        "/api/auth/forgot-password",
        json={"email": "user@test.com", "role": "user"}
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Check dev mailer link
    assert "user@test.com" in DEV_LAST_RESET_LINKS
    raw_token = DEV_LAST_RESET_LINKS["user@test.com"]["token"]
    assert len(raw_token) > 20

    # 2. Verify valid token
    verify_resp = client.get(f"/api/auth/reset-password/verify?token={raw_token}")
    assert verify_resp.status_code == 200
    assert verify_resp.json()["success"] is True

    # 3. Verify invalid token
    invalid_resp = client.get("/api/auth/reset-password/verify?token=completely_fake_token_12345")
    assert invalid_resp.status_code == 400

    # 4. Confirm new password
    confirm_resp = client.post(
        "/api/auth/reset-password/confirm",
        json={"token": raw_token, "newPassword": "newBrandNewPassword123"}
    )
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["success"] is True

    # 5. Token cannot be reused (single-use)
    reuse_resp = client.get(f"/api/auth/reset-password/verify?token={raw_token}")
    assert reuse_resp.status_code == 400

    reuse_confirm = client.post(
        "/api/auth/reset-password/confirm",
        json={"token": raw_token, "newPassword": "anotherPassword999"}
    )
    assert reuse_confirm.status_code == 400

    # 6. Old password fails
    old_login = client.post(
        "/api/auth/login",
        json={"email": "user@test.com", "password": "password123"}
    )
    assert old_login.status_code == 401

    # 7. New password succeeds
    new_login = client.post(
        "/api/auth/login",
        json={"email": "user@test.com", "password": "newBrandNewPassword123"}
    )
    assert new_login.status_code == 200
    assert new_login.json()["success"] is True

def test_forgot_password_role_mismatch_prevents_reset(client):
    from email_service import DEV_LAST_RESET_LINKS
    DEV_LAST_RESET_LINKS.clear()

    # user@test.com is a "user", attempting reset as "rider"
    resp = client.post(
        "/api/auth/forgot-password",
        json={"email": "user@test.com", "role": "rider"}
    )
    # Generic message to prevent user enumeration
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    # No token generated for rider role
    assert "user@test.com" not in DEV_LAST_RESET_LINKS

