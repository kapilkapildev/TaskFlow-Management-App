const express = require('express');
const { Pool } = require('pg');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Database pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/taskflow_db',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Apply authentication
router.use(authenticateToken);

// Sync endpoint - merge client tasks with server tasks
router.post('/sync', async (req, res) => {
    try {
        const { userId } = req.user;
        const { tasks: clientTasks } = req.body;
        
        if (!Array.isArray(clientTasks)) {
            return res.status(400).json({ 
                message: '客户端任务数组是必需的' 
            });
        }
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Get all server tasks for the user
            const serverTasksResult = await client.query(
                'SELECT * FROM tasks WHERE user_id = $1',
                [userId]
            );
            
            const serverTasks = serverTasksResult.rows.map(row => ({
                id: row.id,
                title: row.title,
                description: row.description,
                category: row.category,
                priority: row.priority,
                status: row.status,
                dueDate: row.due_date,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
            
            // Create maps for easier lookup
            const serverTaskMap = new Map(serverTasks.map(task => [task.id, task]));
            const clientTaskMap = new Map(clientTasks.map(task => [task.id, task]));
            
            const mergedTasks = [];
            const tasksToCreate = [];
            const tasksToUpdate = [];
            
            // Process client tasks
            for (const clientTask of clientTasks) {
                const serverTask = serverTaskMap.get(clientTask.id);
                
                if (!serverTask) {
                    // Task exists only on client - create on server
                    tasksToCreate.push(clientTask);
                } else {
                    // Task exists on both - merge based on updated_at
                    const clientUpdated = new Date(clientTask.updatedAt);
                    const serverUpdated = new Date(serverTask.updatedAt);
                    
                    if (clientUpdated > serverUpdated) {
                        // Client version is newer - update server
                        tasksToUpdate.push(clientTask);
                        mergedTasks.push(clientTask);
                    } else {
                        // Server version is newer or same - keep server version
                        mergedTasks.push(serverTask);
                    }
                }
            }
            
            // Process server tasks that don't exist on client
            for (const serverTask of serverTasks) {
                if (!clientTaskMap.has(serverTask.id)) {
                    // Task exists only on server - add to merged tasks
                    mergedTasks.push(serverTask);
                }
            }
            
            // Create new tasks on server
            for (const task of tasksToCreate) {
                let dueDateValue = null;
                if (task.dueDate) {
                    dueDateValue = new Date(task.dueDate);
                    if (isNaN(dueDateValue.getTime())) {
                        dueDateValue = null;
                    }
                }
                
                const result = await client.query(
                    `INSERT INTO tasks (id, user_id, title, description, category, priority, status, due_date, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                     ON CONFLICT (id) DO NOTHING
                     RETURNING *`,
                    [
                        task.id,
                        userId,
                        task.title,
                        task.description || null,
                        task.category || null,
                        task.priority || 'Medium',
                        task.status || 'todo',
                        dueDateValue,
                        new Date(task.createdAt),
                        new Date(task.updatedAt)
                    ]
                );
                
                if (result.rows.length > 0) {
                    const row = result.rows[0];
                    const createdTask = {
                        id: row.id,
                        title: row.title,
                        description: row.description,
                        category: row.category,
                        priority: row.priority,
                        status: row.status,
                        dueDate: row.due_date,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at
                    };
                    
                    // Replace in merged tasks
                    const index = mergedTasks.findIndex(t => t.id === task.id);
                    if (index >= 0) {
                        mergedTasks[index] = createdTask;
                    } else {
                        mergedTasks.push(createdTask);
                    }
                }
            }
            
            // Update existing tasks on server
            for (const task of tasksToUpdate) {
                let dueDateValue = null;
                if (task.dueDate) {
                    dueDateValue = new Date(task.dueDate);
                    if (isNaN(dueDateValue.getTime())) {
                        dueDateValue = null;
                    }
                }
                
                const result = await client.query(
                    `UPDATE tasks 
                     SET title = $3, description = $4, category = $5, priority = $6, 
                         status = $7, due_date = $8, updated_at = $9
                     WHERE id = $1 AND user_id = $2
                     RETURNING *`,
                    [
                        task.id,
                        userId,
                        task.title,
                        task.description || null,
                        task.category || null,
                        task.priority || 'Medium',
                        task.status || 'todo',
                        dueDateValue,
                        new Date(task.updatedAt)
                    ]
                );
                
                if (result.rows.length > 0) {
                    const row = result.rows[0];
                    const updatedTask = {
                        id: row.id,
                        title: row.title,
                        description: row.description,
                        category: row.category,
                        priority: row.priority,
                        status: row.status,
                        dueDate: row.due_date,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at
                    };
                    
                    // Update in merged tasks
                    const index = mergedTasks.findIndex(t => t.id === task.id);
                    if (index >= 0) {
                        mergedTasks[index] = updatedTask;
                    }
                }
            }
            
            await client.query('COMMIT');
            
            // Sort merged tasks by updated_at desc
            mergedTasks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            
            res.json({
                message: '同步成功',
                tasks: mergedTasks,
                stats: {
                    total: mergedTasks.length,
                    created: tasksToCreate.length,
                    updated: tasksToUpdate.length,
                    serverOnly: serverTasks.length - clientTasks.filter(ct => serverTaskMap.has(ct.id)).length
                }
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ 
            message: '同步时发生内部服务器错误' 
        });
    }
});

// Get sync status
router.get('/sync/status', async (req, res) => {
    try {
        const { userId } = req.user;
        
        // Get task counts and last update time
        const result = await pool.query(
            `SELECT 
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status = 'todo' THEN 1 END) as todo_tasks,
                COUNT(CASE WHEN status = 'inProgress' THEN 1 END) as in_progress_tasks,
                COUNT(CASE WHEN status = 'done' THEN 1 END) as done_tasks,
                MAX(updated_at) as last_updated
             FROM tasks 
             WHERE user_id = $1`,
            [userId]
        );
        
        const stats = result.rows[0];
        
        res.json({
            status: 'ready',
            serverStats: {
                totalTasks: parseInt(stats.total_tasks),
                todoTasks: parseInt(stats.todo_tasks),
                inProgressTasks: parseInt(stats.in_progress_tasks),
                doneTasks: parseInt(stats.done_tasks),
                lastUpdated: stats.last_updated
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Sync status error:', error);
        res.status(500).json({ 
            message: '获取同步状态时发生内部服务器错误' 
        });
    }
});

// Force full sync - get all server tasks
router.get('/sync/full', async (req, res) => {
    try {
        const { userId } = req.user;
        
        const result = await pool.query(
            'SELECT * FROM tasks WHERE user_id = $1 ORDER BY updated_at DESC',
            [userId]
        );
        
        const tasks = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            category: row.category,
            priority: row.priority,
            status: row.status,
            dueDate: row.due_date,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
        
        res.json({
            message: '完整同步成功',
            tasks,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Full sync error:', error);
        res.status(500).json({ 
            message: '完整同步时发生内部服务器错误' 
        });
    }
});

// Conflict resolution endpoint
router.post('/sync/resolve', async (req, res) => {
    try {
        const { userId } = req.user;
        const { conflicts, resolutions } = req.body;
        
        if (!Array.isArray(conflicts) || !Array.isArray(resolutions)) {
            return res.status(400).json({ 
                message: '冲突和解决方案数组是必需的' 
            });
        }
        
        if (conflicts.length !== resolutions.length) {
            return res.status(400).json({ 
                message: '冲突和解决方案数量必须匹配' 
            });
        }
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            const resolvedTasks = [];
            
            for (let i = 0; i < conflicts.length; i++) {
                const conflict = conflicts[i];
                const resolution = resolutions[i]; // 'client', 'server', or 'merge'
                
                if (resolution === 'client') {
                    // Use client version
                    const task = conflict.clientVersion;
                    
                    let dueDateValue = null;
                    if (task.dueDate) {
                        dueDateValue = new Date(task.dueDate);
                        if (isNaN(dueDateValue.getTime())) {
                            dueDateValue = null;
                        }
                    }
                    
                    const result = await client.query(
                        `UPDATE tasks 
                         SET title = $3, description = $4, category = $5, priority = $6, 
                             status = $7, due_date = $8, updated_at = $9
                         WHERE id = $1 AND user_id = $2
                         RETURNING *`,
                        [
                            task.id,
                            userId,
                            task.title,
                            task.description || null,
                            task.category || null,
                            task.priority || 'Medium',
                            task.status || 'todo',
                            dueDateValue,
                            new Date()
                        ]
                    );
                    
                    if (result.rows.length > 0) {
                        const row = result.rows[0];
                        resolvedTasks.push({
                            id: row.id,
                            title: row.title,
                            description: row.description,
                            category: row.category,
                            priority: row.priority,
                            status: row.status,
                            dueDate: row.due_date,
                            createdAt: row.created_at,
                            updatedAt: row.updated_at
                        });
                    }
                    
                } else if (resolution === 'server') {
                    // Keep server version (no update needed)
                    resolvedTasks.push(conflict.serverVersion);
                    
                } else if (resolution === 'merge') {
                    // Custom merge logic would go here
                    // For now, default to server version
                    resolvedTasks.push(conflict.serverVersion);
                }
            }
            
            await client.query('COMMIT');
            
            res.json({
                message: '冲突解决成功',
                resolvedTasks,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('Conflict resolution error:', error);
        res.status(500).json({ 
            message: '解决冲突时发生内部服务器错误' 
        });
    }
});

module.exports = router;