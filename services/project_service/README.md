# Project Service

Projects, bids, and milestones microservice.

## Port
8003 (mapped from container port 8000)

## Endpoints

### POST /api/v1/projects
Create project

### GET /api/v1/projects/{id}
Get project

### POST /api/v1/projects/{id}/bids
Submit bid

### GET /api/v1/projects/{id}/bids
Get project bids

### POST /api/v1/projects/{id}/accept
Accept bid (creates contract + escrow)

### POST /api/v1/projects/{id}/milestones
Create milestone

### GET /api/v1/projects/{id}/milestones
Get milestones

### POST /api/v1/projects/{id}/submit
Submit work for milestone

### POST /api/v1/projects/{id}/revision
Request revision

### POST /api/v1/projects/{id}/close
Close project

### POST /api/v1/projects/{id}/approve
Approve milestone (releases escrow)

