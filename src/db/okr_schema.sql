-- OKR System Database Schema (V2 - AI Native)

-- ============================================================
-- Organizations
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    invite_code VARCHAR(20) UNIQUE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_organizations_invite_code ON organizations(invite_code) WHERE invite_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_org_id ON org_members(org_id);
CREATE INDEX idx_org_members_user_id ON org_members(user_id);

-- ============================================================
-- Cycles
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

CREATE INDEX idx_cycles_user_id ON cycles(user_id);
CREATE INDEX idx_cycles_org_id ON cycles(org_id);
CREATE INDEX idx_cycles_status ON cycles(status);

-- ============================================================
-- Objectives
-- ============================================================

CREATE TABLE IF NOT EXISTS objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('work', 'personal')),
    horizon VARCHAR(20) NOT NULL CHECK (horizon IN ('week', 'month', 'quarter', 'year')),
    success_def TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    progress DECIMAL(5,4) NOT NULL DEFAULT 0,
    risk_score DECIMAL(5,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_objectives_user_id ON objectives(user_id);
CREATE INDEX idx_objectives_org_id ON objectives(org_id);
CREATE INDEX idx_objectives_cycle_id ON objectives(cycle_id);
CREATE INDEX idx_objectives_status ON objectives(status);
CREATE INDEX idx_objectives_type ON objectives(type);
CREATE INDEX idx_objectives_horizon ON objectives(horizon);

-- ============================================================
-- Key Results
-- ============================================================

CREATE TABLE IF NOT EXISTS key_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('metric', 'milestone', 'boolean')),
    target VARCHAR(255),
    current VARCHAR(255),
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    parent_kr_id UUID REFERENCES key_results(id) ON DELETE SET NULL,
    root_kr_id UUID REFERENCES key_results(id) ON DELETE SET NULL,
    level INTEGER NOT NULL DEFAULT 0,
    progress DECIMAL(5,4) NOT NULL DEFAULT 0,
    risk_score DECIMAL(5,4) NOT NULL DEFAULT 0,
    velocity DECIMAL(8,4),
    importance_weight DECIMAL(5,4) NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_key_results_user_id ON key_results(user_id);
CREATE INDEX idx_key_results_objective_id ON key_results(objective_id);
CREATE INDEX idx_key_results_parent_kr_id ON key_results(parent_kr_id);
CREATE INDEX idx_key_results_root_kr_id ON key_results(root_kr_id);

-- ============================================================
-- Initiatives
-- ============================================================

CREATE TABLE IF NOT EXISTS initiatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kr_id UUID NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_initiatives_user_id ON initiatives(user_id);
CREATE INDEX idx_initiatives_kr_id ON initiatives(kr_id);
CREATE INDEX idx_initiatives_status ON initiatives(status);
CREATE INDEX idx_initiatives_assignee_id ON initiatives(assignee_id);

-- ============================================================
-- Tasks (OKR tasks, separate from calendar_slots)
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(20) NOT NULL CHECK (category IN ('work', 'personal')),
    objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
    kr_id UUID REFERENCES key_results(id) ON DELETE SET NULL,
    initiative_id UUID REFERENCES initiatives(id) ON DELETE SET NULL,
    estimate INTEGER,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    impact_note TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
    due_date TIMESTAMP WITH TIME ZONE,
    root_kr_id UUID,
    impact_score DECIMAL(5,4) NOT NULL DEFAULT 0,
    priority_score DECIMAL(5,4) NOT NULL DEFAULT 0,
    alignment_depth INTEGER NOT NULL DEFAULT 0,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    blocking BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_objective_id ON tasks(objective_id);
CREATE INDEX idx_tasks_kr_id ON tasks(kr_id);
CREATE INDEX idx_tasks_initiative_id ON tasks(initiative_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_priority_score ON tasks(priority_score);

-- ============================================================
-- AI Snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_snapshots_user_id ON ai_snapshots(user_id);
CREATE INDEX idx_ai_snapshots_cycle_id ON ai_snapshots(cycle_id);
CREATE INDEX idx_ai_snapshots_created_at ON ai_snapshots(created_at DESC);
