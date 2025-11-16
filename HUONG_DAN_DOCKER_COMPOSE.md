# Hướng Dẫn Docker Compose - Giải Thích Chi Tiết

## ❓ Câu Hỏi: "Tôi chỉ chạy docker-compose up --build thì muốn sử dụng được web thì phải chạy từng service trong file yml đúng không?"

## ✅ Trả Lời: KHÔNG CẦN!

**`docker-compose up --build` sẽ tự động chạy TẤT CẢ services** được định nghĩa trong file `docker-compose.yml`. Bạn KHÔNG cần chạy từng service riêng lẻ.

## 📋 Docker Compose Làm Gì?

Khi bạn chạy `docker-compose up --build`, nó sẽ:

1. **Đọc file `docker-compose.yml`**
2. **Build images** cho các services có `build:` directive
3. **Tạo và khởi động containers** cho TẤT CẢ services:
   - Databases (postgres-auth, postgres-main)
   - Redis
   - MinIO
   - RabbitMQ
   - 9 Microservices (auth-service, user-service, project-service, ...)
   - Nginx
4. **Tạo networks** để các services có thể giao tiếp với nhau
5. **Tạo volumes** để lưu dữ liệu
6. **Đợi health checks** - các services sẽ đợi dependencies sẵn sàng

## 🔍 Kiểm Tra Services Đã Chạy

Sau khi chạy `docker-compose up --build`, kiểm tra:

```bash
# Xem tất cả containers đang chạy
docker-compose ps

# Kết quả sẽ hiển thị:
# NAME                STATUS
# postgres-auth       Up (healthy)
# postgres-main       Up (healthy)
# redis               Up (healthy)
# minio               Up (healthy)
# rabbitmq            Up (healthy)
# auth-service        Up
# user-service        Up
# project-service     Up
# search-service      Up
# payments-service    Up
# messaging-service   Up
# notifications-service Up
# admin-service       Up
# analytics-service   Up
# nginx               Up
```

## ⚠️ Lưu Ý Quan Trọng

### 1. Database Tự Động Được Tạo

**CÓ**, databases đã được định nghĩa trong `docker-compose.yml`:

```yaml
postgres-auth:
  image: postgres:15-alpine
  environment:
    POSTGRES_DB: auth_db        # ← Database này được tạo tự động
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres

postgres-main:
  image: postgres:15-alpine
  environment:
    POSTGRES_DB: marketplace_db  # ← Database này được tạo tự động
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
```

**PostgreSQL tự động tạo database** khi container khởi động lần đầu dựa trên biến môi trường `POSTGRES_DB`.

### 2. Tables/Schemas Cần Được Tạo

Tuy nhiên, **tables/schemas cần được tạo bởi ứng dụng**. Các services sẽ tự động tạo tables khi khởi động (trong `main.py` có `init_db()`).

### 3. Seed Data (Tùy Chọn)

Nếu muốn có dữ liệu mẫu (users, profiles, ...), bạn cần chạy seed script:

```bash
# Cách 1: Chạy trong container
docker-compose exec auth-service python scripts/seed_data.py

# Cách 2: Chạy trên máy local (cần Python và dependencies)
python scripts/seed_data.py
```

## 🚀 Quy Trình Chạy Đầy Đủ

### Bước 1: Khởi động tất cả services

```bash
docker-compose up --build
```

**Lần đầu chạy sẽ mất 5-10 phút** để:
- Download Docker images
- Build application images
- Khởi động databases
- Chờ health checks

### Bước 2: Đợi tất cả services sẵn sàng

Đợi đến khi thấy log:
```
auth-service    | Application startup complete.
nginx           | ...ready to handle connections.
```

Hoặc kiểm tra:
```bash
docker-compose ps
# Tất cả phải là "Up" hoặc "Up (healthy)"
```

### Bước 3: Seed dữ liệu (tùy chọn)

```bash
# Mở terminal mới
python scripts/seed_data.py
```

### Bước 4: Truy cập web

- Frontend: http://localhost
- API Docs: http://localhost:8001/docs

## 🔧 Các Lệnh Docker Compose Hữu Ích

### Chạy tất cả services
```bash
docker-compose up --build
```

### Chạy ở background (detached mode)
```bash
docker-compose up -d --build
```

### Chỉ chạy một số services cụ thể
```bash
# Chỉ chạy databases và Redis
docker-compose up postgres-auth postgres-main redis

# Chỉ chạy một service
docker-compose up auth-service
```

### Dừng tất cả
```bash
docker-compose stop
# hoặc
docker-compose down
```

### Xem logs
```bash
# Tất cả services
docker-compose logs -f

# Một service cụ thể
docker-compose logs -f auth-service
```

### Restart một service
```bash
docker-compose restart auth-service
```

## ❌ Khi Nào Cần Chạy Từng Service?

**Chỉ khi bạn muốn:**

1. **Development/Debug**: Chạy một service trên máy local (không dùng Docker) để debug dễ hơn
2. **Test riêng**: Test một service độc lập
3. **Tiết kiệm tài nguyên**: Chỉ cần một số services, không cần tất cả

**Ví dụ chạy từng service (không dùng Docker):**

```bash
# Terminal 1 - Chỉ chạy infrastructure
docker-compose up postgres-auth postgres-main redis

# Terminal 2 - Chạy auth-service trên máy local
cd services/auth_service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

## 📊 Kiến Trúc Docker Compose

```
docker-compose up --build
    │
    ├── Infrastructure Services (tự động chạy)
    │   ├── postgres-auth (Database cho auth)
    │   ├── postgres-main (Database cho các services khác)
    │   ├── redis (Cache)
    │   ├── minio (File storage)
    │   └── rabbitmq (Message queue)
    │
    ├── Microservices (tự động chạy)
    │   ├── auth-service (Port 8001)
    │   ├── user-service (Port 8002)
    │   ├── project-service (Port 8003)
    │   ├── search-service (Port 8004)
    │   ├── payments-service (Port 8005)
    │   ├── messaging-service (Port 8006)
    │   ├── notifications-service (Port 8007)
    │   ├── admin-service (Port 8008)
    │   └── analytics-service (Port 8009)
    │
    └── Nginx (tự động chạy)
        └── Reverse proxy (Port 80)
```

**TẤT CẢ đều chạy tự động với một lệnh `docker-compose up --build`!**

## ✅ Tóm Tắt

1. **KHÔNG cần chạy từng service** - `docker-compose up --build` làm tất cả
2. **Databases được tạo tự động** - PostgreSQL tự tạo database từ environment variables
3. **Tables được tạo tự động** - Services tạo tables khi khởi động
4. **Seed data là tùy chọn** - Chỉ cần nếu muốn có dữ liệu mẫu
5. **Đợi 1-2 phút** sau khi chạy để tất cả services khởi động xong

## 🐛 Nếu Vẫn Có Vấn Đề

```bash
# 1. Kiểm tra services
docker-compose ps

# 2. Xem logs
docker-compose logs -f

# 3. Restart
docker-compose restart

# 4. Rebuild từ đầu
docker-compose down -v
docker-compose up --build
```

