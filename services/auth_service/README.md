# Auth Service

Authentication and authorization microservice for CodeDesign Marketplace.

## Port
8001 (mapped from container port 8000)

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `SECRET_KEY`: JWT secret key (min 32 chars)
- `ALGORITHM`: JWT algorithm (default: HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Access token expiry (default: 30)
- `REFRESH_TOKEN_EXPIRE_DAYS`: Refresh token expiry (default: 7)

## Endpoints

### POST /api/v1/auth/signup
Register new user
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "freelancer"
}
```

### POST /api/v1/auth/login
Login and get tokens
```json
{
  "email": "user@example.com",
  "password": "password123",
  "two_fa_code": "123456" // optional if 2FA enabled
}
```

### POST /api/v1/auth/refresh
Refresh access token
```json
{
  "refresh_token": "token_here"
}
```

### POST /api/v1/auth/logout
Revoke refresh token

### POST /api/v1/auth/verify-email
Verify email with token

### POST /api/v1/auth/request-password-reset
Request password reset

### POST /api/v1/auth/confirm-reset
Confirm password reset with token

### POST /api/v1/auth/enable-2fa
Enable 2FA (returns QR code)

### POST /api/v1/auth/verify
Submit identity verification (CMND/CCCD)

## Testing
```bash
pytest tests/
```

