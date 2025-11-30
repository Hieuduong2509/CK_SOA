# Notifications Service

Notifications microservice with background worker for processing events.

## Port
8007 (mapped from container port 8000)

## Endpoints

### GET /api/v1/notifications
Get user notifications (supports unread_only filter)

### POST /api/v1/notifications/{id}/read
Mark notification as read

### POST /api/v1/notifications/read-all
Mark all notifications as read

## Background Worker
Run worker separately:
```bash
python worker.py
```

Worker listens to RabbitMQ events and creates notifications.

