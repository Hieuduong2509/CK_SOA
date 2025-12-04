from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from database import get_db
from models import Dispute, DisputeStatus
from typing import List, Optional
from pydantic import BaseModel
import httpx
import os

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:8001")
PAYMENTS_SERVICE_URL = os.getenv("PAYMENTS_SERVICE_URL", "http://localhost:8005")
PROJECT_SERVICE_URL = os.getenv("PROJECT_SERVICE_URL", "http://project-service:8000")
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://user-service:8000")


class DisputeResolutionRequest(BaseModel):
    dispute_id: int
    resolution: str
    escrow_action: str  # 'release_to_freelancer', 'refund_to_client', 'split'


async def require_admin_token(request: Request) -> str:
    token = request.headers.get("Authorization")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required"
        )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{AUTH_SERVICE_URL}/api/v1/auth/me",
                headers={"Authorization": token}
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to contact auth service: {exc}"
        )

    if resp.status_code != 200:
        detail = resp.json().get("detail") if resp.headers.get("content-type") == "application/json" else resp.text
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail or "Invalid admin token"
        )

    data = resp.json()
    role = data.get("role")
    if isinstance(role, dict):
        role = role.get("value") or role.get("name")
    if str(role).lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return token


async def proxy_request(method: str, url: str, token: Optional[str] = None, **kwargs):
    headers = kwargs.pop("headers", {})
    if token:
        headers["Authorization"] = token
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.request(method, url, headers=headers, **kwargs)
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Service unavailable: {exc}"
        )

    if response.status_code >= 400:
        try:
            detail = response.json()
        except ValueError:
            detail = response.text
        raise HTTPException(status_code=response.status_code, detail=detail)
    return response.json()


def fetch_users(role: Optional[str] = None, verified: Optional[bool] = None):
    from database import auth_engine
    from sqlalchemy import text
    
    query = """
        SELECT id, email, name, phone, headline, role, is_verified,
               is_email_verified, is_2fa_enabled, is_banned, suspended_until, created_at
        FROM users
    """
    conditions = []
    params = {}
    if role:
        conditions.append("role = :role")
        params["role"] = role
    if verified is not None:
        conditions.append("is_verified = :verified")
        params["verified"] = verified
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY created_at DESC"

    with auth_engine.connect() as conn:
        rows = conn.execute(text(query), params).mappings().all()

    result = []
    for row in rows:
        result.append({
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "phone": row["phone"],
            "headline": row["headline"],
            "role": row["role"],
            "is_verified": row["is_verified"],
            "is_email_verified": row["is_email_verified"],
            "is_2fa_enabled": row["is_2fa_enabled"],
            "is_banned": row["is_banned"],
            "suspended_until": row["suspended_until"].isoformat() if row["suspended_until"] else None,
            "created_at": row["created_at"].isoformat() if row["created_at"] else None
        })
    return result


@router.get("/users")
async def get_users(
    role: Optional[str] = None,
    token: str = Depends(require_admin_token)
):
    params = {}
    if role:
        params["role"] = role
    return await proxy_request(
        "GET",
        f"{AUTH_SERVICE_URL}/api/v1/auth/users",
        token=token,
        params=params
    )


@router.get("/users/{user_id}")
def get_user_detail(
    user_id: int,
    token: str = Depends(require_admin_token)
):
    """Get detailed user information"""
    try:
        from database import auth_engine
        from sqlalchemy import text
        
        query = """
            SELECT id, email, name, phone, headline, role, is_verified,
                   is_email_verified, is_2fa_enabled, is_banned, suspended_until, created_at
            FROM users
            WHERE id = :user_id
        """
        
        with auth_engine.connect() as conn:
            row = conn.execute(text(query), {"user_id": user_id}).mappings().first()
        
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "phone": row["phone"],
            "headline": row["headline"],
            "role": row["role"],
            "is_verified": row["is_verified"],
            "is_email_verified": row["is_email_verified"],
            "is_2fa_enabled": row["is_2fa_enabled"],
            "is_banned": row["is_banned"],
            "suspended_until": row["suspended_until"].isoformat() if row["suspended_until"] else None,
            "created_at": row["created_at"].isoformat() if row["created_at"] else None
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in get_user_detail: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/users/{user_id}/complaints")
def get_user_complaints(
    user_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(require_admin_token)
):
    """Get all complaints/disputes raised by or against a user"""
    # Get disputes where user raised the complaint
    disputes_raised = db.query(Dispute).filter(Dispute.raised_by == user_id).all()
    
    # Get disputes from projects where user is involved (client or freelancer)
    # We need to check project ownership, but for now just return disputes raised by user
    return disputes_raised


@router.get("/disputes")
def get_disputes(
    status: str = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    token: str = Depends(require_admin_token)
):
    query = db.query(Dispute)
    if status:
        query = query.filter(Dispute.status == status)
    disputes = query.order_by(Dispute.created_at.desc()).offset(offset).limit(limit).all()
    return disputes


