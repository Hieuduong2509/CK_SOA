# Hướng Dẫn Sửa Lỗi Seed Dữ Liệu

## Vấn Đề
API trả về 200 OK nhưng response chỉ 453 bytes, có thể dữ liệu chưa được seed hoặc có lỗi.

## Giải Pháp

### Bước 1: Kiểm tra dữ liệu hiện có

Chạy lệnh sau trong PowerShell:

```powershell
docker-compose exec user-service python /app/scripts/check_data.py
```

### Bước 2: Seed dữ liệu

Nếu chưa có dữ liệu hoặc ít dữ liệu, chạy:

```powershell
docker-compose exec user-service python /app/scripts/seed_data.py
```

### Bước 3: Kiểm tra API trực tiếp

Mở browser và truy cập:
```
http://localhost/api/v1/users?limit=100
```

Hoặc dùng PowerShell:
```powershell
Invoke-WebRequest -Uri "http://localhost/api/v1/users?limit=100" | Select-Object -ExpandProperty Content
```

### Bước 4: Restart services nếu cần

```powershell
docker-compose restart user-service
docker-compose restart search-service
```

## Lưu Ý

- Đảm bảo database đã được tạo
- Đảm bảo các services đang chạy: `docker-compose ps`
- Nếu vẫn lỗi, xem logs: `docker-compose logs user-service`

