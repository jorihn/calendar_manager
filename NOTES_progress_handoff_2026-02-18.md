# Progress + Daily Hand-off (2026-02-18)

Goal: Allow users/agents to save "work in progress" so unfinished tasks can continue smoothly next day.

## DB
- Added nullable fields to `tasks`:
  - `progress_percent` (int 0..100)
  - `progress_note` (text)
  - `next_action` (text)
  - `blocked_reason` (text)
  - `last_worked_at` (timestamptz)
  - `progress_score` (numeric 0..1)
- Migration:
  - `src/db/migrations/004_task_progress_handoff.up.sql`
  - `src/db/migrations/004_task_progress_handoff.down.sql`

## API
- `PATCH /tasks/:id`
  - supports updating the new fields
  - validates `progress_percent` as integer 0..100
  - updates `last_worked_at` when progress/hand-off fields change or when setting `status=doing`
  - DoD gate for `status=done` remains unchanged
  - If `status=doing` and both `progress_note` + `next_action` are empty, API returns 200 but sets header:
    - `X-Warning: Consider providing progress_note or next_action for smoother daily hand-off`

- `GET /tasks`, `GET /tasks/:id`, `GET /tasks/my-work/assigned`
  - already return `SELECT *` / `t.*`, so new fields are included automatically.

## Non-blocking progress scoring
- Added `src/services/progressScoring.ts` with `evaluateAndPersistProgressScore(taskId)`.
- Currently uses a heuristic scoring function (0..1), persists to `tasks.progress_score`.
- Called non-blocking (fire-and-forget) on:
  - task update when progress fields or status/dod/outcome change
  - task complete
- If scoring fails, it logs and does not block the request.

## Files changed
- `src/routes/tasks.ts`
- `src/services/progressScoring.ts`
- `src/db/migrations/004_task_progress_handoff.*.sql`
