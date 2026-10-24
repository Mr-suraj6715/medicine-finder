import sqlite3, os

db_path = os.path.join("frontend", "prisma", "dev.db")
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute("SELECT name, category, description FROM Medicine LIMIT 50")
for r in c.fetchall():
    print(r)

conn.close()
