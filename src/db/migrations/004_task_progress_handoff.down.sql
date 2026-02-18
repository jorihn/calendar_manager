-- 004_task_progress_handoff.down.sql
-- Roll back progress + daily hand-off fields

BEGIN;

-- Drop constraints first
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_progress_percent_check;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_progress_score_check;

ALTER TABLE tasks
  DROP COLUMN IF EXISTS progress_percent,
  DROP COLUMN IF EXISTS progress_note,
  DROP COLUMN IF EXISTS next_action,
  DROP COLUMN IF EXISTS blocked_reason,
  DROP COLUMN IF EXISTS last_worked_at,
  DROP COLUMN IF EXISTS progress_score;

COMMIT;
