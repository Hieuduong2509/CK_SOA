from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from schemas import (
    ProjectCreate, ProjectResponse, BidCreate, BidResponse,
    AcceptBidRequest, MilestoneCreate, MilestoneResponse,
    MilestoneSubmissionCreate, RevisionRequest
)
from crud import (
    create_project, get_project, get_projects_by_client, get_projects_by_freelancer,
    create_bid, get_bids_by_project, accept_bid,
    create_milestone, get_milestones, submit_milestone,
    approve_milestone, request_revision, close_project
)
from models import Bid, Project, ProjectStatus
import httpx
import os
import pika
import json
from typing import Optional

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])

USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://localhost:8002")
PAYMENTS_SERVICE_URL = os.getenv("PAYMENTS_SERVICE_URL", "http://localhost:8005")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://admin:admin@localhost:5672/")
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
        print(f"Failed to resolve account: {exc}")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token"
    )


def publish_event(event_type: str, data: dict):
    """Publish event to RabbitMQ"""
    try:
        params = pika.URLParameters(RABBITMQ_URL)
        connection = pika.BlockingConnection(params)
        channel = connection.channel()
        channel.queue_declare(queue='events', durable=True)
        channel.basic_publish(
            exchange='',
            routing_key='events',
            body=json.dumps({"type": event_type, "data": data}),
            properties=pika.BasicProperties(delivery_mode=2)
        )
        connection.close()
    except Exception as e:
        print(f"Failed to publish event: {e}")


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project_endpoint(
    project: ProjectCreate,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    client_id = project.client_id or (account.get("id") if account else None)
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client identifier is required"
        )

    payload = project.dict(exclude={"client_id"})
    project_obj = create_project(db, client_id, **payload)
    publish_event("project.created", {"project_id": project_obj.id, "client_id": client_id})
    return project_obj


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project_endpoint(project_id: int, db: Session = Depends(get_db)):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    return project


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    client_id: int = None,
    freelancer_id: int = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if client_id:
        projects = get_projects_by_client(db, client_id)
    elif freelancer_id:
        projects = get_projects_by_freelancer(db, freelancer_id)
    else:
        projects = db.query(Project).all()

    if status_filter:
        try:
            status_enum = ProjectStatus(status_filter)
            projects = [p for p in projects if p.status == status_enum]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status filter"
            )
    return projects


@router.post("/{project_id}/bids", response_model=BidResponse, status_code=status.HTTP_201_CREATED)
def create_bid_endpoint(
    project_id: int,
    bid: BidCreate,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    if not account or account.get("role") != "freelancer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only freelancers can submit bids"
        )
    freelancer_id = account.get("id")

    bid_obj = create_bid(db, project_id, freelancer_id, **bid.dict())
    publish_event("bid.created", {"bid_id": bid_obj.id, "project_id": project_id, "freelancer_id": freelancer_id})
    return bid_obj


@router.get("/{project_id}/bids", response_model=list[BidResponse])
def get_project_bids(project_id: int, db: Session = Depends(get_db)):
    bids = get_bids_by_project(db, project_id)
    return bids


@router.post("/{project_id}/accept", response_model=ProjectResponse)
def accept_bid_endpoint(
    project_id: int,
    request: AcceptBidRequest,
    db: Session = Depends(get_db)
):
    project = accept_bid(db, project_id, request.bid_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to accept bid"
        )
    
    # Create initial milestone and escrow
    from database import SessionLocal
    bid_db = SessionLocal()
    bid = bid_db.query(Bid).filter(Bid.id == request.bid_id).first()
    if bid:
        # Call payments service to create escrow
        try:
            httpx.post(
                f"{PAYMENTS_SERVICE_URL}/api/v1/payments/escrow/deposit",
                json={
                    "project_id": project_id,
                    "amount": bid.price,
                    "milestone_id": None
                },
                timeout=5.0
            )
        except:
            pass
        finally:
            bid_db.close()
    
    publish_event("bid.accepted", {"project_id": project_id, "bid_id": request.bid_id})
    return project


@router.post("/{project_id}/milestones", response_model=MilestoneResponse, status_code=status.HTTP_201_CREATED)
def create_milestone_endpoint(
    project_id: int,
    milestone: MilestoneCreate,
    db: Session = Depends(get_db)
):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    milestone_obj = create_milestone(db, project_id, **milestone.dict())
    
    # Create escrow for milestone
    try:
        response = httpx.post(
            f"{PAYMENTS_SERVICE_URL}/api/v1/payments/escrow/deposit",
            json={
                "project_id": project_id,
                "amount": milestone.amount,
                "milestone_id": milestone_obj.id
            },
            timeout=5.0
        )
        if response.status_code == 200:
            data = response.json()
            milestone_obj.escrow_id = data.get("escrow_id")
            db.commit()
    except:
        pass
    
    return milestone_obj


@router.get("/{project_id}/milestones", response_model=list[MilestoneResponse])
def get_project_milestones(project_id: int, db: Session = Depends(get_db)):
    milestones = get_milestones(db, project_id)
    return milestones


@router.post("/{project_id}/submit", status_code=status.HTTP_201_CREATED)
def submit_work(
    project_id: int,
    submission: MilestoneSubmissionCreate,
    milestone_id: int,
    db: Session = Depends(get_db)
):
    milestone = db.query(Milestone).filter(
        Milestone.id == milestone_id,
        Milestone.project_id == project_id
    ).first()
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found"
        )
    
    submission_obj = submit_milestone(db, milestone_id, **submission.dict())
    publish_event("milestone.submitted", {"milestone_id": milestone_id, "project_id": project_id})
    return submission_obj


@router.post("/{project_id}/revision")
def request_revision_endpoint(
    project_id: int,
    request: RevisionRequest,
    db: Session = Depends(get_db)
):
    milestone = request_revision(db, request.milestone_id)
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found"
        )
    publish_event("revision.requested", {"milestone_id": request.milestone_id})
    return {"message": "Revision requested"}


@router.post("/{project_id}/close", response_model=ProjectResponse)
def close_project_endpoint(project_id: int, db: Session = Depends(get_db)):
    project = close_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    publish_event("project.closed", {"project_id": project_id})
    return project


@router.post("/{project_id}/approve")
def approve_milestone_endpoint(
    project_id: int,
    milestone_id: int,
    db: Session = Depends(get_db)
):
    milestone = approve_milestone(db, milestone_id)
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found"
        )
    
    # Release escrow
    try:
        httpx.post(
            f"{PAYMENTS_SERVICE_URL}/api/v1/payments/escrow/release",
            json={"milestone_id": milestone_id},
            timeout=5.0
        )
    except:
        pass
    
    publish_event("milestone.approved", {"milestone_id": milestone_id})
    return {"message": "Milestone approved and payment released"}

