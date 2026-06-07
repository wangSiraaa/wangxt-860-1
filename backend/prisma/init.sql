-- 数据库初始化脚本
-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    real_name VARCHAR(50),
    phone VARCHAR(20),
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT role_check CHECK (role IN ('admin', 'manager', 'member'))
);

-- 客户项目表
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_code VARCHAR(50) UNIQUE NOT NULL,
    project_name VARCHAR(200) NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    customer_contact VARCHAR(50),
    customer_phone VARCHAR(20),
    project_manager_id UUID REFERENCES users(id),
    description TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'planning',
    total_budget DECIMAL(15,2),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT status_check CHECK (status IN ('planning', 'in_progress', 'suspended', 'completed', 'cancelled'))
);

-- 项目成员表
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

-- 里程碑表
CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    milestone_code VARCHAR(50) UNIQUE NOT NULL,
    milestone_name VARCHAR(200) NOT NULL,
    description TEXT,
    planned_date DATE NOT NULL,
    actual_date DATE,
    status VARCHAR(20) DEFAULT 'pending',
    sort_order INTEGER DEFAULT 0,
    acceptance_criteria TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed', 'cancelled'))
);

-- 里程碑前置依赖表
CREATE TABLE IF NOT EXISTS milestone_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
    predecessor_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(milestone_id, predecessor_id),
    CONSTRAINT no_self_dependency CHECK (milestone_id <> predecessor_id)
);

-- 风险项表
CREATE TABLE IF NOT EXISTS risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    risk_code VARCHAR(50) UNIQUE NOT NULL,
    risk_title VARCHAR(200) NOT NULL,
    description TEXT,
    risk_level VARCHAR(20) DEFAULT 'medium',
    probability VARCHAR(20) DEFAULT 'medium',
    impact VARCHAR(20) DEFAULT 'medium',
    mitigation_measure TEXT,
    owner_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'open',
    identified_date DATE,
    resolved_date DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT level_check CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT probability_check CHECK (probability IN ('low', 'medium', 'high')),
    CONSTRAINT impact_check CHECK (impact IN ('low', 'medium', 'high')),
    CONSTRAINT status_check CHECK (status IN ('open', 'monitoring', 'mitigated', 'resolved', 'closed'))
);

-- 会议纪要表
CREATE TABLE IF NOT EXISTS meeting_minutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    meeting_title VARCHAR(200) NOT NULL,
    meeting_type VARCHAR(50),
    meeting_date TIMESTAMP NOT NULL,
    location VARCHAR(200),
    duration INTEGER,
    host_id UUID REFERENCES users(id),
    content TEXT,
    decisions TEXT,
    action_items TEXT,
    file_path VARCHAR(500),
    file_name VARCHAR(200),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 会议参与人表
CREATE TABLE IF NOT EXISTS meeting_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID REFERENCES meeting_minutes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    attended BOOLEAN DEFAULT true,
    UNIQUE(meeting_id, user_id)
);

-- 验收单表
CREATE TABLE IF NOT EXISTS acceptance_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES milestones(id),
    acceptance_code VARCHAR(50) UNIQUE NOT NULL,
    acceptance_title VARCHAR(200) NOT NULL,
    description TEXT,
    acceptance_content TEXT,
    acceptance_result VARCHAR(20),
    status VARCHAR(20) DEFAULT 'draft',
    submit_date TIMESTAMP,
    accept_date TIMESTAMP,
    applicant_id UUID REFERENCES users(id),
    reviewer_id UUID REFERENCES users(id),
    review_opinion TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT result_check CHECK (acceptance_result IN ('passed', 'failed', 'partial')),
    CONSTRAINT status_check CHECK (status IN ('draft', 'submitted', 'reviewing', 'accepted', 'rejected', 'cancelled'))
);

-- 验收附件表
CREATE TABLE IF NOT EXISTS acceptance_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    acceptance_id UUID REFERENCES acceptance_forms(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(200) NOT NULL,
    file_size BIGINT,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestone_deps_milestone ON milestone_dependencies(milestone_id);
CREATE INDEX IF NOT EXISTS idx_risks_project ON risks(project_id);
CREATE INDEX IF NOT EXISTS idx_risks_status ON risks(status);
CREATE INDEX IF NOT EXISTS idx_risks_level ON risks(risk_level);
CREATE INDEX IF NOT EXISTS idx_meetings_project ON meeting_minutes(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meeting_minutes(meeting_date);
CREATE INDEX IF NOT EXISTS idx_acceptance_project ON acceptance_forms(project_id);
CREATE INDEX IF NOT EXISTS idx_acceptance_milestone ON acceptance_forms(milestone_id);
CREATE INDEX IF NOT EXISTS idx_acceptance_status ON acceptance_forms(status);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要自动更新 updated_at 的表创建触发器
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_milestones_updated_at
    BEFORE UPDATE ON milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_risks_updated_at
    BEFORE UPDATE ON risks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_meetings_updated_at
    BEFORE UPDATE ON meeting_minutes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_acceptance_updated_at
    BEFORE UPDATE ON acceptance_forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
