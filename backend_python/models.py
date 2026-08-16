from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Medicine(Base):
    __tablename__ = "Medicine"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, nullable=True)
    indications = Column(String, nullable=True)
    image = Column(String, nullable=True)
    createdAt = Column(String, nullable=True)
    updatedAt = Column(String, nullable=True)

    inventory = relationship("Inventory", back_populates="medicine")

class Pharmacy(Base):
    __tablename__ = "Pharmacy"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    rating = Column(Float, default=0.0)
    distance = Column(Float, default=0.0)
    phone = Column(String, nullable=True)
    openingTime = Column(String, default="9:00 AM")
    closingTime = Column(String, default="9:00 PM")
    isAvailable = Column(Boolean, default=True)
    createdAt = Column(String, nullable=True)
    updatedAt = Column(String, nullable=True)

    inventory = relationship("Inventory", back_populates="pharmacy")

class Inventory(Base):
    __tablename__ = "Inventory"

    id = Column(String, primary_key=True, index=True)
    medicineId = Column(String, ForeignKey("Medicine.id"), nullable=False)
    pharmacyId = Column(String, ForeignKey("Pharmacy.id"), nullable=False)
    price = Column(Float, nullable=False)
    stock = Column(Integer, default=0)
    sold = Column(Integer, default=0)
    createdAt = Column(String, nullable=True)
    updatedAt = Column(String, nullable=True)

    medicine = relationship("Medicine", back_populates="inventory")
    pharmacy = relationship("Pharmacy", back_populates="inventory")
    orderItems = relationship("OrderItem", back_populates="inventory")

class User(Base):
    __tablename__ = "User"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, default="user")
    loyaltyPoints = Column(Integer, default=0)
    riderRating = Column(Float, default=3.0)
    riderLoyaltyPoints = Column(Integer, default=0)
    completedDeliveries = Column(Integer, default=0)
    cancelledDeliveries = Column(Integer, default=0)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    vehicleType = Column(String, default="Motorcycle")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    createdAt = Column(String, nullable=True)
    updatedAt = Column(String, nullable=True)

    addresses = relationship("Address", back_populates="user")
    orders = relationship("Order", foreign_keys="[Order.userId]", back_populates="user")
    riderOrders = relationship("Order", foreign_keys="[Order.riderId]", back_populates="rider")
    healthLogs = relationship("HealthLog", back_populates="user")

class Address(Base):
    __tablename__ = "Address"

    id = Column(String, primary_key=True, index=True)
    label = Column(String, nullable=False)
    address = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    userId = Column(String, ForeignKey("User.id"), nullable=False)
    createdAt = Column(String, nullable=True)

    user = relationship("User", back_populates="addresses")

class HealthLog(Base):
    __tablename__ = "HealthLog"

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("User.id"), nullable=False)
    symptoms = Column(String, nullable=False)
    prescription = Column(String, nullable=True)
    createdAt = Column(String, nullable=True)

    user = relationship("User", back_populates="healthLogs")

class Order(Base):
    __tablename__ = "Order"

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("User.id"), nullable=False)
    riderId = Column(String, ForeignKey("User.id"), nullable=True)
    cancelledRiderId = Column(String, nullable=True)
    totalAmount = Column(Float, nullable=False)
    discountApplied = Column(Float, default=0.0)
    loyaltyEarned = Column(Integer, default=0)
    isEmergency = Column(Boolean, default=False)
    surgeFee = Column(Float, default=0.0)
    driverEarnings = Column(Float, default=0.0)
    status = Column(String, default="PENDING")
    paymentMethod = Column(String, default="CASH_ON_DELIVERY")
    deliveryAddress = Column(String, nullable=True)
    deliveryLat = Column(Float, nullable=True)
    deliveryLng = Column(Float, nullable=True)
    trackingNumber = Column(String, nullable=True)
    estimatedDelivery = Column(String, nullable=True)
    deliveryStartTime = Column(String, nullable=True)
    deliveryEndTime = Column(String, nullable=True)
    deliveryDurationMinutes = Column(Integer, nullable=True)
    deliveryDistance = Column(Float, nullable=True)
    ratingEarned = Column(Float, nullable=True)
    loyaltyPointsChange = Column(Integer, nullable=True)
    createdAt = Column(String, nullable=True)

    user = relationship("User", foreign_keys=[userId], back_populates="orders")
    rider = relationship("User", foreign_keys=[riderId], back_populates="riderOrders")
    items = relationship("OrderItem", back_populates="order")

class OrderItem(Base):
    __tablename__ = "OrderItem"

    id = Column(String, primary_key=True, index=True)
    orderId = Column(String, ForeignKey("Order.id"), nullable=False)
    inventoryId = Column(String, ForeignKey("Inventory.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    priceAtTime = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")
    inventory = relationship("Inventory", back_populates="orderItems")
