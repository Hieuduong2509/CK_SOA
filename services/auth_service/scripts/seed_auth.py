#!/usr/bin/env python3
"""
Seed auth database only - run from auth-service container
"""
import sys
import os

# Add service path - in container /app is the service root
sys.path.insert(0, '/app')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import User, UserRole
from database import Base
import hashlib
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    prehashed = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return pwd_context.hash(prehashed)

# Database URL from environment
AUTH_DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@postgres-auth:5432/auth_db")

def seed_auth_db():
    """Seed auth database with users"""
    engine = create_engine(AUTH_DB_URL)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    users = [
        {
            "email": "admin@codedesign.com",
            "password": "admin123",
            "name": "Admin User",
            "role": UserRole.ADMIN,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84123450000",
            "headline": "System Administrator"
        },
        {
            "email": "freelancer1@codedesign.com",
            "password": "freelancer123",
            "name": "John Developer",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84123451111",
            "headline": "Full-stack Solution Architect"
        },
        {
            "email": "freelancer2@codedesign.com",
            "password": "freelancer123",
            "name": "Jane Designer",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84123452222",
            "headline": "Senior UI/UX & Branding Expert"
        },
        {
            "email": "client1@codedesign.com",
            "password": "client123",
            "name": "Client One",
            "role": UserRole.CLIENT,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84123453333",
            "headline": "Product Owner"
        },
        {
            "email": "client2@codedesign.com",
            "password": "client123",
            "name": "Client Two",
            "role": UserRole.CLIENT,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84123454444",
            "headline": "Startup Founder"
        },
        {
            "email": "freelancer3@codedesign.com",
            "password": "freelancer123",
            "name": "Linh Product",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84987654321",
            "headline": "Product Designer & No-code Builder"
        },
        {
            "email": "dev1@codedesign.com",
            "password": "freelancer123",
            "name": "Minh Backend",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84901234567",
            "headline": "Senior Backend Engineer"
        },
        {
            "email": "dev2@codedesign.com",
            "password": "freelancer123",
            "name": "Anh Frontend",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84901234568",
            "headline": "React & Vue.js Specialist"
        },
        {
            "email": "dev3@codedesign.com",
            "password": "freelancer123",
            "name": "Huy Fullstack",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84901234569",
            "headline": "Full-stack JavaScript Developer"
        },
        {
            "email": "designer1@codedesign.com",
            "password": "freelancer123",
            "name": "Lan UI Designer",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84901234570",
            "headline": "UI Designer & Prototyping Expert"
        },
        {
            "email": "designer2@codedesign.com",
            "password": "freelancer123",
            "name": "Hoa Brand Designer",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84901234571",
            "headline": "Brand Identity & Logo Designer"
        },
        {
            "email": "designer3@codedesign.com",
            "password": "freelancer123",
            "name": "Mai UX Researcher",
            "role": UserRole.FREELANCER,
            "is_verified": True,
            "is_email_verified": True,
            "phone": "+84901234572",
            "headline": "UX Researcher & Interaction Designer"
        }
    ]
    
    for user_data in users:
        existing = db.query(User).filter(User.email == user_data["email"]).first()
        if not existing:
            user = User(
                email=user_data["email"],
                password_hash=hash_password(user_data["password"]),
                name=user_data["name"],
                phone=user_data.get("phone"),
                headline=user_data.get("headline"),
                role=user_data["role"],
                is_verified=user_data.get("is_verified", False),
                is_email_verified=user_data.get("is_email_verified", False)
            )
            db.add(user)
    
    db.commit()
    print("✓ Auth database seeded")
    db.close()

if __name__ == "__main__":
    print("Seeding auth database...")
    seed_auth_db()
    print("✓ Complete!")

