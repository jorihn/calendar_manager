Xây dựng API Server cho hệ thống OKR (Objective – Key Result – Task)
0️⃣ Mục tiêu hệ thống

Xây dựng REST API server dùng để:

Lưu trữ OKR (Objective, Key Result)

Lưu trữ Task đã được openClaw local xác nhận

Cho phép truy vấn lại để review, trace đóng góp

Nguyên tắc bắt buộc

API server KHÔNG có AI

API server KHÔNG brainstorm

API server KHÔNG suy luận OKR

API server chỉ lưu & trả dữ liệu

1️⃣ Tech stack đề xuất

Có thể thay đổi nếu cần, nhưng mặc định như sau:

Runtime: Node.js 20+

Framework: Fastify (hoặc Express nếu quen)

Database: PostgreSQL

ORM: Prisma

Auth: API key hoặc JWT (đơn giản)

Validation: Zod

2️⃣ Data Model (bắt buộc theo spec)
2.1 Objective
Objective {
  id            string (uuid, pk)
  title         string
  description   string?
  type          "work" | "personal"
  horizon       "week" | "month" | "quarter" | "year"
  success_def   string?
  status        "active" | "archived"
  created_at    timestamp
}

2.2 Key Result
KeyResult {
  id            string (uuid, pk)
  objective_id  string (fk -> Objective.id)
  title         string
  type          "metric" | "milestone" | "boolean"
  target        string?
  current       string?
  confidence    float?
  created_at    timestamp
}

2.3 Task
Task {
  id            string (uuid, pk)
  title         string
  description   string?
  category      "work" | "personal"
  objective_id  string? (fk)
  kr_id         string? (fk)
  estimate      integer?
  priority      "low" | "medium" | "high" | "critical"
  impact_note   string?
  status        "todo" | "doing" | "done"
  created_at    timestamp
  completed_at  timestamp?
}

3️⃣ Database rules (quan trọng)

Task.kr_id optional

Nếu category = personal:

objective_id và kr_id có thể NULL

API server KHÔNG kiểm tra:

task có đúng KR không

KR có đúng Objective không
→ openClaw chịu trách nhiệm logic

4️⃣ REST API Endpoints
4.1 Objective APIs
POST   /objectives
GET    /objectives
GET    /objectives/:id
PATCH  /objectives/:id
DELETE /objectives/:id   // archive, không hard delete

4.2 Key Result APIs
POST   /key-results
GET    /key-results?objective_id=
GET    /key-results/:id
PATCH  /key-results/:id
DELETE /key-results/:id

4.3 Task APIs
POST   /tasks
GET    /tasks
GET    /tasks/:id
PATCH  /tasks/:id
POST   /tasks/:id/complete

5️⃣ Validation rules (chỉ ở mức schema)

Ví dụ Zod cho Task:

TaskSchema = {
  title: string.min(1),
  category: enum(["work", "personal"]),
  objective_id?: string,
  kr_id?: string,
  priority?: enum(["low", "medium", "high", "critical"])
}


🚫 Không validate business logic OKR

6️⃣ API Contract: nguyên tắc cực kỳ quan trọng
❗ API server chỉ nhận dữ liệu đã hoàn chỉnh

Ví dụ:

POST /tasks
{
  "title": "Fix bug provider list",
  "category": "work",
  "objective_id": "obj-001",
  "kr_id": "kr-002",
  "priority": "critical"
}


👉 API server:

không hỏi lại

không sửa

không đoán

7️⃣ Không làm những việc sau (CẤM)

❌ Không auto-generate OKR

❌ Không auto-link task → KR

❌ Không summary

❌ Không progress scoring

❌ Không recommendation

8️⃣ OpenAPI / Swagger

Generate OpenAPI spec từ code

openClaw sẽ dùng spec này để generate client

9️⃣ Test cases tối thiểu (bắt buộc)

Tạo Objective → OK

Tạo KR gắn Objective → OK

Tạo Task gắn KR → OK

Tạo Task personal không có KR → OK

Query Objective → thấy KR → thấy Task

🔚 Kết luận cho Windsurf

Đây là storage + ledger service, không phải AI service.
Mọi trí tuệ nằm ở openClaw local.