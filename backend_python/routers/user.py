from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth
from utils import generate_cuid, current_iso_time

router = APIRouter(prefix="/api/user", tags=["user"])

@router.get("/address")
def get_user_addresses(userId: str = Query(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if userId != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot view addresses of another user")
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

@router.post("/address")
def create_user_address(req: schemas.AddressCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if req.userId != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot create address for another user")
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

@router.delete("/address")
def delete_user_address(id: str = Query(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    addr = db.query(models.Address).filter(models.Address.id == id).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    if addr.userId != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot delete another user's address")
    db.delete(addr)
    db.commit()
    return {"success": True, "message": "Address deleted permanently"}
