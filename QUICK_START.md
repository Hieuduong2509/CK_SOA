# ⚡ Quick Start - Chạy Server

## Mỗi lần mở máy, chạy 1 lệnh này:

```powershell
.\scripts\start-all.ps1
```

**Xong!** Server đã chạy. Copy URL từ Ngrok và truy cập.

---

## Các lệnh khác

```powershell
# Stop server
.\scripts\stop-all.ps1

# Kiểm tra status
.\scripts\check-status.ps1

# Xem logs
docker-compose -f docker-compose.local.yml logs -f
```

---

## Lưu ý

- ✅ Docker Desktop phải chạy trước
- ✅ Ngrok chỉ cần setup 1 lần (đã có token)
- ✅ Máy phải chạy để website online

Xem chi tiết trong `START_SERVER.md`

