-- Calendar Manager Database Schema

-- Enable pgcrypto extension for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agent tokens table
CREATE TABLE IF NOT EXISTS agent_tokens (
    token VARCHAR(255) PRIMARY KEY DEFAULT encode(gen_random_bytes(32), 'base64'),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'agent', 'manager')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_tokens_user_id ON agent_tokens(user_id);

-- Calendar slots table
CREATE TABLE IF NOT EXISTS calendar_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('work', 'meeting', 'focus', 'personal')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'done')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE INDEX idx_calendar_slots_user_id ON calendar_slots(user_id);
CREATE INDEX idx_calendar_slots_status ON calendar_slots(status);
CREATE INDEX idx_calendar_slots_time_range ON calendar_slots(start_time, end_time);

-- Seed data for MVP (1 user, 1 agent)
INSERT INTO users (id, name, timezone) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Owner', 'UTC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO agent_tokens (user_id, role) 
VALUES ('00000000-0000-0000-0000-000000000001', 'agent')
ON CONFLICT (token) DO NOTHING;
