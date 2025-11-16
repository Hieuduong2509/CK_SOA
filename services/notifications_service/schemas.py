from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    data: Optional[dict]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

