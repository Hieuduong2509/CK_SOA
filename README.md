# CodeDesign Marketplace

A modern microservices-based marketplace platform for Code & Design services, similar to Fiverr but specialized for developers and designers.

## 🚀 Quick Start

### Mỗi lần mở máy, chạy:
```powershell
.\scripts\start-all.ps1
```

Xem chi tiết: [START_SERVER.md](START_SERVER.md) hoặc [QUICK_START.md](QUICK_START.md)

## Architecture

This project uses a **microservices architecture** with the following services:

- **auth-service** (Port 8001): Authentication and authorization
- **user-service** (Port 8002): User profiles, portfolios, and packages
- **project-service** (Port 8003): Projects, bids, and milestones
- **search-service** (Port 8004): Search and autocomplete
- **payments-service** (Port 8005): Payments, escrow, and wallet
- **messaging-service** (Port 8006): Real-time chat with WebSocket
- **notifications-service** (Port 8007): Notifications with background worker
- **admin-service** (Port 8008): Admin panel and dispute resolution
- **analytics-service** (Port 8009): Analytics and metrics

## Tech Stack

- **Backend**: FastAPI (Python 3.11+)
- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Database**: PostgreSQL
- **Cache/Queue**: Redis, RabbitMQ
- **Storage**: MinIO (S3-compatible)
- **Reverse Proxy**: Nginx
- **Containerization**: Docker & Docker Compose

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Running the Application

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd test_CK
   ```

2. **Start all services**:
   ```bash
   docker-compose up --build
   ```

   This will start all microservices, databases, Redis, RabbitMQ, MinIO, and Nginx.

3. **Seed the database** (in a new terminal):
   ```bash
   docker-compose exec auth-service python -m pip install passlib[bcrypt]
   # Run seed script (adjust paths as needed)
   python scripts/seed_data.py
   ```

4. **Access the application**:
   - Frontend: http://localhost
   - API Docs: 
     - Auth Service: http://localhost:8001/docs
     - User Service: http://localhost:8002/docs
     - Project Service: http://localhost:8003/docs
     - (and so on for other services)

## Default Credentials

After seeding:

- **Admin**: 
  - Email: `admin@codedesign.com`
  - Password: `admin123`

- **Freelancer**: 
  - Email: `freelancer1@codedesign.com`
  - Password: `freelancer123`

- **Client**: 
  - Email: `client1@codedesign.com`
  - Password: `client123`

## Service Ports

| Service | Port |
|---------|------|
| Auth Service | 8001 |
| User Service | 8002 |
| Project Service | 8003 |
| Search Service | 8004 |
| Payments Service | 8005 |
| Messaging Service | 8006 |
| Notifications Service | 8007 |
| Admin Service | 8008 |
| Analytics Service | 8009 |
| Nginx (Frontend) | 80 |

## Features

### Implemented

- ✅ User authentication (JWT, signup, login, refresh)
- ✅ User profiles with portfolios and service packages
- ✅ Project posting and bidding system
- ✅ Milestone-based escrow payments
- ✅ Real-time chat (WebSocket)
- ✅ Notifications system
- ✅ Search and filtering
- ✅ Admin panel with dispute resolution
- ✅ Analytics dashboard
- ✅ Modern, responsive UI

### Mocked/Stubbed

- Payment gateways (Stripe, MoMo, VNPAY) - mocked for development
- Email sending - prints to console
- 2FA - implemented but requires QR code display
- File uploads - uses MinIO (configured)

## Development

### Running Individual Services

Each service can be run independently:

```bash
cd services/auth_service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### Running Tests

```bash
cd services/auth_service
pytest tests/
```

### Environment Variables

Each service has a `.env.example` file. Copy and customize:

```bash
cp services/auth_service/.env.example services/auth_service/.env
```

## Project Structure

```
.
├── docker-compose.yml          # Orchestration
├── nginx/                      # Reverse proxy config
├── services/                   # Microservices
│   ├── auth_service/
│   ├── user_service/
│   ├── project_service/
│   ├── search_service/
│   ├── payments_service/
│   ├── messaging_service/
│   ├── notifications_service/
│   ├── admin_service/
│   └── analytics_service/
├── frontend/                   # Static frontend
│   └── public/
│       ├── index.html
│       ├── css/
│       └── js/
├── scripts/                    # Utility scripts
│   └── seed_data.py
└── README.md
```

## API Documentation

Each service exposes OpenAPI documentation at `/docs`:

- http://localhost:8001/docs (Auth)
- http://localhost:8002/docs (Users)
- http://localhost:8003/docs (Projects)
- etc.

## Production Considerations

1. **Security**:
   - Change all default passwords and secrets
   - Use environment variables for sensitive data
   - Enable HTTPS/TLS
   - Implement rate limiting
   - Sanitize file uploads

2. **Payment Gateways**:
   - Replace mocked payment integrations with real APIs
   - Store API keys securely (use secrets management)

3. **Email**:
   - Integrate real email service (SendGrid, AWS SES, etc.)

4. **Monitoring**:
   - Add logging and monitoring (ELK, Prometheus, etc.)
   - Set up health checks and alerts

5. **Scaling**:
   - Use load balancers
   - Scale services independently
   - Use managed databases and Redis

## License

This project is for educational/demonstration purposes.

## Support

For issues and questions, please open an issue in the repository.

