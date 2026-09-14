import sqlite3, os

db_path = os.path.join("frontend", "prisma", "dev.db")
conn = sqlite3.connect(db_path)
c = conn.cursor()

print("=== Pharmacy columns ===")
c.execute("PRAGMA table_info(Pharmacy)")
cols = c.fetchall()
for col in cols:
    print(col)

print("\n=== Sample Pharmacies ===")
c.execute("SELECT * FROM Pharmacy LIMIT 5")
for r in c.fetchall():
    print(r)

print("\n=== Inventory columns ===")
c.execute("PRAGMA table_info(Inventory)")
for col in c.fetchall():
    print(col)

print("\n=== Sample Inventory ===")
c.execute("SELECT * FROM Inventory LIMIT 5")
for r in c.fetchall():
    print(r)

conn.close()
