from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from schemas import NotificationResponse
from crud import get_notifications, mark_notification_read, mark_all_read

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
def get_user_notifications(
    user_id: int = 1,  # In production, get from JWT
    unread_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    notifications = get_notifications(db, user_id, limit, unread_only)
    return notifications


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, user_id: int = 1, db: Session = Depends(get_db)):
    notification = mark_notification_read(db, notification_id, user_id)
    return {"message": "Notification marked as read"}


@router.post("/read-all")
def mark_all_as_read(user_id: int = 1, db: Session = Depends(get_db)):
    mark_all_read(db, user_id)
    return {"message": "All notifications marked as read"}

