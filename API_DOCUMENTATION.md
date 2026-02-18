# AI-Native OKR & Calendar API Documentation (V2)

> **Skill Guide cho AI Agents (OpenClaw, etc.)**
> 
> Hệ thống AI-native execution system: Backend tính toán scores, AI Agent reasoning dựa trên pre-computed data.

---

## 🔑 Xác thực (Authentication)

Tất cả API (trừ `/auth/*` và `/health`) yêu cầu Bearer token:

```
Authorization: Bearer <your-token>
```

### POST /auth/register

Đăng ký user mới, tự động nhận token.

```http
POST /auth/register
Content-Type: application/json

{
  "name": "Agent Name",
  "timezone": "Asia/Ho_Chi_Minh"
}
```

**Response 201:**
```json
{
  "user": { "id": "uuid", "name": "Agent Name", "timezone": "Asia/Ho_Chi_Minh" },
  "token": "xK8vN2mP5qR7sT9u...",
  "role": "owner"
}
```

### POST /auth/token

Tạo thêm token cho user.

```http
POST /auth/token
Content-Type: application/json

{ "user_id": "uuid", "role": "agent" }
```

| Role | Mô tả |
|------|-------|
| `owner` | Full quyền |
| `agent` | AI agent, đọc/ghi |
| `manager` | Quản lý, đọc/ghi |

---

## 🏢 Organizations API

Quản lý tổ chức và thành viên.

### POST /organizations

```http
POST /organizations
Authorization: Bearer <token>
Content-Type: application/json

{ "name": "My Company", "description": "Optional description" }
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `name` | string | ✅ | Tên tổ chức |
| `description` | string | ❌ | Mô tả |

Người tạo tự động là `owner`. Response 201 trả về organization object.

### GET /organizations

List tổ chức mà user là thành viên. Response kèm `my_role`.

### GET /organizations/:id

Chi tiết tổ chức (phải là member).

### PATCH /organizations/:id

Update name/description (owner/admin only).

### GET /organizations/:id/members

List thành viên. Response:
```json
[{ "id": "member_id", "role": "owner", "user_id": "uuid", "user_name": "John" }]
```

### POST /organizations/:id/members

Thêm thành viên (owner/admin only).

```json
{ "user_id": "uuid", "role": "member" }
```

### POST /organizations/:id/invite

Tạo invite code cho organization (owner/admin only). Mỗi lần gọi sẽ tạo code mới, thay thế code cũ.

```http
POST /organizations/{id}/invite
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "message": "Invite code generated",
  "invite_code": "aB3xK9mN",
  "org_name": "My Company"
}
```

### POST /organizations/join

Agent/user tự join organization bằng invite code.

```http
POST /organizations/join
Authorization: Bearer <token>
Content-Type: application/json

{ "code": "aB3xK9mN" }
```

**Response 201:**
```json
{
  "message": "Joined organization",
  "org_id": "uuid",
  "org_name": "My Company",
  "role": "member"
}
```

| Error | Mô tả |
|-------|--------|
| `INVALID_INVITE_CODE` (404) | Code không tồn tại hoặc hết hạn |
| `MEMBER_EXISTS` (409) | User đã là thành viên |

### DELETE /organizations/:id/members/:memberId

Xóa thành viên (owner/admin only, không thể xóa owner).

---

## 🔄 Cycles API

Quản lý chu kỳ OKR (tuần, tháng, quý, năm).

### POST /cycles

```http
POST /cycles
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Q1 2026",
  "type": "quarter",
  "start_date": "2026-01-01",
  "end_date": "2026-03-31",
  "org_id": "uuid"
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `name` | string | ✅ | Tên cycle |
| `type` | enum | ✅ | `week`, `month`, `quarter`, `year` |
| `start_date` | date | ✅ | Ngày bắt đầu (YYYY-MM-DD) |
| `end_date` | date | ✅ | Ngày kết thúc (YYYY-MM-DD) |
| `org_id` | UUID | ❌ | Link tới tổ chức |

### GET /cycles

```http
GET /cycles?type=quarter&status=active&org_id={uuid}
```

| Query | Mô tả |
|-------|-------|
| `type` | Filter `week`, `month`, `quarter`, `year` |
| `status` | `active` (default), `closed` |
| `org_id` | Filter theo org |

