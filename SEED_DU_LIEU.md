# Hướng Dẫn Seed Dữ Liệu

## Vấn Đề
File `seed_data.py` không tìm thấy trong container vì scripts folder chưa được mount.

## Giải Pháp Đã Áp Dụng
Đã mount `./scripts` vào `/app/scripts` trong cả `auth-service` và `user-service`.

## Cách Seed Dữ Liệu

### Bước 1: Seed Auth Database (Users)

```powershell
docker-compose exec auth-service python /app/scripts/seed_auth.py
```

Hoặc nếu file seed_data.py đã có trong container:

```powershell
docker-compose exec auth-service python /app/scripts/seed_data.py
```

### Bước 2: Seed User Service Database (Profiles, Packages, Articles)

**Cách 1: Sử dụng script đơn giản (khuyến nghị)**

Tạo file `scripts/seed_user.py` với nội dung chỉ seed profiles, packages, articles (không seed projects).

**Cách 2: Sử dụng seed_data.py gốc**

Nếu seed_data.py đã có trong container, chạy:

```powershell
docker-compose exec user-service python /app/scripts/seed_data.py
```

**Lưu ý:** Script seed_data.py gốc có thể cần import từ project_service, nếu lỗi thì bỏ qua phần seed projects.

### Bước 3: Kiểm tra dữ liệu

```powershell
docker-compose exec user-service python /app/scripts/check_data.py
```

## Nếu Vẫn Lỗi

1. **Kiểm tra file có trong container:**
   ```powershell
   docker-compose exec user-service ls -la /app/scripts/
   ```

2. **Nếu không có file, copy vào container:**
   ```powershell
   docker cp scripts/seed_data.py test_ck-user-service-1:/app/scripts/
   docker cp scripts/seed_auth.py test_ck-auth-service-1:/app/scripts/
   ```

3. **Hoặc chạy trực tiếp từ host (nếu có Python và dependencies):**
   ```powershell
   python scripts/seed_data.py
   ```

## Thông Tin Đăng Nhập Sau Khi Seed

- **Admin:** admin@codedesign.com / admin123
- **Freelancer:** freelancer1@codedesign.com / freelancer123
- **Client:** client1@codedesign.com / client123

