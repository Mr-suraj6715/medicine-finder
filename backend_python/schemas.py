from pydantic import BaseModel, Field, validator, root_validator
from typing import Optional, List, Any, Dict, Union
import re

class LoginRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., max_length=128)
    role: Optional[str] = "user"

    @validator("email")
    def validate_email(cls, v):
        email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
        if not re.match(email_regex, v):
            raise ValueError("Invalid email format")
        return v.strip().lower()

class SignupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    role: Optional[str] = "user"
    phone: Optional[str] = Field(None, max_length=20)
    location: Optional[str] = Field(None, max_length=255)

    @validator("email")
    def validate_email(cls, v):
        email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
        if not re.match(email_regex, v):
            raise ValueError("Invalid email format")
        return v.strip().lower()

class AddressCreate(BaseModel):
    userId: str = Field(..., max_length=128)
    label: str = Field("Home", max_length=50)
    fullName: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=20)
    houseNumber: str = Field(..., min_length=1, max_length=100)
    street: str = Field(..., min_length=2, max_length=255)
    landmark: Optional[str] = Field(None, max_length=255)
    city: str = Field("Mumbai", min_length=2, max_length=100)
    state: str = Field("Maharashtra", min_length=2, max_length=100)
    pincode: str = Field(..., min_length=6, max_length=10)
    address: Optional[str] = Field(None, max_length=500)
    shippingAddress: Optional[str] = Field(None, max_length=500)
    deliveryAddress: Optional[str] = Field(None, max_length=500)
    isDefault: Optional[bool] = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @root_validator(pre=True)
    def handle_address_fields(cls, values):
        if not isinstance(values, dict):
            return values

        # Handle field mismatches or objects sent where string expected
        raw_addr = values.get("address") or values.get("deliveryAddress") or values.get("shippingAddress")
        if isinstance(raw_addr, dict):
            for k, v in raw_addr.items():
                if k not in values or not values[k]:
                    values[k] = v
            raw_addr = None

        if raw_addr and isinstance(raw_addr, str):
            clean_raw = raw_addr.strip()
            values["address"] = clean_raw
            if not values.get("houseNumber"):
                parts = [p.strip() for p in clean_raw.split(",") if p.strip()]
                values["houseNumber"] = parts[0] if parts else clean_raw[:50]
            if not values.get("street"):
                parts = [p.strip() for p in clean_raw.split(",") if p.strip()]
                values["street"] = ", ".join(parts[1:]) if len(parts) > 1 else clean_raw[:150]
            if not values.get("pincode"):
                pin_match = re.search(r"\b([1-9][0-9]{5})\b", clean_raw)
                values["pincode"] = pin_match.group(1) if pin_match else "400001"
            if not values.get("city"):
                values["city"] = "Mumbai"
            if not values.get("state"):
                values["state"] = "Maharashtra"

        # Auto-compute combined address if houseNumber and street exist
        if values.get("houseNumber") and values.get("street") and not values.get("address"):
            parts = [
                str(values.get(k)).strip()
                for k in ["houseNumber", "street", "landmark", "city", "state", "pincode"]
                if values.get(k) and str(values.get(k)).strip()
            ]
            values["address"] = ", ".join(parts)

        # Phone cleaning and normalization
        phone = values.get("phone")
        if phone and isinstance(phone, str):
            cleaned = re.sub(r"[\s\-\(\)\+]", "", phone)
            if len(cleaned) == 12 and cleaned.startswith("91"):
                cleaned = cleaned[2:]
            elif len(cleaned) == 13 and cleaned.startswith("091"):
                cleaned = cleaned[3:]
            elif len(cleaned) == 11 and cleaned.startswith("0"):
                cleaned = cleaned[1:]
            values["phone"] = cleaned

        return values

    @validator("phone")
    def validate_phone(cls, v):
        cleaned = re.sub(r"[\s\-\(\)\+]", "", v)
        if len(cleaned) == 12 and cleaned.startswith("91"):
            cleaned = cleaned[2:]
        elif len(cleaned) == 13 and cleaned.startswith("091"):
            cleaned = cleaned[3:]
        elif len(cleaned) == 11 and cleaned.startswith("0"):
            cleaned = cleaned[1:]
        if not re.match(r"^[6-9]\d{9}$", cleaned):
            raise ValueError("Enter a valid 10-digit Indian mobile number (e.g. 9820011221 or +91 98200 11221)")
        return cleaned

    @validator("pincode")
    def validate_pincode(cls, v):
        cleaned = re.sub(r"\s+", "", v)
        if not re.match(r"^[1-9][0-9]{5}$", cleaned):
            raise ValueError("Enter a valid 6-digit Indian PIN code")
        return cleaned

    @validator("fullName")
    def validate_name(cls, v):
        v = v.strip()
        if not re.match(r"^[A-Za-z\s\.\-\']+$", v):
            raise ValueError("Full Name must contain only letters, dots, hyphens, and spaces")
        if len(v) < 2:
            raise ValueError("Full Name is too short (min 2 characters)")
        return v

    @validator("city", "state")
    def validate_city_state(cls, v):
        v = v.strip()
        if not re.match(r"^[A-Za-z0-9\s\.\-\',()]+$", v):
            raise ValueError("Must contain valid letters and characters")
        if len(v) < 2:
            raise ValueError("Value is too short (min 2 characters)")
        return v

    @validator("houseNumber", "street")
    def validate_address_fields(cls, v):
        v = str(v).strip()
        if len(v) < 1:
            raise ValueError("Field cannot be empty")
        if len(v) > 255:
            raise ValueError("Field is too long")
        return v


