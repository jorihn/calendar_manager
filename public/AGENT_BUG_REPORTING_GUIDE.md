# AGENT BUG REPORTING GUIDE

Use this template when reporting bugs found by AI agents or users.

## 1) Minimal info (required)

- **Time (with timezone):**
- **Environment:** production | staging | local
- **API Base URL:** e.g. `https://agen.tics.network/v1`
- **Endpoint + method:** e.g. `PATCH /tasks/:id`
- **Request body (redact secrets):**
- **Response status + body:**

## 2) Auth context

- **Auth method:** `Authorization: Bearer <token>`
- **Token handling:** NEVER paste raw tokens in bug reports. If needed, include only the first/last 4 chars.
- **User context:** user_id / org_id involved (UUIDs are OK)

## 3) Reproduction steps

1. Step-by-step actions to reproduce
2. Include exact payloads
3. Include any prerequisite data (task id, objective id, etc.)

## 4) Expected vs actual

- **Expected:**
- **Actual:**

## 5) Diagnostics (high value)

- **Request ID / Correlation ID** (if present)
- **Server logs snippet** around the time of failure
- **Database state** (optional): relevant row(s) with IDs only

## 6) Common error categories

- **400**: Validation (bad UUID, invalid enum, missing fields)
- **401/403**: Auth/permission
- **404**: Not found or visibility rules
- **409**: Conflicts (e.g. time overlap)
- **500**: Server error (include stack trace from logs)

---

## Quick paste template

```text
Time:
Env:
Base URL:
Endpoint:
Auth (redacted):
Payload:
Response:
Steps:
Expected:
Actual:
Logs:
```
