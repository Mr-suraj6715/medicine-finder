from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth
from utils import generate_cuid, current_iso_time
import os
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List
import email_service

# In-memory rate limiter for password reset requests: key -> list of UTC timestamps
RESET_RATE_LIMITS: Dict[str, List[datetime]] = {}

def check_reset_rate_limit(key: str, max_requests: int = 3, window_minutes: int = 10) -> bool:
    """Returns True if allowed, False if rate limit exceeded."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=window_minutes)
    timestamps = [t for t in RESET_RATE_LIMITS.get(key, []) if t > cutoff]
    if len(timestamps) >= max_requests:
        return False
    timestamps.append(now)
    RESET_RATE_LIMITS[key] = timestamps
    return True

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login")
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    try:
        email = req.email.lower().strip()
        user = db.query(models.User).filter(models.User.email == email).first()
        role_map = {"user": "Customer", "shop_owner": "Medical Shop Owner", "rider": "Delivery Rider"}
        
        # Auto-create & bypass authentication for official demo/mock accounts
        if email == "demo@medstore.com":
            if req.role and req.role != "user":
                raise HTTPException(
                    status_code=400,
                    detail="demo@medstore.com is registered as a Customer. Please switch to the Customer tab to sign in."
                )
            if not user:
                user = models.User(id=generate_cuid(), email=email, name="Demo Customer", role="user", createdAt=current_iso_time(), updatedAt=current_iso_time())
                db.add(user)
                db.commit()
                db.refresh(user)
            access_token = auth.create_access_token(data={"sub": user.email})
            return {"success": True, "token": access_token, "user": {"id": user.id, "email": user.email, "name": user.name or "Demo Customer", "role": "user", "loyaltyPoints": user.loyaltyPoints or 0}}
        
        if email == "shop@medstore.com":
            if req.role and req.role != "shop_owner":
                raise HTTPException(
                    status_code=400,
                    detail="shop@medstore.com is registered as a Medical Shop Owner. Please switch to the Shop Owner tab to sign in."
                )
            if not user:
                user = models.User(id=generate_cuid(), email=email, name="MediStore Pharmacy", role="shop_owner", createdAt=current_iso_time(), updatedAt=current_iso_time())
                db.add(user)
                db.commit()
                db.refresh(user)
            # Ensure pharmacy record exists
            pharmacy = db.query(models.Pharmacy).filter(models.Pharmacy.id == user.id).first()
            if not pharmacy:
                pharmacy = models.Pharmacy(
                    id=user.id,
                    name=user.name or "MediStore Pharmacy",
                    location="Central Plaza, Mumbai",
                    phone="022-26543210",
                    rating=4.9,
                    distance=0.5,
                    openingTime="8:00 AM",
                    closingTime="11:00 PM",
                    isAvailable=True,
                    createdAt=current_iso_time(),
                    updatedAt=current_iso_time()
                )
                db.add(pharmacy)
                db.commit()

            access_token = auth.create_access_token(data={"sub": user.email})
            return {"success": True, "token": access_token, "user": {"id": user.id, "email": user.email, "name": user.name or "MediStore Pharmacy", "role": "shop_owner", "loyaltyPoints": user.loyaltyPoints or 0}}
        
        if email == "rider@medstore.com":
            if req.role and req.role != "rider":
                raise HTTPException(
                    status_code=400,
                    detail="rider@medstore.com is registered as a Delivery Rider. Please switch to the Rider tab to sign in."
                )
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
        
        # Enforce role matching when role tab is explicitly selected
        if req.role and req.role in ["user", "shop_owner", "rider"] and user.role != req.role:
            target_role = role_map.get(user.role, user.role)
            raise HTTPException(
                status_code=400,
                detail=f"This account is registered as a {target_role}. Please switch to the {target_role} tab to log in."
            )
            
        access_token = auth.create_access_token(data={"sub": user.email})
        return {"success": True, "token": access_token, "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role, "loyaltyPoints": user.loyaltyPoints or 0}}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(err)}")

@router.post("/signup")
def signup(req: schemas.SignupRequest, db: Session = Depends(get_db)):
    try:
        email = req.email.lower().strip()
        existing = db.query(models.User).filter(models.User.email == email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        
        role = req.role if req.role in ["user", "shop_owner", "rider"] else "user"
        hashed_pw = auth.hash_password(req.password)
        user = models.User(
            id=generate_cuid(),
            name=req.name,
            email=email,
            password=hashed_pw,
            role=role,
            phone=req.phone or None,
            address=req.location or None,
            createdAt=current_iso_time(),
            updatedAt=current_iso_time()
        )
        db.add(user)
        
        # If signing up as Medical Shop Owner, auto-create their Pharmacy store
        if role == "shop_owner":
            pharmacy_name = req.name if any(term in req.name.lower() for term in ["pharmacy", "medical", "chemist", "drug", "store", "medstore"]) else f"{req.name}'s Pharmacy"
            pharmacy = models.Pharmacy(
                id=user.id,
                name=pharmacy_name,
                location=req.location or "Local Market Area",
                phone=req.phone or None,
                rating=5.0,
                distance=0.8,
                openingTime="9:00 AM",
                closingTime="10:00 PM",
                isAvailable=True,
                createdAt=current_iso_time(),
                updatedAt=current_iso_time()
            )
            db.add(pharmacy)

        db.commit()
        db.refresh(user)
        access_token = auth.create_access_token(data={"sub": user.email})
        return {"success": True, "token": access_token, "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role, "loyaltyPoints": 0}}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(err)}")

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

# --- Password Reset Flow (Token based) ---

# Helper to generate raw token and its SHA‑256 hash

def _generate_password_reset_token() -> tuple[str, str]:
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    return raw_token, token_hash

# 1. Request password reset – send email with token link
@router.post("/forgot-password")
def forgot_password(req: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    try:
        email = req.email.lower().strip()
        role = (req.role or "user").strip().lower()
        # Rate limiting per email address
        if not check_reset_rate_limit(email):
            raise HTTPException(status_code=429, detail="Too many password reset requests. Please try again later.")

        query = db.query(models.User).filter(models.User.email == email)
        if role in ["user", "shop_owner", "rider"]:
            query = query.filter(models.User.role == role)
        user = query.first()
        # Generic response to avoid user enumeration
        generic_msg = {"success": True, "message": "If an account exists, a password reset link has been sent to the provided email."}
        if not user:
            return generic_msg

        raw_token, token_hash = _generate_password_reset_token()
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=20)).isoformat()
        reset_entry = models.PasswordResetToken(
            id=secrets.token_urlsafe(16),
            userId=user.id,
            tokenHash=token_hash,
            expiresAt=expires_at,
            isUsed=False,
            createdAt=current_iso_time()
        )
        db.add(reset_entry)
        db.commit()

        # Send email (development fallback logs link)
        email_service.send_password_reset_email(recipient_email=email, raw_token=raw_token, user_name=user.name)
        return generic_msg
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(err)}")

# 2. Verify reset token (GET)
@router.get("/reset-password/verify")
def verify_reset_token(token: str, db: Session = Depends(get_db)):
    try:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        entry = db.query(models.PasswordResetToken).filter(models.PasswordResetToken.tokenHash == token_hash).first()
        if not entry or entry.isUsed:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
        if datetime.fromisoformat(entry.expiresAt) < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
        return {"success": True, "message": "Reset token is valid."}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(err)}")

# 3. Confirm reset password using token
@router.post("/reset-password/confirm")
def confirm_reset_password(req: schemas.ConfirmResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        token_hash = hashlib.sha256(req.token.encode()).hexdigest()
        entry = db.query(models.PasswordResetToken).filter(models.PasswordResetToken.tokenHash == token_hash).first()
        if not entry or entry.isUsed:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
        if datetime.fromisoformat(entry.expiresAt) < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

        user = db.query(models.User).filter(models.User.id == entry.userId).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        user.password = auth.hash_password(req.newPassword)
        user.updatedAt = current_iso_time()
        entry.isUsed = True
        db.commit()
        db.refresh(user)
        return {"success": True, "message": "Your password has been successfully reset. You can now sign in."}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(err)}")