@router.post("/resolve_dispute")
def resolve_dispute(
    payload: DisputeResolutionRequest,
    admin_id: int = 1,
    db: Session = Depends(get_db),
    token: str = Depends(require_admin_token)
):
    dispute_id = payload.dispute_id
    escrow_action = payload.escrow_action
    resolution = payload.resolution

    dispute = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dispute not found"
        )
    
    # Handle escrow based on action
    if escrow_action == "release_to_freelancer":
        # Release escrow to freelancer
        try:
            httpx.post(
                f"{PAYMENTS_SERVICE_URL}/api/v1/payments/escrow/release",
                json={"milestone_id": dispute.project_id},
                timeout=5.0
            )
        except:
            pass
    elif escrow_action == "refund_to_client":
        # Refund to client (would need refund endpoint)
        pass
    
    dispute.status = DisputeStatus.RESOLVED
    dispute.resolution = resolution
    dispute.resolved_by = admin_id
    from datetime import datetime
    dispute.resolved_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Dispute resolved", "dispute_id": dispute_id}


@router.get("/pending-projects")
async def get_pending_projects(
    token: str = Depends(require_admin_token),
    limit: int = 100
):
    data = await proxy_request(
        "GET",
        f"{PROJECT_SERVICE_URL}/api/v1/projects",
        token=token,
        params={"status_filter": "pending_approval"}
    )
    if isinstance(data, list):
        return data[:limit]
    return data


@router.post("/projects/{project_id}/approve")
async def approve_project_admin(
    project_id: int,
    token: str = Depends(require_admin_token)
):
    result = await proxy_request(
        "POST",
        f"{PROJECT_SERVICE_URL}/api/v1/projects/{project_id}/approve",
        token=token
    )
    return result


@router.get("/pending-services")
async def get_pending_services(
    token: str = Depends(require_admin_token),
    limit: int = 100
):
    data = await proxy_request(
        "GET",
        f"{USER_SERVICE_URL}/api/v1/services",
        token=token,
        params={"status_filter": "pending", "limit": limit}
    )
    if isinstance(data, list):
        return data[:limit]
    return data


@router.post("/services/{service_id}/approve")
async def approve_service_admin(
    service_id: int,
    token: str = Depends(require_admin_token)
):
    return await proxy_request(
        "POST",
        f"{USER_SERVICE_URL}/api/v1/services/{service_id}/approve",
        token=token
    )


@router.post("/services/{service_id}/reject")
async def reject_service_admin(
    service_id: int,
    request: Request,
    token: str = Depends(require_admin_token)
):
    payload = await request.json() if request.headers.get("content-type") == "application/json" else None
    return await proxy_request(
        "POST",
        f"{USER_SERVICE_URL}/api/v1/services/{service_id}/reject",
        token=token,
        json=payload or {}
    )


@router.post("/services/{service_id}/hide")
async def hide_service_admin(
    service_id: int,
    token: str = Depends(require_admin_token)
):
    return await proxy_request(
        "POST",
        f"{USER_SERVICE_URL}/api/v1/services/{service_id}/hide",
        token=token
    )


@router.get("/pending-users")
async def get_pending_freelancers(
    token: str = Depends(require_admin_token),
    limit: int = 50
):
    return await proxy_request(
        "GET",
        f"{AUTH_SERVICE_URL}/api/v1/auth/pending-users",
        token=token,
        params={"role": "freelancer", "limit": limit}
    )


@router.post("/users/{user_id}/approve")
async def approve_user_account(
    user_id: int,
    token: str = Depends(require_admin_token)
):
    return await proxy_request(
        "POST",
        f"{AUTH_SERVICE_URL}/api/v1/auth/users/{user_id}/approve",
        token=token
    )
@router.post("/users/{user_id}/suspend")
async def suspend_user_account(
    user_id: int,
    payload: dict,
    token: str = Depends(require_admin_token)
):
    return await proxy_request(
        "POST",
        f"{AUTH_SERVICE_URL}/api/v1/auth/users/{user_id}/suspend",
        token=token,
        json=payload
    )


@router.post("/users/{user_id}/unsuspend")
async def unsuspend_user_account(
    user_id: int,
    token: str = Depends(require_admin_token)
):
    return await proxy_request(
        "POST",
        f"{AUTH_SERVICE_URL}/api/v1/auth/users/{user_id}/unsuspend",
        token=token
    )


@router.post("/users/{user_id}/ban")
async def ban_user_account(
    user_id: int,
    token: str = Depends(require_admin_token)
):
    return await proxy_request(
        "POST",
        f"{AUTH_SERVICE_URL}/api/v1/auth/users/{user_id}/ban",
        token=token
    )


@router.post("/users/{user_id}/unban")
async def unban_user_account(
    user_id: int,
    token: str = Depends(require_admin_token)
):
    return await proxy_request(
        "POST",
        f"{AUTH_SERVICE_URL}/api/v1/auth/users/{user_id}/unban",
        token=token
    )


@router.delete("/users/{user_id}")
async def delete_user_account(
    user_id: int,
    token: str = Depends(require_admin_token)
):
    return await proxy_request(
        "DELETE",
        f"{AUTH_SERVICE_URL}/api/v1/auth/users/{user_id}",
        token=token
    )


@router.delete("/projects/{project_id}")
async def admin_delete_project(
    project_id: int,
    token: str = Depends(require_admin_token)
):
    return await proxy_request(
        "DELETE",
        f"{PROJECT_SERVICE_URL}/api/v1/projects/{project_id}",
        token=token
    )

