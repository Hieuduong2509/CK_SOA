from sqlalchemy.orm import Session
from models import Wallet, Transaction, Escrow, TransactionType, TransactionStatus
from datetime import datetime
import os

COMMISSION_RATE = float(os.getenv("COMMISSION_RATE", "0.10"))


def get_or_create_wallet(db: Session, user_id: int):
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if not wallet:
        wallet = Wallet(user_id=user_id, balance=0.0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet


def topup_wallet(db: Session, user_id: int, amount: float, payment_method: str):
    wallet = get_or_create_wallet(db, user_id)
    transaction = Transaction(
        user_id=user_id,
        transaction_type=TransactionType.TOPUP,
        amount=amount,
        payment_method=payment_method,
        status=TransactionStatus.PENDING
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    # Mock payment processing - in production, call payment gateway
    # For now, auto-complete
    transaction.status = TransactionStatus.COMPLETED
    wallet.balance += amount
    db.commit()
    
    return transaction


def create_escrow(db: Session, project_id: int, milestone_id: int, client_id: int, freelancer_id: int, amount: float):
    commission_amount = amount * COMMISSION_RATE
    net_amount = amount - commission_amount
    
    escrow = Escrow(
        project_id=project_id,
        milestone_id=milestone_id,
        client_id=client_id,
        freelancer_id=freelancer_id,
        amount=amount,
        commission_rate=COMMISSION_RATE,
        commission_amount=commission_amount,
        net_amount=net_amount
    )
    db.add(escrow)
    
    # Deduct from client wallet
    client_wallet = get_or_create_wallet(db, client_id)
    if client_wallet.balance < amount:
        raise ValueError("Insufficient balance")
    client_wallet.balance -= amount
    
    # Create transaction
    transaction = Transaction(
        user_id=client_id,
        transaction_type=TransactionType.ESCROW_DEPOSIT,
        amount=amount,
        status=TransactionStatus.COMPLETED,
        description=f"Escrow deposit for project {project_id}"
    )
    db.add(transaction)
    db.commit()
    db.refresh(escrow)
    return escrow


def release_escrow(db: Session, milestone_id: int):
    escrow = db.query(Escrow).filter(
        Escrow.milestone_id == milestone_id,
        Escrow.status == "locked"
    ).first()
    if not escrow:
        return None
    
    # Release to freelancer
    freelancer_wallet = get_or_create_wallet(db, escrow.freelancer_id)
    freelancer_wallet.balance += escrow.net_amount
    
    # Create transactions
    release_transaction = Transaction(
        user_id=escrow.freelancer_id,
        transaction_type=TransactionType.ESCROW_RELEASE,
        amount=escrow.net_amount,
        status=TransactionStatus.COMPLETED,
        description=f"Payment released for milestone {milestone_id}"
    )
    db.add(release_transaction)
    
    commission_transaction = Transaction(
        user_id=escrow.freelancer_id,
        transaction_type=TransactionType.COMMISSION,
        amount=-escrow.commission_amount,
        status=TransactionStatus.COMPLETED,
        description=f"Platform commission"
    )
    db.add(commission_transaction)
    
    escrow.status = "released"
    escrow.released_at = datetime.utcnow()
    db.commit()
    db.refresh(escrow)
    return escrow


def withdraw_funds(db: Session, user_id: int, amount: float, payment_method: str):
    wallet = get_or_create_wallet(db, user_id)
    if wallet.balance < amount:
        raise ValueError("Insufficient balance")
    
    transaction = Transaction(
        user_id=user_id,
        transaction_type=TransactionType.WITHDRAW,
        amount=amount,
        payment_method=payment_method,
        status=TransactionStatus.PENDING
    )
    db.add(transaction)
    wallet.balance -= amount
    db.commit()
    db.refresh(transaction)
    
    # Mock processing - in production, call payment gateway
    transaction.status = TransactionStatus.COMPLETED
    db.commit()
    
    return transaction


def get_transactions(db: Session, user_id: int, limit: int = 50):
    return db.query(Transaction).filter(
        Transaction.user_id == user_id
    ).order_by(Transaction.created_at.desc()).limit(limit).all()

