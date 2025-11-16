from sqlalchemy.orm import Session
from sqlalchemy import and_
from models import Project, Bid, Milestone, MilestoneSubmission, ProjectStatus, BidStatus, MilestoneStatus
from typing import Optional


def create_project(db: Session, client_id: int, **kwargs):
    project = Project(client_id=client_id, **kwargs)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_project(db: Session, project_id: int):
    return db.query(Project).filter(Project.id == project_id).first()


def get_projects_by_client(db: Session, client_id: int):
    return db.query(Project).filter(Project.client_id == client_id).all()


def get_projects_by_freelancer(db: Session, freelancer_id: int):
    bids = db.query(Bid).filter(Bid.freelancer_id == freelancer_id).all()
    project_ids = [bid.project_id for bid in bids]
    return db.query(Project).filter(Project.id.in_(project_ids)).all()


def create_bid(db: Session, project_id: int, freelancer_id: int, **kwargs):
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
    project.status = ProjectStatus.IN_PROGRESS
    db.commit()
    db.refresh(project)
    return project


def create_milestone(db: Session, project_id: int, **kwargs):
    milestone = Milestone(project_id=project_id, **kwargs)
    db.add(milestone)
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
    db.commit()
    db.refresh(milestone)
    return milestone


def request_revision(db: Session, milestone_id: int):
    milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not milestone:
        return None
    
    milestone.status = MilestoneStatus.IN_PROGRESS
    db.commit()
    db.refresh(milestone)
    return milestone


def close_project(db: Session, project_id: int):
    project = get_project(db, project_id)
    if not project:
        return None
    
    project.status = ProjectStatus.COMPLETED
    db.commit()
    db.refresh(project)
    return project

