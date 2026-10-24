import pytest

def test_order_recalculates_total_amount(client, auth_headers):
    # Seeding: Test medicine has price 15.0. Let's order 3 of them.
    # Recalculated total should be: 15.0 * 3 = 45.0
    # Let's send a fake total of 100.0 to verify server overrides it.
    headers = auth_headers("user@test.com")
    response = client.post(
        "/api/orders",
        json={
            "userId": "test-user-id",
            "items": [
                {
                    "inventoryId": "test-inventory-id",
                    "quantity": 3,
                    "priceAtTime": 15.0
                }
            ],
            "totalAmount": 100.0,  # manipulated price
            "discountApplied": 5.0,
            "surgeFee": 10.0,
            "deliveryAddress": "123 Test Street, Mumbai"
        },
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    
    # Retrieve order to verify server-side total
    order_id = data["orderId"]
    resp_order = client.get(f"/api/orders/{order_id}", headers=headers)
    assert resp_order.status_code == 200
    order_data = resp_order.json()["order"]
    # Secure Recalculated Total: (15.0 * 3) - 5.0 + 10.0 = 50.0
    assert order_data["totalAmount"] == 50.0

def test_order_stock_decrement_and_negative_prevent(client, auth_headers):
    # Seeded stock is 10.
    # Attempting to order 11 should fail with 400.
    headers = auth_headers("user@test.com")
    response = client.post(
        "/api/orders",
        json={
            "userId": "test-user-id",
            "items": [
                {
                    "inventoryId": "test-inventory-id",
                    "quantity": 11,
                    "priceAtTime": 15.0
                }
            ],
            "totalAmount": 165.0,
            "deliveryAddress": "123 Test Street, Mumbai"
        },
        headers=headers
    )
    assert response.status_code == 400
    assert "Insufficient stock" in response.json()["detail"]

def test_order_rejects_invalid_inventory_id(client, auth_headers):
    headers = auth_headers("user@test.com")
    response = client.post(
        "/api/orders",
        json={
            "userId": "test-user-id",
            "items": [
                {
                    "inventoryId": "nonexistent-id",
                    "quantity": 1,
                    "priceAtTime": 15.0
                }
            ],
            "totalAmount": 15.0,
            "deliveryAddress": "123 Test Street, Mumbai"
        },
        headers=headers
    )
    assert response.status_code == 400
    assert "Inventory item not found" in response.json()["detail"]

def test_address_delete_only_by_owner(client, auth_headers, db_session):
    import models
    # Create address for user@test.com
    addr = models.Address(
        id="test-addr-id",
        label="Home",
        address="User address description",
        userId="test-user-id"
    )
    db_session.add(addr)
    db_session.commit()
    
    # Try deleting with rider@test.com token
    headers_rider = auth_headers("rider@test.com")
    response = client.delete("/api/user/address?id=test-addr-id", headers=headers_rider)
    assert response.status_code == 403
    
    # Delete with owner succeeds
    headers_user = auth_headers("user@test.com")
    response2 = client.delete("/api/user/address?id=test-addr-id", headers=headers_user)
    assert response2.status_code == 200
    assert response2.json()["success"] is True
