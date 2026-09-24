from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth
from utils import generate_cuid, current_iso_time

router = APIRouter(prefix="/api/user", tags=["user"])


def _serialize_address(a: models.Address) -> dict:
    parts = [p for p in [a.houseNumber, a.street, a.landmark, a.city, a.state, a.pincode] if p]
    combined = ", ".join(parts) if parts else (a.address or "")
    return {
        "id": a.id,
        "label": a.label,
        "fullName": a.fullName,
        "phone": a.phone,
        "houseNumber": a.houseNumber,
        "street": a.street,
        "landmark": a.landmark,
        "city": a.city,
        "state": a.state,
        "pincode": a.pincode,
        "address": combined,
        "latitude": a.latitude,
        "longitude": a.longitude,
        "isDefault": a.isDefault or False,
        "userId": a.userId,
        "createdAt": a.createdAt,
        "updatedAt": a.updatedAt,
    }


@router.get("/address")
def get_user_addresses(
    userId: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if userId != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot view addresses of another user")
    addresses = (
        db.query(models.Address)
        .filter(models.Address.userId == userId)
        .order_by(models.Address.isDefault.desc(), models.Address.createdAt.desc())
        .all()
    )
    return {"addresses": [_serialize_address(a) for a in addresses]}


@router.post("/address")
def create_user_address(
    req: schemas.AddressCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if req.userId != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot create address for another user")

    if req.isDefault:
        db.query(models.Address).filter(
            models.Address.userId == req.userId,
            models.Address.isDefault == True,
        ).update({"isDefault": False, "updatedAt": current_iso_time()})

    existing_count = db.query(models.Address).filter(models.Address.userId == req.userId).count()
    make_default = req.isDefault or (existing_count == 0)

    parts = [p for p in [req.houseNumber, req.street, req.landmark, req.city, req.state, req.pincode] if p]
    combined = ", ".join(parts)

    now = current_iso_time()
    addr = models.Address(
        id=generate_cuid(),
        userId=req.userId,
        label=req.label or "Home",
        fullName=req.fullName.strip(),
        phone=req.phone,
        houseNumber=req.houseNumber.strip(),
        street=req.street.strip(),
        landmark=(req.landmark or "").strip() or None,
        city=req.city.strip(),
        state=req.state.strip(),
        pincode=req.pincode,
        address=combined,
        latitude=req.latitude,
        longitude=req.longitude,
        isDefault=make_default,
        createdAt=now,
        updatedAt=now,
    )
    db.add(addr)
    db.commit()
    db.refresh(addr)
    return {"success": True, "address": _serialize_address(addr)}


@router.put("/address")
def update_user_address(
    id: str = Query(...),
    req: schemas.AddressUpdate = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    addr = db.query(models.Address).filter(models.Address.id == id).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    if addr.userId != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot edit another user s address")

    if req and req.isDefault:
        db.query(models.Address).filter(
            models.Address.userId == current_user.id,
            models.Address.isDefault == True,
            models.Address.id != id,
        ).update({"isDefault": False, "updatedAt": current_iso_time()})

    now = current_iso_time()
    if req:
        updatable = ["label", "fullName", "phone", "houseNumber", "street", "landmark", "city", "state", "pincode", "isDefault", "latitude", "longitude"]
        for field in updatable:
            val = getattr(req, field, None)
            if val is not None:
                setattr(addr, field, val)

    parts = [p for p in [addr.houseNumber, addr.street, addr.landmark, addr.city, addr.state, addr.pincode] if p]
    addr.address = ", ".join(parts)
    addr.updatedAt = now

    db.commit()
    db.refresh(addr)
    return {"success": True, "address": _serialize_address(addr)}


@router.delete("/address")
def delete_user_address(
    id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    addr = db.query(models.Address).filter(models.Address.id == id).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    if addr.userId != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot delete another user s address")

    was_default = addr.isDefault
    db.delete(addr)
    db.commit()

    if was_default:
        next_addr = (
            db.query(models.Address)
            .filter(models.Address.userId == current_user.id)
            .order_by(models.Address.createdAt.desc())
            .first()
        )
        if next_addr:
            next_addr.isDefault = True
            next_addr.updatedAt = current_iso_time()
            db.commit()

    return {"success": True, "message": "Address deleted"}