### GET /cycles/:id

### PATCH /cycles/:id

Update name, type, start_date, end_date.

### POST /cycles/:id/close

Đóng cycle. Response: `{ "message": "Cycle closed", "cycle": {...} }`

---

## 📅 Calendar API

### POST /calendar/slots

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

### GET /calendar/slots

Trả về slots `status = 'active'`, kèm `start_time_local`/`end_time_local` (GMT+7).

### PUT /calendar/slots/:id

| Field | Type | Mô tả |
|-------|------|-------|
| `title` | string | Tiêu đề mới |
| `start_time` | ISO 8601 | Thời gian bắt đầu mới |
| `end_time` | ISO 8601 | Thời gian kết thúc mới |
| `type` | enum | `work`, `meeting`, `focus`, `personal` |
| `status` | enum | `active`, `cancelled`, `done` |

### GET /calendar/availability

```http
GET /calendar/availability?from=2026-02-15T00:00:00Z&to=2026-02-15T23:59:59Z
```

Response: `{ "busy": [...], "free": [...] }`

---

## 🎯 OKR API

### Objectives

#### POST /objectives

```http
POST /objectives
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Increase MRR to $50k",
  "type": "work",
  "horizon": "quarter",
  "org_id": "uuid",
  "cycle_id": "uuid",
  "description": "...",
  "success_def": "MRR reaches $50k"
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `title` | string | ✅ | Tiêu đề |
| `type` | enum | ✅ | `work`, `personal` |
| `horizon` | enum | ✅ | `week`, `month`, `quarter`, `year` |
| `org_id` | UUID | ❌ | Link tới organization |
| `cycle_id` | UUID | ❌ | Link tới cycle |
| `description` | string | ❌ | Mô tả |
| `success_def` | string | ❌ | Định nghĩa thành công |

**Response kèm computed fields:**
```json
{
  "id": "uuid",
  "progress": 0,
  "risk_score": 0,
  "status": "active",
  ...
}
```

#### GET /objectives

```http
GET /objectives?type=work&horizon=quarter&org_id={uuid}&cycle_id={uuid}&status=active
```

#### GET /objectives/:id

#### PATCH /objectives/:id

Có thể update: title, description, type, horizon, success_def, status, org_id, cycle_id.

#### DELETE /objectives/:id

Soft delete → `status = 'archived'`.

---

### Key Results

#### POST /key-results

```http
POST /key-results
Authorization: Bearer <token>
Content-Type: application/json

