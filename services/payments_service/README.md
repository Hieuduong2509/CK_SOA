# Payments Service

Payments, escrow, and wallet microservice.

## Port
8005 (mapped from container port 8000)

## Endpoints

### POST /api/v1/payments/topup
Add funds to wallet (mock payment gateway)

### POST /api/v1/payments/escrow/deposit
Deposit funds to escrow

### POST /api/v1/payments/escrow/release
Release escrow to freelancer (with commission)

### GET /api/v1/payments/history
Get transaction history

### POST /api/v1/payments/withdraw
Withdraw funds (mock)

### GET /api/v1/payments/wallet
Get wallet balance

## Note
Payment gateways (Stripe, MoMo, VNPAY) are mocked. Replace with real integrations in production.

