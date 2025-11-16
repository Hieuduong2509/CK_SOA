from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from schemas import (
    UserSignup, UserLogin, TokenResponse, RefreshTokenRequest,
    VerifyEmailRequest, RequestPasswordReset, ConfirmPasswordReset,
    Enable2FARequest, Enable2FAResponse, Verify2FARequest,
    IdentityVerificationRequest, UserResponse, AuthSuccessResponse
)
from crud import (
    get_user_by_email, create_user, verify_password,
    create_refresh_token, get_refresh_token, revoke_refresh_token,
    create_verification_token, get_verification_by_token, mark_email_verified, get_user_by_id,
    hash_password
)
from auth import create_access_token, verify_token
from datetime import timedelta
import pyotp
import qrcode
import io
import base64
import os
import httpx

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://user-service:8000")
http_bearer = HTTPBearer(auto_error=False)


def get_user_from_credentials(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication payload",
        )

    user = get_user_by_id(db, int(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user_data: UserSignup, db: Session = Depends(get_db)):
    # Check if user exists
    existing_user = get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create user
    db_user = create_user(
        db,
        email=user_data.email,
        password=user_data.password,
        name=user_data.name,
        role=user_data.role.value,
        phone=user_data.phone,
        headline=user_data.headline
    )

    # Create email verification token
    verification = create_verification_token(db, db_user.id, "email")
    # In production, send email with verification link
    print(f"Email verification token for {db_user.email}: {verification.token}")

    # Sync profile with user service
    profile_payload = {
        "display_name": db_user.name,
        "email": db_user.email,
        "phone": db_user.phone,
        "headline": db_user.headline,
        "categories": [],
        "badges": []
    }
    try:
        with httpx.Client(timeout=5.0) as client:
            client.put(
                f"{USER_SERVICE_URL}/api/v1/users/{db_user.id}",
                json=profile_payload
            )
    except Exception as exc:
        print(f"Warning: failed to sync profile for user {db_user.id}: {exc}")

    return db_user


@router.post("/login", response_model=AuthSuccessResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = get_user_by_email(db, credentials.email)
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Check 2FA if enabled
    if user.is_2fa_enabled:
        if not credentials.two_fa_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA code required"
            )
        totp = pyotp.TOTP(user.two_fa_secret)
        if not totp.verify(credentials.two_fa_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid 2FA code"
            )

    # Create tokens
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value},
        expires_delta=access_token_expires
    )
    refresh_token_obj = create_refresh_token(db, user.id)

    return AuthSuccessResponse(
        access_token=access_token,
        refresh_token=refresh_token_obj.token,
        user=user
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(token_data: RefreshTokenRequest, db: Session = Depends(get_db)):
    db_token = get_refresh_token(db, token_data.refresh_token)
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    user = db_token.user if hasattr(db_token, 'user') else None
    if not user:
        from crud import get_user_by_id
        user = get_user_by_id(db, db_token.user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Create new access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value},
        expires_delta=access_token_expires
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=token_data.refresh_token
    )


@router.post("/logout")
def logout(token_data: RefreshTokenRequest, db: Session = Depends(get_db)):
    revoke_refresh_token(db, token_data.refresh_token)
    return {"message": "Logged out successfully"}


@router.post("/verify-email")
def verify_email(request: VerifyEmailRequest, db: Session = Depends(get_db)):
    verification = get_verification_by_token(db, request.token)
    if not verification or verification.verification_type != "email":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )

    user = mark_email_verified(db, verification.user_id)
    return {"message": "Email verified successfully", "user": user}


@router.post("/request-password-reset")
def request_password_reset(request: RequestPasswordReset, db: Session = Depends(get_db)):
    user = get_user_by_email(db, request.email)
    if user:
        # Create reset token
        verification = create_verification_token(db, user.id, "password_reset", expires_hours=1)
        # In production, send email with reset link
        print(f"Password reset token for {user.email}: {verification.token}")
    return {"message": "If email exists, reset link has been sent"}


@router.post("/confirm-reset")
def confirm_password_reset(request: ConfirmPasswordReset, db: Session = Depends(get_db)):
    verification = get_verification_by_token(db, request.token)
    if not verification or verification.verification_type != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    user = get_user_by_id(db, verification.user_id)
    if user:
        user.password_hash = hash_password(request.new_password)
        db.commit()
        return {"message": "Password reset successfully"}

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="User not found"
    )


@router.post("/enable-2fa", response_model=Enable2FAResponse)
def enable_2fa(
    request: Enable2FARequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_user_from_credentials)
):
    if not verify_password(request.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )

    secret = pyotp.random_base32()
    current_user.two_fa_secret = secret
    current_user.is_2fa_enabled = True
    db.commit()

    totp = pyotp.TOTP(secret)
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(totp.provisioning_uri(name=current_user.email, issuer_name="CodeDesign Marketplace"))
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_code_url = f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"

    return Enable2FAResponse(secret=secret, qr_code_url=qr_code_url)


@router.post("/verify")
def verify_identity(
    request: IdentityVerificationRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_user_from_credentials)
):
    verification = create_verification_token(db, current_user.id, "identity")
    verification.document_url = request.document_url
    verification.document_type = request.document_type
    db.commit()
    return {"message": "Verification request submitted", "verification_id": verification.id}


@router.get("/me", response_model=UserResponse)
def get_current_user_endpoint(current_user=Depends(get_user_from_credentials)):
    return current_user

