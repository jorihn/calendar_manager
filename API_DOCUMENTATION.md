# Calendar Manager & OKR API Documentation

> **Skill Guide cho AI Agents (OpenClaw, etc.)**

Tài liệu này hướng dẫn cách sử dụng API để quản lý lịch và công việc theo phương pháp OKR.

---

## 🔑 Xác thực (Authentication)

Tất cả API (trừ `/auth/*` và `/health`) yêu cầu Bearer token trong header:

```
Authorization: Bearer <your-token>
```

### Lấy Token

**Bước 1: Đăng ký user mới**

```http
POST /auth/register
Content-Type: application/json

{
  "name": "Agent Name",
  "timezone": "Asia/Ho_Chi_Minh"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "name": "Agent Name",
    "timezone": "Asia/Ho_Chi_Minh",
    "created_at": "2026-02-11T01:00:00.000Z"
  },
  "token": "xK8vN2mP5qR7sT9uV1wX3yZ4aB6cD8eF...",
  "role": "owner"
}
```

**Lưu `token` này để sử dụng cho tất cả API calls sau!**

---

**Bước 2 (Optional): Tạo thêm token cho user**

```http
POST /auth/token
Content-Type: application/json

{
  "user_id": "uuid",
  "role": "agent"
}
```

| Role | Mô tả |
|------|-------|
| `owner` | Chủ sở hữu, full quyền |
| `agent` | AI agent, quyền đọc/ghi |
| `manager` | Quản lý, quyền đọc/ghi |

---

## 📅 Calendar API

Quản lý lịch làm việc, cuộc họp, thời gian tập trung.

### POST /calendar/slots

Tạo calendar slot mới.

```http
POST /calendar/slots
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Team Meeting",
  "start_time": "2026-02-15T09:00:00+07:00",
  "end_time": "2026-02-15T10:00:00+07:00",
  "type": "meeting"
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `title` | string | ✅ | Tiêu đề |
| `start_time` | ISO 8601 | ✅ | Thời gian bắt đầu |
| `end_time` | ISO 8601 | ✅ | Thời gian kết thúc |
| `type` | enum | ✅ | `work`, `meeting`, `focus`, `personal` |

**Timestamp formats hỗ trợ:**
- `2026-02-15T09:00:00Z` (UTC)
- `2026-02-15T16:00:00+07:00` (với timezone)
- `2026-02-15T16:00:00` (local time của server)

**Response 201:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "title": "Team Meeting",
  "start_time": "2026-02-15T02:00:00.000Z",
  "end_time": "2026-02-15T03:00:00.000Z",
  "type": "meeting",
  "status": "active",
  "created_at": "...",
  "updated_at": "..."
}
```

**Error 409 (TIME_CONFLICT):**
```json
{
  "code": "TIME_CONFLICT",
  "message": "This time slot overlaps with an existing active slot",
  "details": { "conflicting_slot_id": "uuid" }
}
```

---

### GET /calendar/slots

Lấy danh sách calendar slots của user.

```http
GET /calendar/slots
Authorization: Bearer <token>
```

**Response 200:**
```json
[
  {
    "id": "uuid",
    "title": "Team Meeting",
    "start_time": "2026-02-15T02:00:00.000Z",
    "end_time": "2026-02-15T03:00:00.000Z",
    "start_time_local": "2026-02-15 09:00:00",
    "end_time_local": "2026-02-15 10:00:00",
    "type": "meeting",
    "status": "active"
  }
]
```

**Lưu ý:**
- Chỉ trả về slots có `status = 'active'`
- `start_time_local` / `end_time_local` là giờ GMT+7

---

### PUT /calendar/slots/:id

Cập nhật calendar slot.

