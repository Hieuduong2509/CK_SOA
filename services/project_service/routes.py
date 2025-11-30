from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse, BidCreate, BidResponse,
    AcceptBidRequest, MilestoneCreate, MilestoneResponse,
    MilestoneSubmissionCreate, RevisionRequest, FreelancerOrderResponse,
    ServiceOrderCreate, ProjectActivityResponse
)
from crud import (
    create_project, get_project, update_project, get_projects_by_client, get_projects_by_freelancer,
    create_bid, get_bids_by_project, accept_bid,
    create_milestone, get_milestones, submit_milestone,
    approve_milestone, request_revision, close_project, delete_project, approve_project,
    get_project_activities, deliver_project, request_revision_project, accept_delivery,
)
from models import Bid, Project, ProjectStatus, ProjectType, BudgetType, MilestoneStatus
import httpx
import os
import pika
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from io import BytesIO
from minio import Minio
from minio.error import S3Error
from datetime import timedelta
from sqlalchemy.orm import object_session

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])

USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://user-service:8000")
PAYMENTS_SERVICE_URL = os.getenv("PAYMENTS_SERVICE_URL", "http://localhost:8005")

# MinIO configuration
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "projects")

minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False
)

def get_client_ip(request: Request) -> str:
    """Extract client IP address from request (for activity logging)"""
    # Check for forwarded IP (behind proxy/load balancer)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    # Fallback to direct client IP
    if request.client:
        return request.client.host
    return "unknown"


def ensure_bucket(bucket_name: str):
    try:
        if not minio_client.bucket_exists(bucket_name):
            minio_client.make_bucket(bucket_name)
            print(f"Created bucket: {bucket_name}")
            # Set bucket policy to allow public read (for presigned URLs)
            try:
                from minio.commonconfig import REPLACE
                from minio.deleteobjects import DeleteObject
                # Bucket policy for presigned URLs - they work without public policy
                pass
            except Exception as e:
                print(f"Note: Could not set bucket policy (not critical): {e}")
    except S3Error as e:
        print(f"Error ensuring bucket: {e}")
        raise

def upload_file_to_storage(bucket_name: str, object_name: str, file_data: bytes, content_type: str = "application/octet-stream"):
    ensure_bucket(bucket_name)
    try:
        minio_client.put_object(
            bucket_name,
            object_name,
            BytesIO(file_data),
            length=len(file_data),
            content_type=content_type
        )
        # Return object_name instead of full URL - we'll generate presigned URL when needed
        return object_name
    except S3Error as e:
        print(f"Error uploading file: {e}")
        raise

def get_presigned_url(bucket_name: str, object_name: str, expires: timedelta = timedelta(hours=24)):
    """Generate presigned URL for file access"""
    try:
        # Ensure bucket exists
        ensure_bucket(bucket_name)
        # Generate presigned URL
        url = minio_client.presigned_get_object(bucket_name, object_name, expires=expires)
        print(f"Generated presigned URL: {url[:100]}...")
        # Replace internal hostname with localhost for browser access
        if "minio:9000" in url:
            url = url.replace("minio:9000", "localhost:9000")
        return url
    except S3Error as e:
        print(f"Error generating presigned URL for {bucket_name}/{object_name}: {e}")
        import traceback
        traceback.print_exc()
        raise
    except Exception as e:
        print(f"Unexpected error generating presigned URL: {e}")
        import traceback
        traceback.print_exc()
        raise

def delete_file_from_storage(bucket_name: str, object_name: str):
    """Delete a file from MinIO storage"""
    try:
        # Check if object exists before deleting
        try:
            minio_client.stat_object(bucket_name, object_name)
        except S3Error as stat_error:
            if stat_error.code == "NoSuchKey":
                print(f"File {object_name} does not exist in bucket {bucket_name}, skipping deletion")
                return  # File doesn't exist, nothing to delete
            else:
                raise  # Other errors should be raised
        
        # Delete the object
        minio_client.remove_object(bucket_name, object_name)
        print(f"Successfully deleted {object_name} from bucket {bucket_name}")
    except S3Error as e:
        print(f"Error deleting file from storage: {e}")
        # Don't raise - we'll continue to remove from database anyway
        # This allows cleanup of orphaned database entries

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
        elif response.status_code == 401:
            # Token is invalid or expired
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Failed to resolve account: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
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


