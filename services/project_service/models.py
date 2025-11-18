from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Enum, Boolean, JSON, TypeDecorator
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

Base = declarative_base()


class EnumValue(TypeDecorator):
    """Custom TypeDecorator to store enum values instead of names"""
    impl = String
    cache_ok = True
    
    def __init__(self, enum_class, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.enum_class = enum_class
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, self.enum_class):
            # Return the enum value (e.g., "pending_approval") instead of name (e.g., "PENDING_APPROVAL")
            return value.value
        # If it's already a string, return as is
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return value
        # Convert string value back to enum
        try:
            return self.enum_class(value)
        except ValueError:
            # If value doesn't match any enum, try to find by value
            for enum_item in self.enum_class:
                if enum_item.value == value:
                    return enum_item
            raise


class ProjectStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "pending_approval"  # Database has lowercase for this one
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    DISPUTED = "DISPUTED"


class BudgetType(str, enum.Enum):
    FIXED = "FIXED"
    HOURLY = "HOURLY"


class BidStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class MilestoneStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    PAID = "paid"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    budget_type = Column(EnumValue(BudgetType, length=50), nullable=False)
    budget = Column(Float, nullable=False)
    skills_required = Column(JSON, default=list)
    attachments = Column(JSON, default=list)
    category = Column(String, nullable=True)
    tags = Column(JSON, default=list)
    deadline = Column(DateTime(timezone=True), nullable=True)
    minimum_badge = Column(String, nullable=True)  # e.g., "Top Rated", "Premium"
    minimum_level = Column(Integer, nullable=True)  # Minimum freelancer level required
    status = Column(EnumValue(ProjectStatus, length=50), default=ProjectStatus.PENDING_APPROVAL)
    accepted_bid_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    bids = relationship("Bid", back_populates="project", cascade="all, delete-orphan")
    milestones = relationship("Milestone", back_populates="project", cascade="all, delete-orphan")


class Bid(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    freelancer_id = Column(Integer, nullable=False, index=True)
    price = Column(Float, nullable=False)
    timeline_days = Column(Integer, nullable=False)
    cover_letter = Column(Text, nullable=True)
    status = Column(Enum(BidStatus), default=BidStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="bids")


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    amount = Column(Float, nullable=False)
    status = Column(Enum(MilestoneStatus), default=MilestoneStatus.PENDING)
    escrow_id = Column(Integer, nullable=True)  # Reference to payments service
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="milestones")
    submissions = relationship("MilestoneSubmission", back_populates="milestone", cascade="all, delete-orphan")


class MilestoneSubmission(Base):
    __tablename__ = "milestone_submissions"

    id = Column(Integer, primary_key=True, index=True)
    milestone_id = Column(Integer, ForeignKey("milestones.id"), nullable=False)
    version = Column(Integer, default=1)
    description = Column(Text, nullable=True)
    file_urls = Column(JSON, default=list)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())

    milestone = relationship("Milestone", back_populates="submissions")

