from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/marketplace_db")
# Auth database URL - use the same connection string as auth-service
AUTH_DATABASE_URL = os.getenv("AUTH_DATABASE_URL", "postgresql://postgres:postgres@postgres-auth:5432/auth_db")

engine = create_engine(DATABASE_URL)
auth_engine = create_engine(AUTH_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)