@router.get("/{project_id}/activities", response_model=List[ProjectActivityResponse])
def get_project_activities_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account),
):
    # Chỉ client chủ dự án hoặc freelancer được mời mới xem được
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    user_id = account.get("id")
    if user_id not in [project.client_id, project.freelancer_id]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xem hoạt động của dự án này.",
        )

    activities = get_project_activities(db, project_id)
    return activities


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
    # Ensure status is not in payload (will use default from model)
    if 'status' in payload:
        del payload['status']
    project_obj = create_project(db, client_id, **payload)
    publish_event("project.created", {"project_id": project_obj.id, "client_id": client_id})
    return enrich_project_with_bids_count(project_obj, db)


@router.post("/create-from-service", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project_from_service_endpoint(
    payload: ServiceOrderCreate,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    client_id = account.get("id")

    try:
        service_resp = httpx.get(
            f"{USER_SERVICE_URL}/api/v1/services/{payload.service_id}",
            timeout=5.0
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cannot reach user service: {exc}"
        )

    if service_resp.status_code != 200:
        raise HTTPException(
            status_code=service_resp.status_code,
            detail="Unable to retrieve service package information"
        )

    service_data = service_resp.json()
    
    # Validate service status
    service_status = service_data.get("status", "").upper()
    if service_status != "APPROVED":
        if service_status in ["PAUSED", "HIDDEN"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gói dịch vụ này hiện đang tạm ẩn hoặc tạm dừng. Vui lòng liên hệ freelancer để biết thêm chi tiết."
            )
        elif service_status == "REJECTED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gói dịch vụ này đã bị từ chối và không thể mua."
            )
        elif service_status in ["DRAFT", "PENDING"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gói dịch vụ này chưa được duyệt và chưa sẵn sàng để mua."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gói dịch vụ không ở trạng thái phù hợp để mua (trạng thái: {service_status})."
            )
    
    profile = service_data.get("profile")
    freelancer_id = profile.get("user_id") if profile else None

    if not freelancer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Service package is missing freelancer information"
        )

    if freelancer_id == client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot purchase your own service package"
        )
    
    # TODO: Check if freelancer is banned/suspended (requires user_service API)
    # For now, we'll skip this check as it requires additional API call

    delivery_days = service_data.get("delivery_days") or 0
    deadline = datetime.utcnow() + timedelta(days=delivery_days or 7)

    primary_media = None
    gallery = service_data.get("gallery") or []
    if gallery:
        primary_media = gallery[0]
    elif service_data.get("cover_image"):
        primary_media = service_data.get("cover_image")

    service_snapshot: Dict[str, Any] = {
        "service_id": service_data.get("id"),
        "name": service_data.get("name"),
        "description": service_data.get("description"),
        "price": service_data.get("price"),
        "category": service_data.get("category"),
        "delivery_days": service_data.get("delivery_days"),
        "revisions": service_data.get("revisions"),
        "cover_image": primary_media,
        "gallery": gallery,
        "freelancer": {
            "id": freelancer_id,
            "name": profile.get("display_name") if profile else None,
            "avatar": profile.get("avatar_url") if profile else None,
            "headline": profile.get("headline") if profile else None
        }
    }

    project_obj = create_project(
        db,
        client_id=client_id,
        status=ProjectStatus.IN_PROGRESS,
        project_type=ProjectType.GIG_ORDER,
        title=service_data.get("name") or "Gói dịch vụ",
        description=service_data.get("description") or "",
        budget_type=BudgetType.FIXED,
        budget=service_data.get("price") or 0,
        skills_required=service_data.get("tags") or [],
        category=service_data.get("category"),
        tags=service_data.get("tags") or [],
        deadline=deadline,
        freelancer_id=freelancer_id,
        service_package_id=service_data.get("id"),
        requirements_answers=payload.requirements_answers or [],
        service_snapshot=service_snapshot
    )

    # Auto-create a milestone corresponding to the service package price
    milestone = create_milestone(
        db,
        project_obj.id,
        title=service_data.get("name") or "Gói dịch vụ",
        description="Tự động tạo từ đơn hàng dịch vụ",
        amount=service_data.get("price") or 0
    )
    milestone.status = MilestoneStatus.IN_PROGRESS
    db.commit()

    # Note: Escrow deposit will be created when client completes payment
    # This is handled in payment.html after project creation
    # We don't create escrow here because payment hasn't been processed yet

    publish_event(
        "project.created",
        {"project_id": project_obj.id, "client_id": client_id, "type": "service_order"}
    )
    
    # Publish specific event for messaging service to auto-create conversation
    publish_event(
        "project.created_from_gig",
        {
            "project_id": project_obj.id,
            "client_id": client_id,
            "freelancer_id": freelancer_id,
            "service_name": service_data.get("name") or "Gói dịch vụ"
        }
    )
    
    return enrich_project_with_bids_count(project_obj, db)


