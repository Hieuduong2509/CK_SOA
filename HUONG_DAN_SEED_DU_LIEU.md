# Hướng Dẫn Seed Dữ Liệu Freelancer

## Vấn Đề
Dữ liệu freelancer trong file `FREELANCER_DATA.md` cần được seed vào database để hiển thị trên trang web.

## Cách Seed Dữ Liệu

### Bước 1: Đảm bảo Docker đang chạy
```bash
docker-compose ps
```
Tất cả services phải ở trạng thái "Up".

### Bước 2: Seed dữ liệu vào database

**Cách 1: Chạy trực tiếp trong container (Khuyến nghị)**

```bash
# Seed auth database (tạo users)
docker-compose exec auth-service python /app/scripts/seed_data.py

# Hoặc seed cả 2 database cùng lúc
docker-compose exec user-service python /app/scripts/seed_data.py
```

**Cách 2: Chạy từ host (nếu có Python và dependencies)**

```bash
# Từ thư mục gốc project
python scripts/seed_data.py
```

### Bước 3: Kiểm tra dữ liệu đã được seed

```bash
# Kiểm tra số lượng profiles
docker-compose exec user-service python /app/scripts/check_data.py
```

Bạn sẽ thấy:
- Tổng số Freelancer users: 10
- Tổng số Profiles: 10
- Developers: 6 người
- Designers: 4 người

### Bước 4: Kiểm tra trên trang web

1. **Mở trang chủ:** `http://localhost/`
   - Bạn sẽ thấy 2 mục: "Developers" và "Designers"
   - Mỗi mục hiển thị các freelancer tương ứng

2. **Mở trang tìm freelancer:** `http://localhost/freelancers.html`
   - Bạn sẽ thấy tất cả 10 freelancer được hiển thị
   - Có thể dùng bộ lọc để tìm kiếm

3. **Kiểm tra API trực tiếp:**
   - Mở: `http://localhost/api/v1/users?limit=100`
   - Bạn sẽ thấy JSON array chứa 10 freelancer

### Bước 5: Kiểm tra Console trong Browser

1. Mở Developer Tools (F12)
2. Vào tab Console
3. Refresh trang
4. Xem logs:
   - `Loaded all freelancers: 10` (trên trang freelancers.html)
   - `Loaded freelancers: 10` (trên trang index.html)
   - `Developers: 6 [...]`
   - `Designers: 4 [...]`

## Dữ Liệu Sẽ Được Seed

Sau khi seed thành công, bạn sẽ có:

### 10 Freelancer Users:
1. John Developer (user_id: 2)
2. Jane Designer (user_id: 3)
3. Linh Product (user_id: 6)
4. Minh Backend (user_id: 7)
5. Anh Frontend (user_id: 8)
6. Huy Fullstack (user_id: 9)
7. Lan UI Designer (user_id: 10)
8. Hoa Brand Designer (user_id: 11)
9. Mai UX Researcher (user_id: 12)

### Mỗi Freelancer có:
- Profile với đầy đủ thông tin (skills, categories, badges, rating, etc.)
- 3 gói dịch vụ (Starter, Professional, Premium)
- 2 bài viết (articles)

## Troubleshooting

### Nếu seed bị lỗi "table does not exist":
```bash
# Đảm bảo database đã được tạo
docker-compose exec main-db psql -U postgres -c "CREATE DATABASE marketplace_db;"
docker-compose exec auth-db psql -U postgres -c "CREATE DATABASE auth_db;"
```

### Nếu seed bị lỗi "duplicate key":
```bash
# Xóa dữ liệu cũ và seed lại
docker-compose exec main-db psql -U postgres -d marketplace_db -c "TRUNCATE TABLE profiles, packages, articles CASCADE;"
docker-compose exec auth-db psql -U postgres -d auth_db -c "TRUNCATE TABLE users CASCADE;"
docker-compose exec user-service python /app/scripts/seed_data.py
```

### Nếu vẫn không thấy dữ liệu:
1. Kiểm tra logs của user-service:
   ```bash
   docker-compose logs user-service | tail -50
   ```

2. Restart user-service:
   ```bash
   docker-compose restart user-service
   ```

3. Kiểm tra API có trả về dữ liệu:
   ```bash
   curl http://localhost/api/v1/users?limit=100
   ```

## Lưu Ý

- Script seed sẽ tạo dữ liệu mẫu, không xóa dữ liệu cũ
- Nếu user đã tồn tại, script sẽ bỏ qua (không tạo duplicate)
- Để seed lại từ đầu, cần xóa dữ liệu cũ trước (xem phần Troubleshooting)

## Thông Tin Đăng Nhập Mẫu

Sau khi seed, bạn có thể đăng nhập với:
- **Admin:** admin@codedesign.com / admin123
- **Freelancer:** freelancer1@codedesign.com / freelancer123
- **Client:** client1@codedesign.com / client123

