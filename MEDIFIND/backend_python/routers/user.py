from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth
from utils import generate_cuid, current_iso_time
from typing import Optional

router = APIRouter(prefix="/api/user", tags=["user"])
addresses_router = APIRouter(prefix="/api/addresses", tags=["addresses"])


def _serialize_address(a: models.Address) -> dict:
    parts = [p for p in [a.houseNumber, a.street, getattr(a, "area", None), a.landmark, a.city, a.state, a.pincode] if p]
    combined = ", ".join(parts) if parts else (a.address or "")
    return {
        "id": a.id,
        "label": a.label,
        "fullName": a.fullName or "",
        "phone": a.phone or "",
        "houseNumber": a.houseNumber or "",
        "street": a.street or "",
        "area": getattr(a, "area", None) or "",
        "landmark": a.landmark or "",
        "city": a.city or "",
        "state": a.state or "",
        "pincode": a.pincode or "",
        "address": combined,
        "latitude": a.latitude,
        "longitude": a.longitude,
        "isDefault": a.isDefault or False,
        "userId": a.userId,
        "createdAt": a.createdAt,
        "updatedAt": a.updatedAt,
    }


def _get_addresses_impl(userId: Optional[str], db: Session, current_user: models.User):
    target_user_id = userId if userId else current_user.id
    if target_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot view addresses of another user")
    addresses = (
        db.query(models.Address)
        .filter(models.Address.userId == target_user_id)
        .order_by(models.Address.isDefault.desc(), models.Address.createdAt.desc())
        .all()
    )
    return {"addresses": [_serialize_address(a) for a in addresses]}


def _create_address_impl(req: schemas.AddressCreate, db: Session, current_user: models.User):
    # Always enforce the authenticated user's id
    user_id = current_user.id

    if req.isDefault:
        db.query(models.Address).filter(
            models.Address.userId == user_id,
            models.Address.isDefault == True,
        ).update({"isDefault": False, "updatedAt": current_iso_time()})

    existing_count = db.query(models.Address).filter(models.Address.userId == user_id).count()
    make_default = req.isDefault or (existing_count == 0)

    parts = [p for p in [req.houseNumber, req.street, req.area, req.landmark, req.city, req.state, req.pincode] if p]
    combined = ", ".join(parts)

    now = current_iso_time()
    addr = models.Address(
        id=generate_cuid(),
        userId=user_id,
        label=req.label or "Home",
        fullName=req.fullName.strip(),
        phone=req.phone,
        houseNumber=req.houseNumber.strip(),
        street=req.street.strip(),
        area=(req.area or "").strip() or None,
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


def _update_address_impl(id: str, req: Optional[schemas.AddressUpdate], db: Session, current_user: models.User):
    addr = db.query(models.Address).filter(models.Address.id == id).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    if addr.userId != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot edit another user's address")

    if req and req.isDefault:
        db.query(models.Address).filter(
            models.Address.userId == current_user.id,
            models.Address.isDefault == True,
            models.Address.id != id,
        ).update({"isDefault": False, "updatedAt": current_iso_time()})

    now = current_iso_time()
    if req:
        updatable = ["label", "fullName", "phone", "houseNumber", "street", "area", "landmark", "city", "state", "pincode", "isDefault", "latitude", "longitude"]
        for field in updatable:
            val = getattr(req, field, None)
            if val is not None:
                setattr(addr, field, val)

    parts = [p for p in [addr.houseNumber, addr.street, getattr(addr, "area", None), addr.landmark, addr.city, addr.state, addr.pincode] if p]
    addr.address = ", ".join(parts)
    addr.updatedAt = now

    db.commit()
    db.refresh(addr)
    return {"success": True, "address": _serialize_address(addr)}


def _delete_address_impl(id: str, db: Session, current_user: models.User):
    addr = db.query(models.Address).filter(models.Address.id == id).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    if addr.userId != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot delete another user's address")

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


# /api/user/address endpoints
@router.get("/address")
def get_user_addresses(
    userId: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _get_addresses_impl(userId, db, current_user)


@router.post("/address")
def create_user_address(
    req: schemas.AddressCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _create_address_impl(req, db, current_user)


@router.put("/address")
def update_user_address(
    id: str = Query(...),
    req: Optional[schemas.AddressUpdate] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _update_address_impl(id, req, db, current_user)


@router.delete("/address")
def delete_user_address(
    id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _delete_address_impl(id, db, current_user)


# /api/addresses aliases (Requirements 16)
@addresses_router.get("")
def get_addresses_alias(
    userId: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _get_addresses_impl(userId, db, current_user)


@addresses_router.post("")
def create_address_alias(
    req: schemas.AddressCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _create_address_impl(req, db, current_user)


@addresses_router.put("/{id}")
def update_address_path_alias(
    id: str = Path(...),
    req: Optional[schemas.AddressUpdate] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _update_address_impl(id, req, db, current_user)


@addresses_router.delete("/{id}")
def delete_address_path_alias(
    id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _delete_address_impl(id, db, current_user)
