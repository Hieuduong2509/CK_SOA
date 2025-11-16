# User Service

User profiles, portfolios, and service packages microservice.

## Port
8002 (mapped from container port 8000)

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `MINIO_ENDPOINT`: MinIO endpoint
- `MINIO_ACCESS_KEY`: MinIO access key
- `MINIO_SECRET_KEY`: MinIO secret key
- `MINIO_BUCKET`: MinIO bucket name
- `AUTH_SERVICE_URL`: Auth service URL

## Endpoints

### GET /api/v1/users/{user_id}
Get user profile

### PUT /api/v1/users/{user_id}
Update profile

### POST /api/v1/users/{user_id}/avatar
Upload avatar image

### POST /api/v1/users/{user_id}/portfolio
Create portfolio item

### GET /api/v1/users/{user_id}/portfolio
Get user portfolio

### POST /api/v1/users/{user_id}/package
Create service package

### GET /api/v1/users/{user_id}/packages
Get user packages

### GET /api/v1/users
List freelancers with filters (skills, rating, price)

### POST /api/v1/users/{user_id}/reviews
Create review

### GET /api/v1/users/{user_id}/reviews
Get user reviews