def enrich_project_with_bids_count(project: Project, db: Session) -> dict:
    """Add bids_count to project data"""
    bids_count = db.query(Bid).filter(Bid.project_id == project.id).count()
    project_dict = {
        "id": project.id,
        "client_id": project.client_id,
        "freelancer_id": project.freelancer_id,
        "title": project.title,
        "description": project.description,
        "budget_type": project.budget_type,
        "budget": project.budget,
        "skills_required": project.skills_required or [],
        "attachments": project.attachments or [],
        "deadline": project.deadline,
        "status": project.status,
        "project_type": project.project_type,
        "accepted_bid_id": project.accepted_bid_id,
        "service_package_id": project.service_package_id,
        "requirements_answers": project.requirements_answers or [],
        "service_snapshot": project.service_snapshot or None,
        "created_at": project.created_at,
        "category": project.category,
        "tags": project.tags or [],
        "minimum_badge": project.minimum_badge,
        "minimum_level": project.minimum_level,
        "bids_count": bids_count
    }
    return project_dict


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project_endpoint(project_id: int, db: Session = Depends(get_db)):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    return enrich_project_with_bids_count(project, db)


@router.get("/freelancers/{freelancer_id}/orders", response_model=list[FreelancerOrderResponse])
def get_freelancer_orders(
    freelancer_id: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    """Return all bids/projects associated with a freelancer, including status info."""
    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    if account.get("role") != "freelancer" and account.get("id") != freelancer_id and account.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view these orders"
        )

    bids = db.query(Bid).filter(Bid.freelancer_id == freelancer_id).all()
    if not bids:
        return []

    project_ids = {bid.project_id for bid in bids}
    projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
    project_map = {project.id: project for project in projects}

    response_data = []
    for bid in bids:
        project = project_map.get(bid.project_id)
        if not project:
            continue
        is_awarded = project.accepted_bid_id == bid.id
        response_data.append({
            "project": project,
            "bid_id": bid.id,
            "bid_status": bid.status,
            "bid_price": bid.price,
            "bid_timeline_days": bid.timeline_days,
            "is_awarded": is_awarded,
            "order_state": "active" if is_awarded else "pending"
        })

    return response_data


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project_endpoint(
    project_id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check authentication
    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Check if user is the owner of the project
    if account.get("id") != project.client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own projects"
        )
    
    # Only allow updating status from draft to pending_approval
    update_data = project_update.dict(exclude_unset=True)
    if 'status' in update_data:
        # Normalize status comparison - handle both enum and string
        current_status = project.status.value if hasattr(project.status, 'value') else str(project.status)
        if current_status.upper() != 'DRAFT':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only change status from draft to pending_approval"
            )
        new_status = update_data['status']
        if isinstance(new_status, str):
            new_status = new_status.lower()
        elif hasattr(new_status, 'value'):
            new_status = new_status.value
        if new_status != 'pending_approval':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only change status to pending_approval"
            )
    
    updated_project = update_project(db, project_id, **update_data)
    if not updated_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update project"
        )
    
    return enrich_project_with_bids_count(updated_project, db)


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    client_id: int = None,
    freelancer_id: int = None,
    status_filter: Optional[str] = None,
    project_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    type_filter = None
    if project_type:
        try:
            type_filter = ProjectType(project_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid project type filter"
            )

    if client_id:
        projects = get_projects_by_client(db, client_id)
    elif freelancer_id:
        projects = get_projects_by_freelancer(db, freelancer_id)
    else:
        query = db.query(Project)
        if status_filter:
            try:
                status_enum = ProjectStatus(status_filter)
                query = query.filter(Project.status == status_enum)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid status filter"
                )
        else:
            query = query.filter(Project.status == ProjectStatus.OPEN)
        if type_filter:
            query = query.filter(Project.project_type == type_filter)
        projects = query.order_by(Project.created_at.desc()).all()
        return [enrich_project_with_bids_count(p, db) for p in projects]

    if status_filter:
        try:
            status_enum = ProjectStatus(status_filter)
            projects = [p for p in projects if p.status == status_enum]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status filter"
            )
    if type_filter:
        projects = [p for p in projects if p.project_type == type_filter]
    
    return [enrich_project_with_bids_count(p, db) for p in projects]


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
    # Get project to get client_id
    project = get_project(db, project_id)
    publish_event("bid.created", {
        "bid_id": bid_obj.id,
        "project_id": project_id,
        "freelancer_id": freelancer_id,
        "client_id": project.client_id if project else None
    })
    return bid_obj


