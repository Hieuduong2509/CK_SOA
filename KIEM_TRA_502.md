# Hướng Dẫn Sửa Lỗi 502 Bad Gateway

## 🔍 Nguyên Nhân Lỗi 502

Lỗi **502 Bad Gateway** xảy ra khi Nginx không thể kết nối đến backend service (auth-service).

## ✅ Các Bước Kiểm Tra và Sửa

### Bước 1: Kiểm tra services đang chạy

```bash
docker-compose ps
```

**Phải thấy:**
```
NAME                    STATUS
auth-service            Up
nginx                   Up
```

**Nếu thấy "Exited" hoặc không có → Service bị lỗi!**

### Bước 2: Xem logs của auth-service

```bash
docker-compose logs auth-service
```

**Tìm các lỗi:**
- `Connection refused` → Database chưa sẵn sàng
- `Port already in use` → Port bị conflict
- `Module not found` → Thiếu dependencies
- `Database connection failed` → Lỗi kết nối database

### Bước 3: Kiểm tra auth-service có hoạt động không

Mở trình duyệt:
- http://localhost:8001/health

**Nếu trả về `{"status": "healthy"}` = Service OK!**

**Nếu không truy cập được → Service chưa chạy hoặc bị lỗi**

### Bước 4: Kiểm tra logs của nginx

```bash
docker-compose logs nginx
```

**Tìm các lỗi:**
- `upstream timed out` → Service chưa sẵn sàng
- `Connection refused` → Service không chạy
- `no resolver defined` → DNS issue

### Bước 5: Restart services

```bash
# Restart auth-service
docker-compose restart auth-service

# Đợi 10 giây
# Restart nginx
docker-compose restart nginx
```

### Bước 6: Kiểm tra lại

- http://localhost:8001/health (trực tiếp)
- http://localhost/api/v1/auth/login (qua Nginx)

## 🔧 Sửa Lỗi Cụ Thể

### Lỗi 1: "Connection refused" trong nginx logs

**Nguyên nhân:** auth-service chưa khởi động xong

**Giải pháp:**
```bash
# Đợi database sẵn sàng
docker-compose logs postgres-auth

# Restart auth-service
docker-compose restart auth-service

# Đợi 30 giây
# Restart nginx
docker-compose restart nginx
```

### Lỗi 2: "upstream timed out"

**Nguyên nhân:** Service mất quá nhiều thời gian để phản hồi

**Giải pháp:** Đã thêm timeout trong nginx.conf (60s)

### Lỗi 3: Service bị crash liên tục

**Nguyên nhân:** Lỗi trong code hoặc thiếu dependencies

**Giải pháp:**
```bash
# Xem logs chi tiết
docker-compose logs -f auth-service

# Rebuild service
docker-compose build auth-service
docker-compose up -d auth-service
```

### Lỗi 4: Database connection failed

**Nguyên nhân:** Database chưa sẵn sàng

**Giải pháp:**
```bash
# Kiểm tra database
docker-compose logs postgres-auth

# Đợi database healthy
docker-compose ps postgres-auth

# Restart auth-service sau khi database ready
docker-compose restart auth-service
```

## 📋 Checklist

- [ ] `docker-compose ps` - tất cả services phải "Up"
- [ ] http://localhost:8001/health - trả về "healthy"
- [ ] Logs không có lỗi nghiêm trọng
- [ ] Nginx có thể kết nối đến auth-service
- [ ] Port 80 không bị conflict (XAMPP Apache)

## 🚀 Quy Trình Chạy Đúng

```bash
# 1. Dừng tất cả (nếu đang chạy)
docker-compose down

# 2. Chạy lại từ đầu
docker-compose up --build

# 3. Đợi 2-3 phút (lần đầu)

# 4. Kiểm tra (terminal mới)
docker-compose ps

# 5. Test
curl http://localhost:8001/health
curl http://localhost/api/v1/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"test","password":"test"}'
```

## 💡 Tips

- **Luôn kiểm tra logs** khi có lỗi
- **Đợi đủ thời gian** - services cần thời gian khởi động
- **Kiểm tra health endpoints** trước khi test qua Nginx
- **Docker Desktop** giúp xem trực quan containers đang chạy

