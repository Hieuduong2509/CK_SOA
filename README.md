# CodeDesign Marketplace — Hướng dẫn Import, Setup và Chạy hệ thống

Nền tảng marketplace dạng microservices cho dịch vụ Code & Design.

## 1) Yêu cầu hệ thống

- Windows 10/11, PowerShell
- Docker Desktop (kèm Docker Compose)
- Git (để clone dự án)
- Ngrok (đã có sẵn `ngrok.exe` trong thư mục gốc, nếu chưa có vui lòng tải về)

Tùy chọn (chỉ khi cần):
- Python 3.11+ (nếu muốn chạy server/service đơn lẻ hoặc seed thủ công)
- Node.js (nếu muốn serve thư mục `frontend/public` mà không dùng Docker/Nginx)

## 2) Import dự án vào máy

Bạn có thể chọn 1 trong 2 cách:

- Cách 1 (khuyến nghị): Clone repo
  ```powershell
  git clone <repository-url>
  cd <thư_mục_dự_án>
  ```

- Cách 2: Giải nén folder dự án vào một thư mục trên máy (ví dụ `D:\...`) và mở bằng VS Code/IDE.

## 3) Cấu trúc thư mục chính

```
.
├── docker-compose.local.yml     # Compose cho môi trường local
├── docker-compose.yml           # Compose đầy đủ (tham khảo)
├── nginx/
│   └── nginx.conf               # Reverse proxy + serve frontend/public
├── services/                    # Các microservice FastAPI
│   ├── auth_service/            # Port 8001
│   ├── user_service/            # Port 8002
│   ├── project_service/         # Port 8003
│   ├── search_service/          # Port 8004
│   ├── payments_service/        # Port 8005
│   ├── messaging_service/       # Port 8006
│   ├── notifications_service/   # Port 8007
│   ├── admin_service/           # Port 8008
│   └── analytics_service/       # Port 8009
├── frontend/
│   └── public/                  # Website tĩnh (HTML/CSS/JS)
│       ├── index.html
│       ├── css/
│       └── js/
└── scripts/                     # Script PowerShell & seed
    ├── start-all.ps1
    ├── stop-all.ps1
    ├── check-status.ps1
    ├── start-ngrok.ps1
    ├── setup-ngrok.ps1
    └── seed_data.ps1
```

## 4) Thiết lập lần đầu (một lần duy nhất)

- Cài Docker Desktop và bật lên trước khi chạy hệ thống.
- Tải `ngrok.exe` về và đặt ở thư mục gốc dự án nếu chưa có.
  - Có thể chạy: `.\scripts\setup-ngrok.ps1` để khởi chạy ngrok nhanh (tùy chọn).

Mặc định các biến môi trường đã có giá trị phù hợp trong `docker-compose.local.yml`, bạn có thể tùy chỉnh sau nếu cần.

## 5) Chạy toàn bộ hệ thống (Nhanh – khuyến nghị)

Mỗi lần mở máy, chỉ cần một lệnh:

```powershell
.\scripts\start-all.ps1
```

Script sẽ:
- Khởi động toàn bộ Docker containers (DB, Redis, RabbitMQ, MinIO, các service, Nginx)
- Mở Ngrok public port 80 (để có URL công khai)

Xem trạng thái:
```powershell
.\scripts\check-status.ps1
```

Dừng hệ thống:
```powershell
.\scripts\stop-all.ps1
```

Chi tiết thêm xem: `START_SERVER.md`, `QUICK_START.md`.

## 6) Chạy thủ công (Manual)

1) Start Docker containers (local profile):
```powershell
docker-compose -f docker-compose.local.yml up -d
```

2) Public qua Ngrok (chọn 1 trong 2):
```powershell
.\scripts\start-ngrok.ps1
```
hoặc
```powershell
.\ngrok.exe http 80
```

3) Kiểm tra:
```powershell
docker-compose -f docker-compose.local.yml ps
```