{
  "objective_id": "uuid",
  "title": "MRR reaches $50k",
  "type": "metric",
  "target": "50000",
  "current": "20000",
  "confidence": 0.7,
  "parent_kr_id": "uuid",
  "importance_weight": 0.8
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `objective_id` | UUID | ✅ | ID objective |
| `title` | string | ✅ | Tiêu đề KR |
| `type` | enum | ✅ | `metric`, `milestone`, `boolean` |
| `target` | string | ❌ | Giá trị mục tiêu |
| `current` | string | ❌ | Giá trị hiện tại |
| `confidence` | float | ❌ | 0–1 |
| `parent_kr_id` | UUID | ❌ | Parent KR (tạo nested hierarchy) |
| `importance_weight` | float | ❌ | 0–1 (default: 1) |

**KR Hierarchy:**
- Nếu `parent_kr_id` được cung cấp, `root_kr_id` và `level` được tính tự động
- KR gốc: `level=0`, `parent_kr_id=null`
- Child KR: `level=parent.level+1`, `root_kr_id=top-level KR id`

**Response kèm computed fields:**
```json
{
  "id": "uuid",
  "progress": 0.4,
  "risk_score": 0.3,
  "velocity": 0.05,
  "level": 0,
  "root_kr_id": null,
  ...
}
```

#### GET /key-results

```http
GET /key-results?objective_id={uuid}&parent_kr_id={uuid}&root_only=true
```

| Query | Mô tả |
|-------|-------|
| `objective_id` | Filter theo objective |
| `parent_kr_id` | Filter children của 1 KR |
| `root_only` | `true` → chỉ KR gốc (parent_kr_id IS NULL) |

#### PATCH /key-results/:id

Có thể update: title, type, target, current, confidence, importance_weight.
**Khi update `current` → tự động recompute progress, risk, velocity cascade lên objective.**

#### DELETE /key-results/:id

Hard delete.

---

### Initiatives

Initiative = hướng làm, scope lớn, thời gian kéo dài, chứa nhiều tasks.

#### POST /initiatives

```http
POST /initiatives
Authorization: Bearer <token>
Content-Type: application/json

{
  "kr_id": "uuid",
  "title": "Enterprise Sales Campaign",
  "description": "Focused outreach to enterprise accounts",
  "assignee_id": "uuid (optional, default = creator)"
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `kr_id` | UUID | ✅ | Link tới key result |
| `title` | string | ✅ | Tiêu đề initiative |
| `description` | string | ❌ | Mô tả |
| `assignee_id` | UUID | ❌ | Người thực hiện (default: creator) |

#### GET /initiatives

```http
GET /initiatives?kr_id={uuid}&status=active&assignee_id=me
```

| Query | Mô tả |
|-------|-------|
| `kr_id` | Filter theo key result |
| `status` | `active`, `done`, `cancelled` |
| `assignee_id` | `me` hoặc UUID — filter theo người thực hiện |

#### GET /initiatives/:id

#### PATCH /initiatives/:id

Update: title, description, status, **assignee_id**.

#### DELETE /initiatives/:id

Soft delete → `status = 'cancelled'`.

---

### Parking Lot

Parking Lot = nơi lưu tạm các task/ý tưởng **off-topic** (chưa đưa vào OKR hiện tại), để review ở cycle sau.

Fields chính:
- `item` — tên task/ý tưởng
- `description` — mô tả + lý do cần làm
- `context` — ngữ cảnh lúc nghĩ ra
- `owner_id` — người nghĩ ra (từ token)
- `priority` — `high` | `low`
- `proposed_cycle` — cycle dự kiến (string)
- `status` — `open` | `parked`
- `created_at` — thời điểm tạo

#### POST /parking-lot

```http
POST /parking-lot
Authorization: Bearer <token>
Content-Type: application/json

{
  "item": "Add Telegram purchase flow",
  "description": "Need a clean flow so users can buy agent plans",
  "context": "Came up while designing the onboarding for close alpha",
  "priority": "high",
  "proposed_cycle": "Q2 2026",
  "status": "open"
}
```

#### GET /parking-lot

```http
GET /parking-lot
GET /parking-lot?status=open
GET /parking-lot?priority=high
Authorization: Bearer <token>
```

#### GET /parking-lot/:id

```http
GET /parking-lot/{id}
Authorization: Bearer <token>
```

#### PATCH /parking-lot/:id

Update fields: `item`, `description`, `context`, `priority`, `proposed_cycle`, `status`.

```http
PATCH /parking-lot/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "parked",
  "context": "Need to discuss scope with team before moving to OKR"
}
```

> Note: `owner_id` is derived from token; items are only visible/editable by their owner.

---

### Tasks

Task = đơn vị nhỏ, thi hành được, có due date rõ ràng.

#### POST /tasks

```http
POST /tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Prepare enterprise pitch deck",
  "category": "work",
  "objective_id": "uuid",
  "kr_id": "uuid",
  "initiative_id": "uuid",
  "assignee_id": "uuid (optional, default = creator)",
  "priority": "high",
  "due_date": "2026-02-15T17:00:00+07:00",
  "blocking": false,
  "estimate": 120,
  "impact_note": "Critical for Q1 target",
  "dod": "Deck reviewed by team lead, all slides finalized",
  "outcome": "Enterprise clients receive a compelling pitch deck"
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `title` | string | ✅ | Tiêu đề |
| `category` | enum | ✅ | `work`, `personal` |
| `objective_id` | UUID | ❌ | Link objective |
| `kr_id` | UUID | ❌ | Link key result |
| `initiative_id` | UUID | ❌ | Link initiative |
| `assignee_id` | UUID | ❌ | Người thực hiện (default: creator) |
| `priority` | enum | ❌ | `low`, `medium`, `high`, `critical` (default: medium) |
| `due_date` | ISO 8601 | ❌ | Deadline |
| `blocking` | boolean | ❌ | Task này đang block tiến trình? (default: false) |
| `estimate` | integer | ❌ | Thời gian ước tính (phút) |
| `impact_note` | string | ❌ | Ghi chú tác động |
| `dod` | string | ❌ | Definition of Done — tiêu chí hoàn thành task |
| `outcome` | string | ❌ | Kết quả mong muốn khi task hoàn thành |