@router.get("/{project_id}/bids", response_model=list[BidResponse])
def get_project_bids(project_id: int, db: Session = Depends(get_db)):
    bids = get_bids_by_project(db, project_id)
    return bids


@router.post("/{project_id}/accept", response_model=ProjectResponse)
def accept_bid_endpoint(
    project_id: int,
    request: AcceptBidRequest,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    project_obj = get_project(db, project_id)
    if not project_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    role = account.get("role")
    if isinstance(role, dict):
        role = role.get("value") or role.get("name")
    is_admin = str(role).lower() == "admin"

    if not is_admin and account.get("id") != project_obj.client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can accept bids"
        )

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
    return enrich_project_with_bids_count(project, db)


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


@router.post("/{project_id}/milestones/{milestone_id}/submit", status_code=status.HTTP_201_CREATED)
def submit_work(
    project_id: int,
    milestone_id: int,
    submission: MilestoneSubmissionCreate,
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


@router.post("/{project_id}/milestones/{milestone_id}/revision")
def request_revision_endpoint(
    project_id: int,
    milestone_id: int,
    request: RevisionRequest,
    db: Session = Depends(get_db)
):
    milestone = request_revision(db, milestone_id)
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found"
        )
    publish_event("revision.requested", {"milestone_id": milestone_id})
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
    return enrich_project_with_bids_count(project, db)


@router.post("/{project_id}/milestones/{milestone_id}/approve")
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


