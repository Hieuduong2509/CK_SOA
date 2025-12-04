from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8000")

http_bearer = HTTPBearer(auto_error=False)

def resolve_account(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)):
    """Resolve user account from JWT token"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    try:
        response = httpx.get(
            f"{AUTH_SERVICE_URL}/api/v1/auth/me",
            headers={"Authorization": f"Bearer {credentials.credentials}"},
            timeout=5.0
        )
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
        account = response.json()
        if not account.get("id"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication payload"
            )
        return account
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cannot verify authentication: {exc}"
        ) from exc


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
def topup(request: TopupRequest, db: Session = Depends(get_db), account: dict = Depends(resolve_account)):
    user_id = account.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authenticated")
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
def deposit_escrow(request: EscrowDepositRequest, db: Session = Depends(get_db), account: dict = Depends(resolve_account)):
    """
    Create escrow deposit for a project/milestone.
    For service packages: client pays directly, money is held in escrow.
    For bidding projects: client pays from wallet, money is held in escrow.
    """
    client_id = account.get("id")
    if not client_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authenticated")
    
    # Get project info to find freelancer_id
    import httpx
    PROJECT_SERVICE_URL = os.getenv("PROJECT_SERVICE_URL", "http://project-service:8000")
    
    try:
        # Try to get project info from project service
        # Note: We don't have token here, so we'll try without auth first
        # In production, you might want to use internal service-to-service auth
        project_resp = httpx.get(
            f"{PROJECT_SERVICE_URL}/api/v1/projects/{request.project_id}",
            timeout=5.0
        )
        if project_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        project_data = project_resp.json()
        freelancer_id = project_data.get("freelancer_id")
        
        if not freelancer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project does not have an assigned freelancer"
            )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cannot reach project service: {e}"
        )
    
    try:
        escrow = create_escrow(
            db,
            request.project_id,
            request.milestone_id,
            client_id,
            freelancer_id,
            request.amount,
            from_wallet=request.from_wallet
        )
        publish_event("escrow.deposited", {
            "escrow_id": escrow.id,
            "project_id": request.project_id,
            "client_id": client_id,
            "freelancer_id": freelancer_id,
            "amount": request.amount
        })
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
    publish_event("escrow.released", {
        "escrow_id": escrow.id,
        "milestone_id": request.milestone_id,
        "project_id": escrow.project_id,
        "commission_amount": escrow.commission_amount,
        "amount": escrow.amount
    })
    return {"message": "Escrow released successfully", "escrow_id": escrow.id}


@router.get("/history", response_model=list[TransactionResponse])
def get_payment_history(limit: int = 50, db: Session = Depends(get_db), account: dict = Depends(resolve_account)):
    user_id = account.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authenticated")
    transactions = get_transactions(db, user_id, limit)
    return transactions


@router.post("/withdraw", response_model=TransactionResponse)
def withdraw(request: WithdrawRequest, db: Session = Depends(get_db), account: dict = Depends(resolve_account)):
    user_id = account.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authenticated")
    try:
        transaction = withdraw_funds(
            db,
            user_id,
            request.amount,
            request.payment_method.value,
            request.account_details
        )
        publish_event("payment.withdraw", {"user_id": user_id, "amount": request.amount})
        return transaction
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/wallet", response_model=WalletResponse)
def get_wallet(db: Session = Depends(get_db), account: dict = Depends(resolve_account)):
    user_id = account.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authenticated")
    wallet = get_or_create_wallet(db, user_id)
    return wallet

