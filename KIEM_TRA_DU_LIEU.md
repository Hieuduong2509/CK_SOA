# Hướng Dẫn Kiểm Tra và Seed Dữ Liệu Freelancer

## Vấn Đề: Không thấy dữ liệu freelancer hiển thị

### Bước 1: Kiểm tra dữ liệu đã được seed chưa

Chạy lệnh sau để kiểm tra xem có dữ liệu trong database không:

```bash
# Kiểm tra trong container user-service
docker-compose exec user-service python -c "
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from services.user_service.models import Profile

MAIN_DB_URL = os.getenv('MAIN_DB_URL', 'postgresql://postgres:postgres@main-db:5432/marketplace_db')
engine = create_engine(MAIN_DB_URL)
Session = sessionmaker(bind=engine)
db = Session()

profiles = db.query(Profile).all()
print(f'Tổng số profiles: {len(profiles)}')
for p in profiles:
    print(f'  - User ID: {p.user_id}, Name: {p.display_name}, Categories: {p.categories}')
"
```

### Bước 2: Seed dữ liệu nếu chưa có

Nếu chưa có dữ liệu, chạy script seed:

```bash
# Cách 1: Chạy trong container
docker-compose exec user-service python /app/scripts/seed_data.py

# Cách 2: Chạy từ host (nếu có Python và dependencies)
python scripts/seed_data.py
```

### Bước 3: Kiểm tra API trả về dữ liệu

Mở browser và truy cập:
```
http://localhost/api/v1/users?limit=100
```

Hoặc dùng curl:
```bash
curl http://localhost/api/v1/users?limit=100
```

Bạn sẽ thấy JSON array chứa danh sách freelancer.

### Bước 4: Kiểm tra Console trong Browser

1. Mở trang chủ (index.html)
2. Mở Developer Tools (F12)
3. Vào tab Console
4. Xem các log:
   - `Loaded freelancers: X [...]` - số lượng freelancer đã load
   - `Developers: X [...]` - số developer đã phân loại
   - `Designers: X [...]` - số designer đã phân loại

### Bước 5: Kiểm tra Network Tab

1. Mở Developer Tools (F12)
2. Vào tab Network
3. Refresh trang
4. Tìm request `GET /api/v1/users?limit=100`
5. Xem Response để kiểm tra dữ liệu trả về

## Dữ Liệu Freelancer Mẫu

Sau khi seed, bạn sẽ có **10 freelancer**:

### Developers (6 người):
1. John Developer (user_id: 2)
2. Linh Product (user_id: 6)
3. Minh Backend (user_id: 7)
4. Anh Frontend (user_id: 8)
5. Huy Fullstack (user_id: 9)

### Designers (4 người):
1. Jane Designer (user_id: 3)
2. Lan UI Designer (user_id: 10)
3. Hoa Brand Designer (user_id: 11)
4. Mai UX Researcher (user_id: 12)

## Troubleshooting

### Nếu vẫn không thấy dữ liệu:

1. **Kiểm tra database connection:**
   ```bash
   docker-compose exec main-db psql -U postgres -d marketplace_db -c "SELECT COUNT(*) FROM profiles;"
   ```

2. **Kiểm tra user-service logs:**
   ```bash
   docker-compose logs user-service | tail -50
   ```

3. **Restart services:**
   ```bash
   docker-compose restart user-service
   ```

4. **Kiểm tra seed script đã chạy thành công:**
   ```bash
   docker-compose exec user-service python /app/scripts/seed_data.py
   ```

## Lưu Ý

- Đảm bảo các services đã start: `docker-compose ps`
- Đảm bảo database đã được tạo: `docker-compose exec main-db psql -U postgres -l`
- Nếu seed lỗi, xóa và tạo lại database:
  ```bash
  docker-compose down -v
  docker-compose up -d
  python scripts/seed_data.py
  ```

