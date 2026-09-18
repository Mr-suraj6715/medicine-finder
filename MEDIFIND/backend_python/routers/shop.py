from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from database import get_db
import models, schemas, auth
import n8n_service

router = APIRouter(prefix="/api/shop", tags=["shop"])

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
    if current_user.role != "shop_owner":
        raise HTTPException(status_code=403, detail="Forbidden: Only shop owners can view available riders")
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

@router.post("/reassign")
def reassign_rider(req: schemas.ShopReassign, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "shop_owner":
        raise HTTPException(status_code=403, detail="Forbidden: Only shop owners can reassign riders")
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