## 7) Truy cập hệ thống

- Frontend (serve bởi Nginx): `http://localhost`
- Ngrok public URL: hiển thị trong cửa sổ Ngrok (ví dụ `https://xxxx.ngrok.io`)
- API Docs:
  - Auth: `http://localhost:8001/docs`
  - Users: `http://localhost:8002/docs`
  - Projects: `http://localhost:8003/docs`
  - Search: `http://localhost:8004/docs`
  - Payments: `http://localhost:8005/docs`
  - Messaging: `http://localhost:8006/docs`
  - Notifications: `http://localhost:8007/docs`
  - Admin: `http://localhost:8008/docs`
  - Analytics: `http://localhost:8009/docs`

## 8) Seed dữ liệu mẫu (tùy chọn nhưng nên làm)

Sau khi containers đã chạy, bạn có thể seed dữ liệu mẫu:
```powershell
.\scripts\seed_data.ps1
```

Tài khoản mẫu sau khi seed:
- Admin: `admin@codedesign.com` / `admin123`
- Freelancer: `freelancer1@codedesign.com` / `freelancer123`
- Client: `client1@codedesign.com` / `client123`

## 9) Cách “chạy public” (serve thư mục frontend/public)

Bạn có 2 lựa chọn:

- Cách 1 (khuyến nghị): Dùng Nginx trong Docker (tự động khi chạy hệ thống)
  - Mặc định `frontend/public` được mount vào Nginx và serve tại `http://localhost`.

- Cách 2: Serve thủ công chỉ riêng static frontend (không cần backend)
  - Dùng Node.js (nếu có):
    ```powershell
    cd frontend/public
    npx serve -l 8080 .
    ```
    Mở: `http://localhost:8080`
  - Hoặc dùng Python:
    ```powershell
    cd frontend/public
    python -m http.server 8080
    ```
    Mở: `http://localhost:8080`

Lưu ý: Khi serve thủ công, các API sẽ không chạy nếu bạn chưa start hệ thống bằng Docker. Với frontend này, hầu hết trang sẽ cần API qua Nginx ở `http://localhost`.

## 10) Cổng dịch vụ (tham khảo nhanh)

| Service | Port |
|---------|------|
| Nginx (Frontend) | 80 |
| Auth | 8001 |
| Users | 8002 |
| Projects | 8003 |
| Search | 8004 |
| Payments | 8005 |
| Messaging | 8006 |
| Notifications | 8007 |
| Admin | 8008 |
| Analytics | 8009 |

## 11) Troubleshooting

- Docker chưa chạy → Mở Docker Desktop trước, đợi chạy ổn định rồi chạy script.
- Port 80 bị chiếm → Tắt service khác dùng port 80, hoặc đổi port trong `docker-compose.local.yml` + `nginx/nginx.conf`.
- Ngrok không có → Tải `ngrok.exe` về đặt ở thư mục gốc dự án, hoặc cài qua Chocolatey.
- Xem logs:
  ```powershell
  docker-compose -f docker-compose.local.yml logs -f
  ```

---

Nếu bạn chỉ cần “mỗi lần mở máy chạy nhanh”, dùng:
```powershell
.\scripts\start-all.ps1
```
Lúc cần dừng, chạy:
```powershell
.\scripts\stop-all.ps1
```

Trong psql:
Liệt kê bảng: \dt
Xem cấu trúc: \d profiles
Bật xem chi tiết: \x on
Xem dữ liệu (mỗi bảng):
SELECT * FROM users LIMIT 50;
SELECT * FROM profiles LIMIT 50;
SELECT * FROM packages LIMIT 50;
SELECT * FROM projects ORDER BY id DESC LIMIT 50;
SELECT * FROM bids LIMIT 50;
SELECT * FROM milestones LIMIT 50;
SELECT * FROM escrows LIMIT 50;
SELECT * FROM reviews LIMIT 50;
