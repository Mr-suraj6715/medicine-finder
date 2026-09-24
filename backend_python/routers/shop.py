from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from database import get_db
import models, schemas, auth
import n8n_service

router = APIRouter(prefix="/api/shop", tags=["shop"])

# Statuses that mean a rider is actively busy (cannot be reassigned another order)
RIDER_BUSY_STATUSES = {
    "PENDING_RIDER_ACCEPT",
    "RIDER_ASSIGNED",
    "RIDER_AT_PHARMACY",
    "RIDER_PICKED_UP",
    "OUT_FOR_DELIVERY",
    "REACHED_CUSTOMER",
}

@router.get("/settings")
def get_shop_settings(pharmacyId: str = Query(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "shop_owner":
        raise HTTPException(status_code=403, detail="Forbidden: Only shop owners can access settings")
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

@router.post("/settings")
def update_shop_settings(req: schemas.ShopSettingsUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "shop_owner":
        raise HTTPException(status_code=403, detail="Forbidden: Only shop owners can update settings")
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

@router.get("/reassign")
def get_available_riders(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Return all riders with availability status. Riders who have an active delivery are marked busy."""
    if current_user.role != "shop_owner":
        raise HTTPException(status_code=403, detail="Forbidden: Only shop owners can view available riders")

    riders = db.query(models.User).filter(models.User.role == "rider").all()

    # Find rider IDs that currently have active/pending deliveries
    busy_rider_ids = set()
    busy_orders = db.query(models.Order.riderId).filter(
        models.Order.riderId != None,
        models.Order.status.in_(list(RIDER_BUSY_STATUSES))
    ).all()
    busy_rider_ids = {row[0] for row in busy_orders}

    return {
        "riders": [
            {
                "id": r.id,
                "name": r.name or r.email,
                "email": r.email,
                "phone": r.phone or "",
                "vehicleType": r.vehicleType or "Motorcycle",
                "riderRating": r.riderRating or 3.0,
                "completedDeliveries": r.completedDeliveries or 0,
                "cancelledDeliveries": r.cancelledDeliveries or 0,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "isAvailable": r.id not in busy_rider_ids,
                "isBusy": r.id in busy_rider_ids,
            }
            for r in riders
        ]
    }

@router.post("/reassign")
def reassign_rider(req: schemas.ShopReassign, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Shopkeeper assigns an order to a specific rider.
    Sets status to PENDING_RIDER_ACCEPT so the rider must explicitly accept/reject.
    """
    if current_user.role != "shop_owner":
        raise HTTPException(status_code=403, detail="Forbidden: Only shop owners can assign riders")

    order = db.query(models.Order).filter(models.Order.id == req.orderId).first()
    rider = db.query(models.User).filter(models.User.id == req.riderId, models.User.role == "rider").first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    # Prevent assigning an already delivered/cancelled order
    if order.status in ("DELIVERED", "CANCELLED", "FAILED"):
        raise HTTPException(status_code=400, detail=f"Cannot assign: order is already {order.status}")

    # Prevent re-assigning if rider is currently busy with another active delivery
    busy_order = db.query(models.Order).filter(
        models.Order.riderId == req.riderId,
        models.Order.status.in_(list(RIDER_BUSY_STATUSES))
    ).first()
    if busy_order and busy_order.id != order.id:
        raise HTTPException(status_code=409, detail=f"Rider is currently busy with order {busy_order.id[:8]}... — please choose another rider.")

    # If this order was previously assigned to a different rider, release them first
    if order.riderId and order.riderId != req.riderId:
        order.cancelledRiderId = order.riderId

    earnings_factor = 1.0 if rider.riderRating >= 4.0 else (0.5 if rider.riderRating >= 3.0 else 0.0)
    order.riderId = req.riderId
    # Use PENDING_RIDER_ACCEPT so the rider sees and can accept/reject
    order.status = "PENDING_RIDER_ACCEPT"
    order.driverEarnings = (order.surgeFee * earnings_factor) if order.isEmergency else 0.0

    db.commit()
    return {"success": True, "message": f"Assignment sent to {rider.name or rider.email}. Awaiting rider acceptance."}

@router.get("/orders")
def get_shop_orders(pharmacyId: str = Query(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "shop_owner":
        raise HTTPException(status_code=403, detail="Forbidden: Only shop owners can access orders")

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

    # Use pharmacy-specific items if they exist, otherwise fall back to all
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
                "customerPhone": o.user.phone or "" if o.user else "",
                "customerAddress": o.deliveryAddress or "Mumbai, MH",
                "items": [],
                "total": o.totalAmount or 0.0,
                "status": o.status or "PENDING",
                "paymentMethod": o.paymentMethod or "CASH_ON_DELIVERY",
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
    # Sort: newest first (PENDING at top, then by createdAt desc)
    def sort_key(o):
        status_priority = {"PENDING": 0, "PROCESSING": 1, "CONFIRMED": 2, "PENDING_RIDER_ACCEPT": 3}.get(o["status"], 10)
        return (status_priority, -(len(str(o.get("createdAt", ""))) and hash(str(o.get("createdAt", "")))) or 0)

    orders_list.sort(key=lambda x: str(x.get("createdAt", "")), reverse=True)

    for o in orders_list:
        if o["cancelledRiderId"]:
            c_rider = db.query(models.User).filter(models.User.id == o["cancelledRiderId"]).first()
            if c_rider:
                o["cancelledRiderName"] = c_rider.name or c_rider.email

    return {"orders": orders_list}

@router.post("/orders")
def update_shop_order_status(req: schemas.OrderStatusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "shop_owner":
        raise HTTPException(status_code=403, detail="Forbidden: Only shop owners can update order status")
    order = db.query(models.Order).filter(models.Order.id == req.orderId).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    previous_status = order.status
    order.status = req.status
    if req.status == "DELIVERED" and order.riderId:
        actual_count = db.query(models.Order).filter(models.Order.riderId == order.riderId, models.Order.status == "DELIVERED").count()
        rider = db.query(models.User).filter(models.User.id == order.riderId).first()
        if rider:
            rider.completedDeliveries = actual_count

    # Fetch user and pharmacy info for n8n payload
    order_user = db.query(models.User).filter(models.User.id == order.userId).first()
    pharmacy = None
    if order.items and order.items[0].inventory and order.items[0].inventory.pharmacy:
        pharmacy = order.items[0].inventory.pharmacy

    db.commit()

    # ── Fire n8n webhook ───────────────────────────────────────────────
    rider_obj = db.query(models.User).filter(models.User.id == order.riderId).first() if order.riderId else None
    n8n_service.emit_order_status_changed(
        order_id=order.id,
        tracking_number=order.trackingNumber,
        previous_status=previous_status,
        new_status=req.status,
        user_email=order_user.email if order_user else None,
        user_name=order_user.name if order_user else None,
        rider_email=rider_obj.email if rider_obj else None,
        rider_name=rider_obj.name if rider_obj else None,
        pharmacy_name=pharmacy.name if pharmacy else None,
        delivery_address=order.deliveryAddress,
    )
    # ─────────────────────────────────────────────────────

    return {"success": True, "status": order.status}
