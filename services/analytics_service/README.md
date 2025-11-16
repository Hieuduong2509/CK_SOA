# Analytics Service

Analytics and metrics collection microservice.

## Port
8009 (mapped from container port 8000)

## Endpoints

### GET /api/v1/analytics/summary
Get platform summary (users, projects, revenue, top skills)

### GET /api/v1/analytics/events
Get events (with optional type filter)

## Background Worker
Run worker to process events from RabbitMQ:
```bash
python worker.py
```

