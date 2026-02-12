-- Migration: Add 'done' status to calendar_slots

-- Drop old constraint and add new one with 'done' status
ALTER TABLE calendar_slots DROP CONSTRAINT IF EXISTS calendar_slots_status_check;
ALTER TABLE calendar_slots ADD CONSTRAINT calendar_slots_status_check 
    CHECK (status IN ('active', 'cancelled', 'done'));
