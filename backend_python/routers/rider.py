from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, desc
from database import get_db
import models, schemas, auth
from utils import generate_cuid, current_iso_time
import n8n_service

router = APIRouter(prefix="/api/rider", tags=["rider"])

# Active statuses where a rider is considered "busy"
ACTIVE_STATUSES = ["PENDING_RIDER_ACCEPT", "RIDER_ASSIGNED", "RIDER_AT_PHARMACY", "RIDER_PICKED_UP", "OUT_FOR_DELIVERY", "REACHED_CUSTOMER"]

@router.get("/profile")
def get_rider_profile(userId: str = Query(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "rider" or current_user.id != userId:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot access this rider profile")
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

@router.post("/profile")
def update_rider_profile(req: schemas.RiderProfileUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "rider" or current_user.id != req.userId:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot update this rider profile")
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

@router.get("/orders")
def get_rider_orders(riderId: str = Query(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "rider" or current_user.id != riderId:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot view orders for this rider")

    # Fetch:
    # 1. Orders CONFIRMED with no rider (open pool — available to all riders)
    # 2. Orders with PENDING_RIDER_ACCEPT assigned to THIS rider (shopkeeper direct-assigned, needs accept/reject)
    # 3. Orders actively assigned to THIS rider (all non-pool active/completed)
    orders = db.query(models.Order).options(
        joinedload(models.Order.user),
        joinedload(models.Order.items).joinedload(models.OrderItem.inventory).joinedload(models.Inventory.medicine),
        joinedload(models.Order.items).joinedload(models.OrderItem.inventory).joinedload(models.Inventory.pharmacy)
    ).filter(
        or_(
            # Open pool: confirmed orders with no rider assigned
            and_(models.Order.status == "CONFIRMED", models.Order.riderId == None),
            # Shopkeeper-assigned to this rider, awaiting acceptance
            and_(models.Order.status == "PENDING_RIDER_ACCEPT", models.Order.riderId == riderId),
            # Actively assigned to this rider (any other status)
            and_(models.Order.riderId == riderId, models.Order.status != "PENDING_RIDER_ACCEPT")
        )
    ).order_by(desc(models.Order.isEmergency), desc(models.Order.createdAt)).all()

    def build_order_map(o):
        pharmacy = o.items[0].inventory.pharmacy if o.items and o.items[0].inventory else None
        return {
            "id": o.trackingNumber or o.id,
            "realId": o.id,
            "customer": o.user.name or o.user.email if o.user else "Customer",
            "customerPhone": o.user.phone or "" if o.user else "",
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
            "pharmacyPhone": pharmacy.phone if pharmacy else "",
            "pharmacyCoord": {"lat": pharmacy.latitude or 19.076, "lng": pharmacy.longitude or 72.877} if pharmacy else {"lat": 19.076, "lng": 72.877},
            "distance": pharmacy.distance if pharmacy else 1.0,
            "paymentMethod": o.paymentMethod or "CASH_ON_DELIVERY",
            "items": [
                {"name": i.inventory.medicine.name if (i.inventory and i.inventory.medicine) else "Medicine",
                 "qty": i.quantity, "price": i.priceAtTime}
                for i in o.items
            ],
            "time": str(o.createdAt)[:16] if o.createdAt else "",
            "deliveryStartTime": o.deliveryStartTime,
            "deliveryEndTime": o.deliveryEndTime,
            "deliveryDuration": o.deliveryDurationMinutes,
            "deliveryDistance": o.deliveryDistance,
            "ratingEarned": o.ratingEarned,
            "pointsChange": o.loyaltyPointsChange
        }

    mapped_orders = [build_order_map(o) for o in orders]

    rider = db.query(models.User).filter(models.User.id == riderId).first()
    actual_delivered = db.query(models.Order).filter(
        models.Order.riderId == riderId, models.Order.status == "DELIVERED"
    ).count()
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

@router.post("/orders")
def update_rider_order_status(req: schemas.OrderStatusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "rider":
        raise HTTPException(status_code=403, detail="Forbidden: Only riders can update order status")

    target_order_id = (req.orderId or "").strip()
    order = db.query(models.Order).filter(
        or_(models.Order.id == target_order_id, models.Order.trackingNumber == target_order_id)
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    effective_rider_id = req.riderId or order.riderId
    if effective_rider_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot update status of order assigned to another rider")

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
        return {"success": True, "status": "CONFIRMED", "message": "Order released by rider. Shopkeeper can reassign."}

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
                actual_count = db.query(models.Order).filter(
                    models.Order.riderId == effective_rider_id, models.Order.status == "DELIVERED"
                ).count()
                rider.completedDeliveries = actual_count + 1

    # Fetch order user info for n8n payload (before commit)
    order_user = db.query(models.User).filter(models.User.id == order.userId).first()

    db.commit()

    # ── Fire n8n webhooks ────────────────────────────────────────────
    n8n_service.emit_order_status_changed(
        order_id=order.id,
        tracking_number=order.trackingNumber,
        previous_status=previous_status,
        new_status=req.status,
        user_email=order_user.email if order_user else None,
        user_name=order_user.name if order_user else None,
        rider_email=current_user.email,
        rider_name=current_user.name,
        delivery_address=order.deliveryAddress,
    )
    if req.status == "DELIVERED":
        n8n_service.emit_rider_delivered(
            order_id=order.id,
            tracking_number=order.trackingNumber,
            rider_id=effective_rider_id,
            rider_name=current_user.name,
            user_email=order_user.email if order_user else None,
            user_name=order_user.name if order_user else None,
            total_amount=order.totalAmount,
            loyalty_earned=order.loyaltyEarned,
        )
    # ────────────────────────────────────────────────

    return {"success": True, "status": order.status}

@router.put("/orders")
def accept_or_reject_order(req: schemas.RiderAcceptOrder, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Rider accepts an order (from open pool OR from shopkeeper-direct-assign).
    Sets status: CONFIRMED/PENDING_RIDER_ACCEPT → RIDER_ASSIGNED.
    """
    if current_user.role != "rider" or current_user.id != req.riderId:
        raise HTTPException(status_code=403, detail="Forbidden: Rider ID mismatch")

    target_order_id = (req.orderId or "").strip()
    rider = db.query(models.User).filter(models.User.id == req.riderId).first()
    order = db.query(models.Order).filter(
        or_(models.Order.id == target_order_id, models.Order.trackingNumber == target_order_id)
    ).first()
    if not rider or not order:
        raise HTTPException(status_code=404, detail="Rider or Order not found")

    # If already assigned to this rider, return success idempotently
    if order.riderId == req.riderId and order.status == "RIDER_ASSIGNED":
        return {"success": True, "status": "RIDER_ASSIGNED", "message": "Order is active! Head to the pharmacy."}

    # Ensure this rider is allowed to accept
    if order.status == "PENDING_RIDER_ACCEPT" and order.riderId != req.riderId:
        raise HTTPException(status_code=403, detail="This order is assigned to a different rider")

    if order.status not in ("CONFIRMED", "PENDING_RIDER_ACCEPT", "RIDER_ASSIGNED"):
        raise HTTPException(status_code=400, detail=f"Order cannot be accepted in status: {order.status}")

    # Check rider isn't already busy with another active order
    busy_order = db.query(models.Order).filter(
        models.Order.riderId == req.riderId,
        models.Order.status.in_(["RIDER_ASSIGNED", "RIDER_AT_PHARMACY", "RIDER_PICKED_UP", "OUT_FOR_DELIVERY", "REACHED_CUSTOMER"]),
        models.Order.id != order.id
    ).first()
    if busy_order:
        raise HTTPException(status_code=409, detail="You already have an active delivery in progress. Complete it first.")

    earnings_factor = 1.0 if rider.riderRating >= 4.0 else (0.5 if rider.riderRating >= 3.0 else 0.0)
    driver_earnings = (order.surgeFee * earnings_factor) if order.isEmergency else 0.0

    order.riderId = req.riderId
    order.status = "RIDER_ASSIGNED"
    order.driverEarnings = driver_earnings

    # Fetch order user info for n8n payload (before commit)
    order_user = db.query(models.User).filter(models.User.id == order.userId).first()
    pharmacy = None
    if order.items and order.items[0].inventory and order.items[0].inventory.pharmacy:
        pharmacy = order.items[0].inventory.pharmacy

    db.commit()

    # ── Fire n8n rider.assigned event ────────────────────────────
    n8n_service.emit_rider_assigned(
        order_id=order.id,
        tracking_number=order.trackingNumber,
        rider_id=req.riderId,
        rider_email=rider.email,
        rider_name=rider.name,
        user_email=order_user.email if order_user else None,
        user_name=order_user.name if order_user else None,
        pharmacy_name=pharmacy.name if pharmacy else None,
        delivery_address=order.deliveryAddress,
    )
    # ──────────────────────────────────────────────────────

    return {"success": True, "status": order.status, "message": "Order accepted! Head to the pharmacy."}

@router.delete("/orders")
def reject_assigned_order(req: schemas.RiderAcceptOrder, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Rider rejects a shopkeeper-assigned order (PENDING_RIDER_ACCEPT / RIDER_ASSIGNED → CONFIRMED + riderId=None).
    The order becomes re-assignable by the shopkeeper.
    """
    if current_user.role != "rider" or current_user.id != req.riderId:
        raise HTTPException(status_code=403, detail="Forbidden: Rider ID mismatch")

    target_order_id = (req.orderId or "").strip()
    order = db.query(models.Order).filter(
        or_(models.Order.id == target_order_id, models.Order.trackingNumber == target_order_id)
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in ("PENDING_RIDER_ACCEPT", "RIDER_ASSIGNED"):
        raise HTTPException(status_code=400, detail="Only pending or newly assigned orders can be released")

    if order.riderId != req.riderId:
        raise HTTPException(status_code=403, detail="This order was not assigned to you")

    # Release the order back to CONFIRMED (shopkeeper can assign another rider)
    order.cancelledRiderId = order.riderId
    order.riderId = None
    order.status = "CONFIRMED"

    # Mild penalty for rejecting a direct assignment
    rider = db.query(models.User).filter(models.User.id == req.riderId).first()
    if rider:
        rider.cancelledDeliveries += 1

    db.commit()
    return {"success": True, "status": "CONFIRMED", "message": "Order released. Shopkeeper can reassign."}

@router.patch("/orders")
def update_rider_location(req: schemas.RiderLocationUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "rider" or current_user.id != req.riderId:
        raise HTTPException(status_code=403, detail="Forbidden: Rider ID mismatch")

    rider = db.query(models.User).filter(models.User.id == req.riderId).first()
    if rider:
        rider.latitude = req.latitude
        rider.longitude = req.longitude
        db.commit()
    return {"success": True}
