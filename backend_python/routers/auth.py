from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth
from utils import generate_cuid, current_iso_time

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login")
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    try:
        email = req.email.lower().strip()
        user = db.query(models.User).filter(models.User.email == email).first()
        
        # Auto-create & bypass authentication for official demo/mock accounts
        if email == "demo@medstore.com":
            if not user:
                user = models.User(id=generate_cuid(), email=email, name="Demo Customer", role="user", createdAt=current_iso_time(), updatedAt=current_iso_time())
                db.add(user)
                db.commit()
                db.refresh(user)
            access_token = auth.create_access_token(data={"sub": user.email})
            return {"success": True, "token": access_token, "user": {"id": user.id, "email": user.email, "name": user.name or "Demo Customer", "role": "user", "loyaltyPoints": user.loyaltyPoints or 0}}
        
        if email == "shop@medstore.com":
            if not user:
                user = models.User(id=generate_cuid(), email=email, name="MediStore Pharmacy", role="shop_owner", createdAt=current_iso_time(), updatedAt=current_iso_time())
                db.add(user)
                db.commit()
                db.refresh(user)
            access_token = auth.create_access_token(data={"sub": user.email})
            return {"success": True, "token": access_token, "user": {"id": user.id, "email": user.email, "name": user.name or "MediStore Pharmacy", "role": "shop_owner", "loyaltyPoints": user.loyaltyPoints or 0}}
        
        if email == "rider@medstore.com":
            if not user:
                user = models.User(id=generate_cuid(), email=email, name="Rider Partner", role="rider", createdAt=current_iso_time(), updatedAt=current_iso_time())
                db.add(user)
                db.commit()
                db.refresh(user)
            access_token = auth.create_access_token(data={"sub": user.email})
            return {"success": True, "token": access_token, "user": {"id": user.id, "email": user.email, "name": user.name or "Rider Partner", "role": "rider", "loyaltyPoints": user.loyaltyPoints or 0}}

        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
            
        if user.password and req.password:
            if not auth.verify_password(req.password, user.password):
                raise HTTPException(status_code=401, detail="Invalid email or password")
        elif not user.password:
            if req.password:
                raise HTTPException(status_code=401, detail="Invalid email or password")
        
        access_token = auth.create_access_token(data={"sub": user.email})
        return {"success": True, "token": access_token, "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role, "loyaltyPoints": user.loyaltyPoints or 0}}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/signup")
def signup(req: schemas.SignupRequest, db: Session = Depends(get_db)):
    try:
        email = req.email.lower().strip()
        existing = db.query(models.User).filter(models.User.email == email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        
        hashed_pw = auth.hash_password(req.password)
        user = models.User(
            id=generate_cuid(), name=req.name, email=email,
            password=hashed_pw, role="user",
            phone=req.phone or None,
            address=req.location or None,
            createdAt=current_iso_time(), updatedAt=current_iso_time()
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        access_token = auth.create_access_token(data={"sub": user.email})
        return {"success": True, "token": access_token, "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role, "loyaltyPoints": 0}}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/me")
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return {
        "success": True,
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "role": current_user.role,
            "loyaltyPoints": current_user.loyaltyPoints or 0
        }
    }
