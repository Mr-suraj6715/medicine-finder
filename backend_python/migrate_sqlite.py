import os
import sqlite3
from database import Base, engine
import models

def migrate():
    # Get DB path
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(BASE_DIR, "frontend", "prisma", "dev.db")
    print(f"Checking SQLite database at: {db_path}")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    type_mapping = {
        "INTEGER": "INTEGER",
        "FLOAT": "REAL",
        "BOOLEAN": "BOOLEAN",
        "STRING": "TEXT",
        "VARCHAR": "TEXT",
        "TEXT": "TEXT",
        "DATETIME": "DATETIME",
    }

    for table_name, table in Base.metadata.tables.items():
        # Check if table exists
        c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
        if not c.fetchone():
            print(f"Table {table_name} does not exist in SQLite, creating...")
            table.create(bind=engine, checkfirst=True)
            continue

        # Get existing columns
        c.execute(f'PRAGMA table_info("{table_name}")')
        existing_cols = {row[1] for row in c.fetchall()}

        # Check each column in model
        for col in table.columns:
            if col.name not in existing_cols:
                col_type = str(col.type).upper()
                sql_type = "TEXT"
                for k, v in type_mapping.items():
                    if k in col_type:
                        sql_type = v
                        break
                alter_sql = f'ALTER TABLE "{table_name}" ADD COLUMN "{col.name}" {sql_type}'
                print(f"Adding column: {alter_sql}")
                try:
                    c.execute(alter_sql)
                    conn.commit()
                except Exception as e:
                    print(f"Error altering table {table_name}: {e}")

    conn.close()
    print("Migration check complete.")

if __name__ == "__main__":
    migrate()
