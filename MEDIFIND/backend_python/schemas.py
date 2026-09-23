from pydantic import BaseModel, Field, validator
from typing import Optional, List
import re

class LoginRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., max_length=128)
    role: Optional[str] = None

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
    phone: Optional[str] = Field(None, max_length=25)
    location: Optional[str] = Field(None, max_length=255)

    @validator("email")
    def validate_email(cls, v):
        email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
        if not re.match(email_regex, v):
            raise ValueError("Invalid email format")
        return v.strip().lower()

    @validator("role")
    def validate_role(cls, v):
        if not v:
            return "user"
        normalized = v.strip().lower()
        if normalized in ["user", "customer"]:
            return "user"
        if normalized == "shop_owner":
            return "shop_owner"
        if normalized == "rider":
            return "rider"
        raise ValueError("Invalid role specified. Allowed roles: Customer, Shop Owner, Rider")

class AddressCreate(BaseModel):
    userId: Optional[str] = Field(None, max_length=128)
    label: str = Field("Home", max_length=50)
    fullName: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=25)
    houseNumber: str = Field(..., min_length=1, max_length=100)
    street: str = Field(..., min_length=1, max_length=200)
    area: Optional[str] = Field(None, max_length=200)
    landmark: Optional[str] = Field(None, max_length=200)
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=100)
    pincode: str = Field(..., min_length=5, max_length=10)
    isDefault: Optional[bool] = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @validator("phone", pre=True)
    def validate_phone(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Phone number is required")
        cleaned = re.sub(r"[\s\-\(\)]", "", str(v).strip())
        # Support Indian 10-digit (+91/0 prefix optional) or international 10-15 digits
        digits_only = re.sub(r"^\+91|^91|^0", "", cleaned) if cleaned.startswith(("+91", "91", "0")) and len(re.sub(r"\D", "", cleaned)) > 10 else re.sub(r"\D", "", cleaned)
        if len(digits_only) == 10 and re.match(r"^[6-9]\d{9}$", digits_only):
            return digits_only
        all_digits = re.sub(r"\D", "", cleaned)
        if len(all_digits) < 10 or len(all_digits) > 15:
            raise ValueError("Enter a valid mobile phone number (10 digits)")
        return cleaned

    @validator("pincode", pre=True)
    def validate_pincode(cls, v):
        if not v or not str(v).strip():
            raise ValueError("PIN code is required")
        cleaned = re.sub(r"\s+", "", str(v).strip())
        if not re.match(r"^[1-9][0-9]{5}$", cleaned):
            raise ValueError("PIN code must contain 6 digits (e.g. 400069)")
        return cleaned

    @validator("fullName", pre=True)
    def validate_name(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Full Name is required")
        cleaned = str(v).strip()
        if len(cleaned) < 2:
            raise ValueError("Full Name is too short (min 2 characters)")
        return cleaned

    @validator("houseNumber", "street", "city", "state", pre=True)
    def validate_required_address_fields(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Field cannot be empty")
        cleaned = str(v).strip()
        if len(cleaned) < 1:
            raise ValueError("Field cannot be empty")
        return cleaned

    @validator("area", "landmark", pre=True)
    def validate_optional_address_fields(cls, v):
        if v is None:
            return None
        cleaned = str(v).strip()
        if not cleaned:
            return None
        return cleaned


class AddressUpdate(BaseModel):
    label: Optional[str] = Field(None, max_length=50)
    fullName: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=25)
    houseNumber: Optional[str] = Field(None, min_length=1, max_length=100)
    street: Optional[str] = Field(None, min_length=1, max_length=200)
    area: Optional[str] = Field(None, max_length=200)
    landmark: Optional[str] = Field(None, max_length=200)
    city: Optional[str] = Field(None, min_length=2, max_length=100)
    state: Optional[str] = Field(None, min_length=2, max_length=100)
    pincode: Optional[str] = Field(None, min_length=5, max_length=10)
    isDefault: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @validator("phone", pre=True, always=False)
    def validate_phone(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r"[\s\-\(\)]", "", str(v).strip())
        digits_only = re.sub(r"^\+91|^91|^0", "", cleaned) if cleaned.startswith(("+91", "91", "0")) and len(re.sub(r"\D", "", cleaned)) > 10 else re.sub(r"\D", "", cleaned)
        if len(digits_only) == 10 and re.match(r"^[6-9]\d{9}$", digits_only):
            return digits_only
        all_digits = re.sub(r"\D", "", cleaned)
        if len(all_digits) < 10 or len(all_digits) > 15:
            raise ValueError("Enter a valid mobile phone number (10 digits)")
        return cleaned

    @validator("pincode", pre=True, always=False)
    def validate_pincode(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r"\s+", "", str(v).strip())
        if not re.match(r"^[1-9][0-9]{5}$", cleaned):
            raise ValueError("PIN code must contain 6 digits (e.g. 400069)")
        return cleaned

    @validator("fullName", "houseNumber", "street", "area", "landmark", "city", "state", pre=True, always=False)
    def validate_address_text(cls, v):
        if v is None:
            return v
        cleaned = str(v).strip()
        if not cleaned:
            return None
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
    deliveryAddress: str = Field(..., min_length=5, max_length=255)

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
