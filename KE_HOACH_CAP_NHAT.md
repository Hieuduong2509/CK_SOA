# Kế hoạch Cập nhật - Theo Góp ý

## ✅ Đã hoàn thành

### Giai đoạn 3: Hoàn thiện Flow Gói Dịch vụ
- ✅ Requirements Form trong Service Checkout
- ✅ Auto-create Conversation (RabbitMQ event)
- ✅ Validation service status

---

## 🎯 Giai đoạn 4: Level & Badges (Cập nhật theo góp ý)

### 4.2. Hiển thị Badges - CẢI THIỆN

**Góp ý đã nhận:**
1. **Backend**: Sắp xếp badges theo độ ưu tiên (Top Rated luôn đầu tiên)
2. **Frontend**: Dùng tooltip (title attribute hoặc tippy.js) để hiện giải thích khi hover

**Cần làm:**
1. **Backend** (`user_service/routes.py` - `enrich_profile`):
   - Sắp xếp badges theo priority:
     ```python
     BADGE_PRIORITY = {
         "top_rated": 1,
         "high_earner": 2,
         "client_favorite": 3,
         "fast_delivery": 4,
         "reliable_partner": 5,
         "rising_talent": 6,
         "level_1": 10,
         "level_2": 11,
         # ...
     }
     ```
   - Sort badges trước khi trả về

2. **Frontend** (`freelancer_profile.html`):
   - Thêm tooltip với title attribute hoặc tippy.js
   - Badge descriptions:
     - "Top Rated": "Hoàn thành >50 đơn, đánh giá 4.9+"
     - "Fast Delivery": "Tỷ lệ giao hàng đúng hạn >95%"
     - "Client Favorite": "Tỷ lệ khách quay lại >50%"
     - "High Earner": "Tổng doanh thu >50M VND"
     - "Reliable Partner": "Tỷ lệ hủy <5%, tranh chấp <1%"
     - "Rising Talent": "Hoàn thành >5 đơn trong 90 ngày đầu"

**File cần sửa:**
- `services/user_service/routes.py` (sort badges)
- `frontend/public/freelancer_profile.html` (tooltip)
- `frontend/public/js/freelancer_profile.js` (nếu có)

**Ước tính**: 1-2 giờ

---

## 🎯 Giai đoạn 5: Workspace & UX (Cập nhật theo góp ý)

### 5.2. Log Activity với IP Address - QUAN TRỌNG

**Góp ý đã nhận:**
- Log IP của người thực hiện hành động (lưu trong metadata) để giải quyết tranh chấp

**Cần làm:**
1. **Backend** (`project_service/models.py`):
   - ✅ Đã thêm field `metadata` (JSON) vào `ProjectActivity`

2. **Backend** (`project_service/crud.py`):
   - ✅ Đã cập nhật `log_activity` để nhận `metadata` parameter

3. **Backend** (`project_service/routes.py`):
   - ✅ Đã thêm helper `get_client_ip(request)`
   - Cần cập nhật tất cả endpoints gọi `log_activity` để pass IP:
     ```python
     metadata = {
         "ip_address": get_client_ip(request),
         "user_agent": request.headers.get("User-Agent", "unknown")
     }
     log_activity(db, project_id, "action_type", "description", user_id, metadata)
     ```

**File cần sửa:**
- `services/project_service/routes.py` (cập nhật tất cả log_activity calls)

**Ước tính**: 1-2 giờ

---

## 🚨 Missing Pieces - 3 Quy trình Quan trọng

### 1. Delivery Flow cho GIG_ORDER ⚠️ **RẤT QUAN TRỌNG**

**Vấn đề:**
- Với BIDDING: Freelancer nộp từng Milestone
- Với GIG_ORDER: Cần nút "Giao hàng" riêng, upload file, chuyển IN_PROGRESS -> DELIVERED

**Cần làm:**

