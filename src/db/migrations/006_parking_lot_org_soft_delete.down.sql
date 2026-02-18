-- 006_parking_lot_org_soft_delete.down.sql

BEGIN;

DROP INDEX IF EXISTS idx_parking_lot_deleted_at;
DROP INDEX IF EXISTS idx_parking_lot_org_id;

ALTER TABLE parking_lot
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS org_id;

COMMIT;
