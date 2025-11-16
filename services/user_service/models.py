from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

Base = declarative_base()


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    headline = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    skills = Column(JSON, default=list)  # ["Python", "React", "UI/UX"]
    location = Column(String, nullable=True)
    website = Column(String, nullable=True)
    github = Column(String, nullable=True)
    linkedin = Column(String, nullable=True)
    categories = Column(JSON, default=list)
    badges = Column(JSON, default=list)
    response_time_label = Column(String, nullable=True)
    experience_level = Column(String, nullable=True)
    hourly_rate = Column(Float, nullable=True)
    languages = Column(JSON, default=list)
    rating = Column(Float, default=0.0)
    total_reviews = Column(Integer, default=0)
    total_projects = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    portfolio_items = relationship("PortfolioItem", back_populates="profile", cascade="all, delete-orphan")
    packages = relationship("Package", back_populates="profile", cascade="all, delete-orphan")
    articles = relationship("Article", back_populates="profile", cascade="all, delete-orphan")
    favorited_by = relationship("Favorite", back_populates="freelancer", cascade="all, delete-orphan")


class PortfolioItem(Base):
    __tablename__ = "portfolio_items"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    image_urls = Column(JSON, default=list)
    video_url = Column(String, nullable=True)
    pdf_url = Column(String, nullable=True)
    tags = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    profile = relationship("Profile", back_populates="portfolio_items")


class Package(Base):
    __tablename__ = "packages"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    deliverables = Column(JSON, default=list)
    revisions = Column(Integer, default=1)
    delivery_days = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    profile = relationship("Profile", back_populates="packages")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    reviewer_id = Column(Integer, nullable=False, index=True)
    reviewee_id = Column(Integer, nullable=False, index=True)
    project_id = Column(Integer, nullable=True)
    rating_overall = Column(Float, nullable=False)
    rating_skill = Column(Float, nullable=True)
    rating_communication = Column(Float, nullable=True)
    rating_punctuality = Column(Float, nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    cover_image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    profile = relationship("Profile", back_populates="articles")


class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    freelancer_profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    freelancer = relationship("Profile", back_populates="favorited_by")

