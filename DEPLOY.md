# Hướng dẫn Deploy lên VPS

## Yêu cầu VPS

- Ubuntu 20.04+ hoặc Debian 11+
- RAM: tối thiểu 1GB
- Có quyền sudo
- Địa chỉ IP public

## Bước 1: Cài đặt môi trường

```bash
# SSH vào VPS
ssh user@your-vps-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Cài Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Kiểm tra version
node --version  # v22.x.x
npm --version   # 10.x.x

# Cài PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Kiểm tra PostgreSQL đang chạy
sudo systemctl status postgresql
```

## Bước 2: Tạo Database và User

```bash
# Đăng nhập PostgreSQL
sudo -u postgres psql

# Trong PostgreSQL console:
CREATE DATABASE calendar_manager;
CREATE USER calendar_user WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE calendar_manager TO calendar_user;
ALTER DATABASE calendar_manager OWNER TO calendar_user;
\q
```

## Bước 3: Deploy code

```bash
# Tạo thư mục cho app
mkdir -p ~/apps
cd ~/apps

# Clone code (hoặc upload qua scp/rsync)
# Nếu dùng git:
git clone <your-repo-url> calendar-manager
cd calendar-manager

# Nếu upload thủ công từ máy local:
# scp -r /path/to/CalendarManager user@vps-ip:~/apps/calendar-manager

# Cài dependencies
npm install

# Tạo file .env
nano .env
```

Nội dung file `.env`:

```env
PORT=3000
DATABASE_URL=postgresql://calendar_user:your_secure_password_here@localhost:5432/calendar_manager
NODE_ENV=production
```

```bash
# Chạy schema SQL để tạo tables và seed data
sudo -u postgres psql -d calendar_manager -f ~/apps/calendar-manager/src/db/schema.sql

# Lấy token đã được auto-generate
sudo -u postgres psql -d calendar_manager -c "SELECT token, role FROM agent_tokens;"
```

**Lưu ý:** Copy và lưu token này, bạn sẽ cần nó để authenticate API requests.

```bash
# Build TypeScript
npm run build
```

## Bước 4: Cài đặt PM2 (Process Manager)

```bash
# Cài PM2 global
sudo npm install -g pm2

# Start app với PM2
pm2 start dist/index.js --name calendar-api

# Xem logs
pm2 logs calendar-api

# Xem status
pm2 status

# Setup PM2 tự động khởi động khi VPS reboot
pm2 startup
# Copy và chạy command mà PM2 suggest

pm2 save
```

## Bước 5: Mở port firewall

```bash
# Nếu dùng UFW
sudo ufw allow 3000/tcp
sudo ufw status

# Nếu dùng iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables-save
```

## Bước 6: Test API

Từ máy local, test API qua IP:

```bash
# Thay YOUR_VPS_IP bằng IP thực của VPS
curl http://YOUR_VPS_IP:3000/health

# Test với token (thay YOUR_TOKEN bằng token lấy được từ database)
curl -X POST http://YOUR_VPS_IP:3000/calendar/slots \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Meeting",
    "start_time": "2024-01-15T09:00:00Z",
    "end_time": "2024-01-15T10:00:00Z",
    "type": "meeting"
  }'
```

## Trả lời câu hỏi: Gọi API qua IP có được không?

**CÓ, hoàn toàn được!**

Ví dụ VPS có IP `123.45.67.89`:

```bash
# API endpoint sẽ là:
http://123.45.67.89:3000/calendar/slots

# Agent (Clawbot) gọi API:
curl -X GET http://123.45.67.89:3000/calendar/slots \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Không cần domain** để gọi API. Domain chỉ cần khi:
- Muốn dùng HTTPS với SSL certificate từ Let's Encrypt
- Muốn URL đẹp hơn (api.example.com thay vì 123.45.67.89)

Với MVP, dùng HTTP + IP là đủ.

## Bước 7 (Optional): Setup Nginx Reverse Proxy

Nếu muốn chạy trên port 80 thay vì 3000:

```bash
# Cài Nginx
sudo apt install -y nginx

# Tạo config
sudo nano /etc/nginx/sites-available/calendar-api
```

Nội dung config:

```nginx
server {
    listen 80;
    server_name YOUR_VPS_IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/calendar-api /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Mở port 80
sudo ufw allow 80/tcp
```

Giờ có thể gọi API qua port 80:

```bash
curl http://YOUR_VPS_IP/health
```

## Quản lý PM2

```bash
# Xem logs real-time
pm2 logs calendar-api

# Restart app
pm2 restart calendar-api

# Stop app
pm2 stop calendar-api

# Xem resource usage
pm2 monit

# Xem danh sách processes
pm2 list
```

## Update code

```bash
cd ~/apps/calendar-manager

# Pull code mới (nếu dùng git)
git pull

# Hoặc upload file mới qua scp

# Rebuild
npm install
npm run build

# Restart PM2
pm2 restart calendar-api
```

## Troubleshooting

### Lỗi kết nối database

```bash
# Kiểm tra PostgreSQL đang chạy
sudo systemctl status postgresql

# Kiểm tra connection string trong .env
cat .env

# Test connection thủ công
psql -U calendar_user -d calendar_manager -h localhost
```

### Lỗi port đã được sử dụng

```bash
# Tìm process đang dùng port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>
```

### Xem logs

```bash
# PM2 logs
pm2 logs calendar-api --lines 100

# System logs
journalctl -u postgresql -n 50
```

## Bảo mật

1. **Token được tự động generate:** Token sử dụng `gen_random_bytes(32)` được encode base64, rất an toàn. Lưu token cẩn thận và không share public.

2. **Tạo token mới cho agent khác:**

```sql
sudo -u postgres psql calendar_manager
INSERT INTO agent_tokens (user_id, role) 
VALUES ('00000000-0000-0000-0000-000000000001', 'agent');
SELECT token FROM agent_tokens ORDER BY created_at DESC LIMIT 1;
```

3. **Firewall:** Chỉ mở port cần thiết
4. **PostgreSQL:** Không cho phép remote connection nếu không cần
5. **Regular updates:** `sudo apt update && sudo apt upgrade`

## Monitoring

```bash
# Xem resource usage
htop

# Xem disk space
df -h

# Xem memory
free -h

# PM2 monitoring
pm2 monit
```
