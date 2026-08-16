import uuid
import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, desc

from database import engine, get_db, Base
import models, schemas

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MediFind Python Backend API",
    description="Python FastAPI REST Backend for Medifind Healthcare Logistics",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def generate_cuid():
    return "cmm" + uuid.uuid4().hex[:20]

def current_iso_time():
    return datetime.datetime.utcnow().isoformat() + "Z"

# --- 1. AUTH ENDPOINTS ---
@app.post("/api/auth/login")
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    user = db.query(models.User).filter(models.User.email == email).first()
    
    if email == "demo@medstore.com":
        if not user:
            user = models.User(id=generate_cuid(), email=email, name="Demo Customer", role="user", createdAt=current_iso_time())
            db.add(user)
            db.commit()
            db.refresh(user)
        return {"success": True, "user": {"id": user.id, "email": user.email, "name": user.name or "Demo Customer", "role": "user"}}
    
    if email == "shop@medstore.com":
        if not user:
            user = models.User(id=generate_cuid(), email=email, name="MediStore Pharmacy", role="shop_owner", createdAt=current_iso_time())
            db.add(user)
            db.commit()
            db.refresh(user)
        return {"success": True, "user": {"id": user.id, "email": user.email, "name": user.name or "MediStore Pharmacy", "role": "shop_owner"}}
    
    if email == "rider@medstore.com":
        if not user:
            user = models.User(id=generate_cuid(), email=email, name="Rider Partner", role="rider", createdAt=current_iso_time())
            db.add(user)
            db.commit()
            db.refresh(user)
        return {"success": True, "user": {"id": user.id, "email": user.email, "name": user.name or "Rider Partner", "role": "rider"}}

    if not user:
        user = models.User(id=generate_cuid(), email=email, name=email.split("@")[0].capitalize(), role=req.role or "user", createdAt=current_iso_time())
        db.add(user)
        db.commit()
        db.refresh(user)
    
    return {"success": True, "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}}

@app.post("/api/auth/signup")
def signup(req: schemas.SignupRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        return {"success": True, "user": {"id": existing.id, "email": existing.email, "name": existing.name, "role": existing.role}}
    
    user = models.User(id=generate_cuid(), name=req.name, email=email, role=req.role or "user", createdAt=current_iso_time())
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"success": True, "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}}

# --- 2. USER ADDRESS ENDPOINTS ---
@app.get("/api/user/address")
def get_user_addresses(userId: str = Query(...), db: Session = Depends(get_db)):
    addresses = db.query(models.Address).filter(models.Address.userId == userId).all()
    return {
        "addresses": [
            {
                "id": a.id,
                "label": a.label,
                "address": a.address,
                "latitude": a.latitude,
                "longitude": a.longitude,
                "userId": a.userId,
                "createdAt": a.createdAt
            }
            for a in addresses
        ]
    }

@app.post("/api/user/address")
def create_user_address(req: schemas.AddressCreate, db: Session = Depends(get_db)):
    addr = models.Address(
        id=generate_cuid(),
        userId=req.userId,
        label=req.label,
        address=req.address,
        latitude=19.076,
        longitude=72.877,
        createdAt=current_iso_time()
    )
    db.add(addr)
    db.commit()
    db.refresh(addr)
    return {"success": True, "address": {"id": addr.id, "label": addr.label, "address": addr.address}}

@app.delete("/api/user/address")
def delete_user_address(id: str = Query(...), db: Session = Depends(get_db)):
    addr = db.query(models.Address).filter(models.Address.id == id).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    db.delete(addr)
    db.commit()
    return {"success": True, "message": "Address deleted permanently"}

# --- 3. ORDERS ENDPOINTS ---
@app.get("/api/orders")
def get_user_orders(email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        return {"orders": []}

    orders = db.query(models.Order).options(
        joinedload(models.Order.items).joinedload(models.OrderItem.inventory).joinedload(models.Inventory.medicine),
        joinedload(models.Order.items).joinedload(models.OrderItem.inventory).joinedload(models.Inventory.pharmacy),
        joinedload(models.Order.rider)
    ).filter(models.Order.userId == user.id).order_by(desc(models.Order.createdAt)).all()

    mapped_orders = []
    for o in orders:
        pharmacy = o.items[0].inventory.pharmacy if o.items and o.items[0].inventory else None
        mapped_orders.append({
            "id": o.id,
            "realId": o.id,
            "trackingNumber": o.trackingNumber or o.id,
            "totalAmount": o.totalAmount or 0.0,
            "discountApplied": o.discountApplied or 0.0,
            "loyaltyEarned": o.loyaltyEarned or 0,
            "isEmergency": o.isEmergency or False,
            "surgeFee": o.surgeFee or 0.0,
            "status": o.status or "PENDING",
            "paymentMethod": o.paymentMethod or "CASH_ON_DELIVERY",
            "deliveryAddress": o.deliveryAddress or "",
            "createdAt": o.createdAt or "",
            "date": str(o.createdAt)[:16] if o.createdAt else "",
            "items": [
                {
                    "id": i.id,
                    "quantity": i.quantity or 1,
                    "qty": i.quantity or 1,
                    "priceAtTime": i.priceAtTime or 0.0,
                    "price": i.priceAtTime or 0.0,
                    "name": i.inventory.medicine.name if (i.inventory and i.inventory.medicine) else "Medicine",
                    "inventory": {
                        "id": i.inventory.id if i.inventory else "",
                        "price": i.inventory.price if i.inventory else 0.0,
                        "medicine": {
                            "id": i.inventory.medicine.id if (i.inventory and i.inventory.medicine) else "",
                            "name": i.inventory.medicine.name if (i.inventory and i.inventory.medicine) else "Medicine",
                            "description": i.inventory.medicine.description if (i.inventory and i.inventory.medicine) else ""
                        } if (i.inventory and i.inventory.medicine) else None,
                        "pharmacy": {
                            "id": i.inventory.pharmacy.id if (i.inventory and i.inventory.pharmacy) else "",
                            "name": i.inventory.pharmacy.name if (i.inventory and i.inventory.pharmacy) else "Pharmacy",
                            "phone": i.inventory.pharmacy.phone if (i.inventory and i.inventory.pharmacy) else "",
                            "location": i.inventory.pharmacy.location if (i.inventory and i.inventory.pharmacy) else ""
                        } if (i.inventory and i.inventory.pharmacy) else None
                    } if i.inventory else None
                }
                for i in o.items
            ],
            "pharmacy": {
                "name": pharmacy.name if pharmacy else "Local Pharmacy",
                "phone": pharmacy.phone if pharmacy else "N/A",
                "location": pharmacy.location if pharmacy else "Mumbai, MH"
            } if pharmacy else None,
            "rider": {
                "id": o.rider.id,
                "name": o.rider.name or o.rider.email,
                "email": o.rider.email,
                "phone": o.rider.phone or "N/A",
                "rating": o.rider.riderRating or 5.0,
                "riderRating": o.rider.riderRating or 5.0
            } if o.rider else None
        })

    return {"orders": mapped_orders}

@app.post("/api/orders")
def create_order(req: schemas.OrderCreate, db: Session = Depends(get_db)):
    tracking_num = f"MED-{uuid.uuid4().hex[:6].upper()}"
    new_order = models.Order(
        id=generate_cuid(),
        userId=req.userId,
        totalAmount=req.totalAmount,
        discountApplied=req.discountApplied or 0.0,
        loyaltyEarned=req.loyaltyEarned or 0,
        isEmergency=req.isEmergency or False,
        surgeFee=req.surgeFee or 0.0,
        paymentMethod=req.paymentMethod or "CASH_ON_DELIVERY",
        deliveryAddress=req.deliveryAddress,
        trackingNumber=tracking_num,
        status="PENDING",
        createdAt=current_iso_time()
    )
    db.add(new_order)
    db.flush()

    for item in req.items:
        order_item = models.OrderItem(
            id=generate_cuid(),
            orderId=new_order.id,
            inventoryId=item.inventoryId,
            quantity=item.quantity,
            priceAtTime=item.priceAtTime
        )
        db.add(order_item)
        inv = db.query(models.Inventory).filter(models.Inventory.id == item.inventoryId).first()
        if inv:
            inv.stock = max(0, inv.stock - item.quantity)
            inv.sold += item.quantity

    user = db.query(models.User).filter(models.User.id == req.userId).first()
    if user and req.loyaltyEarned:
        user.loyaltyPoints += req.loyaltyEarned

    db.commit()
    return {"success": True, "trackingNumber": tracking_num, "orderId": new_order.id}

@app.get("/api/orders/{id}")
def get_order_by_id(id: str, db: Session = Depends(get_db)):
    order = db.query(models.Order).options(
        joinedload(models.Order.items).joinedload(models.OrderItem.inventory).joinedload(models.Inventory.medicine),
        joinedload(models.Order.items).joinedload(models.OrderItem.inventory).joinedload(models.Inventory.pharmacy),
        joinedload(models.Order.rider)
    ).filter(models.Order.id == id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return {
        "order": {
            "id": order.id,
            "status": order.status,
            "totalAmount": order.totalAmount,
            "deliveryAddress": order.deliveryAddress,
            "trackingNumber": order.trackingNumber,
            "paymentMethod": order.paymentMethod,
            "isEmergency": order.isEmergency,
            "surgeFee": order.surgeFee,
            "rider": {
                "id": order.rider.id,
                "name": order.rider.name or order.rider.email,
                "phone": order.rider.phone,
                "email": order.rider.email,
                "rating": order.rider.riderRating
            } if order.rider else None,
            "items": [
                {
                    "id": i.id,
                    "quantity": i.quantity,
                    "priceAtTime": i.priceAtTime,
                    "inventory": {
                        "medicine": {
                            "name": i.inventory.medicine.name,
                            "category": i.inventory.medicine.category
                        },
                        "pharmacy": {
                            "name": i.inventory.pharmacy.name,
                            "phone": i.inventory.pharmacy.phone,
                            "location": i.inventory.pharmacy.location
                        }
                    }
                }
                for i in order.items
            ]
        }
    }

# --- 4. RIDER ENDPOINTS ---
@app.get("/api/rider/profile")
def get_rider_profile(userId: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == userId).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone or "",
            "address": user.address or "",
            "vehicleType": user.vehicleType or "Motorcycle",
            "riderRating": user.riderRating,
            "riderLoyaltyPoints": user.riderLoyaltyPoints,
            "completedDeliveries": user.completedDeliveries,
            "cancelledDeliveries": user.cancelledDeliveries,
            "role": user.role
        }
    }

@app.post("/api/rider/profile")
def update_rider_profile(req: schemas.RiderProfileUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == req.userId).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.name is not None and len(req.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters long")

    if req.name is not None: user.name = req.name.strip()
    if req.phone is not None: user.phone = req.phone.strip()
    if req.address is not None: user.address = req.address.strip()
    if req.vehicleType is not None: user.vehicleType = req.vehicleType.strip()

    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": "Profile updated successfully",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone or "",
            "address": user.address or "",
            "vehicleType": user.vehicleType or "Motorcycle",
            "riderRating": user.riderRating,
            "riderLoyaltyPoints": user.riderLoyaltyPoints,
            "completedDeliveries": user.completedDeliveries,
            "cancelledDeliveries": user.cancelledDeliveries,
            "role": user.role
        }
    }

@app.get("/api/rider/orders")
def get_rider_orders(riderId: str = Query(...), db: Session = Depends(get_db)):
    orders = db.query(models.Order).options(
        joinedload(models.Order.user),
        joinedload(models.Order.items).joinedload(models.OrderItem.inventory).joinedload(models.Inventory.medicine),
        joinedload(models.Order.items).joinedload(models.OrderItem.inventory).joinedload(models.Inventory.pharmacy)
    ).filter(
        or_(
            and_(models.Order.status == "CONFIRMED", models.Order.riderId == None),
            models.Order.riderId == riderId
        )
    ).order_by(desc(models.Order.isEmergency), desc(models.Order.createdAt)).all()

    mapped_orders = []
    for o in orders:
        pharmacy = o.items[0].inventory.pharmacy if o.items else None
        mapped_orders.append({
            "id": o.trackingNumber or o.id,
            "realId": o.id,
            "customer": o.user.name or o.user.email if o.user else "Customer",
            "customerAddress": o.deliveryAddress or "Mumbai, MH",
            "customerCoord": {"lat": o.deliveryLat or 19.082, "lng": o.deliveryLng or 72.881},
            "total": o.totalAmount,
            "status": o.status,
            "isEmergency": o.isEmergency,
            "surgeFee": o.surgeFee,
            "riderId": o.riderId,
            "cancelledRiderId": o.cancelledRiderId,
            "pharmacyName": pharmacy.name if pharmacy else "Local Pharmacy",
            "pharmacyAddress": pharmacy.location if pharmacy else "Mumbai, MH",
            "pharmacyCoord": {"lat": pharmacy.latitude or 19.076, "lng": pharmacy.longitude or 72.877} if pharmacy else {"lat": 19.076, "lng": 72.877},
            "distance": pharmacy.distance if pharmacy else 1.0,
            "items": [
                {"name": i.inventory.medicine.name, "qty": i.quantity, "price": i.priceAtTime}
                for i in o.items
            ],
            "time": str(o.createdAt)[:16] if o.createdAt else "",
            "deliveryStartTime": o.deliveryStartTime,
            "deliveryEndTime": o.deliveryEndTime,
            "deliveryDuration": o.deliveryDurationMinutes,
            "deliveryDistance": o.deliveryDistance,
            "ratingEarned": o.ratingEarned,
            "pointsChange": o.loyaltyPointsChange
        })

    rider = db.query(models.User).filter(models.User.id == riderId).first()
    actual_delivered = db.query(models.Order).filter(models.Order.riderId == riderId, models.Order.status == "DELIVERED").count()
    if rider and rider.completedDeliveries != actual_delivered:
        rider.completedDeliveries = actual_delivered
        db.commit()

    return {
        "orders": mapped_orders,
        "riderStats": {
            "rating": rider.riderRating if rider else 3.0,
            "loyaltyPoints": rider.riderLoyaltyPoints if rider else 0,
            "completedDeliveries": actual_delivered,
            "cancelledDeliveries": rider.cancelledDeliveries if rider else 0,
            "name": rider.name if rider else "",
            "email": rider.email if rider else "",
            "phone": rider.phone or "" if rider else "",
            "address": rider.address or "" if rider else "",
            "vehicleType": rider.vehicleType or "Motorcycle" if rider else "Motorcycle"
        } if rider else None
    }

@app.post("/api/rider/orders")
def update_rider_order_status(req: schemas.OrderStatusUpdate, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == req.orderId).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    effective_rider_id = req.riderId or order.riderId
    previous_status = order.status

    if previous_status == "DELIVERED" and req.status == "DELIVERED":
        return {"success": True, "status": "DELIVERED", "message": "Already marked delivered"}

    if req.status == "RIDER_PICKED_UP":
        order.deliveryStartTime = current_iso_time()

    if req.status == "CANCELLED":
        active_rider_id = order.riderId or effective_rider_id
        order.status = "CONFIRMED"
        order.riderId = None
        order.cancelledRiderId = active_rider_id

        if active_rider_id:
            rider = db.query(models.User).filter(models.User.id == active_rider_id).first()
            if rider:
                rider.riderRating = max(0.0, min(5.0, rider.riderRating - 0.2))
                rider.riderLoyaltyPoints = max(0, rider.riderLoyaltyPoints - 10)
                rider.cancelledDeliveries += 1

        db.commit()
        return {"success": True, "status": "CONFIRMED", "message": "Order cancelled by rider"}

    order.status = req.status
    order.riderId = effective_rider_id

    if effective_rider_id and (req.status in ["DELIVERED", "FAILED"]):
        rider = db.query(models.User).filter(models.User.id == effective_rider_id).first()
        if req.status == "DELIVERED" and previous_status != "DELIVERED":
            order.deliveryEndTime = current_iso_time()
            order_rating = 5.0
            order_points = 15
            if order.isEmergency: order_points += 10

            order.ratingEarned = order_rating
            order.loyaltyPointsChange = order_points

            if rider:
                rider.riderRating = max(0.0, min(5.0, rider.riderRating + 0.1))
                rider.riderLoyaltyPoints += order_points
                actual_count = db.query(models.Order).filter(models.Order.riderId == effective_rider_id, models.Order.status == "DELIVERED").count()
                rider.completedDeliveries = actual_count + 1

    db.commit()
    return {"success": True, "status": order.status}

@app.put("/api/rider/orders")
def accept_rider_order(req: schemas.RiderAcceptOrder, db: Session = Depends(get_db)):
    rider = db.query(models.User).filter(models.User.id == req.riderId).first()
    order = db.query(models.Order).filter(models.Order.id == req.orderId).first()
    if not rider or not order:
        raise HTTPException(status_code=404, detail="Rider or Order not found")

    earnings_factor = 1.0 if rider.riderRating >= 4.0 else (0.5 if rider.riderRating >= 3.0 else 0.0)
    driver_earnings = (order.surgeFee * earnings_factor) if order.isEmergency else 0.0

    order.riderId = req.riderId
    order.status = "RIDER_ASSIGNED"
    order.driverEarnings = driver_earnings

    db.commit()
    return {"success": True, "status": order.status}

@app.patch("/api/rider/orders")
def update_rider_location(req: schemas.RiderLocationUpdate, db: Session = Depends(get_db)):
    rider = db.query(models.User).filter(models.User.id == req.riderId).first()
    if rider:
        rider.latitude = req.latitude
        rider.longitude = req.longitude
        db.commit()
    return {"success": True}

# --- 5. SHOP SETTINGS & REASSIGN ENDPOINTS ---
@app.get("/api/shop/settings")
def get_shop_settings(pharmacyId: str = Query(...), db: Session = Depends(get_db)):
    pharmacy = db.query(models.Pharmacy).filter(models.Pharmacy.id == pharmacyId).first()
    if not pharmacy:
        pharmacy = db.query(models.Pharmacy).first()
    return {
        "pharmacy": {
            "id": pharmacy.id if pharmacy else None,
            "name": pharmacy.name if pharmacy else "",
            "location": pharmacy.location if pharmacy else "",
            "phone": pharmacy.phone if pharmacy else "",
            "openingTime": pharmacy.openingTime if pharmacy else "9:00 AM",
            "closingTime": pharmacy.closingTime if pharmacy else "9:00 PM",
            "isAvailable": pharmacy.isAvailable if pharmacy else True,
        } if pharmacy else None
    }

@app.post("/api/shop/settings")
def update_shop_settings(req: schemas.ShopSettingsUpdate, db: Session = Depends(get_db)):
    pharmacy = db.query(models.Pharmacy).filter(models.Pharmacy.id == req.pharmacyId).first()
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")

    if req.name is not None: pharmacy.name = req.name
    if req.location is not None: pharmacy.location = req.location
    if req.phone is not None: pharmacy.phone = req.phone
    if req.openingTime is not None: pharmacy.openingTime = req.openingTime
    if req.closingTime is not None: pharmacy.closingTime = req.closingTime
    if req.isAvailable is not None: pharmacy.isAvailable = req.isAvailable

    db.commit()
    db.refresh(pharmacy)
    return {
        "success": True,
        "pharmacy": {
            "id": pharmacy.id,
            "name": pharmacy.name,
            "location": pharmacy.location,
            "phone": pharmacy.phone,
            "openingTime": pharmacy.openingTime,
            "closingTime": pharmacy.closingTime,
            "isAvailable": pharmacy.isAvailable
        }
    }

@app.get("/api/shop/reassign")
def get_available_riders(db: Session = Depends(get_db)):
    riders = db.query(models.User).filter(models.User.role == "rider").all()
    return {
        "riders": [
            {
                "id": r.id,
                "name": r.name,
                "email": r.email,
                "phone": r.phone,
                "vehicleType": r.vehicleType,
                "riderRating": r.riderRating,
                "completedDeliveries": r.completedDeliveries,
                "cancelledDeliveries": r.cancelledDeliveries,
                "latitude": r.latitude,
                "longitude": r.longitude
            }
            for r in riders
        ]
    }

@app.post("/api/shop/reassign")
def reassign_rider(req: schemas.ShopReassign, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == req.orderId).first()
    rider = db.query(models.User).filter(models.User.id == req.riderId).first()
    if not order or not rider:
        raise HTTPException(status_code=404, detail="Order or Rider not found")

    earnings_factor = 1.0 if rider.riderRating >= 4.0 else (0.5 if rider.riderRating >= 3.0 else 0.0)
    order.riderId = req.riderId
    order.status = "RIDER_ASSIGNED"
    order.driverEarnings = (order.surgeFee * earnings_factor) if order.isEmergency else 0.0

    db.commit()
    return {"success": True, "message": f"Assigned to {rider.name or rider.email}"}

@app.get("/api/shop/orders")
def get_shop_orders(pharmacyId: str = Query(...), db: Session = Depends(get_db)):
    # 1. Fetch order items specifically for this pharmacy
    specific_items = db.query(models.OrderItem).options(
        joinedload(models.OrderItem.order).joinedload(models.Order.user),
        joinedload(models.OrderItem.order).joinedload(models.Order.rider),
        joinedload(models.OrderItem.inventory).joinedload(models.Inventory.medicine)
    ).filter(models.OrderItem.inventory.has(pharmacyId=pharmacyId)).all()

    # 2. Also fetch all recent orders across all pharmacies so no customer order is missed
    all_order_items = db.query(models.OrderItem).options(
        joinedload(models.OrderItem.order).joinedload(models.Order.user),
        joinedload(models.OrderItem.order).joinedload(models.Order.rider),
        joinedload(models.OrderItem.inventory).joinedload(models.Inventory.medicine)
    ).order_by(desc(models.OrderItem.id)).limit(100).all()

    # Use all orders if specific query has fewer, or combine
    combined_items = specific_items if len(specific_items) > 0 else all_order_items

    order_map = {}
    for item in combined_items:
        o = item.order
        if not o:
            continue
        if o.id not in order_map:
            order_map[o.id] = {
                "id": o.trackingNumber or o.id,
                "realId": o.id,
                "customer": o.user.name or o.user.email if o.user else "Customer",
                "customerEmail": o.user.email if o.user else "",
                "customerAddress": o.deliveryAddress or "Mumbai, MH",
                "items": [],
                "total": o.totalAmount or 0.0,
                "status": o.status or "PENDING",
                "isEmergency": o.isEmergency or False,
                "surgeFee": o.surgeFee or 0.0,
                "riderId": o.riderId,
                "riderName": o.rider.name or o.rider.email if o.rider else None,
                "riderPhone": o.rider.phone if o.rider else None,
                "riderRating": o.rider.riderRating if o.rider else None,
                "cancelledRiderId": o.cancelledRiderId,
                "cancelledRiderName": None,
                "time": str(o.createdAt)[:16] if o.createdAt else "",
                "createdAt": o.createdAt or ""
            }
        order_map[o.id]["items"].append({
            "name": item.inventory.medicine.name if (item.inventory and item.inventory.medicine) else "Medicine",
            "qty": item.quantity or 1,
            "price": item.priceAtTime or 0.0
        })

    orders_list = list(order_map.values())
    # Sort orders by most recent first
    orders_list.sort(key=lambda x: str(x.get("createdAt", "")), reverse=True)

    for o in orders_list:
        if o["cancelledRiderId"]:
            c_rider = db.query(models.User).filter(models.User.id == o["cancelledRiderId"]).first()
            if c_rider:
                o["cancelledRiderName"] = c_rider.name or c_rider.email

    return {"orders": orders_list}

@app.post("/api/shop/orders")
def update_shop_order_status(req: schemas.OrderStatusUpdate, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == req.orderId).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = req.status
    if req.status == "DELIVERED" and order.riderId:
        actual_count = db.query(models.Order).filter(models.Order.riderId == order.riderId, models.Order.status == "DELIVERED").count()
        rider = db.query(models.User).filter(models.User.id == order.riderId).first()
        if rider:
            rider.completedDeliveries = actual_count

    db.commit()
    return {"success": True, "status": order.status}

# --- 6. SHOP INVENTORY & SEARCH ENDPOINTS ---
@app.get("/api/shop/inventory")
def get_shop_inventory(pharmacyId: str = Query(...), db: Session = Depends(get_db)):
    inventory = db.query(models.Inventory).options(
        joinedload(models.Inventory.medicine)
    ).filter(models.Inventory.pharmacyId == pharmacyId).all()

    return {
        "inventory": [
            {
                "id": inv.id,
                "medicineId": inv.medicineId,
                "pharmacyId": inv.pharmacyId,
                "price": inv.price,
                "stock": inv.stock,
                "sold": inv.sold,
                "medicine": {
                    "id": inv.medicine.id,
                    "name": inv.medicine.name,
                    "category": inv.medicine.category
                }
            }
            for inv in inventory
        ]
    }

@app.post("/api/shop/inventory")
def update_shop_inventory(payload: dict, db: Session = Depends(get_db)):
    action = payload.get("action")
    pharmacy_id = payload.get("pharmacyId")

    if action == "add_medicine":
        med_name = payload.get("medicineName")
        category = payload.get("category")
        price = float(payload.get("price", 0))
        stock = int(payload.get("stock", 0))

        medicine = db.query(models.Medicine).filter(models.Medicine.name.ilike(f"%{med_name}%")).first()
        if not medicine:
            medicine = models.Medicine(id=generate_cuid(), name=med_name, category=category, createdAt=current_iso_time())
            db.add(medicine)
            db.flush()

        inv = models.Inventory(id=generate_cuid(), medicineId=medicine.id, pharmacyId=pharmacy_id, price=price, stock=stock, createdAt=current_iso_time())
        db.add(inv)
        db.commit()
        return {"success": True}

    elif action == "update_stock":
        med_id = payload.get("medicineId")
        inv = db.query(models.Inventory).filter(models.Inventory.medicineId == med_id, models.Inventory.pharmacyId == pharmacy_id).first()
        if inv:
            if "price" in payload and payload["price"] is not None: inv.price = float(payload["price"])
            if "stock" in payload and payload["stock"] is not None: inv.stock = int(payload["stock"])
            db.commit()
        return {"success": True}

    return {"error": "Invalid action"}

@app.get("/api/inventory/{medicineId}")
def get_inventory_by_medicine(medicineId: str, db: Session = Depends(get_db)):
    inventory = db.query(models.Inventory).options(
        joinedload(models.Inventory.pharmacy)
    ).filter(models.Inventory.medicineId == medicineId).all()

    return {
        "inventory": [
            {
                "id": inv.id,
                "medicineId": inv.medicineId,
                "pharmacyId": inv.pharmacyId,
                "price": inv.price,
                "stock": inv.stock,
                "pharmacy": {
                    "id": inv.pharmacy.id,
                    "name": inv.pharmacy.name,
                    "location": inv.pharmacy.location,
                    "latitude": inv.pharmacy.latitude,
                    "longitude": inv.pharmacy.longitude,
                    "rating": inv.pharmacy.rating,
                    "distance": inv.pharmacy.distance,
                    "phone": inv.pharmacy.phone,
                    "openingTime": inv.pharmacy.openingTime,
                    "closingTime": inv.pharmacy.closingTime,
                    "isAvailable": inv.pharmacy.isAvailable
                }
            }
            for inv in inventory
        ]
    }

@app.get("/api/search")
def search_medicines(q: str = Query(""), db: Session = Depends(get_db)):
    if not q:
        medicines = db.query(models.Medicine).all()
    else:
        medicines = db.query(models.Medicine).filter(
            or_(
                models.Medicine.name.ilike(f"%{q}%"),
                models.Medicine.category.ilike(f"%{q}%"),
                models.Medicine.indications.ilike(f"%{q}%")
            )
        ).all()

    return {
        "results": [
            {
                "id": m.id,
                "name": m.name,
                "description": m.description,
                "category": m.category,
                "indications": m.indications,
                "image": m.image
            }
            for m in medicines
        ]
    }

@app.get("/api/loyalty")
def get_loyalty(email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    return {"points": user.loyaltyPoints if user else 0}

@app.post("/api/ai-consultant")
def ai_consultant(req: schemas.AIConsultantRequest):
    symptoms = req.symptoms.lower()
    medicines = ["Paracetamol 500mg", "ORS Powder"]
    if "fever" in symptoms or "headache" in symptoms or "pain" in symptoms:
        medicines = ["Paracetamol 500mg", "Dolo 650"]
    elif "cough" in symptoms or "cold" in symptoms:
        medicines = ["Cetirizine 10mg", "Paracetamol 500mg"]
    elif "infection" in symptoms or "bacterial" in symptoms:
        medicines = ["Amoxicillin 250mg"]

    return {
        "advice": f"Based on your symptoms ({req.symptoms}), rest well, stay hydrated, and consult a doctor if symptoms persist.",
        "suggestedMedicines": medicines
    }

@app.get("/api/ai-prescribe")
def get_ai_prescribe(email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        return {"healthLogs": []}
    logs = db.query(models.HealthLog).filter(models.HealthLog.userId == user.id).order_by(desc(models.HealthLog.createdAt)).all()
    return {
        "healthLogs": [
            {
                "id": log.id,
                "symptoms": log.symptoms,
                "prescription": log.prescription,
                "createdAt": log.createdAt
            }
            for log in logs
        ]
    }

@app.post("/api/ai-prescribe")
def ai_prescribe(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email") or payload.get("userEmail")
    symptoms = payload.get("symptoms", "")
    meds = ["Paracetamol 500mg", "Amoxicillin 250mg"]
    instructions = "Take Paracetamol twice daily after meals. Amoxicillin once daily for 5 days."
    
    if email:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            new_log = models.HealthLog(
                id=generate_cuid(),
                userId=user.id,
                symptoms=symptoms or "General consultation",
                prescription=", ".join(meds),
                createdAt=current_iso_time()
            )
            db.add(new_log)
            db.commit()

    return {
        "extractedMedicines": meds,
        "instructions": instructions,
        "success": True
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
