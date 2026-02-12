🎯 1. Tầm nhìn dự án
❝ OKR Operating System for AI Agents ❞

Đây không phải:

❌ OKR SaaS truyền thống có thêm AI

❌ Task management tool có chatbot

Mà là:

✅ Một AI-native execution system
nơi AI Agent là người vận hành,
còn backend chỉ là structured reasoning layer.

🧠 2. Agent-as-a-Service nghĩa là gì ở đây?

Agent không chỉ:

đọc dữ liệu

trả lời câu hỏi

Mà phải có khả năng:

hiểu alignment

phân tích risk

gợi ý ưu tiên

phát hiện bottleneck

điều phối task

cảnh báo lệch mục tiêu

Để làm được điều đó:

Backend phải được thiết kế cho AI suy nghĩ, không phải cho UI hiển thị.

🔥 3. Triết lý kiến trúc
Nguyên tắc 1: Alignment phải là số, không phải text

Agent không suy nghĩ tốt với:

“Tăng trưởng bền vững”

Agent suy nghĩ tốt với:

progress = 0.62
risk = 0.3
impact = 0.15

Nguyên tắc 2: Không để LLM traverse cây dữ liệu

LLM tốn token nếu phải:

Task → Initiative → KR → Parent KR → Objective


Thay vào đó:

Ta lưu sẵn:

task.root_kr_id
task.objective_id
task.priority_score
task.alignment_score


LLM chỉ cần đọc 1 JSON phẳng.

Nguyên tắc 3: Tách 3 lớp dữ liệu
1️⃣ Raw Layer (normalized DB)
2️⃣ Computed Layer (pre-aggregated metrics)
3️⃣ AI Snapshot Layer (LLM-optimized JSON)


Agent chỉ đọc layer 2 & 3.

🏗 4. Mô hình dữ liệu sau khi điều chỉnh (AI-first)

Ta điều chỉnh lại một chút để tối ưu cho Agent.

A. Core Entities (normalized)
Organization
User
Cycle
Objective
KeyResult
Initiative
Task

Cascade chỉ đi qua KR:

KR.parent_kr_id
KR.root_kr_id
KR.level

B. Computed Fields (rất quan trọng)
KeyResult
progress_percentage
aggregated_progress
risk_score
importance_weight
velocity
dependency_score

Task
impact_score
priority_score
blocking
alignment_depth
root_kr_id
objective_id


→ Không cần join khi Agent đọc.

C. AI Snapshot Table
ai_org_snapshot


Ví dụ nội dung:

{
  "cycle": "Q1",
  "objectives": [
    { "id": 1, "p": 0.62, "r": 0.3 }
  ],
  "top_risky_krs": [
    { "id": 5, "r": 0.7 }
  ],
  "overdue_tasks": 12
}


Dùng key ngắn:

p = progress

r = risk

Giảm 30–40% token.

📌 5. Những câu hỏi user sẽ quan tâm

Ta liệt kê theo nhóm.

🔍 Nhóm 1 – Alignment

Task tôi đang làm phục vụ mục tiêu nào?

Công việc tôi có thực sự quan trọng không?

Team tôi có đang đi lệch chiến lược không?

KR nào không có task support?

📊 Nhóm 2 – Progress

Chúng ta đang đạt bao nhiêu % mục tiêu?

KR nào đang chậm?

Mục tiêu nào có nguy cơ fail?

Nếu tiếp tục tốc độ này thì có đạt target không?

⚠ Nhóm 3 – Risk

KR nào đang rủi ro nhất?

Task nào đang gây bottleneck?

Ai đang quá tải?

Nếu task X trễ thì ảnh hưởng gì?

🎯 Nhóm 4 – Prioritization

Hôm nay tôi nên làm gì trước?

Task nào có impact cao nhất?

Có task nào không align mục tiêu không?

Có nên dừng task này không?

👁 Nhóm 5 – Transparency

Mọi người đang làm gì?

Team nào đóng góp nhiều nhất?

Ai đang làm việc không phục vụ KR?

Tài nguyên đang phân bổ đúng chưa?

🧠 6. Chứng minh hệ thống này trả lời được hết với ít token

Giả sử Agent nhận được:

{
  "t": [
    { "id": 1, "p": 0.8, "i": 0.3, "r": 0.2 }
  ],
  "k": [
    { "id": 5, "p": 0.4, "r": 0.7 }
  ],
  "o": [
    { "id": 2, "p": 0.62 }
  ]
}


LLM có thể:

So sánh p (progress)

So sánh r (risk)

So sánh i (impact)

Không cần text dài.

Ví dụ câu hỏi 13:

Hôm nay tôi nên làm gì trước?

Agent chỉ cần:

ORDER BY priority_score DESC


Không cần reasoning dài.

Ví dụ câu hỏi 9:

KR nào rủi ro nhất?

Chỉ cần:

SELECT max(risk_score)

Ví dụ câu hỏi 3:

Team có lệch chiến lược không?

So sánh:

sum(child_progress) vs parent_target


Đã precomputed.

📉 7. Token Optimization cụ thể
Thiết kế truyền thống	Thiết kế AI-first
Nested JSON sâu	Flat JSON
Text dài	Numeric fields
Runtime traversal	Pre-aggregated
1000–2000 token context	200–400 token context

Tiết kiệm ~60–80% token.

🚀 8. Vì sao kiến trúc này scale tốt

Không phụ thuộc LLM để tính toán

Tính toán nằm ở backend

LLM chỉ làm reasoning chiến lược

Snapshot giúp constant token size dù có 5000 task

🔮 9. Nếu muốn nâng cấp thêm

Có thể thêm:

Vector summary embedding cho mỗi cycle

Risk prediction model riêng

Event-driven scoring engine

Temporal trend analysis (velocity regression)

🏁 10. Kết luận định vị sản phẩm

Đây không phải:

“OKR tool có AI”

Mà là:

“AI Execution Engine với OKR làm structured backbone”

Hệ thống được build cho:

AI reasoning first

Token efficiency

Alignment quantification

Real-time risk propagation