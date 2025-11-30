# Kế hoạch Chi tiết - CodeDesign Marketplace

## 📊 Đánh giá Tình trạng Hiện tại

### ✅ Đã hoàn thành (Giai đoạn 1-2)

#### Core Features
- ✅ **Authentication & Authorization**: JWT, signup/login, refresh token, 2FA, role-based access
- ✅ **User Management**: Profiles, portfolios, service packages, reviews
- ✅ **Projects & Bidding**: Post projects, submit bids, accept/reject, status management
- ✅ **Milestones & Escrow**: Create milestones, escrow deposit, submission, approval, payment release
- ✅ **Payments**: Wallet, top-up, escrow, withdrawal (mocked gateways)
- ✅ **Messaging**: Real-time WebSocket chat, conversations, file attachments
- ✅ **Notifications**: Event-driven, unread badges, background worker
- ✅ **Search**: Freelancer search, autocomplete, filtering
- ✅ **Admin Panel**: User/project management, dispute resolution
- ✅ **Analytics**: Event collection, platform summary, revenue tracking

#### Mini-Fiverr Features (Gần đây)
- ✅ **Service Packages**: CRUD, status workflow (DRAFT → PENDING → APPROVED)
- ✅ **GIG_ORDER Flow**: `create-from-service` API, auto milestone, escrow
- ✅ **Payment Flow**: `service_checkout → payment → workspace`
- ✅ **Orders Management**: Tab "Đơn dịch vụ tôi mua" với phân chia "Đang xử lý / Đã hoàn tất"
- ✅ **Workspace**: Unified cho cả BIDDING & GIG_ORDER, chat, milestones, files, activity timeline
- ✅ **Leveling System**: File `leveling.py` với thuật toán tính level & badges
- ✅ **Badge Assignment**: Tự động gán badges khi level ≥ 10 & > 10 projects

---

## 🎯 Giai đoạn 3: Hoàn thiện Flow Gói Dịch vụ (Ưu tiên cao)

### 3.1. Requirements Form trong Service Checkout ⚠️ **THIẾU**

**Vấn đề**: Gói dịch vụ có thể có `requirements` (câu hỏi cho client), nhưng `service_checkout.html` chưa hiển thị form để client trả lời.

**Cần làm**:
1. **Frontend** (`service_checkout.js`):
   - Kiểm tra `service.requirements` (array of `{type, question, required, options?}`)
   - Render form động (text input, textarea, select, checkbox)
   - Validate required fields trước khi submit
   - Gửi `requirements_answers` cùng với `service_id` khi bấm "Thanh toán"

2. **Backend** (`project_service/routes.py`):
   - Đảm bảo `requirements_answers` được lưu vào `project.requirements_answers` (đã có, lưu dạng JSON)

3. **Frontend** (`workspace.html` + `workspace.js`): ⚠️ **QUAN TRỌNG**
   - Thêm tab hoặc section "Yêu cầu khách hàng" để **Freelancer xem được** `requirements_answers`
   - Hiển thị dạng: Câu hỏi → Câu trả lời (read-only)
   - Đặt ở tab "Chi tiết" hoặc tạo tab riêng "Yêu cầu"

**File cần sửa**:
- `frontend/public/js/service_checkout.js` (thêm `renderRequirementsForm()`)
- `frontend/public/service_checkout.html` (thêm section hiển thị form)
- `frontend/public/workspace.html` (thêm section hiển thị requirements)
- `frontend/public/js/workspace.js` (thêm `loadProjectRequirements()`)

**Ước tính**: 3-4 giờ (bao gồm hiển thị cho freelancer)

---

### 3.2. Auto-create Conversation khi tạo GIG_ORDER ⚠️ **THIẾU**

**Vấn đề**: Khi client mua gói dịch vụ → tạo project GIG_ORDER, nhưng chưa tự động tạo conversation giữa client & freelancer.

**Cần làm** (Theo góp ý: Dùng RabbitMQ thay vì HTTP blocking):
1. **Backend** (`project_service/routes.py` - `create_project_from_service_endpoint`):
   - Sau khi tạo project thành công, publish event vào RabbitMQ:
     ```python
     publish_event(
         "project.created_from_gig",
         {
             "project_id": project_obj.id,
             "client_id": client_id,
             "freelancer_id": freelancer_id,
             "service_name": service_data.get("name")
         }
     )
     ```
   - Không block response, event sẽ được xử lý async

