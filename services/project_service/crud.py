from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, inspect, text
from models import (
    Project,
    Bid,
    Milestone,
    MilestoneSubmission,
    ProjectStatus,
    ProjectType,
    BudgetType,
    BidStatus,
    MilestoneStatus,
    ProjectActivity,
)
from typing import Optional
from datetime import datetime

_activity_metadata_ready = False
_bid_milestones_ready = False


def ensure_activity_metadata_column(engine):
    global _activity_metadata_ready
    if _activity_metadata_ready:
        return
    try:
        inspector = inspect(engine)
        columns = [col["name"] for col in inspector.get_columns("project_activities")]
        if "metadata" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE project_activities ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb"))
        _activity_metadata_ready = True
    except Exception as exc:
        print(f"ensure_activity_metadata_column error: {exc}")


def ensure_bid_milestones_column(engine):
    """Đảm bảo bảng bids có cột milestones JSONB (tương thích Postgres/SQLite JSON)."""
    global _bid_milestones_ready
    if _bid_milestones_ready:
        return
    try:
        inspector = inspect(engine)
        columns = [col["name"] for col in inspector.get_columns("bids")]
        if "milestones" not in columns:
            # Postgres JSONB (hoặc JSON cho các dialect khác)
            try:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE bids ADD COLUMN milestones JSONB DEFAULT '[]'::jsonb"))
            except Exception:
                # Fallback cho SQLite hoặc dialect khác
                try:
                    with engine.begin() as conn:
                        conn.execute(text("ALTER TABLE bids ADD COLUMN milestones JSON DEFAULT '[]'"))
                except Exception as exc2:
                    print(f"ensure_bid_milestones_column (fallback) error: {exc2}")
        _bid_milestones_ready = True
    except Exception as exc:
        print(f"ensure_bid_milestones_column error: {exc}")

def _coerce_project_status(status_value):
    if status_value is None:
        return ProjectStatus.PENDING_APPROVAL
    if isinstance(status_value, ProjectStatus):
        return status_value
    return ProjectStatus(status_value)


def _coerce_project_type(type_value):
    if type_value is None:
        return ProjectType.BIDDING
    if isinstance(type_value, ProjectType):
        return type_value
    return ProjectType(type_value)


def log_activity(db: Session, project_id: int, action_type: str, description: str, user_id: Optional[int] = None, metadata: Optional[dict] = None):
    """Ghi log hoạt động của dự án
    
    Args:
        db: Database session
        project_id: ID của project
        action_type: Loại hành động (e.g., "project_created", "milestone_submitted")
        description: Mô tả hành động
        user_id: ID người thực hiện (optional)
        metadata: Thông tin bổ sung như IP address, user agent (optional, quan trọng cho dispute resolution)
    """
    try:
        ensure_activity_metadata_column(db.bind)
    except Exception:
        pass

    activity = ProjectActivity(
        project_id=project_id,
        user_id=user_id,
        action_type=action_type,
        description=description,
        activity_metadata=metadata or {}
    )
    db.add(activity)
    return activity


