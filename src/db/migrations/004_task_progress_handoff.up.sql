-- 004_task_progress_handoff.up.sql
-- Add progress + daily hand-off fields to tasks

BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS progress_percent INTEGER,
  ADD COLUMN IF NOT EXISTS progress_note TEXT,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_worked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS progress_score NUMERIC(3,2);

-- Validation constraints (non-breaking; columns are nullable)
DO $$
BEGIN
  BEGIN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_progress_percent_check
      CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100));
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_progress_score_check
      CHECK (progress_score IS NULL OR (progress_score >= 0 AND progress_score <= 1));
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

COMMIT;