```http
PUT /calendar/slots/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Meeting",
  "status": "cancelled"
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `title` | string | Tiêu đề mới |
| `start_time` | ISO 8601 | Thời gian bắt đầu mới |
| `end_time` | ISO 8601 | Thời gian kết thúc mới |
| `type` | enum | `work`, `meeting`, `focus`, `personal` |
| `status` | enum | `active`, `cancelled` |

---

### GET /calendar/availability

Kiểm tra lịch rảnh/bận trong khoảng thời gian.

```http
GET /calendar/availability?from=2026-02-15T00:00:00Z&to=2026-02-15T23:59:59Z
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "busy": [
    { "start": "2026-02-15T09:00:00Z", "end": "2026-02-15T10:00:00Z" }
  ],
  "free": [
    { "start": "2026-02-15T00:00:00Z", "end": "2026-02-15T09:00:00Z" },
    { "start": "2026-02-15T10:00:00Z", "end": "2026-02-15T23:59:59Z" }
  ]
}
```

---

## 🎯 OKR API

Quản lý Objectives, Key Results và Tasks theo phương pháp OKR.

### Objectives

#### POST /objectives

Tạo objective mới.

```http
POST /objectives
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Hoàn thành MVP Calendar Manager",
  "description": "Xây dựng hệ thống quản lý lịch hoàn chỉnh",
  "type": "work",
  "horizon": "month",
  "success_def": "API hoạt động ổn định trên VPS"
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `title` | string | ✅ | Tiêu đề objective |
| `description` | string | ❌ | Mô tả chi tiết |
| `type` | enum | ✅ | `work`, `personal` |
| `horizon` | enum | ✅ | `week`, `month`, `quarter`, `year` |
| `success_def` | string | ❌ | Định nghĩa thành công |

**Response 201:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "title": "Hoàn thành MVP Calendar Manager",
  "description": "...",
  "type": "work",
  "horizon": "month",
  "success_def": "...",
  "status": "active",
  "created_at": "..."
}
```

---

#### GET /objectives

Lấy danh sách objectives.

```http
GET /objectives
GET /objectives?type=work
GET /objectives?horizon=month
GET /objectives?status=active
Authorization: Bearer <token>
```

| Query Param | Mô tả |
|-------------|-------|
| `type` | Filter theo `work` hoặc `personal` |
| `horizon` | Filter theo `week`, `month`, `quarter`, `year` |
| `status` | Filter theo `active` hoặc `archived` (default: active) |

---

#### GET /objectives/:id

Lấy chi tiết một objective.

```http
GET /objectives/{id}
Authorization: Bearer <token>
```

---

#### PATCH /objectives/:id

Cập nhật objective.

```http
PATCH /objectives/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Objective",
  "status": "archived"
}
```

---

#### DELETE /objectives/:id

Archive objective (soft delete).

```http
DELETE /objectives/{id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Objective archived",
  "objective": { ... }
}
```

---

### Key Results

#### POST /key-results

Tạo key result mới.

```http
POST /key-results
Authorization: Bearer <token>
Content-Type: application/json

