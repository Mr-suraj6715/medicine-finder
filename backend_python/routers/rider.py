from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, desc
from database import get_db
import models, schemas, auth
from utils import generate_cuid, current_iso_time

router = APIRouter(prefix="/api/rider", tags=["rider"])

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

@router.post("/orders")
def update_rider_order_status(req: schemas.OrderStatusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "rider":
        raise HTTPException(status_code=403, detail="Forbidden: Only riders can update order status")
        
    order = db.query(models.Order).filter(models.Order.id == req.orderId).first()
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

@router.put("/orders")
def accept_rider_order(req: schemas.RiderAcceptOrder, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "rider" or current_user.id != req.riderId:
        raise HTTPException(status_code=403, detail="Forbidden: Rider ID mismatch")
        
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
