import uuid
import datetime
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from database import engine, Base
from utils import generate_cuid, current_iso_time  # noqa: F401 – re-exported for backward compatibility

# Import and register all routers
from routers import auth as auth_router
from routers import user as user_router
from routers import orders as orders_router
from routers import rider as rider_router
from routers import shop as shop_router
from routers import inventory as inventory_router
from routers import ai as ai_router

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MediFind Python Backend API",
    description="Python FastAPI REST Backend for Medifind Healthcare Logistics",
    version="1.0.0"
)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router.router)
app.include_router(user_router.router)
app.include_router(orders_router.router)
app.include_router(rider_router.router)
app.include_router(shop_router.router)
app.include_router(inventory_router.router)
app.include_router(ai_router.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.datetime.now(datetime.UTC).isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