{
  "objective_id": "uuid",
  "title": "Deploy API lên VPS thành công",
  "type": "boolean",
  "target": "true",
  "current": "false",
  "confidence": 0.8
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `objective_id` | UUID | ✅ | ID của objective |
| `title` | string | ✅ | Tiêu đề KR |
| `type` | enum | ✅ | `metric`, `milestone`, `boolean` |
| `target` | string | ❌ | Giá trị mục tiêu |
| `current` | string | ❌ | Giá trị hiện tại |
| `confidence` | float | ❌ | Độ tin cậy (0-1) |

---

#### GET /key-results

Lấy danh sách key results.

```http
GET /key-results
GET /key-results?objective_id={uuid}
Authorization: Bearer <token>
```

---

#### GET /key-results/:id

Lấy chi tiết một key result.

```http
GET /key-results/{id}
Authorization: Bearer <token>
```

---

#### PATCH /key-results/:id

Cập nhật key result.

```http
PATCH /key-results/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "current": "75%",
  "confidence": 0.9
}
```

---

#### DELETE /key-results/:id

Xóa key result.

```http
DELETE /key-results/{id}
Authorization: Bearer <token>
```

---

### Tasks

#### POST /tasks

Tạo task mới.

```http
POST /tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Fix bug provider list",
  "description": "Sửa lỗi hiển thị danh sách providers",
  "category": "work",
  "objective_id": "uuid",
  "kr_id": "uuid",
  "estimate": 60,
  "priority": "critical",
  "impact_note": "Ảnh hưởng đến UX"
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `title` | string | ✅ | Tiêu đề task |
| `description` | string | ❌ | Mô tả chi tiết |
| `category` | enum | ✅ | `work`, `personal` |
| `objective_id` | UUID | ❌ | Liên kết với objective |
| `kr_id` | UUID | ❌ | Liên kết với key result |
| `estimate` | integer | ❌ | Thời gian ước tính (phút) |
| `priority` | enum | ❌ | `low`, `medium`, `high`, `critical` (default: medium) |
| `impact_note` | string | ❌ | Ghi chú về tác động |

**Lưu ý:**
- Task `personal` có thể không có `objective_id` và `kr_id`
- API KHÔNG validate logic OKR (openClaw chịu trách nhiệm)

---

#### GET /tasks

Lấy danh sách tasks.

```http
GET /tasks
GET /tasks?category=work
GET /tasks?status=todo
GET /tasks?priority=critical
GET /tasks?objective_id={uuid}
GET /tasks?kr_id={uuid}
Authorization: Bearer <token>
```

| Query Param | Mô tả |
|-------------|-------|
| `category` | Filter theo `work` hoặc `personal` |
| `status` | Filter theo `todo`, `doing`, `done` |
| `priority` | Filter theo `low`, `medium`, `high`, `critical` |
| `objective_id` | Filter theo objective |
| `kr_id` | Filter theo key result |

---

#### GET /tasks/:id

Lấy chi tiết một task.

```http
GET /tasks/{id}
Authorization: Bearer <token>
```

---

#### PATCH /tasks/:id

Cập nhật task.

```http
PATCH /tasks/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "doing",
  "priority": "high"
}
```

| Field | Mô tả |
|-------|-------|
| `title` | Tiêu đề mới |
| `description` | Mô tả mới |
| `category` | `work`, `personal` |
| `objective_id` | UUID hoặc `null` |
| `kr_id` | UUID hoặc `null` |
| `estimate` | Thời gian ước tính |
| `priority` | `low`, `medium`, `high`, `critical` |
| `impact_note` | Ghi chú tác động |
| `status` | `todo`, `doing`, `done` |

---

#### POST /tasks/:id/complete

Đánh dấu task hoàn thành.

```http
POST /tasks/{id}/complete
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Fix bug provider list",
  "status": "done",
  "completed_at": "2026-02-11T02:00:00.000Z",
  ...
}
```

---

## 🔧 Utility Endpoints

### GET /health

Kiểm tra server status.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-11T01:00:00.000Z"
}
```

---

### GET /api/server-info

Lấy thông tin server (IP, port).

```http
GET /api/server-info
```

**Response:**
```json
{
  "ip": "192.168.1.100",
  "port": 3000
}
```

---

## ❌ Error Codes

