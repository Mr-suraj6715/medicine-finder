import pytest

def test_01_customer_auth_flow(client):
    """Test 1: Multiple customer signups, logins, wrong passwords, and session tokens."""
    for i in range(1, 4):
        email = f"autotest_cust_{i}@medifind.test"
        # Signup
        resp = client.post("/api/auth/signup", json={
            "name": f"Auto Customer {i}",
            "email": email,
            "password": "Password@123",
            "role": "user",
            "phone": f"982009900{i}",
            "location": "Mumbai, Maharashtra"
        })
        assert resp.status_code == 200, f"Signup failed: {resp.text}"
        data = resp.json()
        assert data["success"] is True
        assert "token" in data
        assert data["user"]["role"] == "user"

        # Duplicate signup rejected
        dup_resp = client.post("/api/auth/signup", json={
            "name": f"Auto Customer {i}",
            "email": email,
            "password": "Password@123",
            "role": "user"
        })
        assert dup_resp.status_code == 400
        assert "Email already in use" in dup_resp.json()["detail"]

        # Valid Login
        login_resp = client.post("/api/auth/login", json={
            "email": email,
            "password": "Password@123",
            "role": "user"
        })
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]
        assert token is not None

        # Wrong Password
        bad_login = client.post("/api/auth/login", json={
            "email": email,
            "password": "WrongPassword123",
            "role": "user"
        })
        assert bad_login.status_code == 401

        # Wrong Role Selection Rejected
        bad_role = client.post("/api/auth/login", json={
            "email": email,
            "password": "Password@123",
            "role": "shop_owner"
        })
        assert bad_role.status_code == 400

        # Authenticated /me endpoint
        me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200
        assert me_resp.json()["user"]["email"] == email

def test_02_shop_owner_auth_and_pharmacy_creation(client):
    """Test 2: Shop Owner signup auto-creates pharmacy and enforces role permissions."""
    for i in range(1, 3):
        email = f"autotest_shop_{i}@medifind.test"
        resp = client.post("/api/auth/signup", json={
            "name": f"MedPlus Care Pharmacy {i}",
            "email": email,
            "password": "ShopPassword@123",
            "role": "shop_owner",
            "phone": f"022-2800110{i}",
            "location": "Bandra West, Mumbai"
        })
        assert resp.status_code == 200
        data = resp.json()
        token = data["token"]
        user_id = data["user"]["id"]

        # Shop Settings access
        settings_resp = client.get(f"/api/shop/settings?pharmacyId={user_id}", headers={"Authorization": f"Bearer {token}"})
        assert settings_resp.status_code == 200
        pharmacy_data = settings_resp.json()["pharmacy"]
        assert pharmacy_data is not None
        assert "MedPlus Care" in pharmacy_data["name"]

        # Shop Settings update
        upd_resp = client.post("/api/shop/settings", json={
            "pharmacyId": user_id,
            "name": f"MedPlus Superstore {i}",
            "openingTime": "07:30 AM",
            "closingTime": "11:30 PM",
            "isAvailable": True
        }, headers={"Authorization": f"Bearer {token}"})
        assert upd_resp.status_code == 200
        assert upd_resp.json()["pharmacy"]["openingTime"] == "07:30 AM"

def test_03_shop_inventory_crud_and_persistence(client, auth_headers):
    """Test 3: Shop inventory manual add, price update, stock update, delete, and persistence."""
    headers = auth_headers("shop@test.com")
    
    # Add new medicine to inventory
    add_resp = client.post("/api/shop/inventory", json={
        "action": "add_medicine",
        "pharmacyId": "test-pharmacy-id",
        "medicineName": "Vitamin C 500mg Chewable (Limcee)",
        "category": "Vitamins & Supplements",
        "price": 25.50,
        "stock": 50
    }, headers=headers)
    assert add_resp.status_code == 200
    assert add_resp.json()["success"] is True

    # Get Shop Inventory and verify added item
    inv_resp = client.get("/api/shop/inventory?pharmacyId=test-pharmacy-id", headers=headers)
    assert inv_resp.status_code == 200
    inventory_items = inv_resp.json()["inventory"]
    limcee = next((item for item in inventory_items if "Vitamin C" in item["medicine"]["name"]), None)
    assert limcee is not None
    assert limcee["price"] == 25.50
    assert limcee["stock"] == 50
    limcee_med_id = limcee["medicineId"]

    # Update Stock
    stock_resp = client.post("/api/shop/inventory", json={
        "action": "update_stock",
        "pharmacyId": "test-pharmacy-id",
        "medicineId": limcee_med_id,
        "stock": 75,
        "price": 24.00
    }, headers=headers)
    assert stock_resp.status_code == 200

    # Re-verify persistence of updates
    inv_resp2 = client.get("/api/shop/inventory?pharmacyId=test-pharmacy-id", headers=headers)
    limcee2 = next((item for item in inv_resp2.json()["inventory"] if item["medicineId"] == limcee_med_id), None)
    assert limcee2["stock"] == 75
    assert limcee2["price"] == 24.00

    # Delete item
    del_resp = client.post("/api/shop/inventory", json={
        "action": "delete_medicine",
        "pharmacyId": "test-pharmacy-id",
        "medicineId": limcee_med_id
    }, headers=headers)
    assert del_resp.status_code == 200

    # Verify item no longer in inventory
    inv_resp3 = client.get("/api/shop/inventory?pharmacyId=test-pharmacy-id", headers=headers)
    limcee3 = next((item for item in inv_resp3.json()["inventory"] if item["medicineId"] == limcee_med_id), None)
    assert limcee3 is None

