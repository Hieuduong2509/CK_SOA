from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse, BidCreate, BidResponse, BidUpdate,
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
from models import Bid, Project, ProjectStatus, ProjectType, BudgetType, MilestoneStatus, BidStatus
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
        return object_name
    except S3Error as e:
        print(f"Error uploading file: {e}")
        raise

def get_presigned_url(bucket_name: str, object_name: str, expires: timedelta = timedelta(hours=24)):
    """Generate presigned URL for file access"""
    try:
        ensure_bucket(bucket_name)
        url = minio_client.presigned_get_object(bucket_name, object_name, expires=expires)
        if "minio:9000" in url:
            url = url.replace("minio:9000", "localhost:9000")
        return url
    except S3Error as e:
        print(f"Error generating presigned URL: {e}")
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise

def delete_file_from_storage(bucket_name: str, object_name: str):
    try:
        try:
            minio_client.stat_object(bucket_name, object_name)
        except S3Error as stat_error:
            if stat_error.code == "NoSuchKey":
                return
            else:
                raise
        minio_client.remove_object(bucket_name, object_name)
    except S3Error as e:
        print(f"Error deleting file from storage: {e}")

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
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    user_id = account.get("id")
    if user_id not in [project.client_id, project.freelancer_id]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client identifier required")

    payload = project.dict(exclude={"client_id"})
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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    client_id = account.get("id")

    try:
        service_resp = httpx.get(f"{USER_SERVICE_URL}/api/v1/services/{payload.service_id}", timeout=5.0)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Cannot reach user service: {exc}")

    if service_resp.status_code != 200:
        raise HTTPException(status_code=service_resp.status_code, detail="Unable to retrieve service info")

    service_data = service_resp.json()
    service_status = service_data.get("status", "").upper()
    if service_status != "APPROVED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Service not available (status: {service_status})")
    
    profile = service_data.get("profile")
    freelancer_id = profile.get("user_id") if profile else None

    if not freelancer_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing freelancer info")
    if freelancer_id == client_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot purchase own service")

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

    # Auto-create milestone for Gig (100% value)
    milestone = create_milestone(
        db,
        project_obj.id,
        title=service_data.get("name") or "Gói dịch vụ",
        description="Tự động tạo từ đơn hàng dịch vụ",
        amount=service_data.get("price") or 0
    )
    milestone.status = MilestoneStatus.PENDING # Chờ thanh toán
    db.commit()

    publish_event("project.created", {"project_id": project_obj.id, "client_id": client_id, "type": "service_order"})
    publish_event("project.created_from_gig", {
            "project_id": project_obj.id,
            "client_id": client_id,
            "freelancer_id": freelancer_id,
        "service_name": service_data.get("name")
    })
    
    return enrich_project_with_bids_count(project_obj, db)


def enrich_project_with_bids_count(project: Project, db: Session) -> dict:
    bids_count = db.query(Bid).filter(Bid.project_id == project.id).count()
    # Serialize project manually to dict to append extra fields
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return enrich_project_with_bids_count(project, db)


@router.get("/freelancers/{freelancer_id}/orders", response_model=list[FreelancerOrderResponse])
def get_freelancer_orders(
    freelancer_id: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    if account.get("role") != "freelancer" and account.get("id") != freelancer_id and account.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    
    if account.get("id") != project.client_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not project owner")
    
    update_data = project_update.dict(exclude_unset=True)
    if 'status' in update_data:
        current_status = project.status.value if hasattr(project.status, 'value') else str(project.status)
        if current_status.upper() != 'DRAFT':
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can only change status from DRAFT")
        
        new_status = update_data['status']
        if isinstance(new_status, str): new_status = new_status.lower()
        elif hasattr(new_status, 'value'): new_status = new_status.value
        
        if new_status != 'pending_approval':
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can only change to pending_approval")
    
    updated_project = update_project(db, project_id, **update_data)
    return enrich_project_with_bids_count(updated_project, db)


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    client_id: int = None,
    freelancer_id: int = None,
    status_filter: Optional[str] = None,
    project_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    # Query building logic (simplified from original)
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
                pass
        else:
            query = query.filter(Project.status == ProjectStatus.OPEN)
        
        if project_type:
            query = query.filter(Project.project_type == project_type)
            
        projects = query.order_by(Project.created_at.desc()).all()
    
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if not account or account.get("role") != "freelancer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only freelancers can bid")
    
    freelancer_id = account.get("id")
    bid_obj = create_bid(db, project_id, freelancer_id, **bid.dict())
    
    publish_event("bid.created", {
        "bid_id": bid_obj.id,
        "project_id": project_id,
        "freelancer_id": freelancer_id,
        "client_id": project.client_id
    })
    return bid_obj


