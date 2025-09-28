-- TaskFlow Database Schema
-- PostgreSQL version

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    priority VARCHAR(10) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
    status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'inProgress', 'done')),
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_priority ON tasks(user_id, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_user_category ON tasks(user_id, category);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date ON tasks(user_id, due_date);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at 
    BEFORE UPDATE ON tasks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE OR REPLACE VIEW task_stats AS
SELECT 
    user_id,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'todo' THEN 1 END) as todo_tasks,
    COUNT(CASE WHEN status = 'inProgress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN status = 'done' THEN 1 END) as done_tasks,
    COUNT(CASE WHEN priority = 'High' THEN 1 END) as high_priority_tasks,
    COUNT(CASE WHEN priority = 'Medium' THEN 1 END) as medium_priority_tasks,
    COUNT(CASE WHEN priority = 'Low' THEN 1 END) as low_priority_tasks,
    COUNT(CASE WHEN due_date IS NOT NULL AND due_date < now() AND status != 'done' THEN 1 END) as overdue_tasks,
    COUNT(CASE WHEN due_date IS NOT NULL AND DATE(due_date) = CURRENT_DATE AND status != 'done' THEN 1 END) as due_today_tasks,
    MAX(updated_at) as last_updated
FROM tasks
GROUP BY user_id;

-- View for tasks with user information
CREATE OR REPLACE VIEW tasks_with_users AS
SELECT 
    t.*,
    u.username,
    u.display_name
FROM tasks t
JOIN users u ON t.user_id = u.id;

-- Function to get user task statistics
CREATE OR REPLACE FUNCTION get_user_task_stats(p_user_id UUID)
RETURNS TABLE (
    total_tasks BIGINT,
    todo_tasks BIGINT,
    in_progress_tasks BIGINT,
    done_tasks BIGINT,
    high_priority_tasks BIGINT,
    medium_priority_tasks BIGINT,
    low_priority_tasks BIGINT,
    overdue_tasks BIGINT,
    due_today_tasks BIGINT,
    categories TEXT[],
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'todo' THEN 1 END) as todo_tasks,
        COUNT(CASE WHEN status = 'inProgress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status = 'done' THEN 1 END) as done_tasks,
        COUNT(CASE WHEN priority = 'High' THEN 1 END) as high_priority_tasks,
        COUNT(CASE WHEN priority = 'Medium' THEN 1 END) as medium_priority_tasks,
        COUNT(CASE WHEN priority = 'Low' THEN 1 END) as low_priority_tasks,
        COUNT(CASE WHEN due_date IS NOT NULL AND due_date < now() AND status != 'done' THEN 1 END) as overdue_tasks,
        COUNT(CASE WHEN due_date IS NOT NULL AND DATE(due_date) = CURRENT_DATE AND status != 'done' THEN 1 END) as due_today_tasks,
        ARRAY_AGG(DISTINCT category) FILTER (WHERE category IS NOT NULL) as categories,
        MAX(updated_at) as last_updated
    FROM tasks
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old completed tasks (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_completed_tasks(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM tasks 
    WHERE status = 'done' 
    AND updated_at < (now() - INTERVAL '1 day' * days_old);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tasks
CREATE POLICY tasks_user_isolation ON tasks
    FOR ALL
    TO authenticated
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Policy: Users can only modify their own tasks
CREATE POLICY tasks_user_modification ON tasks
    FOR ALL
    TO authenticated
    WITH CHECK (user_id = current_setting('app.current_user_id')::UUID);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO authenticated;
GRANT SELECT ON users TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Sample data for development (commented out for production)
/*
-- Create demo user
INSERT INTO users (username, password_hash, display_name) 
VALUES ('demo', '$2b$10$example_hash_here', 'Demo User')
ON CONFLICT (username) DO NOTHING;

-- Create sample tasks
INSERT INTO tasks (user_id, title, description, category, priority, status, due_date) 
SELECT 
    u.id,
    'Welcome to TaskFlow!',
    'This is a sample task to get you started.',
    'Getting Started',
    'High',
    'todo',
    now() + INTERVAL '1 day'
FROM users u 
WHERE u.username = 'demo'
ON CONFLICT DO NOTHING;
*/

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts for the TaskFlow application';
COMMENT ON TABLE tasks IS 'Tasks created by users';

COMMENT ON COLUMN users.id IS 'Unique identifier for the user';
COMMENT ON COLUMN users.username IS 'Unique username for login';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN users.display_name IS 'Display name for the user';

COMMENT ON COLUMN tasks.id IS 'Unique identifier for the task';
COMMENT ON COLUMN tasks.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN tasks.title IS 'Task title/name';
COMMENT ON COLUMN tasks.description IS 'Detailed task description';
COMMENT ON COLUMN tasks.category IS 'Task category for organization';
COMMENT ON COLUMN tasks.priority IS 'Task priority: Low, Medium, High';
COMMENT ON COLUMN tasks.status IS 'Task status: todo, inProgress, done';
COMMENT ON COLUMN tasks.due_date IS 'Optional due date for the task';

-- Performance monitoring queries (for development/debugging)
/*
-- Check table sizes
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'tasks');

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public';

-- Check query performance
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE query LIKE '%tasks%' 
ORDER BY total_time DESC 
LIMIT 10;
*/