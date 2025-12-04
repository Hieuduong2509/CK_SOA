from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class MessageCreate(BaseModel):
    content: str
    attachments: List[str] = []


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    content: str
    attachments: List[str]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: int
    project_id: Optional[int]
    participant1_id: int
    participant2_id: int
    last_message_at: Optional[datetime]
    created_at: datetime
    unread_count: int = 0
    last_message: Optional[MessageResponse] = None

    class Config:
        from_attributes = True


class StartConversationRequest(BaseModel):
    participant2_id: int
    project_id: Optional[int] = None

