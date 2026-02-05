# Calendar Manager Backend

Backend API cho hệ thống quản lý lịch làm việc cá nhân (MVP).

## Tech Stack

- **Node.js** + **TypeScript**
- **Express** - REST API framework
- **PostgreSQL** - Database
- **pg** - PostgreSQL client

## Yêu cầu hệ thống

- Node.js >= 18.x
- PostgreSQL >= 14.x
- npm hoặc yarn

## Cài đặt

### 1. Clone và cài đặt dependencies

```bash
npm install
```

### 2. Cấu hình database

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

Chỉnh sửa `.env`:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/calendar_manager
NODE_ENV=development
```

### 3. Tạo database

```bash
# Đăng nhập PostgreSQL
psql -U postgres

# Tạo database
CREATE DATABASE calendar_manager;
\q
```

### 4. Chạy migration

```bash
npm run build
npm run migrate
```

Migration sẽ tạo:
- Bảng `users`, `agent_tokens`, `calendar_slots`
- 1 user mặc định (ID: `00000000-0000-0000-0000-000000000001`)
- 1 agent token: `clawbot-token-12345`

## Chạy server

### Development mode

```bash
npm run dev
```

### Production mode

```bash
npm run build
npm start
```

Server sẽ chạy tại `http://localhost:3000`

## API Endpoints

### Health Check

```bash
GET /health
```

### Authentication

Tất cả các endpoint `/calendar/*` yêu cầu Bearer token trong header:

```
Authorization: Bearer clawbot-token-12345
```

### 1. Tạo lịch mới

```bash
POST /calendar/slots
Content-Type: application/json
Authorization: Bearer clawbot-token-12345

{
  "title": "Team Meeting",
  "start_time": "2024-01-15T09:00:00Z",
  "end_time": "2024-01-15T10:00:00Z",
  "type": "meeting"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "title": "Team Meeting",
  "start_time": "2024-01-15T09:00:00Z",
  "end_time": "2024-01-15T10:00:00Z",
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

### 2. Cập nhật lịch

```bash
PUT /calendar/slots/{id}
Content-Type: application/json
Authorization: Bearer clawbot-token-12345

{
  "title": "Updated Meeting",
  "start_time": "2024-01-15T10:00:00Z",
  "end_time": "2024-01-15T11:00:00Z"
}
```

**Response 200:** Trả về slot đã cập nhật

**Error 403:** Không có quyền sửa slot của user khác

### 3. Lấy danh sách lịch

```bash
GET /calendar/slots
Authorization: Bearer clawbot-token-12345
```

**Response 200:**
```json
[
  {
    "id": "uuid",
    "title": "Meeting",
    "start_time": "2024-01-15T09:00:00Z",
    "end_time": "2024-01-15T10:00:00Z",
    "type": "meeting",
    "status": "active"
  }
]
```

### 4. Kiểm tra lịch rảnh/bận

```bash
GET /calendar/availability?from=2024-01-15T00:00:00Z&to=2024-01-15T23:59:59Z
Authorization: Bearer clawbot-token-12345
```

**Response 200:**
```json
{
  "busy": [
    {
      "start": "2024-01-15T09:00:00Z",
      "end": "2024-01-15T10:00:00Z"
    }
  ],
  "free": [
    {
      "start": "2024-01-15T00:00:00Z",
      "end": "2024-01-15T09:00:00Z"
    },
    {
      "start": "2024-01-15T10:00:00Z",
      "end": "2024-01-15T23:59:59Z"
    }
  ]
}
```

## Error Codes

| Code | Mô tả |
|------|-------|
| `MISSING_TOKEN` | Thiếu Authorization header |
| `INVALID_TOKEN` | Token không hợp lệ |
| `MISSING_FIELDS` | Thiếu trường bắt buộc |
| `INVALID_TIMESTAMP` | Timestamp không đúng định dạng ISO 8601 |
| `INVALID_TIME_RANGE` | start_time phải < end_time |
| `TIME_CONFLICT` | Trùng lịch với slot active khác |
| `SLOT_NOT_FOUND` | Không tìm thấy slot |
| `FORBIDDEN` | Không có quyền truy cập |
| `INVALID_TYPE` | Type không hợp lệ (phải là: work, meeting, focus, personal) |

## Deploy lên VPS

### 1. Cài đặt trên VPS

```bash
# Cài Node.js và PostgreSQL
sudo apt update
sudo apt install nodejs npm postgresql

# Clone code
git clone <repo-url>
cd CalendarManager

# Cài dependencies
npm install

# Setup database
sudo -u postgres psql
CREATE DATABASE calendar_manager;
CREATE USER calendar_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE calendar_manager TO calendar_user;
\q

# Cấu hình .env
nano .env
# DATABASE_URL=postgresql://calendar_user:your_password@localhost:5432/calendar_manager

# Build và migrate
npm run build
npm run migrate
```

### 2. Chạy với PM2

```bash
npm install -g pm2
pm2 start dist/index.js --name calendar-api
pm2 save
pm2 startup
```

### 3. Gọi API qua IP

Nếu VPS có IP `123.45.67.89`:

```bash
curl -X POST http://123.45.67.89:3000/calendar/slots \
  -H "Authorization: Bearer clawbot-token-12345" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Meeting",
    "start_time": "2024-01-15T09:00:00Z",
    "end_time": "2024-01-15T10:00:00Z",
    "type": "meeting"
  }'
```

**Lưu ý:** Mở port 3000 trên firewall:
```bash
sudo ufw allow 3000
```

## Nguyên tắc thiết kế

- ✅ Server là nguồn sự thật duy nhất
- ✅ Không trust client - user_id lấy từ token
- ✅ Validation chặt chẽ (time range, overlap)
- ✅ Error codes rõ ràng cho agent
- ✅ Tất cả timestamp lưu dưới dạng UTC
- ✅ Soft delete bằng status = 'cancelled'
- ✅ Deterministic - không dùng AI/heuristic

## Mở rộng sau này

Hệ thống đã được thiết kế để dễ dàng:
- Thêm nhiều user
- Thêm nhiều agent với token riêng
- Phân quyền chi tiết hơn (owner/agent/manager)
- Thêm webhook/notification
- Thêm recurring events

## License

MIT
