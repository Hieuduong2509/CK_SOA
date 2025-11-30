from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from schemas import MessageCreate, MessageResponse, ConversationResponse, StartConversationRequest
from crud import (
    get_or_create_conversation, create_message, get_messages,
    mark_messages_read, get_user_conversations
)
from models import Conversation, Message
from typing import Dict, Set
import json
import httpx
import os
import pika

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])
http_bearer = HTTPBearer(auto_error=False)
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8000")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://admin:admin@rabbitmq:5672/")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        self.conversation_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int, conversation_id: int = None):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        
        if conversation_id:
            if conversation_id not in self.conversation_connections:
                self.conversation_connections[conversation_id] = set()
            self.conversation_connections[conversation_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int, conversation_id: int = None):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
        if conversation_id and conversation_id in self.conversation_connections:
            self.conversation_connections[conversation_id].discard(websocket)

    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_text(message)

    async def broadcast_to_conversation(self, message: str, conversation_id: int):
        if conversation_id in self.conversation_connections:
            for connection in self.conversation_connections[conversation_id]:
                await connection.send_text(message)


manager = ConnectionManager()


def resolve_account(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    try:
        response = httpx.get(
            f"{AUTH_SERVICE_URL}/api/v1/auth/me",
            headers={"Authorization": f"Bearer {credentials.credentials}"},
            timeout=5.0
        )
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
        account = response.json()
        if not account.get("id"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication payload"
            )
        return account
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cannot verify authentication: {exc}"
        ) from exc


def resolve_user_from_token(token: str):
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token"
        )
    try:
        response = httpx.get(
            f"{AUTH_SERVICE_URL}/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5.0
        )
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
        account = response.json()
        if not account.get("id"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication payload"
            )
        return account
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cannot verify authentication: {exc}"
        ) from exc


def publish_event(event_type: str, data: dict):
    try:
        params = pika.URLParameters(RABBITMQ_URL)
        connection = pika.BlockingConnection(params)
        channel = connection.channel()
        channel.queue_declare(queue="events", durable=True)
        payload = json.dumps({"type": event_type, "data": data})
        channel.basic_publish(
            exchange="",
            routing_key="events",
            body=payload,
            properties=pika.BasicProperties(delivery_mode=2),
        )
        connection.close()
    except Exception as exc:
        print(f"Failed to publish event {event_type}: {exc}")


@router.post("/start", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def start_conversation(
    request: StartConversationRequest,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    user_id = account.get("id")
    conversation = get_or_create_conversation(
        db,
        user_id,
        request.participant2_id,
        request.project_id
    )
    return conversation


@router.get("/conversations", response_model=list[ConversationResponse])
def get_conversations(
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    user_id = account.get("id")
    conversations = get_user_conversations(db, user_id)
    responses: list[ConversationResponse] = []
    for conversation in conversations:
        unread_count = db.query(func.count(Message.id)).filter(
            Message.conversation_id == conversation.id,
            Message.sender_id != user_id,
            Message.is_read.is_(False)
        ).scalar() or 0
        last_message = (
            db.query(Message)
            .filter(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.desc())
            .first()
        )
        payload = ConversationResponse.model_validate(conversation).model_dump()
        payload["unread_count"] = unread_count
        payload["last_message"] = (
            MessageResponse.model_validate(last_message).model_dump()
            if last_message else None
        )
        responses.append(payload)
    return responses


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
def get_conversation_messages(
    conversation_id: int,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    messages = get_messages(db, conversation_id, limit, offset)
    mark_messages_read(db, conversation_id, account.get("id"))
    return list(reversed(messages))


@router.websocket("/ws/{conversation_id}")
async def websocket_endpoint(websocket: WebSocket, conversation_id: int):
    token = websocket.query_params.get("token")
    try:
        account = resolve_user_from_token(token)
        user_id = account.get("id")
    except HTTPException as exc:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket, user_id, conversation_id)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Create message in database
            from database import SessionLocal
            from crud import create_message
            db = SessionLocal()
            try:
                message = create_message(
                    db,
                    conversation_id,
                    user_id,
                    message_data.get("content", ""),
                    message_data.get("attachments", [])
                )

                # Determine recipient for notifications
                conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
                recipient_id = None
                if conversation:
                    recipient_id = (
                        conversation.participant2_id
                        if conversation.participant1_id == user_id
                        else conversation.participant1_id
                    )

                payload = {
                    "id": message.id,
                    "conversation_id": message.conversation_id,
                    "sender_id": message.sender_id,
                    "content": message.content,
                    "attachments": message.attachments,
                    "created_at": message.created_at.isoformat()
                }
                
                # Broadcast to all connections in conversation
                await manager.broadcast_to_conversation(json.dumps(payload), conversation_id)

                # Send notification event for recipient
                if recipient_id:
                    publish_event("chat.message", {
                        "conversation_id": conversation_id,
                        "recipient_id": recipient_id,
                        "sender_id": message.sender_id,
                        "sender_name": account.get("name"),
                        "project_id": conversation.project_id,
                        "preview": (message.content or "")[:140]
                    })
            finally:
                db.close()
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id, conversation_id)