2. **Backend** (`messaging_service/worker.py` hoặc tạo mới):
   - Tạo worker listen event `project.created_from_gig`
   - Tự động gọi `get_or_create_conversation(client_id, freelancer_id, project_id)`
   - Tự động gửi tin nhắn chào mừng mặc định từ freelancer:
     ```
     "Xin chào! Tôi đã nhận được đơn hàng của bạn. Tôi sẽ bắt đầu làm việc ngay. Nếu có bất kỳ yêu cầu nào, vui lòng cho tôi biết!"
     ```

3. **Frontend** (`workspace.js`):
   - Đảm bảo `initializeChat(projectId)` hoạt động cho cả GIG_ORDER (đã có)

**File cần sửa**:
- `services/project_service/routes.py` (thêm publish event, thay vì HTTP call)
- `services/messaging_service/worker.py` (tạo worker mới hoặc mở rộng worker hiện có)
- `services/messaging_service/crud.py` (thêm helper function tạo welcome message)

**Ước tính**: 1-2 giờ (bao gồm worker setup)

---

### 3.3. Validation & Error Handling cho GIG_ORDER ⚠️ **CẦN CẢI THIỆN**

**Vấn đề**: Chưa có validation đầy đủ khi tạo đơn từ service.

**Cần làm**:
1. **Backend** (`project_service/routes.py`):
   - Kiểm tra `service.status != APPROVED` → reject với message rõ ràng
   - Kiểm tra `service.status == PAUSED` hoặc `HIDDEN` → reject (theo góp ý)
   - Kiểm tra freelancer bị ban/suspended → reject
   - Kiểm tra client có đủ balance (nếu dùng wallet) → reject hoặc auto top-up
   - Log lỗi escrow creation rõ ràng hơn (hiện chỉ print) → raise HTTPException hoặc log structured

2. **Frontend** (`payment.html`):
   - Hiển thị error message rõ ràng nếu API fail
   - Retry logic hoặc redirect về checkout với message
   - Hiển thị validation errors từ backend (status code 400)

**File cần sửa**:
- `services/project_service/routes.py` (thêm validation đầy đủ)
- `frontend/public/payment.html` (cải thiện error handling)

**Ước tính**: 1-2 giờ

---

## 🎯 Giai đoạn 4: Level & Badges Hiển thị (Ưu tiên trung bình)

### 4.1. Hiển thị Level trên Profile ⚠️ **THIẾU**

**Vấn đề**: Backend đã tính `level` trong `enrich_profile`, nhưng frontend chưa hiển thị.

**Cần làm**:
1. **Frontend** (`freelancer_profile.html`):
   - Thêm badge "Level {level}" bên cạnh tên freelancer
   - Style: badge nhỏ, màu primary

2. **Frontend** (`freelancers.html`):
   - Hiển thị level trong card freelancer (nếu có)

**File cần sửa**:
- `frontend/public/freelancer_profile.html`
- `frontend/public/js/freelancer_profile.js` (nếu có)
- `frontend/public/js/freelancers.js`

**Ước tính**: 1 giờ

---

### 4.2. Hiển thị Badges trên Profile ⚠️ **THIẾU**

**Vấn đề**: Backend đã gán badges vào `profile.badges`, nhưng frontend chưa render.

**Cần làm**:
1. **Frontend** (`freelancer_profile.html`):
   - Render list badges dưới tên freelancer
   - Icon + tooltip cho mỗi badge:
     - "Top Rated" → ⭐
     - "Fast Delivery" → ⚡
     - "Client Favorite" → ❤️
     - "High Earner" → 💰
     - "Level {n}" → 🏆

2. **CSS** (`style.css`):
   - Style cho badge list (flex, gap, hover effect)

**File cần sửa**:
- `frontend/public/freelancer_profile.html`
- `frontend/public/css/style.css`

**Ước tính**: 1-2 giờ

---

### 4.3. Filter theo Badge/Level trong Search ⚠️ **THIẾU**

**Vấn đề**: Backend search đã hỗ trợ filter `badges`, nhưng frontend chưa có UI.

**Cần làm**:
1. **Frontend** (`freelancers.html`):
   - Thêm dropdown "Danh hiệu" với options:
     - "Top Rated"
     - "Fast Delivery"
     - "Client Favorite"
     - "High Earner"
   - Thêm dropdown "Level" (1-5)
   - Gửi params `badges` và `experience_level` khi filter

**File cần sửa**:
- `frontend/public/freelancers.html`
- `frontend/public/js/freelancers.js`