| Code | HTTP Status | Mô tả |
|------|-------------|-------|
| `MISSING_TOKEN` | 401 | Thiếu Authorization header |
| `INVALID_TOKEN` | 401 | Token không hợp lệ |
| `AUTH_ERROR` | 500 | Lỗi xác thực nội bộ |
| `MISSING_FIELDS` | 400 | Thiếu trường bắt buộc |
| `INVALID_TIMESTAMP` | 400 | Timestamp không đúng ISO 8601 |
| `INVALID_TIME_RANGE` | 400 | start_time >= end_time |
| `INVALID_TYPE` | 400 | Type không hợp lệ |
| `INVALID_STATUS` | 400 | Status không hợp lệ |
| `INVALID_CATEGORY` | 400 | Category không hợp lệ |
| `INVALID_PRIORITY` | 400 | Priority không hợp lệ |
| `INVALID_HORIZON` | 400 | Horizon không hợp lệ |
| `INVALID_ID` | 400 | UUID format không hợp lệ |
| `INVALID_CONFIDENCE` | 400 | Confidence không trong khoảng 0-1 |
| `TIME_CONFLICT` | 409 | Trùng lịch với slot khác |
| `SLOT_NOT_FOUND` | 404 | Không tìm thấy calendar slot |
| `OBJECTIVE_NOT_FOUND` | 404 | Không tìm thấy objective |
| `KEY_RESULT_NOT_FOUND` | 404 | Không tìm thấy key result |
| `TASK_NOT_FOUND` | 404 | Không tìm thấy task |
| `USER_NOT_FOUND` | 404 | Không tìm thấy user |
| `FORBIDDEN` | 403 | Không có quyền truy cập |
| `NO_UPDATES` | 400 | Không có trường nào để update |
| `INTERNAL_ERROR` | 500 | Lỗi server nội bộ |

---

## 🤖 Hướng dẫn cho AI Agent

### Workflow cơ bản

```
1. Đăng ký user (nếu chưa có token)
   POST /auth/register

2. Lưu token để sử dụng

3. Tạo Objective
   POST /objectives

4. Tạo Key Results cho Objective
   POST /key-results

5. Tạo Tasks cho Key Results
   POST /tasks

6. Cập nhật tiến độ
   PATCH /key-results/:id
   PATCH /tasks/:id

7. Hoàn thành task
   POST /tasks/:id/complete
```

### Ví dụ workflow hoàn chỉnh

```bash
# 1. Đăng ký
TOKEN=$(curl -s -X POST http://180.93.237.207:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "OpenClaw Agent", "timezone": "Asia/Ho_Chi_Minh"}' \
  | jq -r '.token')

# 2. Tạo Objective
OBJ_ID=$(curl -s -X POST http://180.93.237.207:3000/objectives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Ship MVP", "type": "work", "horizon": "week"}' \
  | jq -r '.id')

# 3. Tạo Key Result
KR_ID=$(curl -s -X POST http://180.93.237.207:3000/key-results \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"objective_id\": \"$OBJ_ID\", \"title\": \"API deployed\", \"type\": \"boolean\"}" \
  | jq -r '.id')

# 4. Tạo Task
TASK_ID=$(curl -s -X POST http://180.93.237.207:3000/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Fix auth bug\", \"category\": \"work\", \"objective_id\": \"$OBJ_ID\", \"kr_id\": \"$KR_ID\", \"priority\": \"critical\"}" \
  | jq -r '.id')

# 5. Hoàn thành Task
curl -X POST "http://180.93.237.207:3000/tasks/$TASK_ID/complete" \
  -H "Authorization: Bearer $TOKEN"

# 6. Cập nhật KR
curl -X PATCH "http://180.93.237.207:3000/key-results/$KR_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current": "true", "confidence": 1.0}'
```

### Nguyên tắc quan trọng

1. **API chỉ lưu trữ** - Không có AI, không brainstorm, không suy luận
2. **Gửi dữ liệu hoàn chỉnh** - API không hỏi lại, không sửa, không đoán
3. **Logic OKR do agent xử lý** - API không validate task có đúng KR không
4. **Soft delete** - Objectives được archive, không hard delete
5. **Token-based auth** - Mỗi request cần Bearer token

---

## 📡 Server Info

- **Base URL:** `http://180.93.237.207:3000`
- **Web Interface:** `http://180.93.237.207:3000` (mở bằng browser)

---

*Tài liệu này được tạo cho AI agents sử dụng Calendar Manager & OKR API.*