@router.post("/{project_id}/deliver", response_model=ProjectResponse, status_code=status.HTTP_200_OK)
def deliver_project_endpoint(
    project_id: int,
    files: List[UploadFile] = File(None),
    description: Optional[str] = None,
    request: Request = None,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    """Deliver GIG_ORDER project - freelancer uploads final files"""
    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Only allow for GIG_ORDER projects
    if project.project_type != ProjectType.GIG_ORDER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only for GIG_ORDER projects"
        )
    
    # Only freelancer assigned to project can deliver
    user_id = account.get("id")
    if project.freelancer_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned freelancer can deliver this project"
        )
    
    # Only allow if status is IN_PROGRESS
    if project.status != ProjectStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot deliver project. Current status: {project.status.value}"
        )
    
    # Upload files if provided
    file_urls = []
    if files:
        ensure_bucket(MINIO_BUCKET)
        for file in files:
            try:
                file_data = file.file.read()
                file_ext = os.path.splitext(file.filename)[1] if file.filename else ""
                object_name = f"projects/{project_id}/delivery/{uuid.uuid4()}{file_ext}"
                
                minio_client.put_object(
                    MINIO_BUCKET,
                    object_name,
                    BytesIO(file_data),
                    length=len(file_data),
                    content_type=file.content_type or "application/octet-stream"
                )
                
                file_url = f"http://{MINIO_ENDPOINT}/{MINIO_BUCKET}/{object_name}"
                file_urls.append(file_url)
            except Exception as e:
                print(f"Error uploading file {file.filename}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to upload file: {file.filename}"
                )
    
    # Get client IP for activity log
    metadata = {
        "ip_address": get_client_ip(request) if request else "unknown",
        "user_agent": request.headers.get("User-Agent", "unknown") if request else "unknown"
    }
    
    # Deliver project
    updated_project = deliver_project(
        db,
        project_id,
        file_urls=file_urls if file_urls else None,
        description=description,
        user_id=user_id,
        metadata=metadata
    )
    
    if not updated_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to deliver project"
        )
    
    publish_event("project.delivered", {
        "project_id": project_id,
        "freelancer_id": user_id,
        "client_id": project.client_id
    })
    
    return enrich_project_with_bids_count(updated_project, db)


@router.post("/{project_id}/request-revision", response_model=ProjectResponse, status_code=status.HTTP_200_OK)
def request_revision_project_endpoint(
    project_id: int,
    reason: Optional[str] = None,
    request: Request = None,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    """Request revision for GIG_ORDER project - client asks freelancer to revise"""
    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Only allow for GIG_ORDER projects
    if project.project_type != ProjectType.GIG_ORDER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only for GIG_ORDER projects"
        )
    
    # Only client can request revision
    user_id = account.get("id")
    if project.client_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project client can request revision"
        )
    
    # Only allow if status is DELIVERED
    if project.status != ProjectStatus.DELIVERED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot request revision. Current status: {project.status.value}"
        )
    
    # Get client IP for activity log
    metadata = {
        "ip_address": get_client_ip(request) if request else "unknown",
        "user_agent": request.headers.get("User-Agent", "unknown") if request else "unknown"
    }
    
    # Request revision
    updated_project = request_revision_project(
        db,
        project_id,
        reason=reason,
        user_id=user_id,
        metadata=metadata
    )
    
    if not updated_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to request revision"
        )
    
    publish_event("project.revision_requested", {
        "project_id": project_id,
        "client_id": user_id,
        "freelancer_id": project.freelancer_id
    })
    
    return enrich_project_with_bids_count(updated_project, db)


@router.post("/{project_id}/accept-delivery", response_model=ProjectResponse, status_code=status.HTTP_200_OK)
def accept_delivery_endpoint(
    project_id: int,
    request: Request = None,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    """Accept delivery for GIG_ORDER project - client accepts and project is completed"""
    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Only allow for GIG_ORDER projects
    if project.project_type != ProjectType.GIG_ORDER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only for GIG_ORDER projects"
        )
    
    # Only client can accept delivery
    user_id = account.get("id")
    if project.client_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project client can accept delivery"
        )
    
    # Only allow if status is DELIVERED
    if project.status != ProjectStatus.DELIVERED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot accept delivery. Current status: {project.status.value}"
        )
    
    # Get client IP for activity log
    metadata = {
        "ip_address": get_client_ip(request) if request else "unknown",
        "user_agent": request.headers.get("User-Agent", "unknown") if request else "unknown"
    }
    
    # Accept delivery
    updated_project = accept_delivery(
        db,
        project_id,
        user_id=user_id,
        metadata=metadata
    )
    
    if not updated_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to accept delivery"
        )
    
    # Release escrow
    milestones = get_milestones(db, project_id)
    if milestones:
        milestone = milestones[0]
        if milestone.escrow_id:
            try:
                httpx.post(
                    f"{PAYMENTS_SERVICE_URL}/api/v1/payments/escrow/release",
                    json={"escrow_id": milestone.escrow_id},
                    timeout=5.0
                )
            except:
                pass  # Log error but don't fail
    
    publish_event("project.delivery_accepted", {
        "project_id": project_id,
        "client_id": user_id,
        "freelancer_id": project.freelancer_id
    })
    
    return enrich_project_with_bids_count(updated_project, db)


