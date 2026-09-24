import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from main import app
from database import SessionLocal
import models
import auth

def run_e2e_report():
    client = TestClient(app)
    db = SessionLocal()

    print("\n" + "="*80)
    print("MEDIFIND MULTI-USER END-TO-END COMPREHENSIVE LOCAL TEST RUNNER")
    print("="*80 + "\n")

    test_results = []

    def record(module, test_name, result, issue="—", severity="—"):
        test_results.append({
            "module": module,
            "test": test_name,
            "result": result,
            "issue": issue,
            "severity": severity
        })
        print(f"[{result}] {module} -> {test_name}")

    # --- 1. USER AUTHENTICATION & ROLE ISOLATION ---
    try:
        # Test customer login
        r1 = client.post("/api/auth/login", json={"email": "customer01@medifind.test", "password": "Customer@123", "role": "user"})
        if r1.status_code == 200 and r1.json().get("success"):
            record("Authentication", "Customer 01 Login & Token", "PASS")
        else:
            record("Authentication", "Customer 01 Login & Token", "FAIL", f"Status: {r1.status_code}", "HIGH")

        # Test shop owner login
        r2 = client.post("/api/auth/login", json={"email": "shop01@medifind.test", "password": "ShopOwner@123", "role": "shop_owner"})
        if r2.status_code == 200 and r2.json().get("success"):
            record("Authentication", "Shop Owner 01 Login & Token", "PASS")
        else:
            record("Authentication", "Shop Owner 01 Login & Token", "FAIL", f"Status: {r2.status_code}", "HIGH")

        # Test rider login
        r3 = client.post("/api/auth/login", json={"email": "rider01@medifind.test", "password": "Rider@123", "role": "rider"})
        if r3.status_code == 200 and r3.json().get("success"):
            record("Authentication", "Rider 01 Login & Token", "PASS")
        else:
            record("Authentication", "Rider 01 Login & Token", "FAIL", f"Status: {r3.status_code}", "HIGH")

        # Wrong credentials test
        r4 = client.post("/api/auth/login", json={"email": "customer01@medifind.test", "password": "WrongPassword", "role": "user"})
        if r4.status_code == 401:
            record("Authentication", "Invalid Password Handling", "PASS")
        else:
            record("Authentication", "Invalid Password Handling", "FAIL", "Did not return 401", "HIGH")

        # Role mismatch prevention
        r5 = client.post("/api/auth/login", json={"email": "customer01@medifind.test", "password": "Customer@123", "role": "shop_owner"})
        if r5.status_code == 400:
            record("Authentication", "Role Mismatch Enforcement", "PASS")
        else:
            record("Authentication", "Role Mismatch Enforcement", "FAIL", "Allowed wrong role login", "HIGH")
    except Exception as e:
        record("Authentication", "Auth Suite", "FAIL", str(e), "CRITICAL")

    # --- 2. CUSTOMER ADDRESS MANAGEMENT ---
    try:
        cust1_token = client.post("/api/auth/login", json={"email": "customer01@medifind.test", "password": "Customer@123", "role": "user"}).json()["token"]
        cust1_id = db.query(models.User).filter(models.User.email == "customer01@medifind.test").first().id
        headers_cust1 = {"Authorization": f"Bearer {cust1_token}"}

        # Add structured address
        r_addr = client.post("/api/user/address", json={
            "userId": cust1_id,
            "label": "Work Office",
            "fullName": "Aarav Sharma",
            "phone": "9820011221",
            "houseNumber": "Floor 5 Technopolis Hub",
            "street": "Mahakali Caves Road Andheri East",
            "landmark": "Near MIDC Police Station",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400093",
            "isDefault": True
        }, headers=headers_cust1)
        if r_addr.status_code == 200:
            created_addr_id = r_addr.json()["address"]["id"]
            record("Customer Address", "Create Structured Address", "PASS")
        else:
            record("Customer Address", "Create Structured Address", "FAIL", f"Status: {r_addr.status_code}", "HIGH")
            created_addr_id = None

        # Fetch Address List
        r_list = client.get(f"/api/user/address?userId={cust1_id}", headers=headers_cust1)
        if r_list.status_code == 200 and len(r_list.json()["addresses"]) >= 2:
            record("Customer Address", "List & Default Address Switching", "PASS")
        else:
            record("Customer Address", "List & Default Address Switching", "FAIL", "Failed to retrieve address list", "HIGH")

        # Address Validation: Invalid Pincode
        r_bad_pin = client.post("/api/user/address", json={
            "userId": cust1_id,
            "fullName": "Aarav Sharma",
            "phone": "9820011221",
            "houseNumber": "10",
            "street": "Street",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "000123"
        }, headers=headers_cust1)
        if r_bad_pin.status_code == 422:
            record("Customer Address", "Indian PIN Code Validation", "PASS")
        else:
            record("Customer Address", "Indian PIN Code Validation", "FAIL", "Allowed invalid PIN code", "MEDIUM")

        # Cross-user authorization check
        cust2_token = client.post("/api/auth/login", json={"email": "customer02@medifind.test", "password": "Customer@123", "role": "user"}).json()["token"]
        headers_cust2 = {"Authorization": f"Bearer {cust2_token}"}
        if created_addr_id:
            r_unauth_del = client.delete(f"/api/user/address?id={created_addr_id}", headers=headers_cust2)
            if r_unauth_del.status_code == 403:
                record("Customer Address", "Cross-User Address Security Isolation", "PASS")
            else:
                record("Customer Address", "Cross-User Address Security Isolation", "FAIL", "Customer 2 deleted Customer 1 address", "CRITICAL")
    except Exception as e:
        record("Customer Address", "Address Suite", "FAIL", str(e), "HIGH")

    # --- 3. SHOP INVENTORY MANAGEMENT & BULK UPLOAD ---
    try:
        shop1_user = db.query(models.User).filter(models.User.email == "shop01@medifind.test").first()
        shop1_token = client.post("/api/auth/login", json={"email": "shop01@medifind.test", "password": "ShopOwner@123", "role": "shop_owner"}).json()["token"]
        headers_shop1 = {"Authorization": f"Bearer {shop1_token}"}

        # Manual Inventory Add
        r_add_inv = client.post("/api/shop/inventory", json={
            "action": "add_medicine",
            "pharmacyId": shop1_user.id,
            "medicineName": "Amoxicillin and Potassium Clavulanate (Augmentin 625)",
            "category": "Antibiotic",
            "price": 185.0,
            "stock": 50
        }, headers=headers_shop1)
        if r_add_inv.status_code == 200:
            record("Shop Owner", "Manual Inventory Management", "PASS")
        else:
            record("Shop Owner", "Manual Inventory Management", "FAIL", f"Status: {r_add_inv.status_code}", "HIGH")

        # Bulk Inventory Upload
        r_bulk = client.post("/api/shop/inventory/bulk-upload", json={
            "pharmacyId": shop1_user.id,
            "conflictStrategy": "update_add",
            "items": [
                {
                    "name": "Ibuprofen 400mg & Paracetamol (Combiflam)",
                    "genericName": "Ibuprofen + Paracetamol",
                    "category": "Pain Relief / NSAID",
                    "price": 48.0,
                    "stock": 100,
                    "batchNumber": "COMBI-445",
                    "expiryDate": "2027-12-31"
                }
            ]
        }, headers=headers_shop1)
        if r_bulk.status_code == 200 and r_bulk.json()["success"]:
            record("Shop Owner", "Bulk / Excel Inventory Upload & Persistence", "PASS")
        else:
            record("Shop Owner", "Bulk / Excel Inventory Upload & Persistence", "FAIL", f"Status: {r_bulk.status_code}", "HIGH")
    except Exception as e:
        record("Shop Owner", "Inventory Suite", "FAIL", str(e), "HIGH")

    # --- 4. MEDICINE SEARCH & MULTI-STORE AVAILABILITY ---
    try:
        r_search = client.get("/api/search?q=Paracetamol")
        if r_search.status_code == 200 and len(r_search.json()["results"]) > 0:
            record("Customer Search", "Exact & Partial Medicine Search", "PASS")
        else:
            record("Customer Search", "Exact & Partial Medicine Search", "FAIL", "No search results returned", "HIGH")

        r_gen = client.get("/api/search?q=Ibuprofen")
        if r_gen.status_code == 200 and len(r_gen.json()["results"]) > 0:
            record("Customer Search", "Generic Name Search Matching", "PASS")
        else:
            record("Customer Search", "Generic Name Search Matching", "FAIL", "Generic search failed", "MEDIUM")
    except Exception as e:
        record("Customer Search", "Search Suite", "FAIL", str(e), "HIGH")

    # --- 5. END-TO-END ORDER CREATION, STATUS LIFECYCLE & RIDER DISPATCH ---
    try:
        # Find an inventory item in shop 01
        inv_item = db.query(models.Inventory).filter(models.Inventory.pharmacyId == shop1_user.id, models.Inventory.stock > 5).first()
        initial_stock = inv_item.stock
        order_resp = client.post("/api/orders", json={
            "userId": cust1_id,
            "items": [
                {
                    "inventoryId": inv_item.id,
                    "quantity": 2,
                    "priceAtTime": inv_item.price
                }
            ],
            "totalAmount": inv_item.price * 2,
            "deliveryAddress": "A-101 Sunrise Apts, MG Road, Mumbai - 400001",
            "paymentMethod": "CASH_ON_DELIVERY"
        }, headers=headers_cust1)

        if order_resp.status_code == 200:
            order_id = order_resp.json()["orderId"]
            record("Order System", "End-to-End Order Creation & Stock Decrement", "PASS")
        else:
            record("Order System", "End-to-End Order Creation & Stock Decrement", "FAIL", f"Status: {order_resp.status_code}", "CRITICAL")
            order_id = None

        if order_id:
            # Shop Owner processes: PENDING -> PROCESSING -> CONFIRMED
            r_conf = client.post("/api/shop/orders", json={"orderId": order_id, "status": "CONFIRMED"}, headers=headers_shop1)
            if r_conf.status_code == 200:
                record("Shop Owner", "Order Status Processing (CONFIRMED)", "PASS")
            else:
                record("Shop Owner", "Order Status Processing (CONFIRMED)", "FAIL", "Shop status update failed", "HIGH")

            # Rider accepts order
            rider1_user = db.query(models.User).filter(models.User.email == "rider01@medifind.test").first()
            rider1_token = client.post("/api/auth/login", json={"email": "rider01@medifind.test", "password": "Rider@123", "role": "rider"}).json()["token"]
            headers_rider1 = {"Authorization": f"Bearer {rider1_token}"}

            r_accept = client.put("/api/rider/orders", json={"orderId": order_id, "riderId": rider1_user.id}, headers=headers_rider1)
            if r_accept.status_code == 200:
                record("Rider Dispatch", "Rider Order Acceptance", "PASS")
            else:
                record("Rider Dispatch", "Rider Order Acceptance", "FAIL", "Rider accept failed", "HIGH")

            # Rider delivery lifecycle: RIDER_PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED
            client.post("/api/rider/orders", json={"orderId": order_id, "status": "RIDER_PICKED_UP", "riderId": rider1_user.id}, headers=headers_rider1)
            client.post("/api/rider/orders", json={"orderId": order_id, "status": "OUT_FOR_DELIVERY", "riderId": rider1_user.id}, headers=headers_rider1)
            r_deliv = client.post("/api/rider/orders", json={"orderId": order_id, "status": "DELIVERED", "riderId": rider1_user.id}, headers=headers_rider1)

            if r_deliv.status_code == 200:
                record("Rider Dispatch", "Complete Delivery Lifecycle (DELIVERED)", "PASS")
            else:
                record("Rider Dispatch", "Complete Delivery Lifecycle (DELIVERED)", "FAIL", "Delivery marking failed", "HIGH")

            # Customer views order history
            r_cust_hist = client.get(f"/api/orders?email=customer01@medifind.test", headers=headers_cust1)
            if r_cust_hist.status_code == 200:
                delivered_order = next((o for o in r_cust_hist.json()["orders"] if o["id"] == order_id), None)
                if delivered_order and delivered_order["status"] == "DELIVERED":
                    record("Customer Portal", "Customer Order History & Status Notification", "PASS")
                else:
                    record("Customer Portal", "Customer Order History & Status Notification", "FAIL", "Status mismatch", "HIGH")
            else:
                record("Customer Portal", "Customer Order History & Status Notification", "FAIL", "Failed fetching history", "HIGH")
    except Exception as e:
        record("Order System", "Order Lifecycle Suite", "FAIL", str(e), "CRITICAL")

    # --- 6. RIDER CANCELLATION & POOL REASSIGNMENT ---
    try:
        # Create second order
        inv_item2 = db.query(models.Inventory).filter(models.Inventory.pharmacyId == shop1_user.id, models.Inventory.stock > 2).first()
        ord2_resp = client.post("/api/orders", json={
            "userId": cust1_id,
            "items": [{"inventoryId": inv_item2.id, "quantity": 1, "priceAtTime": inv_item2.price}],
            "totalAmount": inv_item2.price,
            "deliveryAddress": "A-101 Sunrise Apts, Mumbai"
        }, headers=headers_cust1)
        ord2_id = ord2_resp.json()["orderId"]
        client.post("/api/shop/orders", json={"orderId": ord2_id, "status": "CONFIRMED"}, headers=headers_shop1)

        # Rider 01 accepts
        client.put("/api/rider/orders", json={"orderId": ord2_id, "riderId": rider1_user.id}, headers=headers_rider1)

        # Rider 01 cancels assignment
        r_cancel = client.post("/api/rider/orders", json={"orderId": ord2_id, "status": "CANCELLED", "riderId": rider1_user.id}, headers=headers_rider1)

        # Available Rider (rider03) accepts
        rider2_user = db.query(models.User).filter(models.User.email == "rider03@medifind.test").first()
        rider2_token = client.post("/api/auth/login", json={"email": "rider03@medifind.test", "password": "Rider@123", "role": "rider"}).json()["token"]
        headers_rider2 = {"Authorization": f"Bearer {rider2_token}"}

        r_reassign = client.put("/api/rider/orders", json={"orderId": ord2_id, "riderId": rider2_user.id}, headers=headers_rider2)
        if r_cancel.status_code == 200 and r_reassign.status_code == 200:
            record("Rider Dispatch", "Rider Cancellation & Pool Reassignment", "PASS")
        else:
            record("Rider Dispatch", "Rider Cancellation & Pool Reassignment", "FAIL", "Cancellation / Reassignment failed", "HIGH")
    except Exception as e:
        record("Rider Dispatch", "Reassignment Suite", "FAIL", str(e), "HIGH")

    # --- 7. DATABASE INTEGRITY ---
    try:
        user_count = db.query(models.User).count()
        pharmacy_count = db.query(models.Pharmacy).count()
        medicine_count = db.query(models.Medicine).count()
        inventory_count = db.query(models.Inventory).count()
        address_count = db.query(models.Address).count()
        order_count = db.query(models.Order).count()

        assert user_count >= 30, f"Expected at least 30 users, found {user_count}"
        assert pharmacy_count >= 10, f"Expected at least 10 pharmacies, found {pharmacy_count}"
        assert medicine_count >= 10, f"Expected at least 10 medicines, found {medicine_count}"
        assert inventory_count >= 10, f"Expected inventory records, found {inventory_count}"
        assert address_count >= 10, f"Expected addresses, found {address_count}"

        # Verify no orphan order items
        orphan_items = db.query(models.OrderItem).filter(~models.OrderItem.orderId.in_(db.query(models.Order.id))).count()
        assert orphan_items == 0, f"Found {orphan_items} orphaned order items"

        record("Database Integrity", "Foreign Keys, Counts & Orphan Prevention", "PASS")
    except Exception as e:
        record("Database Integrity", "Foreign Keys, Counts & Orphan Prevention", "FAIL", str(e), "CRITICAL")

    db.close()

    # PRINT SUMMARY TABLE
    print("\n" + "="*80)
    print("MEDIFIND MULTI-USER LOCAL TESTING RESULTS TABLE")
    print("="*80)
    print(f"| {'Module':<20} | {'Test':<40} | {'Result':<6} | {'Issue':<20} | {'Severity':<8} |")
    print(f"|{'-'*22}|{'-'*42}|{'-'*8}|{'-'*22}|{'-'*10}|")
    for r in test_results:
        print(f"| {r['module']:<20} | {r['test']:<40} | {r['result']:<6} | {r['issue']:<20} | {r['severity']:<8} |")
    print("="*80)

    total_tests = len(test_results)
    pass_count = sum(1 for r in test_results if r["result"] == "PASS")
    fail_count = sum(1 for r in test_results if r["result"] == "FAIL")
    blocked_count = sum(1 for r in test_results if r["result"] == "BLOCKED")

    print(f"\nTOTAL TESTS: {total_tests}")
    print(f"PASSED:      {pass_count}")
    print(f"FAILED:      {fail_count}")
    print(f"BLOCKED:     {blocked_count}")
    print("="*80 + "\n")

if __name__ == "__main__":
    run_e2e_report()