def create_project(
    db: Session,
    client_id: int,
    status: ProjectStatus = ProjectStatus.PENDING_APPROVAL,
    project_type: ProjectType = ProjectType.BIDDING,
    **kwargs
):
    status_override = kwargs.pop("status", None)
    type_override = kwargs.pop("project_type", None)
    project_status = _coerce_project_status(status_override or status)
    project_type = _coerce_project_type(type_override or project_type)

    project = Project(
        client_id=client_id,
        status=project_status,
        project_type=project_type,
        **kwargs
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Log activity
    try:
        log_activity(db, project.id, "project_created", f"Project '{project.title}' được tạo")
        db.commit()
    except Exception:
        db.rollback()

    return project


def get_project(db: Session, project_id: int):
    return db.query(Project).filter(Project.id == project_id).first()


def update_project(db: Session, project_id: int, **kwargs):
    project = get_project(db, project_id)
    if not project:
        return None
    
    # Update fields
    for key, value in kwargs.items():
        if hasattr(project, key):
            # Special handling for attachments - allow empty list
            if key == "attachments":
                setattr(project, key, value if value is not None else [])
            elif value is not None:
                setattr(project, key, value)
    
    db.commit()
    db.refresh(project)
    return project


def get_projects_by_client(db: Session, client_id: int):
    return db.query(Project).filter(Project.client_id == client_id).all()


def get_projects_by_freelancer(db: Session, freelancer_id: int):
    bids = db.query(Bid).filter(Bid.freelancer_id == freelancer_id).all()
    project_ids = [bid.project_id for bid in bids]
    filters = [Project.freelancer_id == freelancer_id]
    if project_ids:
        filters.append(Project.id.in_(project_ids))
    return db.query(Project).filter(or_(*filters)).all()


def create_bid(db: Session, project_id: int, freelancer_id: int, **kwargs):
    # Auto-migration: đảm bảo có cột milestones
    try:
        ensure_bid_milestones_column(db.bind)
    except Exception:
        pass

    bid = Bid(project_id=project_id, freelancer_id=freelancer_id, **kwargs)
    db.add(bid)
    db.commit()
    db.refresh(bid)
    return bid


def get_bids_by_project(db: Session, project_id: int):
    return db.query(Bid).filter(Bid.project_id == project_id).all()


def accept_bid(db: Session, project_id: int, bid_id: int):
    project = get_project(db, project_id)
    if not project:
        return None
    
    bid = db.query(Bid).filter(Bid.id == bid_id).first()
    if not bid:
        return None
    
    # Reject other bids
    db.query(Bid).filter(
        and_(
            Bid.project_id == project_id,
            Bid.id != bid_id
        )
    ).update({"status": BidStatus.REJECTED})
    
    bid.status = BidStatus.ACCEPTED
    project.accepted_bid_id = bid_id
    project.freelancer_id = bid.freelancer_id  # Set freelancer_id so workspace can find the freelancer
    project.status = ProjectStatus.IN_PROGRESS

    # QUAN TRỌNG: Copy Milestones từ Bid sang bảng Milestones của Project
    # Xóa các milestone cũ (nếu có - phòng trường hợp accept lại)
    db.query(Milestone).filter(Milestone.project_id == project_id).delete()
    
    official_milestones = []
    
    # Debug: In ra để kiểm tra
    print(f"[DEBUG] Accept bid {bid_id}: bid.milestones = {bid.milestones}, type = {type(bid.milestones)}")
    
    # Parse milestones từ bid.milestones (column JSON) hoặc cover_letter (legacy)
    milestones_data = None
    
    # Ưu tiên lấy từ column milestones
    if bid.milestones:
        milestones_data = bid.milestones
        if isinstance(bid.milestones, str):
            try:
                import json
                milestones_data = json.loads(bid.milestones)
                print(f"[DEBUG] Parsed milestones JSON string: {milestones_data}")
            except Exception as e:
                print(f"[DEBUG] Failed to parse milestones JSON string: {e}")
                milestones_data = None
    
    # FALLBACK: Nếu milestones column rỗng, thử parse từ cover_letter (legacy format)
    if not milestones_data and bid.cover_letter:
        import json
        # Dùng cách parse đơn giản: split('DATA_JSON:') và lấy phần sau
        if 'DATA_JSON:' in bid.cover_letter:
            try:
                parts = str(bid.cover_letter).split('DATA_JSON:')
                json_str = (parts[1] if len(parts) > 1 else '').strip()
                if json_str:
                    milestones_data = json.loads(json_str)
                    if isinstance(milestones_data, list) and len(milestones_data) > 0:
                        print(f"[DEBUG] Found milestones in cover_letter for bid {bid_id}, parsed {len(milestones_data)} milestones")
                    else:
                        print(f"[DEBUG] Parsed milestones is not a list or empty for bid {bid_id}")
                        milestones_data = None
                else:
                    print(f"[DEBUG] No JSON string found after DATA_JSON: for bid {bid_id}")
            except Exception as e:
                print(f"[DEBUG] Failed to parse milestones from cover_letter for bid {bid_id}: {e}")
                milestones_data = None
        else:
            print(f"[DEBUG] No DATA_JSON: pattern found in cover_letter for bid {bid_id}")
    
    # Nếu bid có milestones (JSON hoặc từ cover_letter), dùng nó
    if milestones_data and isinstance(milestones_data, list) and len(milestones_data) > 0:
        print(f"[DEBUG] Creating {len(milestones_data)} milestones from bid")
        for idx, m_data in enumerate(milestones_data):
            # m_data có thể là dict hoặc đã là object
            if isinstance(m_data, dict):
                title = m_data.get('title', f'Giai đoạn {idx+1}')
                amount = float(m_data.get('amount', 0))
                deadline = m_data.get('deadline', 'N/A')
            else:
                # Nếu là object (Pydantic model)
                title = getattr(m_data, 'title', f'Giai đoạn {idx+1}')
                amount = float(getattr(m_data, 'amount', 0))
                deadline = getattr(m_data, 'deadline', 'N/A')
            
            print(f"[DEBUG] Creating milestone {idx+1}: title={title}, amount={amount}, deadline={deadline}")
            
            # Tạo Mốc mới
            new_ms = Milestone(
                project_id=project_id,
                title=title,
                amount=amount,
                description=f"Tạo tự động từ hồ sơ thầu. Hạn: {deadline}",
                status=MilestoneStatus.PENDING
            )
            db.add(new_ms)
            official_milestones.append(new_ms)
    
    else:
        # Fallback: Nếu dữ liệu cũ không có milestones JSON, tạo 1 mốc full tiền
        print(f"[DEBUG] No milestones in bid, creating fallback milestone with amount={bid.price}")
        full_ms = Milestone(
            project_id=project_id,
            title="Hoàn thành dự án",
            amount=bid.price,
            description="Thanh toán toàn bộ khi hoàn thành",
            status=MilestoneStatus.PENDING
        )
        db.add(full_ms)
        official_milestones.append(full_ms)
    
    print(f"[DEBUG] Total milestones created: {len(official_milestones)}")

    # Log activity
    log_activity(
        db,
        project.id,
        "bid_accepted",
        f"Đã chấp nhận đề xuất của freelancer #{bid.freelancer_id}",
    )

    db.commit()
    db.refresh(project)
    
    # Refresh milestones để có ID
    for ms in official_milestones:
        db.refresh(ms)
    
    # Trả về kèm danh sách mốc vừa tạo để Route xử lý thanh toán
    return project, official_milestones


def create_milestone(db: Session, project_id: int, **kwargs):
    milestone = Milestone(project_id=project_id, **kwargs)
    db.add(milestone)

    # Log activity
    log_activity(
        db,
        project_id,
        "milestone_created",
        f"Tạo milestone '{milestone.title}' với số tiền {milestone.amount}",
    )

    db.commit()
    db.refresh(milestone)
    return milestone


def get_milestones(db: Session, project_id: int):
    return db.query(Milestone).filter(Milestone.project_id == project_id).all()


def submit_milestone(db: Session, milestone_id: int, **kwargs):
    milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not milestone:
        return None
    
    # Get latest version
    latest_submission = db.query(MilestoneSubmission).filter(
        MilestoneSubmission.milestone_id == milestone_id
    ).order_by(MilestoneSubmission.version.desc()).first()
    
    version = (latest_submission.version + 1) if latest_submission else 1
    
    submission = MilestoneSubmission(milestone_id=milestone_id, version=version, **kwargs)
    db.add(submission)
    milestone.status = MilestoneStatus.SUBMITTED

    # Log activity
    log_activity(
        db,
        milestone.project_id,
        "milestone_submitted",
        f"Milestone '{milestone.title}' đã được nộp để duyệt",
    )

    db.commit()
    db.refresh(submission)
    return submission


def approve_milestone(db: Session, milestone_id: int):
    milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not milestone:
        return None
    
    milestone.status = MilestoneStatus.APPROVED
    from datetime import datetime

    milestone.approved_at = datetime.utcnow()

    # Log activity
    log_activity(
        db,
        milestone.project_id,
        "milestone_approved",
        f"Milestone '{milestone.title}' đã được khách hàng duyệt",
    )

    db.commit()
    db.refresh(milestone)
    return milestone


def request_revision(db: Session, milestone_id: int):
    milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not milestone:
        return None
    
    milestone.status = MilestoneStatus.IN_PROGRESS

    # Log activity
    log_activity(
        db,
        milestone.project_id,
        "milestone_revision_requested",
        f"Khách hàng yêu cầu chỉnh sửa milestone '{milestone.title}'",
    )

    db.commit()
    db.refresh(milestone)
    return milestone


def close_project(db: Session, project_id: int):
    project = get_project(db, project_id)
    if not project:
        return None
    
    project.status = ProjectStatus.COMPLETED

    # Log activity
    log_activity(
        db,
        project.id,
        "project_closed",
        f"Dự án đã được đánh dấu hoàn thành",
    )

    db.commit()
    db.refresh(project)
    return project


def get_project_activities(db: Session, project_id: int):
    return (
        db.query(ProjectActivity)
        .filter(ProjectActivity.project_id == project_id)
        .order_by(ProjectActivity.created_at.desc())
        .all()
    )


def approve_project(db: Session, project_id: int):
    """Approve project by admin - change status from PENDING_APPROVAL to OPEN"""
    project = get_project(db, project_id)
    if not project:
        return None
    
    if project.status != ProjectStatus.PENDING_APPROVAL:
        return None  # Can only approve pending_approval projects
    
    project.status = ProjectStatus.OPEN
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project_id: int):
    project = get_project(db, project_id)
    if not project:
        return None
    
    # Only allow deletion if project is in draft, pending_approval or open status
    # Projects in progress or completed should not be deleted
    if project.status not in [ProjectStatus.DRAFT, ProjectStatus.PENDING_APPROVAL, ProjectStatus.OPEN]:
        return None
    
    db.delete(project)
    db.commit()
    return project


