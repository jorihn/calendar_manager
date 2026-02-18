-- 005_parking_lot.up.sql
-- Add Parking Lot table for off-topic ideas/tasks

BEGIN;

CREATE TABLE IF NOT EXISTS parking_lot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  item VARCHAR(255) NOT NULL,
  description TEXT,
  context TEXT,

  priority VARCHAR(10) NOT NULL DEFAULT 'low' CHECK (priority IN ('high', 'low')),
  proposed_cycle TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'parked')),

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parking_lot_owner_id ON parking_lot(owner_id);
CREATE INDEX IF NOT EXISTS idx_parking_lot_status ON parking_lot(status);
CREATE INDEX IF NOT EXISTS idx_parking_lot_priority ON parking_lot(priority);
CREATE INDEX IF NOT EXISTS idx_parking_lot_created_at ON parking_lot(created_at DESC);

COMMIT;
