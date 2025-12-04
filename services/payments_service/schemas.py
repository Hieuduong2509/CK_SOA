from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from models import TransactionType, TransactionStatus, PaymentMethod


class TopupRequest(BaseModel):
    amount: float
    payment_method: PaymentMethod


class TopupResponse(BaseModel):
    transaction_id: int
    payment_url: Optional[str] = None
    status: TransactionStatus


class EscrowDepositRequest(BaseModel):
    project_id: int
    milestone_id: Optional[int] = None
    amount: float
    from_wallet: bool = False  # True if deducting from wallet, False for direct payment


class EscrowDepositResponse(BaseModel):
    escrow_id: int
    status: str


class EscrowReleaseRequest(BaseModel):
    milestone_id: int


class TransactionResponse(BaseModel):
    id: int
    user_id: int
    transaction_type: TransactionType
    amount: float
    status: TransactionStatus
    payment_method: Optional[PaymentMethod]
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class WithdrawRequest(BaseModel):
    amount: float
    payment_method: PaymentMethod
    account_details: dict  # Bank account, PayPal email, etc.


class WalletResponse(BaseModel):
    user_id: int
    balance: float

    class Config:
        from_attributes = True

