Bạn là một senior backend engineer.
Hãy xây dựng phần SERVER cho một MVP hệ thống quản lý lịch làm việc cá nhân.

=== MỤC TIÊU MVP ===
- Chỉ có 1 user (owner)
- Chỉ có 1 agent (Clawbot)
- Agent giao tiếp với server qua HTTP API
- Server KHÔNG dùng AI
- Server là nguồn sự thật duy nhất về lịch

Agent sẽ:
- thêm lịch
- điều chỉnh lịch
- kiểm tra lịch rảnh / bận

Hệ thống phải được thiết kế MỞ để sau này:
- thêm nhiều user
- thêm nhiều agent
- phân quyền bằng token

---

=== YÊU CẦU KỸ THUẬT ===

1. Tech stack:
- Node.js + TypeScript (hoặc FastAPI nếu phù hợp hơn)
- REST API
- PostgreSQL (ưu tiên) hoặc SQLite cho MVP
- Không websocket
- Không message queue

2. Database schema (phải implement):
- users
  - id (UUID)
  - name
  - timezone

- agent_tokens
  - token (string, primary key)
  - user_id (UUID)
  - role (owner | agent | manager)

- calendar_slots
  - id (UUID)
  - user_id (UUID)
  - title (string)
  - start_time (UTC timestamp)
  - end_time (UTC timestamp)
  - type (work | meeting | focus | personal)
  - status (active | cancelled)
  - created_at
  - updated_at

3. Authentication & Authorization:
- Agent gửi header:
  Authorization: Bearer <AGENT_TOKEN>
- Server:
  - map token → user_id
  - agent KHÔNG được gửi user_id trong body
  - mọi insert/update đều gắn user_id từ token
- Agent chỉ được sửa lịch của chính user đó

---

=== API ENDPOINTS CẦN VIẾT ===

1. POST /calendar/slots
- Tạo lịch mới
- Server tự gán user_id từ token
- Validate:
  - start_time < end_time
  - không overlap với slot active khác
- Trả lỗi rõ ràng nếu conflict

2. PUT /calendar/slots/{id}
- Update slot
- Chỉ cho phép nếu slot.user_id == token.user_id

3. GET /calendar/slots
- Lấy danh sách slot của user
- Chỉ trả slot active

4. GET /calendar/availability?from=&to=
- Server tính free/busy
- Không để agent tự tính
- Trả JSON:
  {
    busy: [{ start, end }],
    free: [{ start, end }]
  }

---

=== NGUYÊN TẮC THIẾT KẾ (RẤT QUAN TRỌNG) ===

- Server phải DETERMINISTIC
- Không dùng AI, không heuristic
- Không trust client
- Không để client override user_id
- Tất cả time lưu dưới dạng UTC
- Soft delete bằng status = cancelled
- Error response phải có code máy đọc được (ví dụ: TIME_CONFLICT)

---

=== OUTPUT MONG MUỐN ===

- Code server chạy được
- Có file migration / schema SQL
- Có middleware auth bằng token
- Có validation rõ ràng
- Code gọn, dễ mở rộng
- Không viết thừa feature ngoài phạm vi MVP

Nếu có chỗ chưa rõ, hãy chọn giải pháp ĐƠN GIẢN NHẤT phù hợp MVP.
