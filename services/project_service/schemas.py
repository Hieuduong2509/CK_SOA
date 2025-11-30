from pydantic import BaseModel, Field
from typing import Optional, List, Union, Dict, Any
from datetime import datetime
from models import ProjectStatus, ProjectType, BudgetType, BidStatus, MilestoneStatus, ProjectActivity


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
    project_type: Optional[ProjectType] = ProjectType.BIDDING
    freelancer_id: Optional[int] = None
    service_package_id: Optional[int] = None
    requirements_answers: List[Any] = Field(default_factory=list)
    service_snapshot: Optional[Dict[str, Any]] = None


class ProjectUpdate(BaseModel):
    status: Optional[ProjectStatus] = None


class ProjectResponse(BaseModel):
    id: int
    client_id: int
    freelancer_id: Optional[int] = None
    title: str
    description: str
    budget_type: BudgetType
    budget: float
    skills_required: List[str]
    attachments: List[Union[str, Dict[str, Any]]]  # Accept both strings (legacy) and objects
    deadline: Optional[datetime]
    status: ProjectStatus
    project_type: ProjectType
    accepted_bid_id: Optional[int]
    service_package_id: Optional[int]
    requirements_answers: List[Any] = []
    service_snapshot: Optional[Dict[str, Any]] = None
    created_at: datetime
    category: Optional[str] = None
    tags: List[str] = []
    minimum_badge: Optional[str] = None
    minimum_level: Optional[int] = None
    bids_count: Optional[int] = 0  # Number of bids/applicants

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


class ServiceOrderCreate(BaseModel):
    service_id: int
    requirements_answers: List[Any] = Field(default_factory=list)


class ProjectActivityResponse(BaseModel):
    id: int
    project_id: int
    user_id: Optional[int] = None
    action_type: str
    description: Optional[str] = None
    created_at: datetime
    metadata: Optional[Dict[str, Any]] = Field(default=None, alias="activity_metadata")

    class Config:
        from_attributes = True
        populate_by_name = True

