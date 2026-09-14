from pydantic import BaseModel, Field, validator
from typing import Optional, List
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
    label: str = Field(..., min_length=1, max_length=50)
    address: str = Field(..., min_length=5, max_length=255)

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