def deliver_project(db: Session, project_id: int, file_urls: list = None, description: str = None, user_id: Optional[int] = None, metadata: Optional[dict] = None):
    """Deliver GIG_ORDER project - change status from IN_PROGRESS to DELIVERED"""
    project = get_project(db, project_id)
    if not project:
        return None
    
    # Only allow for GIG_ORDER projects
    if project.project_type != ProjectType.GIG_ORDER:
        return None
    
    # Only allow if status is IN_PROGRESS
    if project.status != ProjectStatus.IN_PROGRESS:
        return None
    
    # Update project status
    project.status = ProjectStatus.DELIVERED
    
    # Update attachments if files provided
    if file_urls:
        current_attachments = project.attachments or []
        # Add new files to attachments
        for file_url in file_urls:
            current_attachments.append({
                "url": file_url,
                "uploaded_at": datetime.utcnow().isoformat(),
                "uploaded_by": user_id
            })
        project.attachments = current_attachments
    
    # Update milestone if exists (for GIG_ORDER, there's usually one milestone)
    milestones = get_milestones(db, project_id)
    if milestones:
        milestone = milestones[0]  # GIG_ORDER typically has one milestone
        milestone.status = MilestoneStatus.SUBMITTED
        # Create submission if files provided
        if file_urls:
            latest_submission = db.query(MilestoneSubmission).filter(
                MilestoneSubmission.milestone_id == milestone.id
            ).order_by(MilestoneSubmission.version.desc()).first()
            version = (latest_submission.version + 1) if latest_submission else 1
            
            submission = MilestoneSubmission(
                milestone_id=milestone.id,
                version=version,
                description=description,
                file_urls=file_urls
            )
            db.add(submission)
    
    # Log activity
    log_activity(
        db,
        project.id,
        "project_delivered",
        f"Freelancer đã giao hàng cho dự án '{project.title}'",
        user_id=user_id,
        metadata=metadata
    )
    
    db.commit()
    db.refresh(project)
    return project


