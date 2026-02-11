-- OKR System Database Schema

-- Objectives table
CREATE TABLE IF NOT EXISTS objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('work', 'personal')),
    horizon VARCHAR(20) NOT NULL CHECK (horizon IN ('week', 'month', 'quarter', 'year')),
    success_def TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_objectives_user_id ON objectives(user_id);
CREATE INDEX idx_objectives_status ON objectives(status);
CREATE INDEX idx_objectives_type ON objectives(type);
CREATE INDEX idx_objectives_horizon ON objectives(horizon);

-- Key Results table
CREATE TABLE IF NOT EXISTS key_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('metric', 'milestone', 'boolean')),
    target VARCHAR(255),
    current VARCHAR(255),
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_key_results_user_id ON key_results(user_id);
CREATE INDEX idx_key_results_objective_id ON key_results(objective_id);

-- Tasks table (OKR tasks, separate from calendar_slots)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(20) NOT NULL CHECK (category IN ('work', 'personal')),
    objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
    kr_id UUID REFERENCES key_results(id) ON DELETE SET NULL,
    estimate INTEGER,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    impact_note TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_objective_id ON tasks(objective_id);
CREATE INDEX idx_tasks_kr_id ON tasks(kr_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_tasks_priority ON tasks(priority);
