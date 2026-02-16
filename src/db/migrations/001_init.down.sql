-- 001_init.down.sql
-- WARNING: This drops all schema objects for this app.

BEGIN;

-- Drop in reverse dependency order

DROP TABLE IF EXISTS ai_snapshots;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS initiatives;
DROP TABLE IF EXISTS key_results;
DROP TABLE IF EXISTS objectives;
DROP TABLE IF EXISTS cycles;
DROP TABLE IF EXISTS org_members;
DROP TABLE IF EXISTS organizations;

DROP TABLE IF EXISTS calendar_slots;
DROP TABLE IF EXISTS agent_tokens;
DROP TABLE IF EXISTS users;

-- Keep extension (optional). If you want a full wipe, uncomment:
-- DROP EXTENSION IF EXISTS pgcrypto;

COMMIT;
