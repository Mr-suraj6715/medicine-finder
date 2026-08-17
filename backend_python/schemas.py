from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = None
    role: Optional[str] = "user"

class SignupRequest(BaseModel):
    name: str
    email: str
    password: Optional[str] = None
    role: Optional[str] = "user"
    phone: Optional[str] = None
    location: Optional[str] = None

class AddressCreate(BaseModel):
    userId: str
    label: str
    address: str

class RiderProfileUpdate(BaseModel):
    userId: str
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    vehicleType: Optional[str] = None

class ShopSettingsUpdate(BaseModel):
    pharmacyId: str
    name: Optional[str] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    openingTime: Optional[str] = None
    closingTime: Optional[str] = None
    isAvailable: Optional[bool] = None

class OrderCreateItem(BaseModel):
    inventoryId: str
    quantity: int
    priceAtTime: float

class OrderCreate(BaseModel):
    userId: str
    items: List[OrderCreateItem]
    totalAmount: float
    discountApplied: Optional[float] = 0.0
    loyaltyEarned: Optional[int] = 0
    isEmergency: Optional[bool] = False
    surgeFee: Optional[float] = 0.0
    paymentMethod: Optional[str] = "CASH_ON_DELIVERY"
    deliveryAddress: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    orderId: str
    status: str
    riderId: Optional[str] = None

class RiderAcceptOrder(BaseModel):
    orderId: str
    riderId: str

class RiderLocationUpdate(BaseModel):
    riderId: str
    latitude: float
    longitude: float

class ShopReassign(BaseModel):
    orderId: str
    riderId: str

class InventoryAddMedicine(BaseModel):
    action: str = "add_medicine"
    pharmacyId: str
    medicineName: str
    category: Optional[str] = None
    price: float
    stock: int

class InventoryUpdateStock(BaseModel):
    action: str = "update_stock"
    pharmacyId: str
    medicineId: str
    price: Optional[float] = None
    stock: Optional[int] = None
    category: Optional[str] = None

class AIConsultantRequest(BaseModel):
    symptoms: str
    userEmail: Optional[str] = None

class AIPrescribeRequest(BaseModel):
    prescriptionText: str
    userEmail: Optional[str] = None
