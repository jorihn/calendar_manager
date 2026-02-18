-- 006_parking_lot_org_soft_delete.up.sql
-- Add org visibility + soft delete for parking_lot

BEGIN;

ALTER TABLE parking_lot
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_parking_lot_org_id ON parking_lot(org_id);
CREATE INDEX IF NOT EXISTS idx_parking_lot_deleted_at ON parking_lot(deleted_at);

COMMIT;