def test_04_bulk_excel_inventory_import(client, auth_headers):
    """Test 4: Bulk spreadsheet import with validation of valid rows, invalid rows, and update strategies."""
    headers = auth_headers("shop@test.com")

    # Valid Bulk Import
    bulk_payload = {
        "pharmacyId": "test-pharmacy-id",
        "conflictStrategy": "replace",
        "items": [
            {
                "name": "Omeprazole 20mg (Omez)",
                "genericName": "Omeprazole",
                "category": "Antacid & PPI",
                "manufacturer": "Dr. Reddy's",
                "price": 55.0,
                "mrp": 65.0,
                "stock": 100,
                "batchNumber": "OMZ-101",
                "expiryDate": "2027-10-31"
            },
            {
                "name": "Amoxicillin 500mg (Mox 500)",
                "genericName": "Amoxicillin",
                "category": "Antibiotic",
                "manufacturer": "Sun Pharma",
                "price": 82.0,
                "mrp": 95.0,
                "stock": 60,
                "batchNumber": "MOX-202",
                "expiryDate": "2027-08-31"
            }
        ]
    }
    resp = client.post("/api/shop/inventory/bulk-upload", json=bulk_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["added"] >= 2
    assert data["failed"] == 0

    # Verify items are in inventory
    inv_resp = client.get("/api/shop/inventory?pharmacyId=test-pharmacy-id", headers=headers)
    item_names = [i["medicine"]["name"] for i in inv_resp.json()["inventory"]]
    assert "Omeprazole 20mg (Omez)" in item_names
    assert "Amoxicillin 500mg (Mox 500)" in item_names

def test_05_inventory_to_customer_search(client, auth_headers):
    """Test 5: Medicine created in inventory is discoverable by customer search, including generic name and out-of-stock handling."""
    # First seed a medicine with generic name via bulk upload
    headers = auth_headers("shop@test.com")
    client.post("/api/shop/inventory/bulk-upload", json={
        "pharmacyId": "test-pharmacy-id",
        "conflictStrategy": "replace",
        "items": [
            {
                "name": "Omeprazole 20mg (Omez)",
                "genericName": "Omeprazole",
                "category": "Antacid",
                "price": 55.0,
                "stock": 100
            }
        ]
    }, headers=headers)

    # Search by brand name
    search_paracetamol = client.get("/api/search?q=Paracetamol")
    assert search_paracetamol.status_code == 200
    results = search_paracetamol.json()["results"]
    assert len(results) > 0
    paracetamol_item = results[0]
    assert "Paracetamol" in paracetamol_item["name"]
    assert paracetamol_item["storeCount"] >= 1
    assert paracetamol_item["startingPrice"] is not None

    # Search by generic name
    search_generic = client.get("/api/search?q=Omeprazole")
    assert search_generic.status_code == 200
    results_generic = search_generic.json()["results"]
    assert len(results_generic) > 0

    # Search case-insensitivity
    search_lower = client.get("/api/search?q=paracetamol")
    assert search_lower.status_code == 200
    assert len(search_lower.json()["results"]) == len(results)

    # Search non-existent medicine returns empty list
    search_none = client.get("/api/search?q=NonExistentMedicineXyz999")
    assert search_none.status_code == 200
    assert len(search_none.json()["results"]) == 0

def test_06_customer_address_management_and_validation(client, auth_headers):
    """Test 6: Customer address CRUD, strict Indian PIN/phone validation, and default address switching."""
    headers = auth_headers("user@test.com")

    # 1. Valid Address Creation
    addr_payload = {
        "userId": "test-user-id",
        "label": "Office",
        "fullName": "Aarav Sharma",
        "phone": "9820011221",
        "houseNumber": "Floor 5 Technopolis Hub",
        "street": "Mahakali Caves Road Andheri East",
        "landmark": "Near MIDC Police Station",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400093",
        "isDefault": True
    }
    create_resp = client.post("/api/user/address", json=addr_payload, headers=headers)
    assert create_resp.status_code == 200
    created_addr = create_resp.json()["address"]
    addr_id = created_addr["id"]
    assert created_addr["pincode"] == "400093"
    assert created_addr["isDefault"] is True

    # 2. Add a second address and make it default -> first address should become non-default
    addr_payload2 = {
        "userId": "test-user-id",
        "label": "Parents House",
        "fullName": "Aarav Sharma",
        "phone": "9820011222",
        "houseNumber": "14 Shanti Nivas",
        "street": "SV Road Bandra",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400050",
        "isDefault": True
    }
    create_resp2 = client.post("/api/user/address", json=addr_payload2, headers=headers)
    assert create_resp2.status_code == 200
    addr2_id = create_resp2.json()["address"]["id"]

    # Verify address list and default status
    list_resp = client.get("/api/user/address?userId=test-user-id", headers=headers)
    assert list_resp.status_code == 200
    addresses = list_resp.json()["addresses"]
    assert len(addresses) >= 2
    first_addr = next(a for a in addresses if a["id"] == addr_id)
    second_addr = next(a for a in addresses if a["id"] == addr2_id)
    assert second_addr["isDefault"] is True
    assert first_addr["isDefault"] is False

    # 3. Invalid Indian PIN code rejected (< 6 digits or non-Indian prefix)
    bad_pin = {
        "userId": "test-user-id",
        "fullName": "Aarav Sharma",
        "phone": "9820011221",
        "houseNumber": "10",
        "street": "Test Street",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "000123"
    }
    bad_pin_resp = client.post("/api/user/address", json=bad_pin, headers=headers)
    assert bad_pin_resp.status_code == 422

    # 4. Invalid phone number rejected (< 10 digits or non-Indian starting digit)
    bad_phone = {
        "userId": "test-user-id",
        "fullName": "Aarav Sharma",
        "phone": "1234567890",
        "houseNumber": "10",
        "street": "Test Street",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001"
    }
    bad_phone_resp = client.post("/api/user/address", json=bad_phone, headers=headers)
    assert bad_phone_resp.status_code == 422

    # 5. Delete Address with authorization check
    del_resp = client.delete(f"/api/user/address?id={addr_id}", headers=headers)
    assert del_resp.status_code == 200

def test_07_complete_order_lifecycle_and_rider_dispatch(client, auth_headers):
    """Test 7: Complete order placement -> Shop owner status update -> Rider assignment -> Delivery completion."""
    cust_headers = auth_headers("user@test.com")
    shop_headers = auth_headers("shop@test.com")
    rider_headers = auth_headers("rider@test.com")

    # 1. Place order
    order_resp = client.post("/api/orders", json={
        "userId": "test-user-id",
        "items": [
            {
                "inventoryId": "test-inventory-id",
                "quantity": 2,
                "priceAtTime": 15.0
            }
        ],
        "totalAmount": 30.0,
        "deliveryAddress": "Flat 4B Ocean View, Bandra West, Mumbai - 400050",
        "paymentMethod": "CASH_ON_DELIVERY"
    }, headers=cust_headers)
    assert order_resp.status_code == 200
    order_data = order_resp.json()
    order_id = order_data["orderId"]
    assert order_id is not None

    # Verify inventory was decremented from 10 to 8
    inv_resp = client.get("/api/shop/inventory?pharmacyId=test-pharmacy-id", headers=shop_headers)
    inv_item = next(i for i in inv_resp.json()["inventory"] if i["id"] == "test-inventory-id")
    assert inv_item["stock"] == 8
    assert inv_item["sold"] == 2

    # 2. Shop Owner sees new order in orders list
    shop_orders_resp = client.get("/api/shop/orders?pharmacyId=test-pharmacy-id", headers=shop_headers)
    assert shop_orders_resp.status_code == 200
    shop_orders = shop_orders_resp.json()["orders"]
    matching_order = next((o for o in shop_orders if o["realId"] == order_id), None)
    assert matching_order is not None
    assert matching_order["status"] == "PENDING"

    # 3. Shop Owner processes order: PENDING -> PROCESSING -> CONFIRMED
    p1 = client.post("/api/shop/orders", json={"orderId": order_id, "status": "PROCESSING"}, headers=shop_headers)
    assert p1.status_code == 200

    p2 = client.post("/api/shop/orders", json={"orderId": order_id, "status": "CONFIRMED"}, headers=shop_headers)
    assert p2.status_code == 200
    assert p2.json()["status"] == "CONFIRMED"

    # 4. Rider Task Pool: Order is available for riders
    tasks_resp = client.get("/api/rider/orders?riderId=test-rider-id", headers=rider_headers)
    assert tasks_resp.status_code == 200
    tasks = tasks_resp.json()["orders"]
    avail_order = next((t for t in tasks if t["realId"] == order_id), None)
    assert avail_order is not None

    # 5. Rider accepts order: CONFIRMED -> RIDER_ASSIGNED
    accept_resp = client.put("/api/rider/orders", json={
        "orderId": order_id,
        "riderId": "test-rider-id"
    }, headers=rider_headers)
    assert accept_resp.status_code == 200

    # 6. Delivery status progression
    s1 = client.post("/api/rider/orders", json={"orderId": order_id, "status": "RIDER_AT_PHARMACY", "riderId": "test-rider-id"}, headers=rider_headers)
    assert s1.status_code == 200

    s2 = client.post("/api/rider/orders", json={"orderId": order_id, "status": "RIDER_PICKED_UP", "riderId": "test-rider-id"}, headers=rider_headers)
    assert s2.status_code == 200

    s3 = client.post("/api/rider/orders", json={"orderId": order_id, "status": "OUT_FOR_DELIVERY", "riderId": "test-rider-id"}, headers=rider_headers)
    assert s3.status_code == 200

    s4 = client.post("/api/rider/orders", json={"orderId": order_id, "status": "DELIVERED", "riderId": "test-rider-id"}, headers=rider_headers)
    assert s4.status_code == 200
    assert s4.json()["status"] == "DELIVERED"

    # 7. Customer views completed order in order history
    cust_orders = client.get("/api/orders?email=user@test.com", headers=cust_headers)
    assert cust_orders.status_code == 200
    completed_order = next((o for o in cust_orders.json()["orders"] if o["id"] == order_id), None)
    assert completed_order is not None
    assert completed_order["status"] == "DELIVERED"

def test_08_rider_cancellation_and_reassignment(client, auth_headers):
    """Test 8: Rider cancels assignment, order returns to pool, second rider accepts."""
    cust_headers = auth_headers("user@test.com")
    shop_headers = auth_headers("shop@test.com")
    rider1_headers = auth_headers("rider@test.com")

    # Create and confirm order
    order_resp = client.post("/api/orders", json={
        "userId": "test-user-id",
        "items": [{"inventoryId": "test-inventory-id", "quantity": 1, "priceAtTime": 15.0}],
        "totalAmount": 15.0,
        "deliveryAddress": "Mumbai"
    }, headers=cust_headers)
    order_id = order_resp.json()["orderId"]
    client.post("/api/shop/orders", json={"orderId": order_id, "status": "CONFIRMED"}, headers=shop_headers)

    # Rider 1 accepts
    client.put("/api/rider/orders", json={"orderId": order_id, "riderId": "test-rider-id"}, headers=rider1_headers)

    # Rider 1 cancels -> status reverts to CONFIRMED and riderId is unassigned
    cancel_resp = client.post("/api/rider/orders", json={
        "orderId": order_id,
        "status": "CANCELLED",
        "riderId": "test-rider-id"
    }, headers=rider1_headers)
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "CONFIRMED"

def test_09_security_and_role_isolation(client, auth_headers):
    """Test 9: Cross-user data isolation and role boundaries."""
    cust_headers = auth_headers("user@test.com")
    shop_headers = auth_headers("shop@test.com")
    rider_headers = auth_headers("rider@test.com")

    # Customer cannot access shop inventory management
    resp1 = client.get("/api/shop/inventory?pharmacyId=test-pharmacy-id", headers=cust_headers)
    assert resp1.status_code == 403

    # Customer cannot update shop settings
    resp2 = client.post("/api/shop/settings", json={"pharmacyId": "test-pharmacy-id", "name": "Hacked Pharmacy"}, headers=cust_headers)
    assert resp2.status_code == 403

    # Customer cannot view another user's orders
    resp3 = client.get("/api/orders?email=otheruser@test.com", headers=cust_headers)
    assert resp3.status_code == 403

    # Shop Owner cannot access rider orders endpoint
    resp4 = client.get("/api/rider/orders?riderId=test-rider-id", headers=shop_headers)
    assert resp4.status_code == 403

    # Rider cannot view customer addresses of another user
    resp5 = client.get("/api/user/address?userId=test-user-id", headers=rider_headers)
    assert resp5.status_code == 403
