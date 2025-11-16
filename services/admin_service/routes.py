from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Dispute, DisputeStatus
from typing import List
import httpx
import os

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:8001")
PAYMENTS_SERVICE_URL = os.getenv("PAYMENTS_SERVICE_URL", "http://localhost:8005")


@router.get("/users")
def get_users(limit: int = 50, offset: int = 0):
    # In production, verify admin role
    # For now, return mock data
    return {"users": [], "total": 0}


@router.get("/projects")
def get_projects(flagged_only: bool = False, limit: int = 50, offset: int = 0):
    # In production, get from project service
    return {"projects": [], "total": 0}


@router.get("/disputes")
def get_disputes(
    status: str = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(Dispute)
    if status:
        query = query.filter(Dispute.status == status)
    disputes = query.order_by(Dispute.created_at.desc()).offset(offset).limit(limit).all()
    return disputes


@router.post("/resolve_dispute")
def resolve_dispute(
    dispute_id: int,
    resolution: str,
    escrow_action: str,  # 'release_to_freelancer', 'refund_to_client', 'split'
    admin_id: int = 1,
    db: Session = Depends(get_db)
):
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

