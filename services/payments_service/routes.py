from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from schemas import (
    TopupRequest, TopupResponse, EscrowDepositRequest, EscrowDepositResponse,
    EscrowReleaseRequest, TransactionResponse, WithdrawRequest, WalletResponse
)
from crud import (
    get_or_create_wallet, topup_wallet, create_escrow, release_escrow,
    withdraw_funds, get_transactions
)
import httpx
import os
import pika
import json

router = APIRouter(prefix="/api/v1/payments", tags=["payments"])

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://admin:admin@localhost:5672/")


def publish_event(event_type: str, data: dict):
    try:
        params = pika.URLParameters(RABBITMQ_URL)
        connection = pika.BlockingConnection(params)
        channel = connection.channel()
        channel.queue_declare(queue='events', durable=True)
        channel.basic_publish(
            exchange='',
            routing_key='events',
            body=json.dumps({"type": event_type, "data": data}),
            properties=pika.BasicProperties(delivery_mode=2)
        )
        connection.close()
    except Exception as e:
        print(f"Failed to publish event: {e}")


@router.post("/topup", response_model=TopupResponse)
def topup(request: TopupRequest, user_id: int = 1, db: Session = Depends(get_db)):
    try:
        transaction = topup_wallet(
            db,
            user_id,
            request.amount,
            request.payment_method.value
        )
        publish_event("payment.topup", {"user_id": user_id, "amount": request.amount})
        return TopupResponse(
            transaction_id=transaction.id,
            status=transaction.status
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/escrow/deposit", response_model=EscrowDepositResponse)
def deposit_escrow(request: EscrowDepositRequest, db: Session = Depends(get_db)):
    # In production, get client_id and freelancer_id from project
    client_id = 1  # Mock
    freelancer_id = 2  # Mock
    
    try:
        escrow = create_escrow(
            db,
            request.project_id,
            request.milestone_id,
            client_id,
            freelancer_id,
            request.amount
        )
        publish_event("escrow.deposited", {"escrow_id": escrow.id, "project_id": request.project_id})
        return EscrowDepositResponse(escrow_id=escrow.id, status=escrow.status)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/escrow/release", response_model=dict)
def release_escrow_endpoint(request: EscrowReleaseRequest, db: Session = Depends(get_db)):
    escrow = release_escrow(db, request.milestone_id)
    if not escrow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escrow not found or already released"
        )
    publish_event("escrow.released", {"escrow_id": escrow.id, "milestone_id": request.milestone_id})
    return {"message": "Escrow released successfully", "escrow_id": escrow.id}


@router.get("/history", response_model=list[TransactionResponse])
def get_payment_history(user_id: int = 1, limit: int = 50, db: Session = Depends(get_db)):
    transactions = get_transactions(db, user_id, limit)
    return transactions


@router.post("/withdraw", response_model=TransactionResponse)
def withdraw(request: WithdrawRequest, user_id: int = 1, db: Session = Depends(get_db)):
    try:
        transaction = withdraw_funds(
            db,
            user_id,
            request.amount,
            request.payment_method.value
        )
        publish_event("payment.withdraw", {"user_id": user_id, "amount": request.amount})
        return transaction
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/wallet", response_model=WalletResponse)
def get_wallet(user_id: int = 1, db: Session = Depends(get_db)):
    wallet = get_or_create_wallet(db, user_id)
    return wallet

