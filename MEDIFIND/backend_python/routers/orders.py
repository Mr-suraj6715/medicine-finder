from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from database import get_db
import models, schemas, auth
from utils import generate_cuid, current_iso_time
import uuid

router = APIRouter(prefix="/api/orders", tags=["orders"])

@router.get("")
def get_user_orders(email: str = Query(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Harden server-side authorization check (Point 1)
    if email.lower().strip() != current_user.email.lower().strip():
        raise HTTPException(status_code=403, detail="Forbidden: Cannot view orders of another user")
    
    user = db.query(models.User).filter(models.User.email == email.lower().strip()).first()
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

@router.post("")
def create_order(req: schemas.OrderCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if req.userId != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot create order for another user")
        
    tracking_num = f"MED-{uuid.uuid4().hex[:6].upper()}"
    
    try:
        calculated_total = 0.0
        order_items_to_create = []
        
        for item in req.items:
            # Row lock on the inventory item to prevent race conditions in production
            query = db.query(models.Inventory).filter(models.Inventory.id == item.inventoryId)
            if db.bind.dialect.name != "sqlite":
                query = query.with_for_update()
            inv = query.first()
            if not inv:
                raise HTTPException(status_code=400, detail=f"Inventory item not found: {item.inventoryId}")
            
            if inv.stock < item.quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for medicine: {inv.medicine.name if inv.medicine else 'Medicine'}")
            
            calculated_total += inv.price * item.quantity
            inv.stock -= item.quantity
            inv.sold += item.quantity
            
            order_items_to_create.append(
                models.OrderItem(
                    id=generate_cuid(),
                    inventoryId=item.inventoryId,
                    quantity=item.quantity,
                    priceAtTime=inv.price
                )
            )
            
        discount = req.discountApplied or 0.0
        surge = req.surgeFee or 0.0
        final_amount = max(0.0, calculated_total - discount + surge)
        
        # Enforce server-side recalculated total
        req.totalAmount = final_amount
        
        new_order = models.Order(
            id=generate_cuid(),
            userId=req.userId,
            totalAmount=req.totalAmount,
            discountApplied=discount,
            loyaltyEarned=req.loyaltyEarned or 0,
            isEmergency=req.isEmergency or False,
            surgeFee=surge,
            paymentMethod=req.paymentMethod or "CASH_ON_DELIVERY",
            deliveryAddress=req.deliveryAddress,
            trackingNumber=tracking_num,
            status="PENDING",
            createdAt=current_iso_time()
        )
        db.add(new_order)
        db.flush()
        
        for order_item in order_items_to_create:
            order_item.orderId = new_order.id
            db.add(order_item)
            
        user_query = db.query(models.User).filter(models.User.id == req.userId)
        if db.bind.dialect.name != "sqlite":
            user_query = user_query.with_for_update()
        user = user_query.first()
        if user and req.loyaltyEarned:
            user.loyaltyPoints += req.loyaltyEarned
            
        db.commit()
        return {"success": True, "trackingNumber": tracking_num, "orderId": new_order.id}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error during order creation: {str(e)}")

@router.get("/{id}")
def get_order_by_id(id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    order = db.query(models.Order).options(
        joinedload(models.Order.items).joinedload(models.OrderItem.inventory).joinedload(models.Inventory.medicine),
        joinedload(models.Order.items).joinedload(models.OrderItem.inventory).joinedload(models.Inventory.pharmacy),
        joinedload(models.Order.rider)
    ).filter(models.Order.id == id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Only the user who placed it, the assigned rider, or the shop owner should view it
    if current_user.role == "user" and order.userId != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot view this order")
    elif current_user.role == "rider" and order.riderId != current_user.id and order.status != "CONFIRMED":
        raise HTTPException(status_code=403, detail="Forbidden: You cannot view this order")

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
