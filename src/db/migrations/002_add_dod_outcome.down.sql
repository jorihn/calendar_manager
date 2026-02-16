-- Rollback: Remove 'dod' and 'outcome' fields from tasks
ALTER TABLE tasks DROP COLUMN IF EXISTS dod;
ALTER TABLE tasks DROP COLUMN IF EXISTS outcome;
