import sqlite3, os

db_path = os.path.join("frontend", "prisma", "dev.db")
conn = sqlite3.connect(db_path)
c = conn.cursor()

BAD_ID = "cmmpahjwn0003unucynfc0160"
c.execute("DELETE FROM Inventory WHERE pharmacyId=?", (BAD_ID,))
c.execute("DELETE FROM Pharmacy WHERE id=?", (BAD_ID,))
conn.commit()
print("Deleted chuuut Pharmacy and its inventory")

c.execute("SELECT name, location, latitude, longitude FROM Pharmacy")
print("\nRemaining pharmacies:")
for r in c.fetchall():
    print(" -", r)

conn.close()
