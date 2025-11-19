from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from models import UserRole


class UserSignup(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole = UserRole.CLIENT
    phone: Optional[str] = None
    headline: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    two_fa_code: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthSuccessResponse(TokenResponse):
    user: "UserResponse"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    phone: Optional[str] = None
    headline: Optional[str] = None
    role: UserRole
    is_verified: bool
    is_email_verified: bool
    is_2fa_enabled: bool
    is_banned: bool
    suspended_until: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VerifyEmailRequest(BaseModel):
    token: str


class RequestPasswordReset(BaseModel):
    email: EmailStr


class ConfirmPasswordReset(BaseModel):
    token: str
    new_password: str


class Enable2FARequest(BaseModel):
    password: str


class Enable2FAResponse(BaseModel):
    secret: str
    qr_code_url: str


class Verify2FARequest(BaseModel):
    code: str


class IdentityVerificationRequest(BaseModel):
    document_url: str
    document_type: str  # 'CMND', 'CCCD', 'PASSPORT'


class FreelancerOtpStart(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    headline: Optional[str] = None


class FreelancerOtpVerify(BaseModel):
    email: EmailStr
    otp: str


class SuspendRequest(BaseModel):
    days: int = 30


class AdminUserActionResponse(BaseModel):
    message: str
    user: UserResponse


AuthSuccessResponse.update_forward_refs()

