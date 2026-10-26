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

# Render provides postgres:// but SQLAlchemy requires postgresql://
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCAL_SQLITE_URL = "sqlite:///" + os.path.join(BASE_DIR, "frontend", "prisma", "dev.db")

try:
    is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")
    connect_args = {"check_same_thread": False} if is_sqlite else {}

    engine_kwargs = {
        "connect_args": connect_args,
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    if not is_sqlite:
        engine_kwargs["pool_size"] = 5
        engine_kwargs["max_overflow"] = 5

    test_engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)
    with test_engine.connect() as conn:
        pass
    engine = test_engine

except Exception as e:
    print(f"Warning: Primary database connection failed ({e}). Falling back to local SQLite.")
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
