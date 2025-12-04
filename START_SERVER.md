# 🚀 Hướng dẫn Start Server mỗi lần khởi động

## Các bước cần làm mỗi lần mở máy

### Bước 1: Mở PowerShell
Mở PowerShell trong thư mục dự án: `C:\xampp\htdocs\test_CK`

### Bước 2: Chạy script tự động (Khuyến nghị) ⭐

```powershell
.\scripts\start-all.ps1
```

Script này sẽ tự động:
- ✅ Kiểm tra Docker đang chạy
- ✅ Start tất cả Docker containers
- ✅ Start Ngrok tunnel
- ✅ Hiển thị URL công khai

**Đơn giản vậy thôi!**

---

## Hoặc chạy manual (2 bước)

### Bước 1: Start Docker containers
```powershell
docker-compose -f docker-compose.local.yml up -d
```

### Bước 2: Start Ngrok tunnel
```powershell
# Mở PowerShell mới
.\ngrok.exe http 80
```

---

## Kiểm tra server đã chạy

```powershell
# Kiểm tra status
.\scripts\check-status.ps1

# Hoặc manual
docker-compose -f docker-compose.local.yml ps
```

---

## Stop server khi xong việc

```powershell
.\scripts\stop-all.ps1
```

---

## Tóm tắt nhanh

| Việc | Lệnh | Khi nào |
|------|------|---------|
| **Start server** | `.\scripts\start-all.ps1` | Mỗi lần mở máy |
| **Stop server** | `.\scripts\stop-all.ps1` | Khi xong việc |
| **Kiểm tra** | `.\scripts\check-status.ps1` | Khi cần |

---

## Lưu ý

1. **Docker Desktop phải chạy trước** - Mở Docker Desktop trước khi chạy script
2. **Ngrok chỉ cần setup 1 lần** - Token đã được lưu, không cần setup lại
3. **Máy phải chạy** - Nếu tắt máy, website sẽ offline

---

## Troubleshooting

### Lỗi: Docker is not running
→ Mở Docker Desktop và đợi nó khởi động xong

### Lỗi: ngrok.exe not found
→ Đảm bảo `ngrok.exe` đã có trong thư mục dự án

### Lỗi: Port 80 already in use
→ Có thể có service khác đang dùng port 80, tắt nó đi

