# Calendar Manager Backend

Backend API cho hệ thống quản lý lịch làm việc với **multi-user** và **multi-agent** support.

## 🎯 Overview

Hệ thống cho phép:
- **Nhiều user** đăng ký và quản lý lịch riêng
- **Nhiều agent** (OpenClaw, AI assistants) của các user khác nhau sử dụng API
- Mỗi user có thể có nhiều token với các role khác nhau (owner, agent, manager)
- Web interface để test API từ browser
- RESTful API với authentication token-based

## Tech Stack

- **Node.js 22.x** + **TypeScript**
- **Express** - REST API framework
- **PostgreSQL 14+** - Database
- **pg** - PostgreSQL client

## Yêu cầu hệ thống

- Node.js >= 22.x
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
DATABASE_URL=postgresql://calendar_user@localhost:5432/calendar_manager
NODE_ENV=development
```

### 3. Setup PostgreSQL

```bash
# Tạo database và user
sudo -u postgres psql << 'EOF'
CREATE DATABASE calendar_manager;
CREATE USER calendar_user;
GRANT ALL PRIVILEGES ON DATABASE calendar_manager TO calendar_user;
ALTER DATABASE calendar_manager OWNER TO calendar_user;
\q
EOF

# Chạy schema SQL
cat src/db/schema.sql | sudo -u postgres psql -d calendar_manager
```

Schema sẽ tạo:
- Bảng `users`, `agent_tokens`, `calendar_slots`
- Extension `pgcrypto` cho random token generation
- 1 user seed với auto-generated token

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

Server sẽ chạy tại:
- API: `http://localhost:3000`
- Web Interface: `http://localhost:3000` (mở browser)

## 🌐 Web Interface

Mở browser và truy cập `http://localhost:3000` để:
1. **Đăng ký user mới** và nhận token tự động
2. **Tạo calendar slots** với form trực quan
3. **Xem danh sách slots** của bạn
4. **Test API** ngay trên browser

**Từ máy khác trong cùng mạng:**
```bash
# Lấy IP của server
hostname -I | awk '{print $1}'

# Truy cập từ máy khác
http://192.168.x.x:3000
```

## API Endpoints

### Health Check

```bash
GET /health
```

### Authentication Endpoints

#### 1. Đăng ký User mới

```bash
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "timezone": "Asia/Ho_Chi_Minh"
}
```

**Response 201:**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "timezone": "Asia/Ho_Chi_Minh",
    "created_at": "2026-02-06T01:05:00.000Z"
  },
  "token": "xK8vN2mP5qR7sT9uV1wX3yZ4aB6cD8eF0gH2iJ4kL6mN8oP0qR2sT4uV6wX8yZ0a==",
  "role": "owner"
}
```

#### 2. Tạo Token mới cho User

```bash
POST /auth/token
Content-Type: application/json

