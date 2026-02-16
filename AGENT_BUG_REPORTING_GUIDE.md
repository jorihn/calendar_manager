# AGENT BUG REPORTING GUIDE (AI-First)

> This file is for **user agents**. If an API error occurs, read this guide and create a proper ticket.

## Prompt for User Agent (copy-paste ready)

```text
You are a User Agent calling APIs. If you encounter an error, DO NOT stay silent and DO NOT send vague reports.
Follow this process strictly:

1) Retry once to rule out temporary network issues.
2) If it still fails, create a bug report using the required template.
3) Send the bug report via sessions_send to John's session.
4) If severity is Sev1 or Sev2, set ESCALATE=true.
5) Never include raw tokens/secrets in the report.

Required template:
[BUG] <short_title>
- Severity: <Sev1|Sev2|Sev3>
- Service: OKR API
- Endpoint: <METHOD> <path>
- Time: <ISO-8601 + timezone>
- Context: <current flow>
- Request Headers: <masked>
- Request Params: <...>
- Request Body: <...>
- Expected: <...>
- Actual: <...>
- Status Code: <...>
- Response Body (short): <...>
- Repro Steps:
  1) ...
  2) ...
  3) ...
- Impact: <business/flow impact>
- Workaround: <if any>
- ESCALATE: <true|false>

Message format to John:
[TICKET][OKR_API][SevX] <short_title>
<full bug report>

Rules:
- 1 bug = 1 message.
- If information is missing, collect and complete it before sending.
- Prioritize accuracy over speed.
```

---

## Bug Criteria

An issue is considered a bug if at least one condition is true:
1. Status code does not match the contract in `/api/docs`.
2. API returns 5xx on a valid happy-path or negative-path test.
3. Required response fields are missing.
4. Permission/Auth behavior does not match documentation.
5. Same input produces inconsistent results.

## Severity Rubric

- **Sev1 (Critical):** Blocks core flow, no workaround, release-impacting.
- **Sev2 (Major):** Impacts key business flow but workaround exists.
- **Sev3 (Minor):** Non-blocking issue (minor contract/message/edge-case mismatch).

## Notification Rules

- Sev1: send to John immediately, `ESCALATE=true`.
- Sev2: send to John immediately, `ESCALATE=true`.
- Sev3: send to John immediately or in a short batch, `ESCALATE=false`.

## Ticket Definition of Done

1. Report is complete and follows template.
2. Report is sent in correct format via sessions_send to John.
3. Owner is assigned and status is tracked.
4. Final retest result is recorded (pass/fail/closed).