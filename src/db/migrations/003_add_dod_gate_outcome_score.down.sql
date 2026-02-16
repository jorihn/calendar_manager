-- Rollback: Remove outcome_score, dod_review_status, dod_review_note from tasks
ALTER TABLE tasks DROP COLUMN IF EXISTS outcome_score;
ALTER TABLE tasks DROP COLUMN IF EXISTS dod_review_status;
ALTER TABLE tasks DROP COLUMN IF EXISTS dod_review_note;
