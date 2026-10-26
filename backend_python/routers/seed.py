"""
Demo seeding module — ensures live database has complete demo data for hackathon judges & evaluation.
Provides endpoints:
- GET /api/seed/demo
- POST /api/seed/demo
- GET /api/seed/status
Also runs automatically on app startup if Medicine count is 0.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
import models
import auth
from utils import generate_cuid, current_iso_time

router = APIRouter(prefix="/api/seed", tags=["seed"])

DEMO_MEDICINES = [
    {
        "name": "Paracetamol 650mg (Dolo-650)",
        "generic": "Paracetamol",
        "cat": "Antipyretic & Analgesic",
        "mfr": "Micro Labs",
        "desc": "Fast relief from fever, headache, body pain, and toothache.",
        "price": 32.50,
        "stock": 120
    },
    {
        "name": "Azithromycin 500mg (Azee-500)",
        "generic": "Azithromycin",
        "cat": "Antibiotic",
        "mfr": "Cipla",
        "desc": "Broad-spectrum macrolide antibiotic for respiratory tract and skin infections.",
        "price": 115.00,
        "stock": 60
    },
    {
        "name": "Amoxicillin and Potassium Clavulanate (Augmentin 625)",
        "generic": "Amoxicillin + Clavulanic Acid",
        "cat": "Antibiotic",
        "mfr": "GSK",
        "desc": "Potent broad-spectrum antibacterial for resistant respiratory and soft-tissue infections.",
        "price": 185.00,
        "stock": 50
    },
    {
        "name": "Cetirizine 10mg (Cetzine)",
        "generic": "Cetirizine HCl",
        "cat": "Antihistamine",
        "mfr": "Dr. Reddy's",
        "desc": "Relief from allergic rhinitis, runny nose, sneezing, itching, and hives.",
        "price": 28.00,
        "stock": 100
    },
    {
        "name": "Pantoprazole 40mg (Pan-40)",
        "generic": "Pantoprazole Sodium",
        "cat": "Antacid & PPI",
        "mfr": "Alkem Laboratories",
        "desc": "Effective treatment for acidity, heartburn, gastritis, and GERD acid reflux.",
        "price": 95.00,
        "stock": 80
    },
    {
        "name": "Ibuprofen 400mg + Paracetamol (Combiflam)",
        "generic": "Ibuprofen + Paracetamol",
        "cat": "Pain Relief / NSAID",
        "mfr": "Sanofi India",
        "desc": "Dual-action pain and inflammation relief for severe muscle aches and sprains.",
        "price": 48.00,
        "stock": 90
    },
    {
        "name": "Metformin 500mg (Glycomet-500)",
        "generic": "Metformin HCl",
        "cat": "Antidiabetic",
        "mfr": "USV Ltd",
        "desc": "First-line oral anti-diabetic medication for managing Type 2 diabetes mellitus.",
        "price": 42.00,
        "stock": 110
    },
    {
        "name": "Amoxicillin 500mg (Mox-500)",
        "generic": "Amoxicillin",
        "cat": "Antibiotic",
        "mfr": "Cipla",
        "desc": "Effective penicillin-class antibiotic for ear, throat, urinary, and chest infections.",
        "price": 85.00,
        "stock": 70
    },
    {
        "name": "Vitamin D3 60000 IU (D-Rise)",
        "generic": "Cholecalciferol",
        "cat": "Vitamin & Supplement",
        "mfr": "Sun Pharma",
        "desc": "High-strength weekly dosage capsule to treat Vitamin D deficiency and support bone health.",
        "price": 68.00,
        "stock": 95
    },
    {
        "name": "Oral Rehydration Salts (Electral)",
        "generic": "ORS WHO Formula",
        "cat": "Hydration & Wellness",
        "mfr": "FDC Ltd",
        "desc": "Restores vital electrolyte balance and prevents dehydration during heat and sickness.",
        "price": 22.00,
        "stock": 200
    },
    {
        "name": "Montelukast 10mg (Montair-10)",
        "generic": "Montelukast Sodium",
        "cat": "Respiratory",
        "mfr": "Cipla",
        "desc": "Long-term control and prevention of asthma symptoms and seasonal allergies.",
        "price": 145.00,
        "stock": 55
    },
    {
        "name": "Telmisartan 40mg (Telma-40)",
        "generic": "Telmisartan",
        "cat": "Cardiovascular / Antihypertensive",
        "mfr": "Glenmark",
        "desc": "Blood pressure management and cardiovascular risk reduction.",
        "price": 140.00,
        "stock": 65
    }
]

def ensure_demo_data_seeded(db: Session) -> dict:
    seeded_meds = []
    seeded_inv = 0

    # 1. Demo Customer
    customer = db.query(models.User).filter(models.User.email == "demo@medstore.com").first()
    if not customer:
        customer = models.User(
            id=generate_cuid(),
            email="demo@medstore.com",
            name="Demo Customer",
            password=auth.hash_password("demo123"),
            role="user",
            phone="9820011221",
            address="A-101 Sunrise Apts, MG Road, Mumbai - 400001",
            loyaltyPoints=50,
            createdAt=current_iso_time(),
            updatedAt=current_iso_time()
        )
        db.add(customer)
        db.flush()
    else:
        if not customer.name:
            customer.name = "Demo Customer"
        if not customer.phone:
            customer.phone = "9820011221"
        db.flush()

    # Ensure Customer has a saved Address for easy 1-click checkout
    cust_addr = db.query(models.Address).filter(models.Address.userId == customer.id).first()
    if not cust_addr:
        cust_addr = models.Address(
            id=generate_cuid(),
            userId=customer.id,
            label="Home",
            fullName="Demo Customer",
            phone="9820011221",
            houseNumber="A-101",
            street="MG Road",
            landmark="Near Flora Fountain",
            area="Fort",
            city="Mumbai",
            state="Maharashtra",
            pincode="400001",
            address="A-101 Sunrise Apts, MG Road, Near Flora Fountain, Mumbai, Maharashtra - 400001",
            latitude=19.0760,
            longitude=72.8777,
            isDefault=True,
            createdAt=current_iso_time(),
            updatedAt=current_iso_time()
        )
        db.add(cust_addr)
        db.flush()

    # 2. Demo Shop Owner & Pharmacy
    shop_user = db.query(models.User).filter(models.User.email == "shop@medstore.com").first()
    if not shop_user:
        shop_user = models.User(
            id=generate_cuid(),
            email="shop@medstore.com",
            name="MediStore Pharmacy",
            password=auth.hash_password("shop123"),
            role="shop_owner",
            phone="022-26543210",
            address="Central Plaza, Mumbai - 400001",
            createdAt=current_iso_time(),
            updatedAt=current_iso_time()
        )
        db.add(shop_user)
        db.flush()

    pharmacy1 = db.query(models.Pharmacy).filter(models.Pharmacy.id == shop_user.id).first()
    if not pharmacy1:
        pharmacy1 = models.Pharmacy(
            id=shop_user.id,
            name="MediStore Pharmacy",
            location="Central Plaza, Mumbai",
            phone="022-26543210",
            rating=4.9,
            distance=0.5,
            openingTime="8:00 AM",
            closingTime="11:00 PM",
            isAvailable=True,
            latitude=19.0760,
            longitude=72.8777,
            createdAt=current_iso_time(),
            updatedAt=current_iso_time()
        )
        db.add(pharmacy1)
        db.flush()

    # Additional demo pharmacies to showcase store comparisons
    extra_pharmacies_data = [
        {
            "id": "pharm_apollo_01",
            "name": "Apollo Pharmacy",
            "location": "Linking Road, Bandra, Mumbai",
            "phone": "022-26401234",
            "rating": 4.8,
            "distance": 1.2,
            "latitude": 19.0600,
            "longitude": 72.8340
        },
        {
            "id": "pharm_wellness_02",
            "name": "Wellness Forever Chemist",
            "location": "MG Road, Fort, Mumbai",
            "phone": "022-22874561",
            "rating": 4.7,
            "distance": 2.0,
            "latitude": 19.0728,
            "longitude": 72.8826
        }
    ]
    extra_pharmacies = []
    for p_data in extra_pharmacies_data:
        p = db.query(models.Pharmacy).filter(models.Pharmacy.id == p_data["id"]).first()
        if not p:
            p = models.Pharmacy(
                id=p_data["id"],
                name=p_data["name"],
                location=p_data["location"],
                phone=p_data["phone"],
                rating=p_data["rating"],
                distance=p_data["distance"],
                openingTime="24 Hours",
                closingTime="24 Hours",
                isAvailable=True,
                latitude=p_data["latitude"],
                longitude=p_data["longitude"],
                createdAt=current_iso_time(),
                updatedAt=current_iso_time()
            )
            db.add(p)
            db.flush()
        extra_pharmacies.append(p)

    all_pharmacies = [pharmacy1] + extra_pharmacies

    # 3. Demo Rider
    rider_user = db.query(models.User).filter(models.User.email == "rider@medstore.com").first()
    if not rider_user:
        rider_user = models.User(
            id=generate_cuid(),
            email="rider@medstore.com",
            name="Rider Partner",
            password=auth.hash_password("rider123"),
            role="rider",
            phone="9820099009",
            vehicleType="Motorcycle",
            riderRating=4.9,
            riderLoyaltyPoints=120,
            completedDeliveries=28,
            latitude=19.0750,
            longitude=72.8770,
            createdAt=current_iso_time(),
            updatedAt=current_iso_time()
        )
        db.add(rider_user)
        db.flush()
    else:
        if not rider_user.name:
            rider_user.name = "Rider Partner"
        db.flush()

    # 4. Medicines & Inventories
    for m in DEMO_MEDICINES:
        med = db.query(models.Medicine).filter(models.Medicine.name == m["name"]).first()
        if not med:
            med = models.Medicine(
                id=generate_cuid(),
                name=m["name"],
                genericName=m["generic"],
                category=m["cat"],
                manufacturer=m["mfr"],
                description=m["desc"],
                image="/medicine/placeholder.jpg",
                indications=f"Indicated for {m['cat'].lower()}",
                createdAt=current_iso_time(),
                updatedAt=current_iso_time()
            )
            db.add(med)
            db.flush()
            seeded_meds.append(m["name"])

        # Create inventory across pharmacies with slight price variance
        for idx, pharm in enumerate(all_pharmacies):
            inv = db.query(models.Inventory).filter(
                models.Inventory.medicineId == med.id,
                models.Inventory.pharmacyId == pharm.id
            ).first()
            if not inv:
                # Slight price variation between pharmacies
                price_offset = idx * 2.0
                actual_price = round(m["price"] + price_offset, 2)
                inv = models.Inventory(
                    id=generate_cuid(),
                    medicineId=med.id,
                    pharmacyId=pharm.id,
                    price=actual_price,
                    mrp=round(actual_price * 1.15, 2),
                    purchasePrice=round(actual_price * 0.75, 2),
                    stock=m["stock"] - (idx * 10),
                    sold=12 + idx * 3,
                    batchNumber=f"BATCH-{pharm.name[:4].upper()}-2026",
                    expiryDate="2027-12-31",
                    supplier="National Pharma Distributors",
                    stockLocation="Shelf A-1",
                    createdAt=current_iso_time(),
                    updatedAt=current_iso_time()
                )
                db.add(inv)
                seeded_inv += 1

    db.commit()
    return {
        "success": True,
        "message": f"Demo data seeded successfully! {len(seeded_meds)} new medicines and {seeded_inv} inventory entries created.",
        "medicines_count": db.query(models.Medicine).count(),
        "inventory_count": db.query(models.Inventory).count(),
        "pharmacies_count": db.query(models.Pharmacy).count(),
        "demo_accounts": {
            "customer": "demo@medstore.com",
            "shop_owner": "shop@medstore.com",
            "rider": "rider@medstore.com"
        }
    }

@router.get("/demo")
def seed_demo_get(db: Session = Depends(get_db)):
    return ensure_demo_data_seeded(db)

@router.post("/demo")
def seed_demo_post(db: Session = Depends(get_db)):
    return ensure_demo_data_seeded(db)

@router.get("/status")
def seed_status(db: Session = Depends(get_db)):
    med_count = db.query(models.Medicine).count()
    inv_count = db.query(models.Inventory).count()
    user_count = db.query(models.User).count()
    pharmacy_count = db.query(models.Pharmacy).count()
    return {
        "ready": med_count > 0 and inv_count > 0,
        "medicines": med_count,
        "inventory": inv_count,
        "users": user_count,
        "pharmacies": pharmacy_count
    }
