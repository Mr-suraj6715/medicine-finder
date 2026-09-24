import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from dotenv import load_dotenv
load_dotenv()

# Support an environment variable for PostgreSQL (Render/Neon/Supabase)
# If not present, fallback to the local SQLite database
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DB_PATH = os.path.join(BASE_DIR, "frontend", "prisma", "dev.db")
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# For PostgreSQL, we might need to change the connection string if it's 'postgres://' instead of 'postgresql://'
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCAL_SQLITE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'frontend', 'prisma', 'dev.db')}"

try:
    connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {"connect_timeout": 2}
    test_engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_recycle=300,
    )
    # Test connection
    with test_engine.connect() as conn:
        pass
    engine = test_engine
except Exception as e:
    print(f"Warning: Primary database connection failed ({e}). Falling back to local SQLite at {LOCAL_SQLITE_URL}")
    SQLALCHEMY_DATABASE_URL = LOCAL_SQLITE_URL
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
