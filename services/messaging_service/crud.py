from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from models import Conversation, Message
from datetime import datetime


def get_or_create_conversation(db: Session, participant1_id: int, participant2_id: int, project_id: int = None):
    participant_filter = or_(
        and_(
            Conversation.participant1_id == participant1_id,
            Conversation.participant2_id == participant2_id
        ),
        and_(
            Conversation.participant1_id == participant2_id,
            Conversation.participant2_id == participant1_id
        )
    )

    query = db.query(Conversation).filter(participant_filter)
    if project_id is None:
        query = query.filter(Conversation.project_id.is_(None))
    else:
        query = query.filter(Conversation.project_id == project_id)

    conversation = query.first()
    
    if not conversation:
        conversation = Conversation(
            participant1_id=participant1_id,
            participant2_id=participant2_id,
            project_id=project_id
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    return conversation


def create_message(db: Session, conversation_id: int, sender_id: int, content: str, attachments: list = None):
    message = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        content=content,
        attachments=attachments or []
    )
    db.add(message)
    
    # Update conversation last_message_at
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation:
        conversation.last_message_at = datetime.utcnow()
    
    db.commit()
    db.refresh(message)
    return message


def get_messages(db: Session, conversation_id: int, limit: int = 50, offset: int = 0):
    return db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.desc()).offset(offset).limit(limit).all()


def mark_messages_read(db: Session, conversation_id: int, user_id: int):
    db.query(Message).filter(
        and_(
            Message.conversation_id == conversation_id,
            Message.sender_id != user_id
        )
    ).update({"is_read": True})
    db.commit()


def get_user_conversations(db: Session, user_id: int):
    return db.query(Conversation).filter(
        or_(
            Conversation.participant1_id == user_id,
            Conversation.participant2_id == user_id
        )
    ).order_by(Conversation.last_message_at.desc()).all()

