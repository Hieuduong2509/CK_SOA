from pydantic import BaseModel
from pydantic import Field
from typing import Optional, List
from datetime import datetime


class ProfileBase(BaseModel):
    bio: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    location: Optional[str] = None
    website: Optional[str] = None
    github: Optional[str] = None
    linkedin: Optional[str] = None
    display_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    headline: Optional[str] = None
    categories: List[str] = Field(default_factory=list)
    badges: List[str] = Field(default_factory=list)
    response_time_label: Optional[str] = None
    experience_level: Optional[str] = None
    hourly_rate: Optional[float] = None
    languages: List[str] = Field(default_factory=list)


class ProfileResponse(ProfileBase):
    id: int
    user_id: int
    avatar_url: Optional[str] = None
    rating: float = 0.0
    total_reviews: int = 0
    total_projects: int = 0
    created_at: datetime
    starting_price: Optional[float] = None
    total_stars: float = 0.0
    level: int = 1

    class Config:
        from_attributes = True


class PortfolioItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    image_urls: List[str] = []
    video_url: Optional[str] = None
    pdf_url: Optional[str] = None
    tags: List[str] = []


class PortfolioItemResponse(BaseModel):
    id: int
    profile_id: int
    title: str
    description: Optional[str]
    image_urls: List[str]
    video_url: Optional[str]
    pdf_url: Optional[str]
    tags: List[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PackageCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    deliverables: List[str] = []
    revisions: int = 1
    delivery_days: int


class PackageResponse(BaseModel):
    id: int
    profile_id: int
    name: str
    description: Optional[str]
    price: float
    deliverables: List[str]
    revisions: int
    delivery_days: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FreelancerFilter(BaseModel):
    skills: Optional[List[str]] = None
    rating_min: Optional[float] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    location: Optional[str] = None


class ReviewCreate(BaseModel):
    reviewee_id: int
    project_id: Optional[int] = None
    rating_overall: float
    rating_skill: Optional[float] = None
    rating_communication: Optional[float] = None
    rating_punctuality: Optional[float] = None
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: int
    reviewer_id: int
    reviewee_id: int
    project_id: Optional[int]
    rating_overall: float
    rating_skill: Optional[float]
    rating_communication: Optional[float]
    rating_punctuality: Optional[float]
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ArticleCreate(BaseModel):
    title: str
    content: Optional[str] = None
    tags: List[str] = []
    cover_image_url: Optional[str] = None


class ArticleResponse(ArticleCreate):
    id: int
    profile_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class FavoriteCreate(BaseModel):
    freelancer_profile_id: int
    notes: Optional[str] = None


class FavoriteResponse(BaseModel):
    id: int
    freelancer_profile_id: int
    notes: Optional[str]
    created_at: datetime
    freelancer: ProfileResponse

    class Config:
        from_attributes = True

