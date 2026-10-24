import sqlite3, os, uuid, time

db_path = os.path.join("frontend", "prisma", "dev.db")
conn = sqlite3.connect(db_path)
c = conn.cursor()

def cuid():
    import random, string
    chars = string.ascii_lowercase + string.digits
    return 'c' + ''.join(random.choices(chars, k=24))

now = int(time.time() * 1000)

# ── 1. Update existing pharmacies with lat/lng ──
pharmacies_latlong = [
    ('cmmp1vmuh0003unu4ocytr7ca', 19.0760, 72.8777, 'Apollo Pharmacy',      'Andheri, Mumbai'),
    ('cmmp1vmun0004unu4w330fhso', 19.1136, 72.8697, 'HealthPlus Medicos',   'Borivali, Mumbai'),
    ('cmmp1vmut0005unu49l5d1z5g', 19.0454, 72.8415, 'City Pharma',          'Bandra, Mumbai'),
    ('cmmpahjwn0003unucynfc0160', 19.0596, 72.8295, 'chuuut Pharmacy',      'Kurla, Mumbai'),
    ('cmmpcpy170000unwco18lk8he', 19.0822, 72.8840, 'MediStore',            'Malad, Mumbai'),
]

for pid, lat, lng, name, loc in pharmacies_latlong:
    c.execute("""
        UPDATE Pharmacy SET latitude=?, longitude=?, name=?, location=?, rating=?, updatedAt=?
        WHERE id=?
    """, (lat, lng, name, loc, round(4.2 + (hash(pid) % 10) * 0.08, 1), now, pid))
    print(f"Updated {name}")

# ── 2. Add 2 new pharmacies ──
new_pharmacies = [
    (cuid(), 'MedLife Pharmacy',  'Dadar, Mumbai',     19.0178, 72.8478, 4.6, 0.9, '9:00 AM', '10:00 PM'),
    (cuid(), 'GenericMeds Hub',   'Thane, Mumbai',     19.2183, 72.9781, 4.3, 2.1, '8:00 AM', '9:00 PM'),
]

for pid, name, loc, lat, lng, rating, dist, op, cl in new_pharmacies:
    c.execute("""
        INSERT OR IGNORE INTO Pharmacy (id, name, location, latitude, longitude, rating, distance, phone, openingTime, closingTime, isAvailable, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    """, (pid, name, loc, lat, lng, rating, dist, '9999999999', op, cl, now, now))
    print(f"Added pharmacy: {name} ({pid})")

conn.commit()

# ── 3. Get all pharmacy IDs and all medicine IDs ──
c.execute("SELECT id FROM Pharmacy")
all_pharmacies = [r[0] for r in c.fetchall()]

c.execute("SELECT id FROM Medicine LIMIT 200")
all_medicines = [r[0] for r in c.fetchall()]

print(f"\nTotal pharmacies: {len(all_pharmacies)}")
print(f"Total medicines to link: {len(all_medicines)}")

# ── 4. For each medicine, ensure every pharmacy has inventory ──
import random
random.seed(42)

inserted = 0
for med_id in all_medicines:
    for pharm_id in all_pharmacies:
        # Check if inventory exists
        c.execute("SELECT id FROM Inventory WHERE medicineId=? AND pharmacyId=?", (med_id, pharm_id))
        if c.fetchone() is None:
            price = round(random.uniform(10, 500), 2)
            stock = random.randint(5, 100)
            inv_id = cuid()
            c.execute("""
                INSERT INTO Inventory (id, medicineId, pharmacyId, price, stock, sold, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?)
            """, (inv_id, med_id, pharm_id, price, stock, now, now))
            inserted += 1

conn.commit()
print(f"\nInserted {inserted} new inventory entries")

# ── 5. Final counts ──
c.execute("SELECT COUNT(*) FROM Pharmacy"); print("Pharmacies:", c.fetchone()[0])
c.execute("SELECT COUNT(*) FROM Inventory"); print("Inventory rows:", c.fetchone()[0])
conn.close()
print("\nDone! All pharmacies now have lat/lng and inventory.")
