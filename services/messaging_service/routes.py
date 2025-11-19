from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from database import get_db
from schemas import MessageCreate, MessageResponse, ConversationResponse, StartConversationRequest
from crud import (
    get_or_create_conversation, create_message, get_messages,
    mark_messages_read, get_user_conversations
)
from typing import Dict, Set
import json

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])

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


@router.post("/start", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def start_conversation(
    request: StartConversationRequest,
    user_id: int = 1,  # In production, get from JWT
    db: Session = Depends(get_db)
):
    conversation = get_or_create_conversation(
        db,
        user_id,
        request.participant2_id,
        request.project_id
    )
    return conversation


@router.get("/conversations", response_model=list[ConversationResponse])
def get_conversations(user_id: int = 1, db: Session = Depends(get_db)):
    conversations = get_user_conversations(db, user_id)
    return conversations


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
def get_conversation_messages(
    conversation_id: int,
    limit: int = 50,
    offset: int = 0,
    user_id: int = 1,
    db: Session = Depends(get_db)
):
    messages = get_messages(db, conversation_id, limit, offset)
    mark_messages_read(db, conversation_id, user_id)
    return list(reversed(messages))


@router.websocket("/ws/{conversation_id}")
async def websocket_endpoint(websocket: WebSocket, conversation_id: int, user_id: int = 1):
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
                
                # Broadcast to all connections in conversation
                await manager.broadcast_to_conversation(
                    json.dumps({
                        "id": message.id,
                        "conversation_id": message.conversation_id,
                        "sender_id": message.sender_id,
                        "content": message.content,
                        "attachments": message.attachments,
                        "created_at": message.created_at.isoformat()
                    }),
                    conversation_id
                )
            finally:
                db.close()
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id, conversation_id)

