# Messaging Service

Real-time chat and messaging microservice with WebSocket support.

## Port
8006 (mapped from container port 8000)

## Endpoints

### POST /api/v1/chat/start
Start a conversation

### GET /api/v1/chat/conversations
Get user conversations

### GET /api/v1/chat/{conversation_id}/messages
Get conversation messages

### WebSocket /ws/{conversation_id}
Real-time chat connection

## Usage
Connect to WebSocket with `user_id` query parameter:
```
ws://localhost:8006/ws/1?user_id=1
```

Send messages as JSON:
```json
{
  "content": "Hello!",
  "attachments": []
}
```

