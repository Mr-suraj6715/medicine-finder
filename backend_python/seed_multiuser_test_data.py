import os
import sys
from datetime import datetime, timezone

# Ensure backend_python is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base
import models
import auth
from utils import generate_cuid, current_iso_time

def seed_multiuser_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    print("=== SEEDING MULTI-USER LOCAL TEST DATA ===")
    
    # 1. 10 Customer Accounts
    customers_data = [
        {"name": "Aarav Sharma", "email": "customer01@medifind.test", "phone": "9820011221", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001", "house": "A-101 Sunrise Apts", "street": "MG Road", "landmark": "Near Flora Fountain"},
        {"name": "Priya Patel", "email": "customer02@medifind.test", "phone": "9820022332", "city": "Mumbai", "state": "Maharashtra", "pincode": "400050", "house": "Flat 4B Ocean View", "street": "Hill Road Bandra", "landmark": "Opposite St. Peter's Church"},
        {"name": "Rohan Gupta", "email": "customer03@medifind.test", "phone": "9820033443", "city": "Mumbai", "state": "Maharashtra", "pincode": "400076", "house": "702 Hiranandani Estate", "street": "Central Avenue Powai", "landmark": "Near D-Mart"},
        {"name": "Ananya Iyer", "email": "customer04@medifind.test", "phone": "9820044554", "city": "Mumbai", "state": "Maharashtra", "pincode": "400028", "house": "12 Shivaji Park Heights", "street": "Keluskar Road Dadar", "landmark": "Near Shivaji Park Gate 3"},
        {"name": "Vikram Singh", "email": "customer05@medifind.test", "phone": "9820055665", "city": "Mumbai", "state": "Maharashtra", "pincode": "400092", "house": "304 Gokul Dham", "street": "Eksar Road Borivali West", "landmark": "Near IC Colony"},
        {"name": "Sneha Reddy", "email": "customer06@medifind.test", "phone": "9820066776", "city": "Mumbai", "state": "Maharashtra", "pincode": "400069", "house": "501 Palm Springs", "street": "Andheri Kurla Road", "landmark": "Near Chakala Metro"},
        {"name": "Aditya Verma", "email": "customer07@medifind.test", "phone": "9820077887", "city": "Mumbai", "state": "Maharashtra", "pincode": "400053", "house": "B-202 Lokhandwala Tower", "street": "Lokhandwala Complex", "landmark": "Behind Celebrations Club"},
        {"name": "Pooja Mehta", "email": "customer08@medifind.test", "phone": "9820088998", "city": "Mumbai", "state": "Maharashtra", "pincode": "400077", "house": "Flat 14 Shanti Sadan", "street": "Tilak Road Ghatkopar", "landmark": "Near Jain Temple"},
        {"name": "Karan Joshi", "email": "customer09@medifind.test", "phone": "9820099009", "city": "Mumbai", "state": "Maharashtra", "pincode": "400057", "house": "103 Vile Parle Greens", "street": "Subhash Road Vile Parle East", "landmark": "Near Dinanath Mangeshkar Hall"},
        {"name": "Neha Desai", "email": "customer10@medifind.test", "phone": "9820010110", "city": "Mumbai", "state": "Maharashtra", "pincode": "400058", "house": "801 Windsor Court", "street": "SV Road Andheri West", "landmark": "Near Shoppers Stop"}
    ]
    
    customer_users = []
    for c in customers_data:
        existing = db.query(models.User).filter(models.User.email == c["email"]).first()
        if not existing:
            user = models.User(
                id=generate_cuid(),
                name=c["name"],
                email=c["email"],
                password=auth.hash_password("Customer@123"),
                role="user",
                phone=c["phone"],
                address=f"{c['house']}, {c['street']}, {c['city']}, {c['state']} - {c['pincode']}",
                loyaltyPoints=25,
                createdAt=current_iso_time(),
                updatedAt=current_iso_time()
            )
            db.add(user)
            db.flush()
            
            # Add Primary Address
            addr = models.Address(
                id=generate_cuid(),
                userId=user.id,
                label="Home",
                fullName=c["name"],
                phone=c["phone"],
                houseNumber=c["house"],
                street=c["street"],
                landmark=c["landmark"],
                city=c["city"],
                state=c["state"],
                pincode=c["pincode"],
                address=f"{c['house']}, {c['street']}, {c['city']}, {c['state']} - {c['pincode']}",
                isDefault=True,
                createdAt=current_iso_time(),
                updatedAt=current_iso_time()
            )
            db.add(addr)
            customer_users.append(user)
        else:
            customer_users.append(existing)
            
    print(f"[OK] Seeded / Verified {len(customer_users)} Customer accounts with default addresses.")

    # 2. 10 Shop Owners + Pharmacies
    shop_data = [
        {"name": "Apollo Lifecare Chemist", "owner_name": "Suresh Gupta", "email": "shop01@medifind.test", "phone": "022-26834101", "location": "Andheri West, Mumbai", "lat": 19.1197, "lng": 72.8468, "rating": 4.8, "open": "08:00 AM", "close": "11:00 PM"},
        {"name": "Wellness Forever Pharmacy", "owner_name": "Manish Shah", "email": "shop02@medifind.test", "phone": "022-26401202", "location": "Bandra West, Mumbai", "lat": 19.0596, "lng": 72.8295, "rating": 4.9, "open": "24 Hours", "close": "24 Hours"},
        {"name": "Noble Medical Store", "owner_name": "Ramesh Agarwal", "email": "shop03@medifind.test", "phone": "022-24142303", "location": "Dadar East, Mumbai", "lat": 19.0178, "lng": 72.8478, "rating": 4.7, "open": "09:00 AM", "close": "10:30 PM"},
        {"name": "Sanjivani Medicos", "owner_name": "Kailash Sharma", "email": "shop04@medifind.test", "phone": "022-28983404", "location": "Borivali West, Mumbai", "lat": 19.2307, "lng": 72.8567, "rating": 4.6, "open": "08:30 AM", "close": "11:00 PM"},
        {"name": "City Health Drugstore", "owner_name": "Dinesh Patel", "email": "shop05@medifind.test", "phone": "022-25704505", "location": "Powai, Mumbai", "lat": 19.1176, "lng": 72.9060, "rating": 4.8, "open": "09:00 AM", "close": "10:00 PM"},
        {"name": "Relief 24x7 Pharmacy", "owner_name": "Vinod Jain", "email": "shop06@medifind.test", "phone": "022-25365606", "location": "Thane West, Mumbai", "lat": 19.2183, "lng": 72.9781, "rating": 4.9, "open": "24 Hours", "close": "24 Hours"},
        {"name": "Guardian Healthcare Pharmacy", "owner_name": "Ashok Singhania", "email": "shop07@medifind.test", "phone": "022-25126707", "location": "Ghatkopar East, Mumbai", "lat": 19.0856, "lng": 72.9082, "rating": 4.5, "open": "08:00 AM", "close": "10:00 PM"},
        {"name": "Metro Care Chemist", "owner_name": "Rajendra Kothari", "email": "shop08@medifind.test", "phone": "022-26187808", "location": "Juhu Tara Road, Mumbai", "lat": 19.0988, "lng": 72.8264, "rating": 4.7, "open": "09:00 AM", "close": "11:00 PM"},
        {"name": "Lifeline Medicals", "owner_name": "Prakash Nair", "email": "shop09@medifind.test", "phone": "022-22848909", "location": "Colaba, Mumbai", "lat": 18.9067, "lng": 72.8147, "rating": 4.6, "open": "08:00 AM", "close": "10:00 PM"},
        {"name": "Prime Health Pharmacy", "owner_name": "Vijay Chawla", "email": "shop10@medifind.test", "phone": "022-28829010", "location": "Malad West, Mumbai", "lat": 19.1860, "lng": 72.8485, "rating": 4.8, "open": "08:30 AM", "close": "11:30 PM"}
    ]
    
    shop_users = []
    pharmacies = []
    for s in shop_data:
        existing = db.query(models.User).filter(models.User.email == s["email"]).first()
        if not existing:
            user = models.User(
                id=generate_cuid(),
                name=s["owner_name"],
                email=s["email"],
                password=auth.hash_password("ShopOwner@123"),
                role="shop_owner",
                phone=s["phone"],
                address=s["location"],
                createdAt=current_iso_time(),
                updatedAt=current_iso_time()
            )
            db.add(user)
            db.flush()
            
            pharmacy = models.Pharmacy(
                id=user.id,
                name=s["name"],
                location=s["location"],
                phone=s["phone"],
                latitude=s["lat"],
                longitude=s["lng"],
                rating=s["rating"],
                distance=1.2,
                openingTime=s["open"],
                closingTime=s["close"],
                isAvailable=True,
                createdAt=current_iso_time(),
                updatedAt=current_iso_time()
            )
            db.add(pharmacy)
            shop_users.append(user)
            pharmacies.append(pharmacy)
        else:
            shop_users.append(existing)
            pharm = db.query(models.Pharmacy).filter(models.Pharmacy.id == existing.id).first()
            if pharm:
                pharmacies.append(pharm)
                
    print(f"[OK] Seeded / Verified {len(shop_users)} Shop Owners & Pharmacies.")

    # 3. 10 Rider Accounts
    rider_data = [
        {"name": "Rahul Shinde", "email": "rider01@medifind.test", "phone": "9702011221", "vehicle": "Hero Splendor (MH-02-AB-1234)", "rating": 4.9, "completed": 128},
        {"name": "Amit Gaikwad", "email": "rider02@medifind.test", "phone": "9702022332", "vehicle": "Honda Activa 6G (MH-02-CD-5678)", "rating": 4.8, "completed": 94},
        {"name": "Sandeep Kamble", "email": "rider03@medifind.test", "phone": "9702033443", "vehicle": "Bajaj Pulsar 150 (MH-03-EF-9012)", "rating": 4.7, "completed": 76},
        {"name": "Deepak Pawar", "email": "rider04@medifind.test", "phone": "9702044554", "vehicle": "TVS Jupiter (MH-02-GH-3456)", "rating": 5.0, "completed": 150},
        {"name": "Sunil Jadhav", "email": "rider05@medifind.test", "phone": "9702055665", "vehicle": "Ather 450X EV (MH-04-IJ-7890)", "rating": 4.9, "completed": 112},
        {"name": "Vijay More", "email": "rider06@medifind.test", "phone": "9702066776", "vehicle": "Yamaha FZ (MH-02-KL-2345)", "rating": 4.6, "completed": 58},
        {"name": "Pradeep Kadam", "email": "rider07@medifind.test", "phone": "9702077887", "vehicle": "Suzuki Access 125 (MH-03-MN-6789)", "rating": 4.8, "completed": 89},
        {"name": "Sachin Salvi", "email": "rider08@medifind.test", "phone": "9702088998", "vehicle": "Honda Shine (MH-01-OP-1234)", "rating": 4.7, "completed": 64},
        {"name": "Ganesh Bhosale", "email": "rider09@medifind.test", "phone": "9702099009", "vehicle": "Ola S1 Pro EV (MH-02-QR-5678)", "rating": 4.9, "completed": 142},
        {"name": "Ramesh Sawant", "email": "rider10@medifind.test", "phone": "9702010110", "vehicle": "Royal Enfield Hunter (MH-02-ST-9012)", "rating": 5.0, "completed": 180}
    ]
    
    rider_users = []
    for r in rider_data:
        existing = db.query(models.User).filter(models.User.email == r["email"]).first()
        if not existing:
            user = models.User(
                id=generate_cuid(),
                name=r["name"],
                email=r["email"],
                password=auth.hash_password("Rider@123"),
                role="rider",
                phone=r["phone"],
                address="Mumbai Logistics Hub",
                vehicleType=r["vehicle"],
                riderRating=r["rating"],
                riderLoyaltyPoints=r["completed"] * 5,
                completedDeliveries=r["completed"],
                cancelledDeliveries=1,
                latitude=19.0760,
                longitude=72.8777,
                createdAt=current_iso_time(),
                updatedAt=current_iso_time()
            )
            db.add(user)
            rider_users.append(user)
        else:
            rider_users.append(existing)
            
    print(f"[OK] Seeded / Verified {len(rider_users)} Rider accounts with delivery records.")

    # 4. Standard Catalogue of Core Medicines
    core_medicines = [
        {"name": "Paracetamol 650mg (Dolo-650)", "genericName": "Paracetamol", "category": "Antipyretic & Analgesic", "manufacturer": "Micro Labs", "desc": "Relief from fever, headache and body pain.", "price": 32.50, "stock": 100},
        {"name": "Azithromycin 500mg (Azee-500)", "genericName": "Azithromycin", "category": "Antibiotic", "manufacturer": "Cipla", "desc": "Antibiotic used to treat bacterial respiratory infections.", "price": 115.00, "stock": 50},
        {"name": "Amoxicillin and Potassium Clavulanate (Augmentin 625)", "genericName": "Amoxicillin + Clavulanic Acid", "category": "Antibiotic", "manufacturer": "GSK", "desc": "Broad spectrum antibiotic for bacterial infections.", "price": 185.00, "stock": 40},
        {"name": "Cetirizine 10mg (Cetzine)", "genericName": "Cetirizine Hydrochloride", "category": "Antihistamine", "manufacturer": "Dr. Reddy's", "desc": "Relief from allergic rhinitis, runny nose, and hives.", "price": 28.00, "stock": 80},
        {"name": "Pantoprazole 40mg (Pan-40)", "genericName": "Pantoprazole Gastro-resistant", "category": "Antacid & PPI", "manufacturer": "Alkem Laboratories", "desc": "Treatment of acidity, heartburn, and GERD.", "price": 95.00, "stock": 60},
        {"name": "Telmisartan 40mg (Telma-40)", "genericName": "Telmisartan", "category": "Cardiovascular / Antihypertensive", "manufacturer": "Glenmark", "desc": "Management of high blood pressure and hypertension.", "price": 145.00, "stock": 35},
        {"name": "Metformin 500mg (Glycomet-500)", "genericName": "Metformin Hydrochloride", "category": "Antidiabetic", "manufacturer": "USV Ltd", "desc": "Oral anti-diabetic for blood glucose regulation in type 2 diabetes.", "price": 42.00, "stock": 90},
        {"name": "Montelukast & Levocetirizine (Montair-LC)", "genericName": "Montelukast + Levocetirizine", "category": "Respiratory / Antiallergic", "manufacturer": "Cipla", "desc": "Relief of allergic rhinitis and asthma symptoms.", "price": 170.00, "stock": 45},
        {"name": "Ibuprofen 400mg & Paracetamol (Combiflam)", "genericName": "Ibuprofen + Paracetamol", "category": "Pain Relief / NSAID", "manufacturer": "Sanofi India", "desc": "Anti-inflammatory painkiller for severe aches and joint pain.", "price": 48.00, "stock": 70},
        {"name": "Oral Rehydration Salts (Electral Sachet)", "genericName": "Oral Electrolytes WHO Formula", "category": "Hydration & Wellness", "manufacturer": "FDC Ltd", "desc": "Restores essential electrolytes during dehydration and diarrhea.", "price": 22.00, "stock": 150}
    ]

    for med_info in core_medicines:
        med = db.query(models.Medicine).filter(models.Medicine.name == med_info["name"]).first()
        if not med:
            med = models.Medicine(
                id=generate_cuid(),
                name=med_info["name"],
                genericName=med_info["genericName"],
                category=med_info["category"],
                manufacturer=med_info["manufacturer"],
                description=med_info["desc"],
                image="/medicine/placeholder.jpg",
                indications=f"Indicated for {med_info['category'].lower()}",
                createdAt=current_iso_time(),
                updatedAt=current_iso_time()
            )
            db.add(med)
            db.flush()

        # Seed inventory across first 5 pharmacies
        for pharm in pharmacies[:5]:
            inv = db.query(models.Inventory).filter(
                models.Inventory.medicineId == med.id,
                models.Inventory.pharmacyId == pharm.id
            ).first()
            if not inv:
                inv = models.Inventory(
                    id=generate_cuid(),
                    medicineId=med.id,
                    pharmacyId=pharm.id,
                    price=med_info["price"],
                    mrp=med_info["price"] * 1.15,
                    purchasePrice=med_info["price"] * 0.75,
                    stock=med_info["stock"],
                    sold=5,
                    batchNumber=f"BATCH-{pharm.id[:4].upper()}-2026",
                    expiryDate="2027-12-31",
                    supplier="National Pharma Distributors",
                    stockLocation="Shelf A-1",
                    createdAt=current_iso_time(),
                    updatedAt=current_iso_time()
                )
                db.add(inv)

    db.commit()
    print("[OK] Seeded / Verified Core Medicine Catalogue & Pharmacy Inventories.")
    db.close()
    print("=== MULTI-USER DATA SEEDING COMPLETE ===")

if __name__ == "__main__":
    seed_multiuser_data()
