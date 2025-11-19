from pydantic import BaseModel
from typing import Optional, List, Union, Dict, Any, Literal
from datetime import datetime
from models import ProjectStatus, BudgetType, BidStatus, MilestoneStatus


class AttachmentInfo(BaseModel):
    url: str
    filename: Optional[str] = None
    content_type: Optional[str] = None
    size: Optional[int] = None
    uploaded_at: Optional[str] = None
    object_name: Optional[str] = None


class ProjectCreate(BaseModel):
    client_id: Optional[int] = None
    title: str
    description: str
    budget_type: BudgetType
    budget: float
    skills_required: List[str] = []
    attachments: List[str] = []  # For backward compatibility, accepts list of strings
    deadline: Optional[datetime] = None
    category: Optional[str] = None
    tags: List[str] = []
    minimum_badge: Optional[str] = None
    minimum_level: Optional[int] = None


class ProjectUpdate(BaseModel):
    status: Optional[ProjectStatus] = None


class ProjectResponse(BaseModel):
    id: int
    client_id: int
    title: str
    description: str
    budget_type: BudgetType
    budget: float
    skills_required: List[str]
    attachments: List[Union[str, Dict[str, Any]]]  # Accept both strings (legacy) and objects
    deadline: Optional[datetime]
    status: ProjectStatus
    accepted_bid_id: Optional[int]
    created_at: datetime
    category: Optional[str] = None
    tags: List[str] = []
    minimum_badge: Optional[str] = None
    minimum_level: Optional[int] = None

    class Config:
        from_attributes = True


class BidCreate(BaseModel):
    price: float
    timeline_days: int
    cover_letter: Optional[str] = None


class BidResponse(BaseModel):
    id: int
    project_id: int
    freelancer_id: int
    price: float
    timeline_days: int
    cover_letter: Optional[str]
    status: BidStatus
    created_at: datetime

    class Config:
        from_attributes = True


class AcceptBidRequest(BaseModel):
    bid_id: int


class MilestoneCreate(BaseModel):
    title: str
    description: Optional[str] = None
    amount: float


class MilestoneResponse(BaseModel):
    id: int
    project_id: int
    title: str
    description: Optional[str]
    amount: float
    status: MilestoneStatus
    escrow_id: Optional[int]
    submitted_at: Optional[datetime]
    approved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class MilestoneSubmissionCreate(BaseModel):
    description: Optional[str] = None
    file_urls: List[str] = []


class RevisionRequest(BaseModel):
    milestone_id: int
    reason: str


class FreelancerOrderResponse(BaseModel):
    project: ProjectResponse
    bid_id: int
    bid_status: BidStatus
    bid_price: float
    bid_timeline_days: int
    is_awarded: bool
    order_state: Literal["active", "pending"]