def request_revision_project(db: Session, project_id: int, reason: str = None, user_id: Optional[int] = None, metadata: Optional[dict] = None):
    """Request revision for GIG_ORDER project - change status from DELIVERED back to IN_PROGRESS"""
    project = get_project(db, project_id)
    if not project:
        return None
    
    # Only allow for GIG_ORDER projects
    if project.project_type != ProjectType.GIG_ORDER:
        return None
    
    # Only allow if status is DELIVERED
    if project.status != ProjectStatus.DELIVERED:
        return None
    
    # Update project status
    project.status = ProjectStatus.IN_PROGRESS
    
    # Update milestone status
    milestones = get_milestones(db, project_id)
    if milestones:
        milestone = milestones[0]
        milestone.status = MilestoneStatus.IN_PROGRESS
    
    # Log activity
    log_activity(
        db,
        project.id,
        "project_revision_requested",
        f"Khách hàng yêu cầu chỉnh sửa lại. Lý do: {reason or 'Không có lý do cụ thể'}",
        user_id=user_id,
        metadata=metadata
    )
    
    db.commit()
    db.refresh(project)
    return project


def accept_delivery(db: Session, project_id: int, user_id: Optional[int] = None, metadata: Optional[dict] = None):
    """Accept delivery for GIG_ORDER project - change status from DELIVERED to COMPLETED"""
    project = get_project(db, project_id)
    if not project:
        return None
    
    # Only allow for GIG_ORDER projects
    if project.project_type != ProjectType.GIG_ORDER:
        return None
    
    # Only allow if status is DELIVERED
    if project.status != ProjectStatus.DELIVERED:
        return None
    
    # Update project status
    project.status = ProjectStatus.COMPLETED
    
    # Update milestone status
    milestones = get_milestones(db, project_id)
    if milestones:
        milestone = milestones[0]
        milestone.status = MilestoneStatus.APPROVED
    
    # Log activity
    log_activity(
        db,
        project.id,
        "project_delivery_accepted",
        f"Khách hàng đã chấp nhận giao hàng cho dự án '{project.title}'",
        user_id=user_id,
        metadata=metadata
    )
    
    db.commit()
    db.refresh(project)
    return project

