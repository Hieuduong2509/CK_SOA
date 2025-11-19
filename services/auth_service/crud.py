from sqlalchemy.orm import Session
from sqlalchemy import and_
from models import User, RefreshToken, Verification
from passlib.context import CryptContext
import hashlib
from datetime import datetime, timedelta
import secrets
import uuid
from typing import Optional

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _prehash_password(password: str) -> str:
    """
    Pre-hash the raw password using SHA-256 before passing it to bcrypt.
    This prevents bcrypt from failing on extremely long passwords.
    """
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    """Hash a password using SHA-256 pre-hash + bcrypt."""
    return pwd_context.hash(_prehash_password(password))


def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()


def create_user(
    db: Session,
    email: str,
    password: str,
    name: str,
    role: str,
    phone: Optional[str] = None,
    headline: Optional[str] = None,
):
    password_hash = hash_password(password)
    db_user = User(
        email=email,
        password_hash=password_hash,
        name=name,
        role=role,
        phone=phone,
        headline=headline
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def create_user_with_password_hash(
    db: Session,
    email: str,
    password_hash: str,
    name: str,
    role: str,
    phone: Optional[str] = None,
    headline: Optional[str] = None,
):
    db_user = User(
        email=email,
        password_hash=password_hash,
        name=name,
        role=role,
        phone=phone,
        headline=headline
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(_prehash_password(plain_password), hashed_password)


def create_refresh_token(db: Session, user_id: int, expires_days: int = 7):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=expires_days)
    db_token = RefreshToken(
        user_id=user_id,
        token=token,
        expires_at=expires_at
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token


def get_refresh_token(db: Session, token: str):
    return db.query(RefreshToken).filter(
        and_(
            RefreshToken.token == token,
            RefreshToken.expires_at > datetime.utcnow()
        )
    ).first()


def revoke_refresh_token(db: Session, token: str):
    db_token = get_refresh_token(db, token)
    if db_token:
        db.delete(db_token)
        db.commit()
    return db_token


def create_verification_token(db: Session, user_id: int, verification_type: str, expires_hours: int = 24):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=expires_hours)
    db_verification = Verification(
        user_id=user_id,
        verification_type=verification_type,
        token=token,
        expires_at=expires_at
    )
    db.add(db_verification)
    db.commit()
    db.refresh(db_verification)
    return db_verification


def get_verification_by_token(db: Session, token: str):
    return db.query(Verification).filter(
        and_(
            Verification.token == token,
            Verification.expires_at > datetime.utcnow()
        )
    ).first()


def mark_email_verified(db: Session, user_id: int):
    user = get_user_by_id(db, user_id)
    if user:
        user.is_email_verified = True
        db.commit()
        db.refresh(user)
    return user

