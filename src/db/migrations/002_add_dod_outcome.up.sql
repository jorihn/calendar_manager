-- Migration: Add 'dod' (Definition of Done) and 'outcome' fields to tasks
ALTER TABLE tasks ADD COLUMN dod TEXT;
ALTER TABLE tasks ADD COLUMN outcome TEXT;