class AddressUpdate(BaseModel):
    label: Optional[str] = Field(None, max_length=50)
    fullName: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    houseNumber: Optional[str] = Field(None, min_length=1, max_length=100)
    street: Optional[str] = Field(None, min_length=2, max_length=255)
    landmark: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, min_length=2, max_length=100)
    state: Optional[str] = Field(None, min_length=2, max_length=100)
    pincode: Optional[str] = Field(None, min_length=6, max_length=10)
    address: Optional[str] = Field(None, max_length=500)
    shippingAddress: Optional[str] = Field(None, max_length=500)
    deliveryAddress: Optional[str] = Field(None, max_length=500)
    isDefault: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @root_validator(pre=True)
    def handle_address_update_fields(cls, values):
        if not isinstance(values, dict):
            return values
        raw_addr = values.get("address") or values.get("deliveryAddress") or values.get("shippingAddress")
        if isinstance(raw_addr, dict):
            for k, v in raw_addr.items():
                if k not in values or not values[k]:
                    values[k] = v
        phone = values.get("phone")
        if phone and isinstance(phone, str):
            cleaned = re.sub(r"[\s\-\(\)\+]", "", phone)
            if len(cleaned) == 12 and cleaned.startswith("91"):
                cleaned = cleaned[2:]
            elif len(cleaned) == 13 and cleaned.startswith("091"):
                cleaned = cleaned[3:]
            elif len(cleaned) == 11 and cleaned.startswith("0"):
                cleaned = cleaned[1:]
            values["phone"] = cleaned
        return values

    @validator("phone", pre=True, always=False)
    def validate_phone(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r"[\s\-\(\)\+]", "", v)
        if len(cleaned) == 12 and cleaned.startswith("91"):
            cleaned = cleaned[2:]
        elif len(cleaned) == 13 and cleaned.startswith("091"):
            cleaned = cleaned[3:]
        elif len(cleaned) == 11 and cleaned.startswith("0"):
            cleaned = cleaned[1:]
        if not re.match(r"^[6-9]\d{9}$", cleaned):
            raise ValueError("Enter a valid 10-digit Indian mobile number (e.g. 9820011221 or +91 98200 11221)")
        return cleaned

    @validator("pincode", pre=True, always=False)
    def validate_pincode(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r"\s+", "", v)
        if not re.match(r"^[1-9][0-9]{5}$", cleaned):
            raise ValueError("Enter a valid 6-digit Indian PIN code")
        return cleaned


class RiderProfileUpdate(BaseModel):
    userId: str = Field(..., max_length=128)
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=255)
    vehicleType: Optional[str] = Field(None, max_length=50)

class ShopSettingsUpdate(BaseModel):
    pharmacyId: str = Field(..., max_length=128)
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    location: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    openingTime: Optional[str] = Field(None, max_length=20)
    closingTime: Optional[str] = Field(None, max_length=20)
    isAvailable: Optional[bool] = None

class OrderCreateItem(BaseModel):
    inventoryId: str = Field(..., max_length=128)
    quantity: int = Field(..., gt=0, lt=1000)
    priceAtTime: float = Field(..., ge=0.0)