**Ước tính**: 1 giờ

---

## 🎯 Giai đoạn 5: Cải thiện Workspace & UX (Ưu tiên trung bình)

### 5.1. Activity Timeline Icons ⚠️ **CẦN CẢI THIỆN**

**Vấn đề**: Timeline hiện chỉ có icon chung, chưa phân biệt theo `action_type`.

**Cần làm**:
1. **Frontend** (`workspace.js` - `loadProjectActivities`):
   - Map `action_type` → icon khác nhau:
     - `project_created` → 🆕
     - `milestone_submitted` → 📤
     - `milestone_approved` → ✅
     - `milestone_revision_requested` → 🔄
     - `escrow.released` → 💰
     - `project_closed` → 🏁

2. **CSS** (`style.css`):
   - Style cho icon theo loại (màu khác nhau)

**File cần sửa**:
- `frontend/public/js/workspace.js`
- `frontend/public/css/style.css`

**Ước tính**: 1 giờ

---

### 5.2. Log thêm Activities ⚠️ **THIẾU**

**Vấn đề**: Một số sự kiện quan trọng chưa được log vào `ProjectActivity`.

**Cần làm**:
1. **Backend** (`project_service/crud.py`):
   - Thêm log cho:
     - `escrow.deposited` (khi tạo escrow)
     - `escrow.released` (khi release escrow)
     - `review.created` (khi client review)

2. **Backend** (`payments_service/routes.py`):
   - Khi release escrow, publish event với `project_id` để project_service có thể log

**File cần sửa**:
- `services/project_service/crud.py` (thêm log trong các hàm)
- `services/payments_service/routes.py` (đảm bảo event có project_id)

**Ước tính**: 1 giờ

---

### 5.3. Mobile Responsive cho Workspace ⚠️ **CẦN KIỂM TRA**

**Vấn đề**: Workspace có grid layout phức tạp, cần test trên mobile.

**Cần làm**:
1. **CSS** (`style.css`):
   - Media query cho `@media (max-width: 768px)`:
     - Stack chat & control panel (không side-by-side)
     - Tabs chuyển thành dropdown hoặc scroll horizontal
     - Gallery grid → 1 cột

**File cần sửa**:
- `frontend/public/css/style.css`

**Ước tính**: 1-2 giờ

---

## 🎯 Giai đoạn 6: Testing & Polish (Ưu tiên thấp)

### 6.1. End-to-end Testing

**Cần làm**:
1. Test full flow: **Freelancer đăng gói → Admin duyệt → Client mua → Thanh toán → Workspace → Deliver → Approve → Review**
2. Test edge cases:
   - Client mua gói của chính mình (đã block)
   - Freelancer bị ban khi đang có gói active
   - Escrow creation fail

**Ước tính**: 2-3 giờ

---

### 6.2. Error Messages & Loading States

**Cần làm**:
1. **Frontend**: Thêm loading spinners cho tất cả API calls
2. **Frontend**: Standardize error messages (tiếng Việt, dễ hiểu)
3. **Backend**: Return error messages nhất quán

**Ước tính**: 2 giờ

---

## 📋 Tổng kết & Ưu tiên

### ⚡ Ưu tiên CAO (Làm ngay)
1. **3.1. Requirements Form trong Service Checkout** (2-3h)
2. **3.2. Auto-create Conversation khi tạo GIG_ORDER** (30 phút)
3. **3.3. Validation & Error Handling** (1-2h)

### 📊 Ưu tiên TRUNG BÌNH (Làm sau)
4. **4.1-4.3. Level & Badges hiển thị** (3-4h tổng)
5. **5.1-5.2. Activity Timeline improvements** (2h)
6. **5.3. Mobile Responsive** (1-2h)

### 🔧 Ưu tiên THẤP (Khi có thời gian)
7. **6.1-6.2. Testing & Polish** (4-5h)

---

## 🚀 Bước tiếp theo đề xuất

**Bắt đầu với Giai đoạn 3** (Requirements Form + Auto Conversation + Validation) vì:
- Hoàn thiện flow GIG_ORDER (core feature)
- Dễ test và demo
- Tác động lớn đến UX

**Sau đó làm Giai đoạn 4** (Level & Badges) để tăng engagement và trust.

---

## 📝 Notes

- Tất cả tính năng mocked (payment gateways, email) có thể giữ nguyên cho demo
- Security improvements (rate limiting, XSS protection) có thể làm sau khi core features ổn định
- CI/CD và production deployment có thể làm song song với development


