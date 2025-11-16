# Hướng Dẫn Docker Compose - Giải Thích Chi Tiết Cho Người Mới

## 🎯 Docker Compose Là Gì?

**Docker Compose** là công cụ để chạy NHIỀU containers cùng lúc bằng một lệnh duy nhất.

**File `docker-compose.yml`** giống như một "bản thiết kế" mô tả:
- Cần chạy những services nào
- Services nào cần chạy trước (dependencies)
- Cách các services kết nối với nhau

## 📋 Khi Bạn Chạy `docker-compose up --build`

### Bước 1: Docker đọc file `docker-compose.yml`

Docker sẽ đọc file và biết cần chạy:
- 2 databases (postgres-auth, postgres-main)
- Redis, MinIO, RabbitMQ
- 9 microservices
- Nginx

### Bước 2: Docker tự động tạo và chạy TẤT CẢ

**BẠN KHÔNG CẦN BẤM NÚT GÌ CẢ!** Docker tự động:
1. Tạo networks để services giao tiếp
2. Tạo volumes để lưu dữ liệu
3. Build images (nếu cần)
4. Khởi động containers
5. Đợi health checks

### Bước 3: Tất cả services chạy song song

Tất cả services chạy CÙNG LÚC, không cần chạy từng cái.

## 🗄️ Database Có Sẵn Chưa?

### ✅ CÓ - Database được tạo TỰ ĐỘNG!

Khi container PostgreSQL khởi động:
1. PostgreSQL tự động tạo database dựa trên biến môi trường `POSTGRES_DB`
2. Trong `docker-compose.yml` có:
   ```yaml
   postgres-auth:
     environment:
       POSTGRES_DB: auth_db  # ← Database này được tạo TỰ ĐỘNG
   ```
3. **KHÔNG CẦN** tạo database thủ công!

### 📊 Tables/Schemas

- **Tables được tạo TỰ ĐỘNG** bởi services khi khởi động
- Mỗi service có hàm `init_db()` trong `main.py` để tạo tables
- **KHÔNG CẦN** chạy migration thủ công (lần đầu)

## 🚀 Cách Chạy Đúng

### Bước 1: Mở Terminal/PowerShell

```bash
cd c:\xampp\htdocs\test_CK
```

### Bước 2: Chạy MỘT lệnh duy nhất

```bash
docker-compose up --build
```

**Lệnh này sẽ:**
- ✅ Tạo và chạy TẤT CẢ services
- ✅ Tạo databases tự động
- ✅ Tạo tables tự động
- ✅ Kết nối tất cả services với nhau

### Bước 3: Đợi 1-2 phút

Lần đầu chạy sẽ mất thời gian để:
- Download Docker images
- Build application images
- Khởi động databases
- Chờ health checks

**Đợi đến khi thấy:**
```
auth-service    | Application startup complete.
user-service    | Application startup complete.
nginx           | ...ready to handle connections.
```

### Bước 4: Kiểm tra services đang chạy

**Mở terminal MỚI** (giữ terminal cũ đang chạy) và chạy:

```bash
docker-compose ps
```

**Kết quả sẽ hiển thị:**
```
NAME                    STATUS
postgres-auth           Up (healthy)
postgres-main           Up (healthy)
redis                   Up (healthy)
auth-service            Up
user-service            Up
nginx                   Up
...
```

**Nếu thấy "Up" hoặc "Up (healthy)" = OK!**

## 🔍 Kiểm Tra Services Đang Chạy

### Cách 1: Docker Desktop (GUI)

1. Mở **Docker Desktop**
2. Vào tab **Containers**
3. Bạn sẽ thấy TẤT CẢ containers đang chạy
4. Click vào từng container để xem logs

### Cách 2: Terminal

```bash
# Xem tất cả containers
docker-compose ps

# Xem logs của một service
docker-compose logs auth-service

# Xem logs real-time
docker-compose logs -f auth-service
```

