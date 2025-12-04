from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Event, Metric

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/summary")
async def get_summary(db: Session = Depends(get_db)):
    total_users = db.query(func.count(Event.user_id.distinct())).scalar() or 0
    total_projects = db.query(func.count()).filter(Event.event_type == "project.created").scalar() or 0
    
    revenue = db.query(func.sum(Metric.value)).filter(
        Metric.metric_name == "revenue"
    ).scalar() or 0.0
    
    revenue_split = {"gig": 0.0, "bidding": 0.0, "unknown": 0.0}
    metric_rows = db.query(Metric.meta_data, Metric.value).filter(Metric.metric_name == "revenue").all()
    for meta, value in metric_rows:
        value = value or 0.0
        project_type = (meta or {}).get("project_type") if meta else None
        if project_type and "gig" in project_type.lower():
            revenue_split["gig"] += value
        elif project_type and "bidding" in project_type.lower():
            revenue_split["bidding"] += value
        else:
            revenue_split["unknown"] += value
    
    return {
        "total_users": total_users,
        "total_projects": total_projects,
        "total_revenue": revenue,
        "revenue_split": revenue_split,
        "top_skills": []
    }


@router.get("/events")
def get_events(event_type: str = None, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(Event)
    if event_type:
        query = query.filter(Event.event_type == event_type)
    events = query.order_by(Event.created_at.desc()).limit(limit).all()
    return events

