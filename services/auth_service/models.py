from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import enum

Base = declarative_base()


class UserRole(str, enum.Enum):
    FREELANCER = "freelancer"
    CLIENT = "client"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    headline = Column(String, nullable=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.CLIENT)
    is_verified = Column(Boolean, default=False)
    is_email_verified = Column(Boolean, default=False)
    is_2fa_enabled = Column(Boolean, default=False)
    two_fa_secret = Column(String, nullable=True)
    is_banned = Column(Boolean, default=False)
    suspended_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Verification(Base):
    __tablename__ = "verifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    verification_type = Column(String, nullable=False)  # 'email', 'identity'
    token = Column(String, unique=True, nullable=False)
    status = Column(String, default="pending")  # 'pending', 'approved', 'rejected'
    document_url = Column(String, nullable=True)
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    token = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