{
  "user_id": "uuid",
  "role": "agent"
}
```

**Response 201:**
```json
{
  "token": "aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3aB4cD5eF6gH7iJ8kL9mN0oP1q==",
  "role": "agent",
  "created_at": "2026-02-06T01:10:00.000Z"
}
```

### Calendar Endpoints

Tất cả các endpoint `/calendar/*` yêu cầu Bearer token:

```
Authorization: Bearer <your-token>
```

#### 1. Tạo lịch mới

```bash
POST /calendar/slots
Content-Type: application/json
Authorization: Bearer <your-token>

{
  "title": "Team Meeting",
  "start_time": "2026-02-10T09:00:00Z",
  "end_time": "2026-02-10T10:00:00Z",
  "type": "meeting"
}
```

**Timestamp formats hỗ trợ:**
- ISO 8601 với UTC: `2026-02-10T09:00:00Z`
- ISO 8601 với timezone: `2026-02-10T16:00:00+07:00`
- ISO 8601 local: `2026-02-10T16:00:00`

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

#### 2. Cập nhật lịch

```bash
PUT /calendar/slots/{id}
Content-Type: application/json
Authorization: Bearer <your-token>

{
  "title": "Updated Meeting",
  "start_time": "2026-02-10T10:00:00Z",
  "end_time": "2026-02-10T11:00:00Z",
  "status": "cancelled"
}
```

**Các trường có thể update:**
- `title`, `start_time`, `end_time`, `type`
- `status`: `active` hoặc `cancelled`

**Response 200:** Trả về slot đã cập nhật

**Error 403:** Không có quyền sửa slot của user khác

#### 3. Lấy danh sách lịch

```bash
GET /calendar/slots
Authorization: Bearer <your-token>
```

**Response 200:**
```json
[
  {
    "id": "uuid",
    "title": "Meeting",
    "start_time": "2026-02-10T09:00:00.000Z",
    "end_time": "2026-02-10T10:00:00.000Z",
    "start_time_local": "2026-02-10 16:00:00",
    "end_time_local": "2026-02-10 17:00:00",
    "type": "meeting",
    "status": "active"
  }
]
```

**Lưu ý:**
- Chỉ trả về slots có `status = 'active'`
- `start_time`/`end_time`: UTC timestamp
- `start_time_local`/`end_time_local`: GMT+7 (Asia/Ho_Chi_Minh)

#### 4. Kiểm tra lịch rảnh/bận

```bash
GET /calendar/availability?from=2026-02-10T00:00:00Z&to=2026-02-10T23:59:59Z
Authorization: Bearer <your-token>
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
| `INVALID_STATUS` | Status không hợp lệ (phải là: active, cancelled) |
| `AUTH_ERROR` | Lỗi xác thực token |

## 🚀 Deploy lên VPS

### 1. Cài đặt trên VPS

**Xem hướng dẫn chi tiết trong `DEPLOY.md`**

```bash
# Cài Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Cài PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Clone code
mkdir -p ~/app
cd ~/app
git clone git@github.com:jorihn/calendar_manager.git
cd calendar_manager

# Cài dependencies
npm install

# Setup database
sudo -u postgres psql << 'EOF'
CREATE DATABASE calendar_manager;
CREATE USER calendar_user;
GRANT ALL PRIVILEGES ON DATABASE calendar_manager TO calendar_user;
ALTER DATABASE calendar_manager OWNER TO calendar_user;
\q
EOF

# Chạy schema SQL
cat src/db/schema.sql | sudo -u postgres psql -d calendar_manager

# Cấu hình .env
cat > .env << 'EOF'
PORT=3000
DATABASE_URL=postgresql://calendar_user@localhost:5432/calendar_manager
NODE_ENV=production
EOF

# Build
npm run build
```

### 2. Chạy với PM2

```bash
npm install -g pm2
pm2 start dist/index.js --name calendar-api
pm2 save
pm2 startup
```

### 3. Truy cập từ xa

**Web Interface:**
```
http://VPS_IP:3000
```

**API từ OpenClaw/Agent:**
```bash
# 1. Đăng ký user và lấy token
curl -X POST http://VPS_IP:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Agent Name", "timezone": "Asia/Ho_Chi_Minh"}'

# 2. Sử dụng token để gọi API
curl -X POST http://VPS_IP:3000/calendar/slots \
  -H "Authorization: Bearer <token-from-step-1>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Meeting",
    "start_time": "2026-02-10T09:00:00Z",
    "end_time": "2026-02-10T10:00:00Z",
    "type": "meeting"
  }'
```

**Firewall:**
```bash
sudo ufw allow 3000/tcp
sudo ufw status
```

## 🔧 Troubleshooting

### Lỗi PostgreSQL Authentication trên VPS

Nếu gặp lỗi `AUTH_ERROR` hoặc `password authentication failed`:

#### 1. Kiểm tra PostgreSQL đang chạy
```bash
sudo systemctl status postgresql
sudo netstat -tlnp | grep 5432
```

#### 2. Kiểm tra user và database tồn tại
```bash
sudo -u postgres psql -c "\du calendar_user"
sudo -u postgres psql -c "\l calendar_manager"
```

#### 3. Kiểm tra pg_hba.conf
```bash
sudo cat /etc/postgresql/*/main/pg_hba.conf | grep -E "^host.*127.0.0.1"
```

**Nên có dòng:**
```
host    all    all    127.0.0.1/32    trust
```

Nếu không có hoặc sai, sửa lại:
```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Thêm hoặc sửa dòng:
host    all    all    127.0.0.1/32    trust

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### 4. Tạo lại user nếu cần
```bash
sudo -u postgres psql << 'EOF'
DROP USER IF EXISTS calendar_user;
CREATE USER calendar_user;
GRANT ALL PRIVILEGES ON DATABASE calendar_manager TO calendar_user;
ALTER DATABASE calendar_manager OWNER TO calendar_user;
\q
EOF
```

#### 5. Test connection
```bash
psql -U calendar_user -d calendar_manager -h localhost -c "SELECT 1;"
```

#### 6. Kiểm tra .env
```bash
cat ~/app/calendar_manager/.env
# Phải có: DATABASE_URL=postgresql://calendar_user@localhost:5432/calendar_manager
```

#### 7. Restart PM2
```bash
pm2 delete calendar-api
pm2 start dist/index.js --name calendar-api
pm2 logs calendar-api --lines 50
```

### Lỗi Port đã được sử dụng
```bash
# Tìm process đang dùng port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>
```

### Lỗi Permission Denied khi chạy schema.sql
```bash
# Dùng pipe thay vì file path
cat src/db/schema.sql | sudo -u postgres psql -d calendar_manager
```

## Nguyên tắc thiết kế

- ✅ Server là nguồn sự thật duy nhất
- ✅ Không trust client - user_id lấy từ token
- ✅ Validation chặt chẽ (time range, overlap)
- ✅ Error codes rõ ràng cho agent
- ✅ Tất cả timestamp lưu dưới dạng UTC
- ✅ Soft delete bằng status = 'cancelled'
- ✅ Deterministic - không dùng AI/heuristic

## 📚 Tài liệu khác

- **`DEPLOY.md`** - Hướng dẫn deploy chi tiết lên VPS
- **`API_GUIDE.md`** - Hướng dẫn sử dụng API với curl examples
- **`src/db/schema.sql`** - Database schema

## 🔮 Roadmap

Hệ thống hiện tại đã hỗ trợ:
- ✅ Multi-user và multi-agent
- ✅ Token-based authentication
- ✅ Web interface
- ✅ Timezone support
- ✅ Conflict detection

Có thể mở rộng:
- Webhook/notification khi có calendar changes
- Recurring events
- Calendar sharing giữa users
- OAuth integration

## License

MIT
