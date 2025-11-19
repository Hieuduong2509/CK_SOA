from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Event, Metric
from typing import Dict
import httpx
import os

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:8001")
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://localhost:8002")
PROJECT_SERVICE_URL = os.getenv("PROJECT_SERVICE_URL", "http://localhost:8003")


@router.get("/summary")
async def get_summary(db: Session = Depends(get_db)):
    # Count events
    total_users = db.query(func.count(Event.user_id.distinct())).scalar() or 0
    total_projects = db.query(func.count()).filter(Event.event_type == "project.created").scalar() or 0
    
    # Get revenue from metrics
    revenue = db.query(func.sum(Metric.value)).filter(
        Metric.metric_name == "revenue"
    ).scalar() or 0.0
    
    # Top skills (would need aggregation from user service)
    top_skills = []  # Mock
    
    return {
        "total_users": total_users,
        "total_projects": total_projects,
        "total_revenue": revenue,
        "top_skills": top_skills
    }


@router.get("/events")
def get_events(event_type: str = None, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(Event)
    if event_type:
        query = query.filter(Event.event_type == event_type)
    events = query.order_by(Event.created_at.desc()).limit(limit).all()
    return events