## 🐛 Lỗi 502 Bad Gateway - Nguyên Nhân

Lỗi **502 Bad Gateway** xảy ra khi:
- **Nginx không thể kết nối đến backend service** (auth-service)
- Service chưa chạy hoặc chưa sẵn sàng
- Service bị crash/error

## ✅ Cách Sửa Lỗi 502

### Bước 1: Kiểm tra services đang chạy

```bash
docker-compose ps
```

**Phải thấy:**
- `auth-service` = **Up**
- `nginx` = **Up**

Nếu không thấy hoặc status là "Exited" → Service bị lỗi!

### Bước 2: Xem logs để tìm lỗi

```bash
# Xem logs của auth-service
docker-compose logs auth-service

# Xem logs của nginx
docker-compose logs nginx
```

**Tìm các lỗi:**
- `Connection refused` → Service chưa khởi động
- `Port already in use` → Port bị conflict
- `Database connection failed` → Database chưa sẵn sàng
- `Module not found` → Thiếu dependencies

### Bước 3: Restart services

```bash
# Restart tất cả
docker-compose restart

# Hoặc restart từng service
docker-compose restart auth-service
docker-compose restart nginx
```

### Bước 4: Kiểm tra health endpoints

Mở trình duyệt và truy cập:
- http://localhost:8001/health (Auth Service trực tiếp)
- http://localhost:8002/health (User Service trực tiếp)

**Nếu trả về `{"status": "healthy"}` = Service OK!**

### Bước 5: Kiểm tra qua Nginx

- http://localhost/api/v1/auth/login (qua Nginx)

Nếu vẫn 502 → Nginx không kết nối được đến service.

## 🔧 Sửa Lỗi Cụ Thể

### Lỗi: "Connection refused" trong logs

**Nguyên nhân:** Service chưa khởi động xong

**Giải pháp:**
```bash
# Đợi thêm 30 giây
# Sau đó restart
docker-compose restart auth-service
```

### Lỗi: "Database connection failed"

**Nguyên nhân:** Database chưa sẵn sàng khi service khởi động

**Giải pháp:**
```bash
# Kiểm tra database
docker-compose logs postgres-auth

# Nếu database OK, restart service
docker-compose restart auth-service
```

### Lỗi: "Port 80 already in use"

**Nguyên nhân:** XAMPP Apache đang chạy trên port 80

**Giải pháp:**
1. **Tắt XAMPP Apache** (khuyến nghị)
2. Hoặc đổi port Nginx trong `docker-compose.yml`:
   ```yaml
   nginx:
     ports:
       - "8080:80"  # Thay vì "80:80"
   ```
   Sau đó truy cập http://localhost:8080

## 📝 Checklist Kiểm Tra

Sau khi chạy `docker-compose up --build`:

- [ ] Đợi 1-2 phút để tất cả services khởi động
- [ ] Chạy `docker-compose ps` - tất cả phải là "Up"
- [ ] Kiểm tra logs - không có lỗi nghiêm trọng
- [ ] Test health endpoints - trả về "healthy"
- [ ] Test API qua Nginx - không bị 502

## 🎯 Tóm Tắt

1. **Chạy MỘT lệnh:** `docker-compose up --build`
2. **Đợi 1-2 phút** để services khởi động
3. **Kiểm tra:** `docker-compose ps` - tất cả phải "Up"
4. **Database tự động** được tạo, không cần làm gì
5. **Nếu lỗi 502:** Xem logs và restart services

## 💡 Tips

- **Luôn kiểm tra logs** khi có lỗi: `docker-compose logs <service-name>`
- **Đợi đủ thời gian** - lần đầu chạy mất 5-10 phút
- **Docker Desktop** rất hữu ích để xem trực quan
- **Nếu vẫn lỗi:** Gửi output của `docker-compose ps` và `docker-compose logs auth-service`

