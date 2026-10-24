import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import sys

# Add the parent directory to sys.path so we can import modules from backend_python
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from database import Base, get_db
import models
import auth

from sqlalchemy.pool import StaticPool

# Use in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    # Create tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Seed initial data for testing
        user = models.User(
            id="test-user-id",
            name="Test User",
            email="user@test.com",
            password=auth.hash_password("password123"),
            role="user",
            loyaltyPoints=10
        )
        rider = models.User(
            id="test-rider-id",
            name="Test Rider",
            email="rider@test.com",
            password=auth.hash_password("password123"),
            role="rider",
            riderRating=5.0
        )
        shop_owner = models.User(
            id="test-shop-id",
            name="Test Shop Owner",
            email="shop@test.com",
            password=auth.hash_password("password123"),
            role="shop_owner"
        )
        pharmacy = models.Pharmacy(
            id="test-pharmacy-id",
            name="Test Pharmacy",
            location="Mumbai, MH",
            latitude=19.076,
            longitude=72.877,
            isAvailable=True
        )
        medicine = models.Medicine(
            id="test-medicine-id",
            name="Paracetamol 500mg",
            category="Analgesics"
        )
        inventory = models.Inventory(
            id="test-inventory-id",
            medicineId="test-medicine-id",
            pharmacyId="test-pharmacy-id",
            price=15.0,
            stock=10,
            sold=0
        )
        db.add(user)
        db.add(rider)
        db.add(shop_owner)
        db.add(pharmacy)
        db.add(medicine)
        db.add(inventory)
        db.commit()
        
        yield db
    finally:
        db.close()
        # Drop tables
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def auth_headers():
    def _headers(email: str):
        token = auth.create_access_token(data={"sub": email})
        return {"Authorization": f"Bearer {token}"}
    return _headers
