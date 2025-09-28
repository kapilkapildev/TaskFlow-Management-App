const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/taskflow_db',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files (for production)
app.use(express.static(path.join(__dirname, '../')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Server info endpoint
app.get('/info', (req, res) => {
    res.json({
        name: 'TaskFlow API',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api', require('./routes/sync'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ message: 'API endpoint not found' });
});

// Serve frontend for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Database initialization
async function initDatabase() {
    try {
        // Test database connection
        const client = await pool.connect();
        console.log('Database connected successfully');
        
        // Create tables if they don't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT,
                created_at TIMESTAMP DEFAULT now(),
                updated_at TIMESTAMP DEFAULT now()
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT,
                priority VARCHAR(10) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
                status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'inProgress', 'done')),
                due_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT now(),
                updated_at TIMESTAMP DEFAULT now()
            )
        `);
        
        // Create indexes for better performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
            CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
            CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);
            CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
        `);
        
        // Create demo user and tasks for development
        if (process.env.NODE_ENV === 'development') {
            await createDemoData(client);
        }
        
        client.release();
        console.log('Database initialized successfully');
        
    } catch (error) {
        console.error('Database initialization failed:', error);
        
        // In development, continue without database
        if (process.env.NODE_ENV === 'development') {
            console.warn('Continuing without database connection (development mode)');
        } else {
            process.exit(1);
        }
    }
}

async function createDemoData(client) {
    try {
        // Check if demo user already exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE username = $1',
            ['demo']
        );
        
        let userId;
        if (userResult.rows.length === 0) {
            // Create demo user
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash('demo123', 10);
            
            const newUserResult = await client.query(
                'INSERT INTO users (username, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
                ['demo', hashedPassword, 'Demo User']
            );
            
            userId = newUserResult.rows[0].id;
            console.log('Demo user created');
        } else {
            userId = userResult.rows[0].id;
        }
        
        // Check if demo tasks already exist
        const taskCount = await client.query(
            'SELECT COUNT(*) FROM tasks WHERE user_id = $1',
            [userId]
        );
        
        if (parseInt(taskCount.rows[0].count) === 0) {
            // Create demo tasks
            const demoTasks = [
                {
                    title: 'Welcome to TaskFlow!',
                    description: 'This is a sample task to get you started. You can edit or delete this task.',
                    category: 'Getting Started',
                    priority: 'High',
                    status: 'todo'
                },
                {
                    title: 'Design new landing page',
                    description: 'Create wireframes and mockups for the new product landing page',
                    category: 'Design',
                    priority: 'High',
                    status: 'inProgress',
                    due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
                },
                {
                    title: 'Update user documentation',
                    description: 'Review and update the user guide with latest features',
                    category: 'Documentation',
                    priority: 'Medium',
                    status: 'todo',
                    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week from now
                },
                {
                    title: 'Fix responsive layout issue',
                    description: 'Address mobile layout problems on the dashboard page',
                    category: 'Bug Fix',
                    priority: 'Medium',
                    status: 'inProgress'
                },
                {
                    title: 'Set up automated testing',
                    description: 'Implement unit tests and integration tests for core features',
                    category: 'Development',
                    priority: 'High',
                    status: 'todo'
                },
                {
                    title: 'Research competitor features',
                    description: 'Analyze competing task management tools and their features',
                    category: 'Research',
                    priority: 'Low',
                    status: 'done'
                }
            ];
            
            for (const task of demoTasks) {
                await client.query(
                    `INSERT INTO tasks (user_id, title, description, category, priority, status, due_date)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [userId, task.title, task.description, task.category, task.priority, task.status, task.due_date]
                );
            }
            
            console.log('Demo tasks created');
        }
        
    } catch (error) {
        console.warn('Failed to create demo data:', error);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    
    try {
        await pool.end();
        console.log('Database connections closed');
    } catch (error) {
        console.error('Error closing database connections:', error);
    }
    
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    
    try {
        await pool.end();
        console.log('Database connections closed');
    } catch (error) {
        console.error('Error closing database connections:', error);
    }
    
    process.exit(0);
});

// Start server
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, () => {
        console.log(`TaskFlow server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Health check: http://localhost:${PORT}/health`);
        
        if (process.env.NODE_ENV === 'development') {
            console.log(`Demo login: username=demo, password=demo123`);
        }
    });
}

// Export for testing
module.exports = { app, pool };

// Start server if this file is run directly
if (require.main === module) {
    startServer();
}