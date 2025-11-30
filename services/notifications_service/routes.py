from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from schemas import NotificationResponse
from crud import get_notifications, mark_notification_read, mark_all_read
import httpx
import os

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8000")
http_bearer = HTTPBearer(auto_error=False)


def resolve_account(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)):
    if not credentials:
        return None
    try:
        response = httpx.get(
            f"{AUTH_SERVICE_URL}/api/v1/auth/me",
            headers={"Authorization": f"Bearer {credentials.credentials}"},
            timeout=5.0
        )
        if response.status_code == 200:
            return response.json()
    except Exception as exc:
        print(f"resolve_account error: {exc}")
    return None


@router.get("", response_model=list[NotificationResponse])
def get_user_notifications(
    unread_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db),
    account: dict = Depends(resolve_account)
):
    if not account or not account.get("id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    user_id = account.get("id")
    notifications = get_notifications(db, user_id, limit, unread_only)
    return notifications


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    account: dict = Depends(resolve_account)
):
    if not account or not account.get("id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    user_id = account.get("id")
    notification = mark_notification_read(db, notification_id, user_id)
    return {"message": "Notification marked as read"}


@router.post("/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    account: dict = Depends(resolve_account)
):
    if not account or not account.get("id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    user_id = account.get("id")
    mark_all_read(db, user_id)
    return {"message": "All notifications marked as read"}

