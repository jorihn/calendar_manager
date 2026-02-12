-- Migration V2: AI-Native OKR System
-- Adds: organizations, org_members, cycles, initiatives
-- Upgrades: objectives, key_results, tasks
-- New: ai_snapshots

-- ============================================================
-- 1. Organizations
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);

-- Invite code for organizations (added later, safe to re-run)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS invite_code VARCHAR(20) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_organizations_invite_code ON organizations(invite_code) WHERE invite_code IS NOT NULL;

-- ============================================================
-- 2. Cycles
-- ============================================================

CREATE TABLE IF NOT EXISTS cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('week', 'month', 'quarter', 'year')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_cycle_range CHECK (start_date < end_date)
);

CREATE INDEX IF NOT EXISTS idx_cycles_user_id ON cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_cycles_org_id ON cycles(org_id);
CREATE INDEX IF NOT EXISTS idx_cycles_status ON cycles(status);

-- ============================================================
-- 3. Initiatives
-- ============================================================

CREATE TABLE IF NOT EXISTS initiatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kr_id UUID NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_initiatives_user_id ON initiatives(user_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_kr_id ON initiatives(kr_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_status ON initiatives(status);

-- ============================================================
-- 4. Upgrade objectives
-- ============================================================

-- Add org_id
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
-- Add cycle_id
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL;
-- Add computed fields
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS progress DECIMAL(5,4) NOT NULL DEFAULT 0;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS risk_score DECIMAL(5,4) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_objectives_org_id ON objectives(org_id);
CREATE INDEX IF NOT EXISTS idx_objectives_cycle_id ON objectives(cycle_id);

-- ============================================================
-- 5. Upgrade key_results
-- ============================================================

-- KR cascade hierarchy
ALTER TABLE key_results ADD COLUMN IF NOT EXISTS parent_kr_id UUID REFERENCES key_results(id) ON DELETE SET NULL;
ALTER TABLE key_results ADD COLUMN IF NOT EXISTS root_kr_id UUID REFERENCES key_results(id) ON DELETE SET NULL;
ALTER TABLE key_results ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 0;
-- Computed fields
ALTER TABLE key_results ADD COLUMN IF NOT EXISTS progress DECIMAL(5,4) NOT NULL DEFAULT 0;
ALTER TABLE key_results ADD COLUMN IF NOT EXISTS risk_score DECIMAL(5,4) NOT NULL DEFAULT 0;
ALTER TABLE key_results ADD COLUMN IF NOT EXISTS velocity DECIMAL(8,4);
ALTER TABLE key_results ADD COLUMN IF NOT EXISTS importance_weight DECIMAL(5,4) NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_key_results_parent_kr_id ON key_results(parent_kr_id);
CREATE INDEX IF NOT EXISTS idx_key_results_root_kr_id ON key_results(root_kr_id);

-- ============================================================
-- 6. Upgrade tasks
-- ============================================================

-- Link to initiative
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS initiative_id UUID REFERENCES initiatives(id) ON DELETE SET NULL;
-- Due date for tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;
-- Denormalized fields for AI (avoid joins)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS root_kr_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS impact_score DECIMAL(5,4) NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority_score DECIMAL(5,4) NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS alignment_depth INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocking BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tasks_initiative_id ON tasks(initiative_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority_score ON tasks(priority_score);
CREATE INDEX IF NOT EXISTS idx_tasks_blocking ON tasks(blocking) WHERE blocking = true;

-- ============================================================
-- 7. AI Snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_snapshots_user_id ON ai_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_snapshots_cycle_id ON ai_snapshots(cycle_id);
CREATE INDEX IF NOT EXISTS idx_ai_snapshots_created_at ON ai_snapshots(created_at DESC);
