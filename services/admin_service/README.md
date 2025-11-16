# Admin Service

Admin and dispute resolution microservice.

## Port
8008 (mapped from container port 8000)

## Endpoints

### GET /api/v1/admin/users
Get all users (admin only)

### GET /api/v1/admin/projects
Get all projects (admin only)

### GET /api/v1/admin/disputes
Get disputes

### POST /api/v1/admin/resolve_dispute
Resolve dispute and handle escrow