#### Backend:
1. **Thêm DELIVERED status** ✅ (đã thêm vào `ProjectStatus`)
2. **API Deliver Project** (`POST /api/v1/projects/{project_id}/deliver`):
   - Chỉ cho phép GIG_ORDER projects
   - Chỉ freelancer của project mới được deliver
   - Upload files (tương tự milestone submission)
   - Chuyển status: IN_PROGRESS -> DELIVERED
   - Log activity với IP
   - Tạo milestone submission (nếu chưa có) hoặc update milestone hiện có

3. **API Request Revision** (`POST /api/v1/projects/{project_id}/request-revision`):
   - Chỉ cho phép khi status = DELIVERED
   - Chỉ client mới được request revision
   - Chuyển status: DELIVERED -> IN_PROGRESS
   - Log activity với IP

4. **API Accept Delivery** (`POST /api/v1/projects/{project_id}/accept-delivery`):
   - Chỉ cho phép khi status = DELIVERED
   - Chỉ client mới được accept
   - Chuyển status: DELIVERED -> COMPLETED
   - Release escrow
   - Log activity với IP

#### Frontend:
1. **Workspace** (`workspace.html` + `workspace.js`):
   - Nút "Giao hàng" (Deliver Now) cho freelancer khi:
     - Project type = GIG_ORDER
     - Status = IN_PROGRESS
     - User = freelancer của project
   - Modal upload files khi bấm "Giao hàng"
   - Nút "Yêu cầu sửa" (Request Revision) cho client khi:
     - Status = DELIVERED
     - User = client
   - Nút "Chấp nhận" (Accept Delivery) cho client khi:
     - Status = DELIVERED
     - User = client

**File cần sửa:**
- `services/project_service/models.py` ✅ (đã thêm DELIVERED)
- `services/project_service/routes.py` (thêm 3 API endpoints)
- `services/project_service/crud.py` (thêm functions deliver_project, request_revision_project, accept_delivery)
- `frontend/public/workspace.html` (thêm buttons)
- `frontend/public/js/workspace.js` (logic xử lý)

**Ước tính**: 4-6 giờ

---

### 2. Auto-acceptance sau 3 ngày ⚠️ **QUAN TRỌNG**

**Vấn đề:**
- Nếu freelancer deliver mà 3 ngày sau client không phản hồi → tự động COMPLETED và release escrow

**Cần làm:**
1. **Backend** (Tạo worker/cronjob):
   - Tạo file `services/project_service/auto_acceptance_worker.py`
   - Hoặc thêm vào existing worker
   - Logic:
     ```python
     # Query projects với status = DELIVERED và delivered_at < now() - 3 days
     # Tự động:
     # 1. Chuyển status -> COMPLETED
     # 2. Release escrow
     # 3. Log activity
     # 4. Gửi notification cho cả client và freelancer
     ```

2. **Database**:
   - Thêm field `delivered_at` vào `Project` model (hoặc dùng activity log)

**File cần sửa:**
- `services/project_service/models.py` (thêm delivered_at)
- `services/project_service/auto_acceptance_worker.py` (tạo mới)
- `docker-compose.yml` (thêm worker service)

**Ước tính**: 2-3 giờ

---

### 3. Request Revision cho GIG_ORDER ⚠️ **QUAN TRỌNG**

**Vấn đề:**
- Client cần có nút "Yêu cầu sửa" khi status = DELIVERED
- Khi bấm → quay lại IN_PROGRESS

**Cần làm:**
- Đã bao gồm trong **Delivery Flow** (mục 1)

---

## 📋 Tổng kết Ưu tiên

### ⚡ Ưu tiên CAO (Làm ngay)
1. **Delivery Flow cho GIG_ORDER** (4-6h) - Core feature
2. **IP Logging trong Activities** (1-2h) - Quan trọng cho dispute
3. **Badges với Tooltip & Sorting** (1-2h) - UX improvement

### 📊 Ưu tiên TRUNG BÌNH
4. **Auto-acceptance sau 3 ngày** (2-3h) - Automation

---

## 🚀 Bước tiếp theo

**Bắt đầu với Delivery Flow** vì đây là core feature cho GIG_ORDER model.

