# Calendar Manager API Guide

## Setup Server trên máy local

### 1. Khởi động server
```bash
npm run build
npm start
```

Server sẽ chạy trên `0.0.0.0:3000` và có thể truy cập từ các máy khác trong cùng mạng.

### 2. Lấy IP của máy server
```bash
# Linux/Mac
hostname -I | awk '{print $1}'

# Hoặc
ip addr show | grep "inet " | grep -v 127.0.0.1
```

Ví dụ IP: `192.168.1.100`

### 3. Mở firewall (nếu cần)
```bash
# Ubuntu/Debian
sudo ufw allow 3000/tcp

# Hoặc tắt firewall tạm thời để test
sudo ufw disable
```

## API Endpoints

### 1. Đăng ký User mới

**Endpoint:** `POST /auth/register`

**Request:**
```bash
curl -X POST http://192.168.1.100:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "timezone": "Asia/Ho_Chi_Minh"
  }'
```

**Response:**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "timezone": "Asia/Ho_Chi_Minh",
    "created_at": "2026-02-06T01:05:00.000Z"
  },
  "token": "xK8vN2mP5qR7sT9uV1wX3yZ4aB6cD8eF0gH2iJ4kL6mN8oP0qR2sT4uV6wX8yZ0a==",
  "role": "owner"
}
```

**Lưu token này để sử dụng cho các API calls sau!**

### 2. Tạo Token mới cho User hiện có

**Endpoint:** `POST /auth/token`

**Request:**
```bash
curl -X POST http://192.168.1.100:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "role": "agent"
  }'
```

**Response:**
```json
{
  "token": "aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3aB4cD5eF6gH7iJ8kL9mN0oP1q==",
  "role": "agent",
  "created_at": "2026-02-06T01:10:00.000Z"
}
```

### 3. Tạo Calendar Slot

**Endpoint:** `POST /calendar/slots`

**Headers:** `Authorization: Bearer <token>`

**Request:**
```bash
curl -X POST http://192.168.1.100:3000/calendar/slots \
  -H "Authorization: Bearer xK8vN2mP5qR7sT9uV1wX3yZ4aB6cD8eF0gH2iJ4kL6mN8oP0qR2sT4uV6wX8yZ0a==" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Team Meeting",
    "start_time": "2026-02-10T09:00:00Z",
    "end_time": "2026-02-10T10:00:00Z",
    "type": "meeting"
  }'
```

**Response:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Team Meeting",
  "start_time": "2026-02-10T09:00:00.000Z",
  "end_time": "2026-02-10T10:00:00.000Z",
  "type": "meeting",
  "status": "active",
  "created_at": "2026-02-06T01:15:00.000Z",
  "updated_at": "2026-02-06T01:15:00.000Z"
}
```

### 4. Lấy danh sách Slots

**Endpoint:** `GET /calendar/slots`

**Headers:** `Authorization: Bearer <token>`

**Request:**
```bash
curl -X GET http://192.168.1.100:3000/calendar/slots \
  -H "Authorization: Bearer xK8vN2mP5qR7sT9uV1wX3yZ4aB6cD8eF0gH2iJ4kL6mN8oP0qR2sT4uV6wX8yZ0a=="
```

### 5. Cập nhật Slot

**Endpoint:** `PUT /calendar/slots/:id`

**Headers:** `Authorization: Bearer <token>`

**Request:**
```bash
curl -X PUT http://192.168.1.100:3000/calendar/slots/660e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer xK8vN2mP5qR7sT9uV1wX3yZ4aB6cD8eF0gH2iJ4kL6mN8oP0qR2sT4uV6wX8yZ0a==" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Meeting",
    "status": "cancelled"
  }'
```

### 6. Kiểm tra Availability

**Endpoint:** `GET /calendar/availability?from=<timestamp>&to=<timestamp>`

**Headers:** `Authorization: Bearer <token>`

**Request:**
```bash
curl -X GET "http://192.168.1.100:3000/calendar/availability?from=2026-02-10T00:00:00Z&to=2026-02-10T23:59:59Z" \
  -H "Authorization: Bearer xK8vN2mP5qR7sT9uV1wX3yZ4aB6cD8eF0gH2iJ4kL6mN8oP0qR2sT4uV6wX8yZ0a=="
```

## Flow sử dụng từ máy khác

### Bước 1: Đăng ký user
```bash
curl -X POST http://192.168.1.100:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "My Name", "timezone": "Asia/Ho_Chi_Minh"}'
```

Lưu `token` từ response.

### Bước 2: Sử dụng token để gọi API
```bash
TOKEN="<token_from_step_1>"

curl -X POST http://192.168.1.100:3000/calendar/slots \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Meeting",
    "start_time": "2026-02-10T09:00:00Z",
    "end_time": "2026-02-10T10:00:00Z",
    "type": "meeting"
  }'
```

## Troubleshooting

### Không kết nối được từ máy khác

1. **Kiểm tra firewall:**
   ```bash
   sudo ufw status
   sudo ufw allow 3000/tcp
   ```

2. **Kiểm tra server đang listen đúng interface:**
   ```bash
   sudo netstat -tlnp | grep 3000
   # Phải thấy: 0.0.0.0:3000 (không phải 127.0.0.1:3000)
   ```

3. **Ping thử máy server:**
   ```bash
   ping 192.168.1.100
   ```

4. **Test health endpoint:**
   ```bash
   curl http://192.168.1.100:3000/health
   ```

### Lỗi AUTH_ERROR

- Token sai hoặc đã hết hạn
- Đăng ký user mới và lấy token mới