class OrderCreate(BaseModel):
    userId: str = Field(..., max_length=128)
    items: List[OrderCreateItem]
    totalAmount: float = Field(..., ge=0.0)
    discountApplied: Optional[float] = Field(0.0, ge=0.0)
    loyaltyEarned: Optional[int] = Field(0, ge=0)
    isEmergency: Optional[bool] = False
    surgeFee: Optional[float] = Field(0.0, ge=0.0)
    paymentMethod: Optional[str] = Field("CASH_ON_DELIVERY", max_length=50)
    deliveryAddress: str = Field(..., min_length=3, max_length=500)

    @root_validator(pre=True)
    def normalize_delivery_address(cls, values):
        if not isinstance(values, dict):
            return values
        addr = values.get("deliveryAddress") or values.get("address") or values.get("shippingAddress")
        if isinstance(addr, dict):
            parts = [
                str(addr.get(k)).strip()
                for k in ["houseNumber", "street", "landmark", "city", "state", "pincode"]
                if addr.get(k) and str(addr.get(k)).strip()
            ]
            values["deliveryAddress"] = ", ".join(parts) or "Mumbai, Maharashtra"
        elif isinstance(addr, str) and addr.strip():
            values["deliveryAddress"] = addr.strip()
        elif not values.get("deliveryAddress"):
            values["deliveryAddress"] = "Mumbai, Maharashtra"
        return values


class OrderStatusUpdate(BaseModel):
    orderId: str = Field(..., max_length=128)
    status: str = Field(..., max_length=50)
    riderId: Optional[str] = Field(None, max_length=128)

class RiderAcceptOrder(BaseModel):
    orderId: str = Field(..., max_length=128)
    riderId: str = Field(..., max_length=128)

class RiderLocationUpdate(BaseModel):
    riderId: str = Field(..., max_length=128)
    latitude: float
    longitude: float

class ShopReassign(BaseModel):
    orderId: str = Field(..., max_length=128)
    riderId: str = Field(..., max_length=128)

class InventoryAddMedicine(BaseModel):
    action: str = Field("add_medicine", max_length=50)
    pharmacyId: str = Field(..., max_length=128)
    medicineName: str = Field(..., min_length=2, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    price: float = Field(..., ge=0.0)
    stock: int = Field(..., ge=0)

class InventoryUpdateStock(BaseModel):
    action: str = Field("update_stock", max_length=50)
    pharmacyId: str = Field(..., max_length=128)
    medicineId: str = Field(..., max_length=128)
    price: Optional[float] = Field(None, ge=0.0)
    stock: Optional[int] = Field(None, ge=0)
    category: Optional[str] = Field(None, max_length=100)

class AIConsultantRequest(BaseModel):
    symptoms: str = Field(..., min_length=2, max_length=2000)
    userEmail: Optional[str] = Field(None, max_length=255)
    safetyInfo: Optional[dict] = None

class AIPrescribeRequest(BaseModel):
    prescriptionText: str = Field(..., min_length=2, max_length=2000)
    userEmail: Optional[str] = Field(None, max_length=255)

class InventoryActionPayload(BaseModel):
    """Unified payload for all shop inventory mutations."""
    action: str = Field(..., pattern=r"^(add_medicine|update_stock|delete_medicine)$")
    pharmacyId: str = Field(..., max_length=128)
    # add_medicine fields
    medicineName: Optional[str] = Field(None, min_length=2, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    price: Optional[float] = Field(None, ge=0.0)
    stock: Optional[int] = Field(None, ge=0)
    # update_stock / delete_medicine fields
    medicineId: Optional[str] = Field(None, max_length=128)

class BulkInventoryItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    genericName: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field("General", max_length=100)
    batchNumber: Optional[str] = Field(None, max_length=100)
    stock: int = Field(0, ge=0)
    mrp: Optional[float] = Field(None, ge=0.0)
    price: float = Field(0.0, ge=0.0)
    purchasePrice: Optional[float] = Field(None, ge=0.0)
    expiryDate: Optional[str] = Field(None, max_length=50)
    manufacturer: Optional[str] = Field(None, max_length=255)
    supplier: Optional[str] = Field(None, max_length=255)
    stockLocation: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

class BulkInventoryUploadRequest(BaseModel):
    pharmacyId: str = Field(..., max_length=128)
    items: List[BulkInventoryItem]
    conflictStrategy: Optional[str] = Field("update_add", pattern=r"^(update_add|replace|skip)$")

class ResetPasswordRequest(BaseModel):
    email: str = Field(..., max_length=255)
    newPassword: str = Field(..., min_length=6, max_length=128)
    role: Optional[str] = "user"

    @validator("email")
    def validate_email(cls, v):
        email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
        if not re.match(email_regex, v):
            raise ValueError("Invalid email format")
        return v.strip().lower()

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., max_length=255)
    role: Optional[str] = "user"

    @validator("email")
    def validate_email(cls, v):
        email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
        if not re.match(email_regex, v):
            raise ValueError("Invalid email format")
        return v.strip().lower()

class ConfirmResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=255)
    newPassword: str = Field(..., min_length=6, max_length=128)