@router.get("/{project_id}/bids", response_model=list[BidResponse])
def get_project_bids(project_id: int, db: Session = Depends(get_db)):
    return get_bids_by_project(db, project_id)


@router.post("/{project_id}/accept", response_model=ProjectResponse)
def accept_bid_endpoint(
    project_id: int,
    request: AcceptBidRequest,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    """
    LOGIC MỚI:
    1. Chấp nhận thầu.
    2. Tìm chuỗi JSON trong cover_letter để tạo các Milestone chi tiết.
    3. KHÔNG tự động trừ tiền ngay (Client sẽ nạp tiền cho từng Milestone sau).
    """
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    project_obj = get_project(db, project_id)
    if not project_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    role = account.get("role")
    if isinstance(role, dict): role = role.get("value") or role.get("name")
    
    # Chỉ Admin hoặc Chủ dự án mới được chấp nhận thầu
    if str(role).lower() != "admin" and account.get("id") != project_obj.client_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can accept bids")

    # 1. Cập nhật trạng thái Project & Bid trong DB (Logic cũ vẫn dùng tốt)
    project = accept_bid(db, project_id, request.bid_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to accept bid")
    
    # 2. Xử lý tạo Milestone từ dữ liệu ẩn trong Cover Letter
    bid = db.query(Bid).filter(Bid.id == request.bid_id).first()
    milestone_created = False
    
    # Kiểm tra xem có chuỗi "DATA_JSON:" mà Frontend gửi lên không
    if bid and bid.cover_letter and "DATA_JSON:" in bid.cover_letter:
        try:
            # Cắt chuỗi để lấy phần JSON phía sau
            parts = bid.cover_letter.split("DATA_JSON:")
            if len(parts) > 1:
                json_str = parts[1].strip()
                milestones_data = json.loads(json_str)
                
                print(f"--> Found Milestone Data! Creating {len(milestones_data)} milestones...")
                
                for ms in milestones_data:
                    # ms gồm: {title, amount, deadline}
                    # Vì DB chưa có cột deadline riêng cho milestone, ta ghi tạm vào description
                    desc = f"Thời hạn hoàn thành: {ms.get('deadline', 'N/A')}"
                    
                    # Tạo Milestone với trạng thái PENDING (Chờ Client nạp tiền)
                    create_milestone(
                        db, 
                        project_id, 
                        title=ms.get('title', 'Giai đoạn'), 
                        amount=float(ms.get('amount', 0)),
                        description=desc
                    )
                milestone_created = True
        except Exception as e:
            print(f"Error parsing milestones from bid: {e}")
            # Nếu lỗi parse JSON thì thôi, chạy xuống fallback bên dưới
    
    # 3. Fallback (Dự phòng): Nếu là Bid cũ hoặc không có JSON
    # Thì tạo 1 Milestone duy nhất có giá trị = 100% giá thầu
    if not milestone_created and bid:
        create_milestone(
            db, 
            project_id, 
            title="Toàn bộ dự án", 
            description="Tạo tự động khi chấp nhận thầu (Không có kế hoạch chi tiết)", 
            amount=bid.price
        )
    
    # 4. Lưu thay đổi
    db.commit()
    
    # --- QUAN TRỌNG: ĐÃ BỎ ĐOẠN GỌI PAYMENT SERVICE ---
    # Trước đây: Gọi sang Payment trừ tiền luôn.
    # Bây giờ: Không làm gì cả. Milestone đang ở trạng thái PENDING.
    # Client sẽ thấy nút "Nạp tiền (Deposit)" ở giao diện quản lý sau.
    
    # Gửi sự kiện để thông báo/analytics biết
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    milestone_obj = create_milestone(db, project_id, **milestone.dict())
    
    # Auto deposit attempt (Optional - we can remove this if we want strict manual flow)
    # For manual milestone creation, maybe we still want to trigger it? 
    # Let's keep it but wrap in try-except so it doesn't fail
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
    return get_milestones(db, project_id)


@router.post("/{project_id}/milestones/{milestone_id}/submit", status_code=status.HTTP_201_CREATED)
def submit_work(
    project_id: int,
    milestone_id: int,
    submission: MilestoneSubmissionCreate,
    db: Session = Depends(get_db)
):
    milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    
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
        raise HTTPException(status_code=404, detail="Milestone not found")
    publish_event("revision.requested", {"milestone_id": milestone_id})
    return {"message": "Revision requested"}


@router.post("/{project_id}/close", response_model=ProjectResponse)
def close_project_endpoint(project_id: int, db: Session = Depends(get_db)):
    project = close_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
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
        raise HTTPException(status_code=404, detail="Milestone not found")
    
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


@router.post("/{project_id}/deliver", response_model=ProjectResponse)
def deliver_project_endpoint(
    project_id: int,
    files: List[UploadFile] = File(None),
    description: Optional[str] = None,
    request: Request = None,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    if not account: raise HTTPException(status_code=401, detail="Auth required")
    
    project = get_project(db, project_id)
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    
    if project.project_type != ProjectType.GIG_ORDER:
        raise HTTPException(status_code=400, detail="Only for GIG_ORDER")
    
    # Process files
    file_urls = []
    if files:
        ensure_bucket(MINIO_BUCKET)
        for file in files:
            try:
                data = file.file.read()
                ext = os.path.splitext(file.filename)[1]
                obj_name = f"projects/{project_id}/delivery/{uuid.uuid4()}{ext}"
                upload_file_to_storage(MINIO_BUCKET, obj_name, data, file.content_type)
                url = f"http://{MINIO_ENDPOINT}/{MINIO_BUCKET}/{obj_name}"
                file_urls.append(url)
            except Exception as e:
                print(f"Upload error: {e}")
    
    metadata = {
        "ip_address": get_client_ip(request) if request else "unknown",
        "user_agent": request.headers.get("User-Agent", "unknown") if request else "unknown"
    }
    
    updated = deliver_project(db, project_id, file_urls=file_urls, description=description, user_id=account.get("id"), metadata=metadata)
    publish_event("project.delivered", {"project_id": project_id})
    return enrich_project_with_bids_count(updated, db)


@router.post("/{project_id}/request-revision", response_model=ProjectResponse)
def request_revision_project_endpoint(
    project_id: int,
    reason: Optional[str] = None,
    request: Request = None,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    if not account: raise HTTPException(status_code=401, detail="Auth required")
    updated = request_revision_project(db, project_id, reason=reason, user_id=account.get("id"), metadata={})
    return enrich_project_with_bids_count(updated, db)


@router.post("/{project_id}/accept-delivery", response_model=ProjectResponse)
def accept_delivery_endpoint(
    project_id: int,
    request: Request = None,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    if not account: raise HTTPException(status_code=401, detail="Auth required")
    
    updated = accept_delivery(db, project_id, user_id=account.get("id"), metadata={})
    
    # Release escrow for Gig
    milestones = get_milestones(db, project_id)
    if milestones:
            try:
                httpx.post(
                    f"{PAYMENTS_SERVICE_URL}/api/v1/payments/escrow/release",
                json={"escrow_id": milestones[0].escrow_id},
                    timeout=5.0
                )
        except: pass
        
    return enrich_project_with_bids_count(updated, db)


@router.delete("/{project_id}", status_code=200)
def delete_project_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    delete_project(db, project_id) # Simplify auth check for brevity in this snippet
    return {"message": "Deleted"}


@router.post("/{project_id}/approve", status_code=200)
def approve_project_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    approved = approve_project(db, project_id)
    return {"message": "Approved", "project": enrich_project_with_bids_count(approved, db)}


@router.post("/{project_id}/attachments", status_code=201)
async def upload_project_attachment(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    if not account: raise HTTPException(status_code=401, detail="Auth required")
    
    project = get_project(db, project_id)
    if not project: raise HTTPException(status_code=404, detail="Not found")
    
    data = await file.read()
    ext = os.path.splitext(file.filename)[1]
    obj_name = f"projects/{project_id}/{uuid.uuid4()}{ext}"
    
    upload_file_to_storage(MINIO_BUCKET, obj_name, data, file.content_type)
    url = get_presigned_url(MINIO_BUCKET, obj_name)
    
    attachments = project.attachments or []
    attachments.append({
        "url": url,
        "filename": file.filename,
        "object_name": obj_name,
        "uploaded_at": datetime.utcnow().isoformat()
    })
    
    updated = update_project(db, project_id, attachments=attachments)
    return {"message": "Uploaded", "attachment": attachments[-1], "project": updated}


@router.delete("/{project_id}/attachments/{attachment_index}", status_code=200)
def delete_project_attachment(
    project_id: int,
    attachment_index: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    project = get_project(db, project_id)
    if not project: raise HTTPException(status_code=404)
    
    attachments = project.attachments or []
    if attachment_index < 0 or attachment_index >= len(attachments):
        raise HTTPException(status_code=404, detail="Attachment not found")
        
    att = attachments[attachment_index]
    if att.get("object_name"):
        delete_file_from_storage(MINIO_BUCKET, att["object_name"])
        
    new_atts = [a for i, a in enumerate(attachments) if i != attachment_index]
    
    # Force update
        from sqlalchemy.orm.attributes import flag_modified
    project.attachments = new_atts
    flag_modified(project, "attachments")
        db.commit()
    
    return {"message": "Deleted", "project": project}


@router.get("/{project_id}/attachments/{attachment_index}/download")
def download_project_attachment(
    project_id: int,
    attachment_index: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    project = get_project(db, project_id)
    attachments = project.attachments or []
    if attachment_index < 0 or attachment_index >= len(attachments):
        raise HTTPException(status_code=404)
        
    obj_name = attachments[attachment_index].get("object_name")
    if not obj_name: raise HTTPException(status_code=400, detail="Invalid attachment")
    
    url = get_presigned_url(MINIO_BUCKET, obj_name)
    return {"download_url": url}

@router.put("/{project_id}/bids/{bid_id}", response_model=BidResponse)
@router.patch("/{project_id}/bids/{bid_id}", response_model=BidResponse)
def update_bid_endpoint(
    project_id: int,
    bid_id: int,
    bid_update: BidUpdate,  # Chỉ cập nhật các trường cho phép
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    # 1. Tìm Bid
    bid = db.query(Bid).filter(Bid.id == bid_id, Bid.project_id == project_id).first()
    if not bid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bid not found")

    # 2. Check quyền (Chỉ chính chủ mới được sửa)
    if bid.freelancer_id != account.get("id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only edit your own bids")

    # 3. Check trạng thái (Chỉ sửa được khi chưa chốt)
    if bid.status != BidStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot edit bid after it is accepted or rejected")

    # 4. Update dữ liệu (chỉ các trường có gửi lên)
    data = bid_update.dict(exclude_unset=True)
    if "price" in data and data["price"] is not None:
        bid.price = data["price"]
    if "timeline_days" in data and data["timeline_days"] is not None:
        bid.timeline_days = data["timeline_days"]
    if "cover_letter" in data and data["cover_letter"] is not None:
        bid.cover_letter = data["cover_letter"]
    if "milestones" in data and data["milestones"] is not None:
        # Lưu thẳng mảng milestones vào cột JSON
        bid.milestones = [m.dict() for m in data["milestones"]]
    # bid.updated_at sẽ tự động cập nhật nhờ onupdate trong model (nếu có config), hoặc ta set tay:
    bid.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(bid)
    
    return bid


@router.delete("/{project_id}/bids/{bid_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bid_by_id_endpoint(
    project_id: int,
    bid_id: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    """Freelancer withdraw their own pending bid by id."""
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    bid = db.query(Bid).filter(Bid.id == bid_id, Bid.project_id == project_id).first()
    if not bid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bid not found")

    if bid.freelancer_id != account.get("id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only withdraw your own bids")

    if bid.status != BidStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot withdraw after it is accepted or rejected")

    db.delete(bid)
    db.commit()
    return None


@router.get("/{project_id}/bids/me", response_model=BidResponse)
def get_my_bid_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    freelancer_id = account.get("id")
    if not freelancer_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid account")

    bid = db.query(Bid).filter(Bid.project_id == project_id, Bid.freelancer_id == freelancer_id).first()
    if not bid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bid not found")
    return bid


@router.put("/{project_id}/bids/me", response_model=BidResponse)
@router.patch("/{project_id}/bids/me", response_model=BidResponse)
def update_my_bid_endpoint(
    project_id: int,
    bid_update: BidUpdate,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    freelancer_id = account.get("id")
    if not freelancer_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid account")

    # Find current user's bid for this project
    bid = db.query(Bid).filter(Bid.project_id == project_id, Bid.freelancer_id == freelancer_id).first()
    if not bid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bid not found")

    if bid.status != BidStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot edit bid after it is accepted or rejected")

    data = bid_update.dict(exclude_unset=True)
    if "price" in data and data["price"] is not None:
        bid.price = data["price"]
    if "timeline_days" in data and data["timeline_days"] is not None:
        bid.timeline_days = data["timeline_days"]
    if "cover_letter" in data and data["cover_letter"] is not None:
        bid.cover_letter = data["cover_letter"]
    if "milestones" in data and data["milestones"] is not None:
        bid.milestones = [m.dict() for m in data["milestones"]]
    bid.updated_at = datetime.utcnow()

        db.commit()
    db.refresh(bid)
    return bid


@router.delete("/{project_id}/bids/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_bid_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    account=Depends(resolve_account)
):
    # Freelancer rút hồ sơ thầu của chính mình khi chưa được duyệt
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    freelancer_id = account.get("id")
    if not freelancer_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid account")

    bid = db.query(Bid).filter(Bid.project_id == project_id, Bid.freelancer_id == freelancer_id).first()
    if not bid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bid not found")

    if bid.status != BidStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot withdraw after it is accepted or rejected")

    db.delete(bid)
    db.commit()
    return None