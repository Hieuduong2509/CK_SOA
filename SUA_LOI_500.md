# Hướng Dẫn Sửa Lỗi 500 Internal Server Error

## 🔍 Nguyên Nhân Lỗi 500

Lỗi 500 xảy ra khi gọi API `/api/v1/users?limit=6` có thể do:

1. **Database chưa có tables** - Tables chưa được tạo
2. **Lỗi trong query** - Filter skills với JSON không đúng
3. **Subquery rỗng** - Khi filter by price nhưng không có packages
4. **Serialization error** - Lỗi khi convert model sang response

## ✅ Đã Sửa

### 1. Sửa hàm `search_freelancers` trong `crud.py`
- Thêm try-catch để bắt lỗi
- Sửa cách filter skills với JSON (dùng cast to String)
- Xử lý trường hợp subquery rỗng
- Return empty list thay vì crash

### 2. Sửa endpoint `list_freelancers` trong `routes.py`
- Thêm error handling
- Log lỗi để debug
- Trả về HTTP 500 với message rõ ràng nếu có lỗi

### 3. Sửa `ProfileResponse` trong `schemas.py`
- Thêm default values để tránh lỗi khi field None

## 🔧 Cách Kiểm Tra và Sửa

### Bước 1: Kiểm tra logs

```bash
# Xem logs của user-service
docker-compose logs user-service

# Hoặc xem logs real-time
docker-compose logs -f user-service
```

Tìm các lỗi như:
- `relation "profiles" does not exist` → Tables chưa được tạo
- `could not convert string to float` → Lỗi type conversion
- `column does not exist` → Schema không đúng

### Bước 2: Kiểm tra database

```bash
# Vào PostgreSQL container
docker-compose exec postgres-main psql -U postgres -d marketplace_db

# Kiểm tra tables
\dt

# Nếu không có tables, cần restart service để init_db chạy
docker-compose restart user-service
```

### Bước 3: Kiểm tra tables đã được tạo

```sql
-- Trong psql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

Phải có các tables:
- profiles
- portfolio_items
- packages
- reviews

### Bước 4: Nếu tables chưa có

```bash
# Restart user-service để init_db chạy lại
docker-compose restart user-service

# Hoặc vào container và chạy thủ công
docker-compose exec user-service python -c "from database import init_db; init_db()"
```

### Bước 5: Seed dữ liệu mẫu

```bash
# Chạy seed script để có dữ liệu test
python scripts/seed_data.py
```

## 🐛 Debug Chi Tiết

### Kiểm tra endpoint trực tiếp

```bash
# Test health endpoint
curl http://localhost:8002/health

# Test users endpoint
curl http://localhost:8002/api/v1/users?limit=6
```

### Xem error trong browser

1. Mở DevTools (F12)
2. Vào tab Network
3. Click vào request `/api/v1/users?limit=6`
4. Xem tab Response để thấy error message

### Kiểm tra database connection

```bash
# Test connection từ user-service
docker-compose exec user-service python -c "
import os
from sqlalchemy import create_engine
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)
conn = engine.connect()
print('Database connected!')
conn.close()
"
```

## 📋 Checklist

- [ ] Tables đã được tạo trong database
- [ ] Database connection hoạt động
- [ ] Services đang chạy (`docker-compose ps`)
- [ ] Không có lỗi trong logs
- [ ] Seed data đã chạy (nếu muốn có dữ liệu test)

## 🔄 Sau Khi Sửa

1. **Restart service**:
   ```bash
   docker-compose restart user-service
   ```

2. **Clear browser cache** và thử lại

3. **Kiểm tra lại endpoint**:
   - http://localhost:8002/api/v1/users?limit=6
   - Hoặc http://localhost/api/v1/users?limit=6 (qua Nginx)

## 💡 Lưu Ý

- Lần đầu chạy, database có thể chưa có tables → cần đợi `init_db()` chạy
- Nếu không có dữ liệu, API sẽ trả về empty array `[]` (không phải lỗi)
- Lỗi 500 thường do code Python, check logs để biết chi tiết