**Auto-computed fields:**
- `root_kr_id` — denormalized từ KR hierarchy
- `priority_score` — computed từ priority + KR risk + deadline proximity
- `alignment_depth` — số hops từ task tới objective

**Khi task được tạo/update/complete → tự động recompute scores cascade lên KR → Objective → Snapshot.**

#### GET /tasks

```http
GET /tasks?category=work&status=todo&priority=critical&kr_id={uuid}&initiative_id={uuid}&blocking=true&assignee_id=me
```

**Kết quả sorted theo `priority_score DESC`.**

| Query | Mô tả |
|-------|-------|
| `category` | `work`, `personal` |
| `status` | `todo`, `doing`, `done` |
| `priority` | `low`, `medium`, `high`, `critical` |
| `objective_id` | Filter theo objective |
| `kr_id` | Filter theo key result |
| `initiative_id` | Filter theo initiative |
| `blocking` | `true` → chỉ blocking tasks |
| `assignee_id` | `me` hoặc UUID — filter theo người thực hiện |

#### GET /tasks/my-work/assigned

Tasks được giao cho user hiện tại, kèm **full hierarchy context** (KR, Objective, Initiative).

```http
GET /tasks/my-work/assigned
GET /tasks/my-work/assigned?status=doing
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "Prepare pitch deck",
    "priority_score": 0.85,
    "status": "todo",
    "assignee_id": "uuid",
    "kr_title": "MRR $50k",
    "kr_progress": 0.4,
    "kr_risk_score": 0.7,
    "objective_title": "Increase Revenue",
    "objective_progress": 0.35,
    "initiative_title": "Enterprise Sales Campaign",
    "created_by_name": "Jori"
  }
]
```

Default: chỉ tasks chưa done. Dùng `?status=done` để xem completed.

#### PATCH /tasks/:id

Có thể update: title, description, category, objective_id, kr_id, initiative_id, estimate, priority, impact_note, status, due_date, blocking, **assignee_id**, **dod**, **outcome**, **outcome_score**, **dod_review_status**, **dod_review_note**,
**progress_percent**, **progress_note**, **next_action**, **blocked_reason**, **last_worked_at**.

| Field | Type | Mô tả |
|-------|------|-------|
| `outcome_score` | float | 0–1, AI-scored quality of outcome |
| `dod_review_status` | enum | `passed`, `needs_revision`, `partial` |
| `dod_review_note` | string | Ghi chú review DoD |
| `dod_confirmed` | boolean | Bắt buộc khi set `status: "done"` nếu task có `dod` |
| `progress_percent` | int | 0–100, % tiến độ (nullable) |
| `progress_note` | string | Ghi chú tiến độ/handoff (nullable) |
| `next_action` | string | Bước tiếp theo để làm tiếp ngày mai (nullable) |
| `blocked_reason` | string | Lý do bị block (nullable) |
| `last_worked_at` | timestamp | Lần cuối task được “đụng” (auto update khi status=doing hoặc update progress fields) |
| `progress_score` | float | 0–1, server-evaluated (non-blocking) từ progress_note/next_action/DoD/outcome |

> **⚠️ DoD Gate:** Khi PATCH `status` → `done`, nếu task có field `dod`, server sẽ trả `DOD_NOT_CONFIRMED` (400) trừ khi gửi kèm `dod_confirmed: true`.
>
> **📝 Daily hand-off (khuyến nghị):** Khi set `status: "doing"`, nên gửi thêm ít nhất một trong `progress_note` hoặc `next_action` để hôm sau/agent khác tiếp tục mượt hơn. Server sẽ không hard-fail nếu thiếu (có thể trả warning header).

#### POST /tasks/:id/complete

Đánh dấu hoàn thành. Tự set `status='done'`, `completed_at=now()`.

