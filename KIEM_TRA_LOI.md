# Hướng Dẫn Kiểm Tra và Sửa Lỗi

## ✅ Đã Sửa: Lỗi JavaScript API_BASE

**Vấn đề**: Biến `const API_BASE` được khai báo nhiều lần trong các file JS khác nhau, gây lỗi "Identifier 'API_BASE' has already been declared".

**Giải pháp**: 
- Tạo file `config.js` để khai báo `API_BASE` một lần duy nhất
- Tất cả các file JS khác sử dụng `window.API_BASE`
- Thêm `<script src="js/config.js"></script>` vào tất cả các trang HTML (phải load trước các file JS khác)

## 🔍 Kiểm Tra Lỗi ERR_EMPTY_RESPONSE

Lỗi này thường do services chưa khởi động xong hoặc có vấn đề. Hãy kiểm tra theo các bước sau:

### Bước 1: Kiểm tra Docker Services đang chạy

```bash
docker-compose ps
```

Tất cả services phải có status là "Up" hoặc "Up (healthy)".

### Bước 2: Kiểm tra Logs

```bash
# Xem logs của tất cả services
docker-compose logs

# Xem logs của một service cụ thể
docker-compose logs auth-service
docker-compose logs nginx
```

**Tìm các lỗi phổ biến:**
- `Connection refused` → Service chưa khởi động
- `Port already in use` → Port bị conflict
- `Database connection failed` → Database chưa sẵn sàng
- `Module not found` → Thiếu dependencies

### Bước 3: Kiểm tra Health Endpoints

Mở trình duyệt và truy cập:
- http://localhost:8001/health (Auth Service)
- http://localhost:8002/health (User Service)
- http://localhost:8003/health (Project Service)
- ... (các services khác)

Nếu trả về `{"status": "healthy"}` thì service đang chạy tốt.

### Bước 4: Kiểm tra Nginx

```bash
# Xem logs của Nginx
docker-compose logs nginx

# Kiểm tra cấu hình Nginx
docker-compose exec nginx nginx -t
```

### Bước 5: Kiểm tra Ports

Đảm bảo các ports sau không bị chiếm:
- Port 80 (Nginx)
- Ports 8001-8009 (Services)
- Port 5432, 5433 (PostgreSQL)
- Port 6379 (Redis)
- Port 5672 (RabbitMQ)
- Port 9000, 9001 (MinIO)

**Trên Windows:**
```powershell
netstat -ano | findstr :80
netstat -ano | findstr :8001
```

### Bước 6: Restart Services

Nếu có lỗi, thử restart:

```bash
# Restart tất cả
docker-compose restart

# Hoặc restart từng service
docker-compose restart auth-service
docker-compose restart nginx
```

### Bước 7: Rebuild nếu cần

```bash
# Dừng và xóa containers
docker-compose down

# Rebuild và start lại
docker-compose up --build
```

## 🔧 Các Lỗi Thường Gặp và Cách Sửa

### Lỗi 1: "Port already in use"

**Nguyên nhân**: Port đã được sử dụng bởi ứng dụng khác (có thể là XAMPP Apache đang chạy trên port 80).

**Giải pháp**:
1. Tắt XAMPP Apache hoặc đổi port trong XAMPP
2. Hoặc đổi port Nginx trong `docker-compose.yml`:
   ```yaml
   nginx:
     ports:
       - "8080:80"  # Thay vì "80:80"
   ```
   Sau đó truy cập http://localhost:8080

### Lỗi 2: "Database connection failed"

**Nguyên nhân**: PostgreSQL chưa khởi động xong hoặc connection string sai.

**Giải pháp**:
```bash
# Đợi database khởi động (30-60 giây)
docker-compose logs postgres-main

# Kiểm tra database đã sẵn sàng
docker-compose exec postgres-main pg_isready -U postgres
```

### Lỗi 3: "Module not found" trong Python services

**Nguyên nhân**: Thiếu dependencies trong requirements.txt hoặc build chưa đúng.

**Giải pháp**:
```bash
# Rebuild service cụ thể
docker-compose build auth-service
docker-compose up auth-service
```

### Lỗi 4: Nginx không proxy được

**Nguyên nhân**: Services chưa sẵn sàng khi Nginx khởi động.

**Giải pháp**: Nginx đã có `depends_on` trong docker-compose, nhưng nếu vẫn lỗi:
```bash
# Restart Nginx sau khi services đã chạy
docker-compose restart nginx
```

### Lỗi 5: Frontend không load được

**Nguyên nhân**: 
- Nginx chưa mount đúng volume
- File frontend không tồn tại

**Giải pháp**:
```bash
# Kiểm tra volume mount
docker-compose exec nginx ls -la /usr/share/nginx/html

# Kiểm tra file có tồn tại không
ls -la frontend/public/index.html
```

## 📋 Checklist Kiểm Tra

- [ ] Docker và Docker Compose đã cài đặt
- [ ] Tất cả services đang chạy (`docker-compose ps`)
- [ ] Không có lỗi trong logs (`docker-compose logs`)
- [ ] Health endpoints trả về "healthy"
- [ ] Ports không bị conflict
- [ ] Nginx đang chạy và có thể truy cập
- [ ] Frontend files tồn tại trong `frontend/public/`
- [ ] Database đã khởi động (đợi 30-60 giây sau khi start)

## 🚀 Sau Khi Sửa Xong

1. **Clear browser cache**: Ctrl+Shift+Delete hoặc Ctrl+F5
2. **Truy cập lại**: http://localhost
3. **Kiểm tra Console**: F12 → Console tab để xem lỗi JavaScript
4. **Kiểm tra Network**: F12 → Network tab để xem API calls

## 💡 Tips

- Luôn kiểm tra logs trước: `docker-compose logs -f`
- Nếu services crash, xem logs để biết lý do
- Đợi 1-2 phút sau khi `docker-compose up` để tất cả services khởi động
- Sử dụng `docker-compose ps` để xem status real-time