@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
def delete_project_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check authentication
    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    role = account.get("role")
    if isinstance(role, dict):
        role = role.get("value") or role.get("name")
    is_admin = str(role).lower() == "admin"
    
    # Check if user is the owner of the project or admin
    if account.get("id") != project.client_id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own projects"
        )
    
    deleted_project = delete_project(db, project_id)
    if not deleted_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete project. Only draft, pending approval or open projects can be deleted."
        )
    
    publish_event("project.deleted", {"project_id": project_id})
    return {"message": "Project deleted successfully"}


@router.post("/{project_id}/approve", status_code=status.HTTP_200_OK)
def approve_project_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    """Approve project - only admin can approve projects"""
    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Check if user is admin
    user_role = account.get("role")
    if isinstance(user_role, dict):
        user_role = user_role.get("value") or user_role.get("name")
    
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can approve projects"
        )
    
    approved_project = approve_project(db, project_id)
    if not approved_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve project. Only pending approval projects can be approved."
        )
    
    publish_event("project.approved", {"project_id": project_id})
    return {"message": "Project approved successfully", "project": enrich_project_with_bids_count(approved_project, db)}


@router.post("/{project_id}/attachments", status_code=status.HTTP_201_CREATED)
async def upload_project_attachment(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    """Upload attachment file for a project"""
    print(f"Upload attachment request for project {project_id}")
    print(f"Account resolved: {account is not None}")
    if account:
        print(f"Account ID: {account.get('id')}, Role: {account.get('role')}")
    
    if not account:
        print("No account resolved - returning 401")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please ensure you are logged in and the Authorization header is sent correctly."
        )
    
    # Get project
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check if user is the owner of the project
    if account.get("id") != project.client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only upload attachments to your own projects"
        )
    
    # Maximum file size: 50MB
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB in bytes
    
    # Read file data in chunks to check size
    file_data = b""
    total_size = 0
    chunk_size = 1024 * 1024  # 1MB chunks
    
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum limit of 50MB. Current size: {total_size / (1024 * 1024):.2f}MB"
            )
        file_data += chunk
    
    # Generate unique object name
    file_extension = os.path.splitext(file.filename)[1] if file.filename else ""
    object_name = f"projects/{project_id}/{uuid.uuid4()}{file_extension}"
    
    # Upload to MinIO
    try:
        file_url = upload_file_to_storage(
            MINIO_BUCKET,
            object_name,
            file_data,
            file.content_type or "application/octet-stream"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )
    
    # Generate presigned URL for file access
    try:
        presigned_url = get_presigned_url(MINIO_BUCKET, object_name)
        print(f"Generated presigned URL for {object_name}")
    except Exception as e:
        print(f"Warning: Failed to generate presigned URL: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to direct URL (may not work from browser)
        presigned_url = f"http://localhost:9000/{MINIO_BUCKET}/{object_name}"
    
    # Update project attachments
    attachments = project.attachments or []
    attachment_info = {
        "url": presigned_url,
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(file_data),
        "uploaded_at": datetime.utcnow().isoformat(),
        "object_name": object_name
    }
    attachments.append(attachment_info)
    print(f"Adding attachment to list. Total attachments: {len(attachments)}")
    
    # Update project
    try:
        updated_project = update_project(db, project_id, attachments=attachments)
        print(f"Project updated successfully. Project ID: {project_id}")
        if updated_project:
            print(f"Updated project attachments count: {len(updated_project.attachments or [])}")
    except Exception as e:
        print(f"Error updating project: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update project with attachment: {str(e)}"
        )
    
    return {
        "message": "File uploaded successfully",
        "attachment": attachment_info,
        "project": updated_project
    }


@router.delete("/{project_id}/attachments/{attachment_index}", status_code=status.HTTP_200_OK)
def delete_project_attachment(
    project_id: int,
    attachment_index: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    """Delete an attachment from a project"""
    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Get project
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check if user is the owner of the project
    if account.get("id") != project.client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete attachments from your own projects"
        )
    
    # Get attachments
    attachments = project.attachments or []
    print(f"Deleting attachment at index {attachment_index}. Total attachments: {len(attachments)}")
    
    if attachment_index < 0 or attachment_index >= len(attachments):
        print(f"Invalid attachment index: {attachment_index}, total: {len(attachments)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )
    
    # Get attachment info
    attachment = attachments[attachment_index]
    object_name = attachment.get("object_name")
    filename = attachment.get("filename", "unknown")
    print(f"Deleting attachment: {filename}, object_name: {object_name}")
    
    # Delete from MinIO if object_name exists
    if object_name:
        try:
            delete_file_from_storage(MINIO_BUCKET, object_name)
            print(f"Successfully deleted file from MinIO: {object_name}")
        except Exception as e:
            print(f"Warning: Failed to delete file from storage: {e}")
            import traceback
            traceback.print_exc()
            # Continue anyway - we'll still remove from database
    else:
        print(f"Warning: No object_name found for attachment, skipping MinIO deletion")
    
    # Remove from attachments list - create new list to ensure SQLAlchemy detects change
    new_attachments = [att for i, att in enumerate(attachments) if i != attachment_index]
    print(f"Removed attachment from list. Remaining attachments: {len(new_attachments)}")
    
    # Update project - explicitly set attachments (even if empty list)
    try:
        # Use flag_modified to ensure SQLAlchemy detects the change in JSON column
        from sqlalchemy.orm.attributes import flag_modified
        project.attachments = new_attachments
        flag_modified(project, "attachments")  # Force SQLAlchemy to detect JSON column change
        db.commit()
        db.refresh(project)
        print(f"Project updated successfully. Project ID: {project_id}")
        print(f"Updated project attachments count: {len(project.attachments or [])}")
        print(f"Updated project attachments: {project.attachments}")
    except Exception as e:
        db.rollback()
        print(f"Error updating project: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update project after deleting attachment: {str(e)}"
        )
    
    return {
        "message": "Attachment deleted successfully",
        "project": project
    }


@router.get("/{project_id}/attachments/{attachment_index}/download")
def download_project_attachment(
    project_id: int,
    attachment_index: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    """Get download URL for an attachment (generates new presigned URL)"""
    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    # Get project
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Get attachments
    attachments = project.attachments or []
    if attachment_index < 0 or attachment_index >= len(attachments):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )
    
    # Get attachment info
    attachment = attachments[attachment_index]
    object_name = attachment.get("object_name")
    
    if not object_name:
        # Legacy format - try to extract from URL
        url = attachment.get("url", "")
        if "/" in url:
            parts = url.split("/")
            if len(parts) >= 3:
                # Extract bucket and object from URL like http://host/bucket/object
                bucket = parts[-2] if len(parts) >= 2 else MINIO_BUCKET
                object_name = parts[-1]
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid attachment URL format"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attachment object_name not found"
            )
    
    # Generate presigned URL
    try:
        presigned_url = get_presigned_url(MINIO_BUCKET, object_name)
        return {"download_url": presigned_url}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate download URL: {str(e)}"
        )

