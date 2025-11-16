# Hướng Dẫn Kiểm Tra Service Không Chạy

## 🔍 Kiểm Tra Service Có Chạy Không

### Bước 1: Kiểm tra containers đang chạy

```bash
docker-compose ps
```

**Kết quả phải thấy:**
```
NAME                    STATUS              PORTS
auth-service            Up                  0.0.0.0:8001->8000/tcp
```

**Nếu không thấy hoặc status là "Exited" → Service không chạy!**

### Bước 2: Xem logs để tìm lỗi

```bash
docker-compose logs auth-service
```

**Tìm các lỗi:**
- `Error starting user` → Lỗi khởi động
- `Port already in use` → Port bị conflict
- `Database connection failed` → Lỗi database
- `Module not found` → Thiếu dependencies

### Bước 3: Kiểm tra port có bị chiếm không

**Trên Windows PowerShell:**
```powershell
netstat -ano | findstr :8001
```

**Nếu có kết quả và không phải Docker → Port bị conflict!**

### Bước 4: Kiểm tra trong Docker Desktop

1. Mở **Docker Desktop**
2. Vào tab **Containers**
3. Tìm container `auth-service`
4. Xem status và logs

## 🔧 Các Lỗi Thường Gặp

### Lỗi 1: Service không chạy (Exited)

**Nguyên nhân:** Service bị crash hoặc lỗi

**Giải pháp:**
```bash
# Xem logs để biết lỗi
docker-compose logs auth-service

# Restart service
docker-compose restart auth-service

# Hoặc rebuild
docker-compose build auth-service
docker-compose up -d auth-service
```

### Lỗi 2: Port 8001 không accessible

**Nguyên nhân:** 
- Port không được expose
- Firewall block
- Service chưa bind đúng port

**Giải pháp:**
```bash
# Kiểm tra port mapping
docker-compose ps

# Test từ trong container
docker-compose exec auth-service curl http://localhost:8000/health

# Nếu OK trong container nhưng không OK từ ngoài → Port mapping issue
```

### Lỗi 3: Service chưa khởi động xong

**Nguyên nhân:** Service đang khởi động, chưa sẵn sàng

**Giải pháp:**
```bash
# Đợi thêm 30 giây
# Kiểm tra lại
docker-compose ps

# Xem logs real-time
docker-compose logs -f auth-service
```

### Lỗi 4: Database chưa sẵn sàng

**Nguyên nhân:** Service khởi động trước khi database ready

**Giải pháp:**
```bash
# Kiểm tra database
docker-compose ps postgres-auth

# Đợi database healthy
# Restart auth-service
docker-compose restart auth-service
```

## 🚀 Cách Sửa Nhanh

### Nếu service không chạy:

```bash
# 1. Dừng tất cả
docker-compose down

# 2. Xóa volumes (nếu cần)
docker-compose down -v

# 3. Chạy lại
docker-compose up --build

# 4. Đợi 2-3 phút

# 5. Kiểm tra (terminal mới)
docker-compose ps
```

### Nếu vẫn không chạy:

```bash
# 1. Xem logs chi tiết
docker-compose logs auth-service

# 2. Chạy service riêng để debug
docker-compose up auth-service

# 3. Xem output trực tiếp
```

## 📋 Checklist

- [ ] `docker-compose ps` - auth-service phải "Up"
- [ ] Port 8001 không bị conflict
- [ ] Logs không có lỗi nghiêm trọng
- [ ] Database đã healthy
- [ ] Service đã khởi động xong (đợi đủ thời gian)

## 💡 Test Từ Trong Container

```bash
# Vào container
docker-compose exec auth-service sh

# Test health endpoint
curl http://localhost:8000/health

# Nếu OK → Service chạy, vấn đề ở port mapping
# Nếu không OK → Service có lỗi
```

