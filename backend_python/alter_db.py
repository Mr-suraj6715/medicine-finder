import os
import sqlalchemy

db_url = "postgresql://postgres.uwdpfhrhpqmsacfgifho:Darvyx%40Suraj@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
engine = sqlalchemy.create_engine(db_url)
with engine.connect() as conn:
    try:
        conn.execute(sqlalchemy.text('ALTER TABLE "User" ADD COLUMN "password" VARCHAR(255);'))
        conn.commit()
        print('Column added successfully')
    except Exception as e:
        print('Error:', e)
