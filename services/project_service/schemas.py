from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

# Class định nghĩa cấu trúc của 1 Milestone
class MilestoneSchema(BaseModel):
    title: str
    amount: float
    deadline: str  # Định dạng YYYY-MM-DD
    

# ------- Bids (đề xuất) -------
class BidCreate(BaseModel):
    price: float
    timeline_days: int
    cover_letter: Optional[str] = None
    milestones: List[MilestoneSchema] = []


class BidResponse(BaseModel):
    id: int
    project_id: int
    freelancer_id: int
    price: float
    timeline_days: int
    cover_letter: Optional[str] = None
    status: str
    created_at: datetime
    milestones: List[MilestoneSchema] = []

    class Config:
        from_attributes = True


# Cập nhật bid
class BidUpdate(BaseModel):
    price: Optional[float] = None
    timeline_days: Optional[int] = None
    cover_letter: Optional[str] = None
    milestones: Optional[List[MilestoneSchema]] = None


# ------- Proposals (alias) -------
class ProposalCreate(BaseModel):
    project_id: int
    freelancer_id: int
    cover_letter: str
    bid_amount: float
    delivery_time: int
    # Thêm trường này để nhận JSON từ Frontend
    milestones: List[MilestoneSchema] 

class ProposalResponse(BaseModel):
    id: int
    project_id: int
    freelancer_id: int
    cover_letter: str
    bid_amount: float
    delivery_time: int
    status: str
    created_at: datetime
    milestones: List[MilestoneSchema] = [] 

    class Config:
        from_attributes = True