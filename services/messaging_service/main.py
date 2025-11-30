from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routes import router
import os

app = FastAPI(
    title="Messaging Service API",
    description="Real-time chat and messaging microservice",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.on_event("startup")
async def startup_event():
    init_db()


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "messaging-service"}

