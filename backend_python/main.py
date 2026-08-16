import uuid
import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, desc

from database import engine, get_db, Base
import models, schemas
import hashlib

Base.metadata.create_all(bind=engine)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest() if password else ""

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
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    if user.password and req.password:
        if user.password != hash_password(req.password):
            from fastapi import HTTPException
            raise HTTPException(status_code=401, detail="Invalid email or password")
    elif not user.password:
        pass # Allow older users without password to login
    
    return {"success": True, "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}}

@app.post("/api/auth/signup")
def signup(req: schemas.SignupRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Email already in use")
    
    hashed_pw = hash_password(req.password) if req.password else None
    user = models.User(id=generate_cuid(), name=req.name, email=email, password=hashed_pw, role=req.role or "user", createdAt=current_iso_time())
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

    elif action == "delete_medicine":
        med_id = payload.get("medicineId")
        inv = db.query(models.Inventory).filter(models.Inventory.medicineId == med_id, models.Inventory.pharmacyId == pharmacy_id).first()
        if inv:
            db.delete(inv)
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
        medicines = db.query(models.Medicine).limit(50).all()
    else:
        medicines = db.query(models.Medicine).filter(
            or_(
                models.Medicine.name.ilike(f"%{q}%"),
                models.Medicine.category.ilike(f"%{q}%"),
                models.Medicine.indications.ilike(f"%{q}%")
            )
        ).limit(50).all()

    results = []
    for m in medicines:
        inv_list = db.query(models.Inventory).filter(
            models.Inventory.medicineId == m.id,
            models.Inventory.stock > 0
        ).all()
        min_price = min((i.price for i in inv_list), default=None)
        results.append({
            "id": m.id,
            "name": m.name,
            "description": m.description,
            "category": m.category,
            "indications": m.indications,
            "image": m.image,
            "inventory": [{"price": i.price, "stock": i.stock} for i in inv_list],
            "storeCount": len(inv_list),
            "startingPrice": min_price
        })

    return {"results": results}


@app.get("/api/loyalty")
def get_loyalty(email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    return {"points": user.loyaltyPoints if user else 0}

# ══════════════════════════════════════════════════════════════════════════════
# SAFE AI MEDICAL GUIDANCE SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

RED_FLAG_KEYWORDS = [
    "difficulty breathing","can't breathe","cannot breathe","shortness of breath",
    "chest pain","severe chest","heart attack","cardiac",
    "unconscious","fainted","collapse","loss of consciousness",
    "severe allergic","anaphylaxis","swollen throat","throat swelling",
    "very high fever","fever above 104","fever above 40","104 degree","40 degree",
    "seizure","convulsion","fits",
    "blood in vomit","vomiting blood","blood in stool","black stool",
    "severe abdominal pain","excruciating pain",
    "confusion","disoriented","not responsive",
    "stroke","facial drooping","arm weakness","slurred speech",
    "severe injury","head injury","fracture",
    "overdose","poisoning","swallowed something",
    "suicidal","self harm",
    "meningitis","stiff neck with fever",
    "severe dehydration","no urine","not urinating",
    "rapidly worsening","severe vomiting","can't keep anything down",
]

SYMPTOM_KNOWLEDGE = {
    "fever": {
        "label": "Mild Fever / Viral Symptoms",
        "description": "Mild fever is commonly associated with viral infections like the common cold or flu. Usually resolves in 3–5 days with rest and fluids.",
        "otc_keywords": ["paracetamol","dolo","calpol","ibuprofen","antipyretic"],
        "categories": ["Antipyretics","Analgesics"],
        "advice": "Stay hydrated, rest, and monitor temperature. Paracetamol reduces fever if uncomfortable.",
        "warning": "If fever persists >3 days, exceeds 39°C, or comes with rash/stiff neck, see a doctor.",
        "escalate_after_days": 3,
    },
    "headache": {
        "label": "Mild Headache",
        "description": "Mild headaches are caused by tension, dehydration, or stress. Most resolve with rest.",
        "otc_keywords": ["paracetamol","ibuprofen","aspirin","analgesic","dolo"],
        "categories": ["Analgesics"],
        "advice": "Rest in a quiet room, stay hydrated, and use a mild pain reliever.",
        "warning": "Seek immediate care for sudden severe headache, headache with fever and stiff neck, or post-injury headache.",
        "escalate_after_days": 2,
    },
    "cold": {
        "label": "Common Cold",
        "description": "Mild viral respiratory infection causing runny nose, sneezing, nasal congestion, mild sore throat, and low-grade fever.",
        "otc_keywords": ["cetirizine","loratadine","antihistamine","decongestant","cold","flu"],
        "categories": ["Respiratory","Analgesics","Antipyretics"],
        "advice": "Rest, drink warm fluids, and use saline nasal spray. Antihistamines relieve sneezing.",
        "warning": "See a doctor if symptoms worsen after 10 days or if you develop high fever or ear pain.",
        "escalate_after_days": 10,
    },
    "cough": {
        "label": "Cough (Dry or Productive)",
        "description": "Cough clears the airways. Dry cough is often throat irritation; productive cough may indicate a mild respiratory infection.",
        "otc_keywords": ["cough","bromhexine","expectorant","antitussive","respiratory"],
        "categories": ["Respiratory"],
        "advice": "Stay hydrated, use honey-lemon tea, avoid smoke. OTC cough syrups can help.",
        "warning": "See a doctor if cough lasts >3 weeks, has blood, chest pain, or breathing difficulty.",
        "escalate_after_days": 14,
    },
    "sore throat": {
        "label": "Sore Throat / Throat Irritation",
        "description": "Usually caused by viral infections or irritation. Most sore throats resolve in a few days.",
        "otc_keywords": ["throat","lozenges","antiseptic","gargle","analgesic"],
        "categories": ["Respiratory","Analgesics"],
        "advice": "Gargle with warm salt water, use throat lozenges, stay hydrated.",
        "warning": "Seek care for severe swallowing difficulty, high fever, or white patches on tonsils.",
        "escalate_after_days": 7,
    },
    "nasal congestion": {
        "label": "Nasal Congestion",
        "description": "Blocked nose usually from cold, allergies, or sinusitis.",
        "otc_keywords": ["nasal","decongestant","saline","antihistamine","cetirizine"],
        "categories": ["Respiratory"],
        "advice": "Use saline nasal spray. Decongestant sprays: max 3 consecutive days only.",
        "warning": "See doctor if congestion lasts >2 weeks or is accompanied by severe facial pain.",
        "escalate_after_days": 10,
    },
    "body ache": {
        "label": "Mild Body Ache / Muscle Pain",
        "description": "Body aches accompanying flu or overexertion.",
        "otc_keywords": ["paracetamol","ibuprofen","diclofenac","muscle","analgesic"],
        "categories": ["Analgesics"],
        "advice": "Rest, stay warm, and use mild pain relievers with food.",
        "warning": "Seek care for severe pain, muscle weakness, or pain after injury.",
        "escalate_after_days": 5,
    },
    "acidity": {
        "label": "Acidity / Heartburn / Indigestion",
        "description": "Caused by stomach acid reflux or indigestion after eating.",
        "otc_keywords": ["antacid","omeprazole","pantoprazole","gastrointestinal","digestive","acidity"],
        "categories": ["Gastrointestinal"],
        "advice": "Eat smaller meals, avoid spicy foods, don't lie down after eating. Antacids for quick relief.",
        "warning": "See a doctor for frequent heartburn, difficulty swallowing, or black stools.",
        "escalate_after_days": 7,
    },
    "allergy": {
        "label": "Mild Seasonal Allergy",
        "description": "Hay fever causing runny nose, sneezing, itchy eyes from pollen or environmental triggers.",
        "otc_keywords": ["cetirizine","loratadine","fexofenadine","antihistamine","allergy"],
        "categories": ["Respiratory"],
        "advice": "Avoid allergens, keep windows closed during high-pollen days, use antihistamines.",
        "warning": "Seek IMMEDIATE care for difficulty breathing, swelling of throat — may be anaphylaxis.",
        "escalate_after_days": 14,
    },
    "diarrhea": {
        "label": "Mild Diarrhea",
        "description": "Usually from food intolerance or minor infection. Resolves in 1–2 days with fluids.",
        "otc_keywords": ["ors","oral rehydration","loperamide","probiotics","electrolyte","gastrointestinal"],
        "categories": ["Gastrointestinal"],
        "advice": "Stay hydrated with ORS. Avoid dairy and fatty foods. BRAT diet recommended.",
        "warning": "Seek care for bloody diarrhea, severe dehydration signs, or diarrhea >2 days.",
        "escalate_after_days": 2,
    },
    "skin rash": {
        "label": "Minor Skin Rash / Irritation",
        "description": "Minor rashes from allergies, contact irritants, or dry skin.",
        "otc_keywords": ["calamine","hydrocortisone","antihistamine","cetirizine","dermatology"],
        "categories": ["Dermatology"],
        "advice": "Apply calamine lotion. Avoid scratching. Use fragrance-free soap.",
        "warning": "Seek IMMEDIATE care for rash with fever or breathing difficulty.",
        "escalate_after_days": 7,
    },
}

SAFETY_QUESTIONS = {
    "age": "How old is the patient? (Enter age in years)",
    "allergies": "Do you have any known drug allergies? (e.g., penicillin, aspirin, or 'none')",
    "pregnancy": "Are you pregnant or breastfeeding? (yes/no)",
    "conditions": "Do you have existing medical conditions? (e.g., diabetes, kidney issues, or 'none')",
}

PRESCRIPTION_KEYWORDS = [
    "amoxicillin","azithromycin","ciprofloxacin","metronidazole","doxycycline",
    "tramadol","codeine","morphine","prednisone","warfarin","insulin","metformin",
    "sertraline","fluoxetine","diazepam","alprazolam","clonazepam","antipsychotic",
]

def detect_red_flags(text: str) -> list:
    t = text.lower()
    return [f for f in RED_FLAG_KEYWORDS if f in t]

def identify_symptoms(text: str) -> list:
    t = text.lower()
    kw_map = {
        "fever":            ["fever","temperature","hot","pyrexia","chills","shivering"],
        "headache":         ["headache","head ache","head pain","migraine"],
        "cold":             ["cold","runny nose","sneezing","flu","viral","nasal discharge"],
        "cough":            ["cough","coughing","dry cough","productive cough"],
        "sore throat":      ["sore throat","throat pain","throat ache","swallowing pain"],
        "nasal congestion": ["nasal congestion","blocked nose","stuffy nose","congestion"],
        "body ache":        ["body ache","muscle pain","muscle ache","body pain","ache"],
        "acidity":          ["acidity","heartburn","indigestion","acid reflux","burning stomach","gas","bloating"],
        "allergy":          ["allergy","allergic","itchy eyes","hay fever","seasonal allergy"],
        "diarrhea":         ["diarrhea","loose motion","loose stool","watery stool"],
        "skin rash":        ["rash","itching","skin irritation","hives","urticaria"],
    }
    matched = []
    for cond, keywords in kw_map.items():
        if any(kw in t for kw in keywords):
            matched.append(cond)
    return matched

def is_prescription_med(name: str) -> bool:
    n = name.lower()
    return any(kw in n for kw in PRESCRIPTION_KEYWORDS)


@app.post("/api/ai-consultant")
def ai_consultant(req: schemas.AIConsultantRequest, db: Session = Depends(get_db)):
    symptoms_text = req.symptoms.strip()
    safety_info = getattr(req, "safetyInfo", None) or {}
    age = safety_info.get("age")
    allergies = safety_info.get("allergies", "")
    pregnancy = bool(safety_info.get("pregnancy", False))
    user_email = getattr(req, "userEmail", None)

    # 1. Red-flag detection
    red_flags = detect_red_flags(symptoms_text)
    if red_flags:
        return {
            "status": "RED_FLAG",
            "redFlags": red_flags[:3],
            "message": "⚠️ Your symptoms include warning signs that may require URGENT MEDICAL ATTENTION.",
            "advice": "Please do not attempt to self-treat these symptoms. Seek emergency care immediately.",
            "urgentAction": "Call emergency services (112) or visit the nearest emergency room NOW.",
            "showPharmacist": False,
            "showDoctor": True,
            "suggestedProducts": [],
            "conditions": [],
        }

    # 2. Safety info check
    missing = []
    if age is None: missing.append("age")
    if not allergies: missing.append("allergies")
    if missing:
        return {
            "status": "NEEDS_SAFETY_INFO",
            "missingFields": missing,
            "questions": {k: SAFETY_QUESTIONS[k] for k in missing},
            "message": "Before providing guidance, we need a few safety details.",
        }

    try: age_int = int(age)
    except: age_int = 25
    child_mode = age_int < 12
    elderly_mode = age_int >= 65

    # 3. Identify symptoms
    matched_conditions = identify_symptoms(symptoms_text)
    if not matched_conditions:
        return {
            "status": "NO_MATCH",
            "message": "I couldn't identify specific common symptoms from your description.",
            "advice": "Please describe symptoms more clearly (e.g., 'I have a fever and runny nose'). For complex symptoms, consult a doctor.",
            "showPharmacist": True,
            "showDoctor": True,
            "suggestedProducts": [],
            "conditions": [],
        }

    # 4. Build condition + inventory results
    condition_results = []
    all_products = []
    seen_ids = set()

    for cond_key in matched_conditions:
        cond = SYMPTOM_KNOWLEDGE.get(cond_key)
        if not cond:
            continue

        # Find OTC medicines from inventory
        cat_meds = db.query(models.Medicine).filter(
            models.Medicine.category.in_(cond["categories"])
        ).limit(20).all()

        name_meds = []
        for kw in cond["otc_keywords"][:3]:
            nm = db.query(models.Medicine).filter(
                models.Medicine.name.ilike(f"%{kw}%")
            ).limit(8).all()
            name_meds.extend(nm)

        candidates = {m.id: m for m in cat_meds + name_meds}
        products = []

        for med in candidates.values():
            if is_prescription_med(med.name): continue
            if len(products) >= 4: break

            inv_items = db.query(models.Inventory).options(
                joinedload(models.Inventory.pharmacy)
            ).filter(
                models.Inventory.medicineId == med.id,
                models.Inventory.stock > 0
            ).order_by(models.Inventory.price).limit(3).all()

            if not inv_items or med.id in seen_ids:
                continue
            seen_ids.add(med.id)

            # Safety warnings
            warns = []
            if allergies.lower() != "none":
                for allergen in ["aspirin","ibuprofen","penicillin"]:
                    if allergen in allergies.lower() and allergen in med.name.lower():
                        warns.append(f"⚠️ Possible allergen match: {allergen}. DO NOT use without pharmacist advice.")
            if pregnancy:
                for pk in ["ibuprofen","aspirin","codeine","naproxen"]:
                    if pk in med.name.lower():
                        warns.append(f"⚠️ {med.name} is NOT recommended during pregnancy. Consult your doctor.")
            if child_mode:
                for ck in ["aspirin","ibuprofen"]:
                    if ck in med.name.lower():
                        warns.append(f"⚠️ Not recommended for children under 12 without doctor advice.")

            pharmacies_avail = []
            for inv in inv_items:
                if inv.pharmacy:
                    pharmacies_avail.append({
                        "pharmacyName": inv.pharmacy.name,
                        "location": inv.pharmacy.location,
                        "price": round(inv.price, 2),
                        "stock": inv.stock,
                        "distance": inv.pharmacy.distance,
                        "rating": inv.pharmacy.rating,
                    })

            products.append({
                "medicineId": med.id,
                "name": med.name,
                "category": med.category,
                "otcStatus": "OTC",
                "indicatedFor": cond["label"],
                "generalUse": f"Used for relief of {cond['label'].lower()} symptoms.",
                "startingPrice": round(inv_items[0].price, 2),
                "availableIn": len(pharmacies_avail),
                "pharmacies": pharmacies_avail,
                "warnings": warns,
            })

        condition_results.append({
            "conditionKey": cond_key,
            "conditionLabel": cond["label"],
            "description": cond["description"],
            "selfCareAdvice": cond["advice"],
            "warning": cond["warning"],
            "escalateAfterDays": cond["escalate_after_days"],
            "productsFound": len(products),
        })
        all_products.extend(products)

    # 5. Log to health history
    if user_email:
        user = db.query(models.User).filter(models.User.email == user_email).first()
        if user:
            log = models.HealthLog(
                id=generate_cuid(), userId=user.id,
                symptoms=symptoms_text,
                prescription=", ".join([p["name"] for p in all_products[:5]]) or "General guidance only",
                createdAt=current_iso_time()
            )
            db.add(log); db.commit()

    extra_notes = []
    if child_mode: extra_notes.append("⚠️ Child under 12: Always confirm suitability with a pharmacist or doctor before giving any medicine.")
    if elderly_mode: extra_notes.append("ℹ️ Patients over 65 may need adjusted dosing. Consult your pharmacist.")
    if pregnancy: extra_notes.append("⚠️ Pregnant/breastfeeding: Always consult your doctor before taking any medicine.")

    return {
        "status": "OK",
        "symptomsReceived": symptoms_text,
        "conditionsIdentified": [c["conditionLabel"] for c in condition_results],
        "conditions": condition_results,
        "suggestedProducts": all_products[:10],
        "disclaimer": "ℹ️ This is general guidance only. Symptoms alone cannot confirm a diagnosis. Always read the product label. Consult a pharmacist or doctor if unsure.",
        "extraNotes": extra_notes,
        "showPharmacist": True,
        "showDoctor": len(matched_conditions) > 2 or child_mode or elderly_mode or pregnancy,
    }


@app.get("/api/ai-prescribe")
def get_ai_prescribe(email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user: return {"healthLogs": []}
    logs = db.query(models.HealthLog).filter(models.HealthLog.userId == user.id).order_by(desc(models.HealthLog.createdAt)).all()
    return {"healthLogs": [{"id": l.id, "symptoms": l.symptoms, "prescription": l.prescription, "createdAt": l.createdAt} for l in logs]}


@app.post("/api/ai-prescribe")
def ai_prescribe(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email") or payload.get("userEmail")
    symptoms = payload.get("symptoms", "")
    if email:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            db.add(models.HealthLog(id=generate_cuid(), userId=user.id, symptoms=symptoms or "General", prescription="General guidance only", createdAt=current_iso_time()))
            db.commit()
    return {"extractedMedicines": [], "instructions": "Consult your pharmacist for correct dosage.", "success": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