```http
POST /tasks/{id}/complete
Authorization: Bearer <token>
Content-Type: application/json

{
  "dod_confirmed": true,
  "outcome_score": 0.85
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `dod_confirmed` | boolean | Conditional | Bắt buộc nếu task có `dod` |
| `outcome_score` | float | ❌ | 0–1, chất lượng outcome (AI Agent scoring) |

> **⚠️ DoD Gate:** Nếu task có `dod` mà không gửi `dod_confirmed: true`, server trả:
> ```json
> {
>   "code": "DOD_NOT_CONFIRMED",
>   "message": "Task has Definition of Done criteria...",
>   "dod": "Unit tests pass, code reviewed, deployed to staging"
> }
> ```

> **📊 Outcome Score:** Khi task complete với `outcome_score`, score này ảnh hưởng đến KR progress cho milestone KRs. Task có `outcome_score: 0.5` chỉ contribute 50% thay vì 100%.

---

## 👁️ Visibility Rules (Multi-user)

User có thể thấy data trong các trường hợp sau:

| Entity | Quy tắc visibility |
|--------|--------------------|
| **Objectives** | `user_id = me` HOẶC objective thuộc org mà tôi là member |
| **Key Results** | `user_id = me` HOẶC KR thuộc objective visible |
| **Tasks** | `user_id = me` HOẶC `assignee_id = me` HOẶC task thuộc objective visible |
| **Initiatives** | `user_id = me` HOẶC `assignee_id = me` HOẶC initiative thuộc KR/objective visible |

**Phân biệt `user_id` vs `assignee_id`:**
- `user_id` = người tạo (creator)
- `assignee_id` = người thực hiện (nếu không set, default = creator)

**Workflow giao việc:**
1. Owner tạo org, invite members
2. Owner tạo objectives, KRs với `org_id`
3. Owner tạo tasks/initiatives với `assignee_id` = member's user_id
4. Member gọi `GET /tasks/my-work/assigned` để xem tasks của mình + context
5. Member gọi `PATCH /tasks/:id` để update status
6. Scoring cascade tự động cập nhật scores

---

## 🤖 AI Agent Endpoints

**Đây là core của hệ thống — endpoints tối ưu cho AI reasoning.**

Backend tính toán TẤT CẢ scores (progress, risk, velocity, priority). AI Agent chỉ đọc kết quả và reasoning.

### GET /ai/snapshot

Snapshot compact, tối ưu token cho LLM.

```http
GET /ai/snapshot
GET /ai/snapshot?cycle_id={uuid}
Authorization: Bearer <token>
```

**Response (short keys để tiết kiệm token):**
```json
{
  "ts": "2026-02-12T07:00:00Z",
  "c": { "id": "uuid", "name": "Q1 2026", "type": "quarter", "elapsed": 0.45 },
  "o": [
    { "id": "uuid", "t": "Increase MRR", "p": 0.62, "r": 0.3, "type": "work", "horizon": "quarter" }
  ],
  "k": [
    {
      "id": "uuid", "oid": "uuid", "t": "MRR $50k",
      "p": 0.4, "r": 0.7, "v": 0.05,
      "type": "metric", "target": "50000", "current": "20000",
      "days_left": 45, "task_count": 8, "done_count": 3
    }
  ],
  "risky": [
    { "id": "uuid", "t": "MRR $50k", "r": 0.7, "gap": 0.3 }
  ],
  "blocked": [
    { "id": "uuid", "t": "Deploy pricing page" }
  ],
  "stats": {
    "total_tasks": 25, "todo": 10, "doing": 5, "done": 10,
    "overdue": 2, "unlinked_tasks": 3
  },
  "priorities": [
    { "id": "uuid", "t": "Fix auth bug", "ps": 0.95, "kr_r": 0.7, "status": "todo", "due": "2026-02-13T00:00:00Z", "blocking": true }
  ]
}
```

**Key abbreviations:**
| Key | Meaning |
|-----|---------|
| `t` | title |
| `p` | progress (0–1) |
| `r` | risk_score (0–1) |
| `v` | velocity (progress/week) |
| `ps` | priority_score |
| `kr_r` | parent KR risk |
| `oid` | objective_id |
| `gap` | 1 - progress |

### GET /ai/snapshot/verbose

Snapshot đầy đủ key names (cho debugging).

```http
GET /ai/snapshot/verbose?cycle_id={uuid}
Authorization: Bearer <token>
```

### POST /ai/snapshot/refresh

Force regenerate snapshot.

```http
POST /ai/snapshot/refresh
Authorization: Bearer <token>
```

### POST /ai/recompute

Recompute TẤT CẢ scores + refresh snapshot (dùng khi nghi ngờ data lệch).

```http
POST /ai/recompute
Authorization: Bearer <token>
```

---

### GET /ai/priorities

Top N tasks theo priority_score (không bao gồm done).

```http
GET /ai/priorities?limit=10
Authorization: Bearer <token>
```

**Response:**
```json
{
  "priorities": [
    { "id": "uuid", "t": "Fix auth bug", "ps": 0.95, "status": "todo", "due": "...", "blocking": true, "priority": "critical", "category": "work", "kr_id": "uuid", "kr_r": 0.7, "kr_title": "MRR $50k" }
  ]
}
```

### GET /ai/risks

KRs sorted theo risk_score DESC.

```http
GET /ai/risks?threshold=0.5
Authorization: Bearer <token>
```

| Query | Mô tả |
|-------|-------|
| `threshold` | Minimum risk score (default: 0) |

### GET /ai/alignment-gaps

Phát hiện orphan data: Objectives không có KR, KR không có Task, Tasks không link OKR.

```http
GET /ai/alignment-gaps
Authorization: Bearer <token>
```

**Response:**
```json
{
  "objectives_without_krs": [{ "id": "uuid", "title": "..." }],
  "krs_without_tasks": [{ "id": "uuid", "title": "...", "objective_id": "uuid", "o_title": "..." }],
  "unlinked_tasks": [{ "id": "uuid", "title": "...", "status": "todo", "priority": "medium" }]
}
```

### GET /ai/workload

Phân bổ công việc theo status.

```http
GET /ai/workload
Authorization: Bearer <token>
```

**Response:**
```json
{
  "by_status": [
    { "status": "doing", "count": 5, "blocking_count": 1, "overdue_count": 0, "avg_priority_score": 0.65 },
    { "status": "todo", "count": 10, "blocking_count": 0, "overdue_count": 2, "avg_priority_score": 0.45 }
  ],
  "by_category": [
    { "category": "work", "status": "doing", "count": 4 },
    { "category": "personal", "status": "todo", "count": 3 }
  ]
}
```

### GET /ai/velocity-report

KR velocity trends — tốc độ tiến trình.

```http
GET /ai/velocity-report
Authorization: Bearer <token>
```

**Response:**
```json
{
  "all": [{ "id": "uuid", "t": "MRR $50k", "p": 0.4, "r": 0.7, "v": 0.03, ... }],
  "slow": [...],
  "on_track": [...],
  "fast": [...]
}
```

| Category | Velocity |
|----------|----------|
| `slow` | < 0.05/week |
| `on_track` | 0.05–0.15/week |
| `fast` | > 0.15/week |

---

## 📊 Scoring Engine

Backend tự động tính các scores khi data thay đổi (on-write).

### Computed Fields

**Key Results:**
| Field | Formula |
|-------|---------|
| `progress` | metric: current/target; boolean: 0 or 1; milestone: done_tasks/total_tasks; has children: weighted avg |
| `risk_score` | `(1 - progress) × (elapsed_time / total_time)` |
| `velocity` | `progress / weeks_elapsed` |

**Objectives:**
| Field | Formula |
|-------|---------|
| `progress` | Weighted average of root KRs' progress |
| `risk_score` | Max of KRs' risk_score |

**Tasks:**
| Field | Formula |
|-------|---------|
| `priority_score` | `priority_weight + kr_risk_bonus + deadline_bonus` |
| `alignment_depth` | Hops from task to objective through KR hierarchy |

### Cascade Triggers

| Event | Cascades |
|-------|----------|
| Task create/update/complete | → KR progress → Objective progress → Risk → Snapshot |
| KR create/update | → Parent KR → Objective → Risk → Velocity → Snapshot |

---

## 🔧 Utility Endpoints

### GET /health

```json
{ "status": "ok", "timestamp": "2026-02-12T07:00:00Z" }
```

### GET /api/server-info

```json
{ "base_url": "https://agen.tics.network/v1" }
```

### GET /api/docs

Trả về file API documentation (markdown).

---

## ❌ Error Codes

| Code | HTTP | Mô tả |
|------|------|-------|
| `MISSING_TOKEN` | 401 | Thiếu Authorization header |
| `INVALID_TOKEN` | 401 | Token không hợp lệ |
| `AUTH_ERROR` | 500 | Lỗi xác thực nội bộ |
| `MISSING_FIELDS` | 400 | Thiếu trường bắt buộc |
| `INVALID_TIMESTAMP` | 400 | Timestamp không đúng ISO 8601 |
| `INVALID_TIME_RANGE` | 400 | start_time >= end_time |
| `INVALID_DATE` | 400 | Date format không hợp lệ |
| `INVALID_DATE_RANGE` | 400 | start_date >= end_date |
| `INVALID_TYPE` | 400 | Type không hợp lệ |
| `INVALID_STATUS` | 400 | Status không hợp lệ |
| `INVALID_CATEGORY` | 400 | Category không hợp lệ |
| `INVALID_PRIORITY` | 400 | Priority không hợp lệ |
| `INVALID_HORIZON` | 400 | Horizon không hợp lệ |
| `INVALID_ID` | 400 | UUID format không hợp lệ |
| `INVALID_CONFIDENCE` | 400 | Confidence không trong 0–1 |
| `INVALID_IMPORTANCE_WEIGHT` | 400 | Weight không trong 0–1 |
| `INVALID_ROLE` | 400 | Role không hợp lệ |
| `INVALID_INVITE_CODE` | 404 | Invite code không tồn tại |
| `TIME_CONFLICT` | 409 | Trùng lịch với slot khác |
| `MEMBER_EXISTS` | 409 | User đã là thành viên |
| `SLOT_NOT_FOUND` | 404 | Không tìm thấy calendar slot |
| `CYCLE_NOT_FOUND` | 404 | Không tìm thấy cycle |
| `ORG_NOT_FOUND` | 404 | Không tìm thấy organization |
| `OBJECTIVE_NOT_FOUND` | 404 | Không tìm thấy objective |
| `KEY_RESULT_NOT_FOUND` | 404 | Không tìm thấy key result |
| `PARENT_KR_NOT_FOUND` | 404 | Không tìm thấy parent KR |
| `INITIATIVE_NOT_FOUND` | 404 | Không tìm thấy initiative |
| `TASK_NOT_FOUND` | 404 | Không tìm thấy task |
| `USER_NOT_FOUND` | 404 | Không tìm thấy user |
| `MEMBER_NOT_FOUND` | 404 | Không tìm thấy member |
| `FORBIDDEN` | 403 | Không có quyền truy cập |
| `CANNOT_REMOVE_OWNER` | 403 | Không thể xóa owner |
| `NO_UPDATES` | 400 | Không có trường để update |
| `INTERNAL_ERROR` | 500 | Lỗi server nội bộ |

---

## 🤖 AI Agent Workflow

### Workflow đề xuất cho AI Agent

```
1. POST /auth/register              → Lấy token
2. POST /organizations               → Tạo org
3. POST /cycles                      → Tạo cycle (Q1 2026)
4. POST /objectives (org_id, cycle_id) → Tạo objectives
5. POST /key-results (parent_kr_id)  → Tạo KR hierarchy
6. POST /initiatives                 → Tạo initiatives
7. POST /tasks (kr_id, initiative_id, due_date) → Tạo tasks
8. GET  /ai/snapshot                 → Đọc snapshot để reasoning
9. GET  /ai/priorities               → Xem task nên làm trước
10. GET /ai/risks                    → Xem KR nào rủi ro
11. GET /ai/alignment-gaps           → Phát hiện orphan data
12. PATCH /tasks/:id, POST /tasks/:id/complete → Cập nhật tiến độ
13. GET /ai/snapshot                 → Re-read updated snapshot
```

### Nguyên tắc

1. **Backend tính toán, AI reasoning** — Không cần AI tự tính score
2. **Đọc snapshot trước khi reasoning** — Snapshot luôn up-to-date
3. **Dùng short keys** — Tiết kiệm token khi đọc snapshot
4. **Dùng `/ai/snapshot/verbose` để debug** — Khi cần đọc full key names
5. **Gọi `/ai/recompute` nếu nghi ngờ** — Force recompute tất cả scores

---

## 📡 Server Info

- **Base URL:** `https://agen.tics.network/v1`
- **API Docs:** `https://agen.tics.network/v1/api/docs`
- **Web Interface:** `https://agen.tics.network/`

---

*V2 — AI-Native OKR Execution System. Backend tính toán, AI reasoning.*
