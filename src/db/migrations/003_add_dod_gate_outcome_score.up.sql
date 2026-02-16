-- Migration: Add outcome_score, dod_review_status, dod_review_note to tasks
-- outcome_score: AI-scored quality of outcome (0.0 - 1.0), used in milestone KR progress
-- dod_review_status: gate check status when completing task
-- dod_review_note: reviewer note on DoD compliance
ALTER TABLE tasks ADD COLUMN outcome_score DECIMAL(3,2) CHECK (outcome_score >= 0 AND outcome_score <= 1);
ALTER TABLE tasks ADD COLUMN dod_review_status VARCHAR(20) CHECK (dod_review_status IN ('passed', 'needs_revision', 'partial'));
ALTER TABLE tasks ADD COLUMN dod_review_note TEXT;
