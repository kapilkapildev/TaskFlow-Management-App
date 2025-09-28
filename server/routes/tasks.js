const express = require('express');
const { Pool } = require('pg');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Database pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/taskflow_db',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Apply authentication to all task routes
router.use(authenticateToken);

// Get all tasks for the authenticated user
router.get('/', async (req, res) => {
    try {
        const { userId } = req.user;
        const { status, category, priority, search, sort, limit, offset } = req.query;
        
        let query = 'SELECT * FROM tasks WHERE user_id = $1';
        let queryParams = [userId];
        let paramCount = 1;
        
        // Apply filters
        if (status) {
            paramCount++;
            query += ` AND status = $${paramCount}`;
            queryParams.push(status);
        }
        
        if (category) {
            paramCount++;
            query += ` AND category = $${paramCount}`;
            queryParams.push(category);
        }
        
        if (priority) {
            paramCount++;
            query += ` AND priority = $${paramCount}`;
            queryParams.push(priority);
        }
        
        if (search) {
            paramCount++;
            query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount} OR category ILIKE $${paramCount})`;
            queryParams.push(`%${search}%`);
        }
        
        // Apply sorting
        const validSortFields = ['created_at', 'updated_at', 'due_date', 'title', 'priority'];
        const validSortOrders = ['asc', 'desc'];
        
        if (sort) {
            const [field, order] = sort.split('-');
            if (validSortFields.includes(field) && validSortOrders.includes(order)) {
                query += ` ORDER BY ${field} ${order.toUpperCase()}`;
            } else {
                query += ' ORDER BY updated_at DESC';
            }
        } else {
            query += ' ORDER BY updated_at DESC';
        }
        
        // Apply pagination
        if (limit) {
            const limitNum = parseInt(limit);
            if (limitNum > 0 && limitNum <= 100) {
                paramCount++;
                query += ` LIMIT $${paramCount}`;
                queryParams.push(limitNum);
            }
        }
        
        if (offset) {
            const offsetNum = parseInt(offset);
            if (offsetNum >= 0) {
                paramCount++;
                query += ` OFFSET $${paramCount}`;
                queryParams.push(offsetNum);
            }
        }
        
        const result = await pool.query(query, queryParams);
        
        // Transform database results to match frontend format
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
        
        res.json({ tasks });
        
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ 
            message: '获取任务时发生内部服务器错误' 
        });
    }
});

// Get a specific task
router.get('/:id', async (req, res) => {
    try {
        const { userId } = req.user;
        const { id } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                message: '任务未找到' 
            });
        }
        
        const row = result.rows[0];
        const task = {
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
        
        res.json({ task });
        
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ 
            message: '获取任务时发生内部服务器错误' 
        });
    }
});

// Create a new task
router.post('/', async (req, res) => {
    try {
        const { userId } = req.user;
        const { title, description, category, priority, status, dueDate } = req.body;
        
        // Validate required fields
        if (!title || title.trim().length === 0) {
            return res.status(400).json({ 
                message: '任务标题是必需的' 
            });
        }
        
        // Validate enum values
        const validPriorities = ['Low', 'Medium', 'High'];
        const validStatuses = ['todo', 'inProgress', 'done'];
        
        if (priority && !validPriorities.includes(priority)) {
            return res.status(400).json({ 
                message: '无效的优先级值' 
            });
        }
        
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: '无效的状态值' 
            });
        }
        
        // Validate due date
        let dueDateValue = null;
        if (dueDate) {
            dueDateValue = new Date(dueDate);
            if (isNaN(dueDateValue.getTime())) {
                return res.status(400).json({ 
                    message: '无效的截止日期' 
                });
            }
        }
        
        const result = await pool.query(
            `INSERT INTO tasks (user_id, title, description, category, priority, status, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                userId,
                title.trim(),
                description?.trim() || null,
                category?.trim() || null,
                priority || 'Medium',
                status || 'todo',
                dueDateValue
            ]
        );
        
        const row = result.rows[0];
        const task = {
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
        
        res.status(201).json({ 
            message: '任务创建成功',
            task 
        });
        
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ 
            message: '创建任务时发生内部服务器错误' 
        });
    }
});

// Update a task
router.put('/:id', async (req, res) => {
    try {
        const { userId } = req.user;
        const { id } = req.params;
        const { title, description, category, priority, status, dueDate } = req.body;
        
        // Check if task exists and belongs to user
        const existingTask = await pool.query(
            'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        
        if (existingTask.rows.length === 0) {
            return res.status(404).json({ 
                message: '任务未找到' 
            });
        }
        
        // Validate fields if provided
        if (title !== undefined && (!title || title.trim().length === 0)) {
            return res.status(400).json({ 
                message: '任务标题不能为空' 
            });
        }
        
        const validPriorities = ['Low', 'Medium', 'High'];
        const validStatuses = ['todo', 'inProgress', 'done'];
        
        if (priority && !validPriorities.includes(priority)) {
            return res.status(400).json({ 
                message: '无效的优先级值' 
            });
        }
        
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: '无效的状态值' 
            });
        }
        
        // Validate due date
        let dueDateValue = undefined;
        if (dueDate !== undefined) {
            if (dueDate === null || dueDate === '') {
                dueDateValue = null;
            } else {
                dueDateValue = new Date(dueDate);
                if (isNaN(dueDateValue.getTime())) {
                    return res.status(400).json({ 
                        message: '无效的截止日期' 
                    });
                }
            }
        }
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramCount = 0;
        
        if (title !== undefined) {
            paramCount++;
            updates.push(`title = $${paramCount}`);
            values.push(title.trim());
        }
        
        if (description !== undefined) {
            paramCount++;
            updates.push(`description = $${paramCount}`);
            values.push(description?.trim() || null);
        }
        
        if (category !== undefined) {
            paramCount++;
            updates.push(`category = $${paramCount}`);
            values.push(category?.trim() || null);
        }
        
        if (priority !== undefined) {
            paramCount++;
            updates.push(`priority = $${paramCount}`);
            values.push(priority);
        }
        
        if (status !== undefined) {
            paramCount++;
            updates.push(`status = $${paramCount}`);
            values.push(status);
        }
        
        if (dueDateValue !== undefined) {
            paramCount++;
            updates.push(`due_date = $${paramCount}`);
            values.push(dueDateValue);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ 
                message: '没有提供要更新的字段' 
            });
        }
        
        // Add updated_at
        paramCount++;
        updates.push(`updated_at = $${paramCount}`);
        values.push(new Date());
        
        // Add WHERE clause parameters
        paramCount++;
        values.push(id);
        paramCount++;
        values.push(userId);
        
        const query = `
            UPDATE tasks 
            SET ${updates.join(', ')} 
            WHERE id = $${paramCount - 1} AND user_id = $${paramCount}
            RETURNING *
        `;
        
        const result = await pool.query(query, values);
        
        const row = result.rows[0];
        const task = {
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
        
        res.json({ 
            message: '任务更新成功',
            task 
        });
        
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ 
            message: '更新任务时发生内部服务器错误' 
        });
    }
});

// Delete a task
router.delete('/:id', async (req, res) => {
    try {
        const { userId } = req.user;
        const { id } = req.params;
        
        const result = await pool.query(
            'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                message: '任务未找到' 
            });
        }
        
        const row = result.rows[0];
        const task = {
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
        
        res.json({ 
            message: '任务删除成功',
            task 
        });
        
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ 
            message: '删除任务时发生内部服务器错误' 
        });
    }
});

// Batch operations
router.post('/batch', async (req, res) => {
    try {
        const { userId } = req.user;
        const { tasks } = req.body;
        
        if (!Array.isArray(tasks) || tasks.length === 0) {
            return res.status(400).json({ 
                message: '任务数组是必需的' 
            });
        }
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            const createdTasks = [];
            
            for (const taskData of tasks) {
                const { title, description, category, priority, status, dueDate } = taskData;
                
                if (!title || title.trim().length === 0) {
                    continue; // Skip invalid tasks
                }
                
                let dueDateValue = null;
                if (dueDate) {
                    dueDateValue = new Date(dueDate);
                    if (isNaN(dueDateValue.getTime())) {
                        dueDateValue = null;
                    }
                }
                
                const result = await client.query(
                    `INSERT INTO tasks (user_id, title, description, category, priority, status, due_date)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     RETURNING *`,
                    [
                        userId,
                        title.trim(),
                        description?.trim() || null,
                        category?.trim() || null,
                        priority || 'Medium',
                        status || 'todo',
                        dueDateValue
                    ]
                );
                
                const row = result.rows[0];
                createdTasks.push({
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
            
            await client.query('COMMIT');
            
            res.status(201).json({ 
                message: `成功创建 ${createdTasks.length} 个任务`,
                tasks: createdTasks 
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('Batch create tasks error:', error);
        res.status(500).json({ 
            message: '批量创建任务时发生内部服务器错误' 
        });
    }
});

// Batch update
router.put('/batch', async (req, res) => {
    try {
        const { userId } = req.user;
        const { updates } = req.body;
        
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ 
                message: '更新数组是必需的' 
            });
        }
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            const updatedTasks = [];
            
            for (const updateData of updates) {
                const { id, ...fields } = updateData;
                
                if (!id) continue;
                
                // Check if task exists and belongs to user
                const existingTask = await client.query(
                    'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
                    [id, userId]
                );
                
                if (existingTask.rows.length === 0) continue;
                
                // Build update query
                const updateFields = [];
                const values = [];
                let paramCount = 0;
                
                Object.keys(fields).forEach(field => {
                    if (fields[field] !== undefined) {
                        paramCount++;
                        
                        if (field === 'dueDate') {
                            updateFields.push(`due_date = $${paramCount}`);
                            const dateValue = fields[field] ? new Date(fields[field]) : null;
                            values.push(isNaN(dateValue?.getTime()) ? null : dateValue);
                        } else {
                            updateFields.push(`${field} = $${paramCount}`);
                            values.push(fields[field]);
                        }
                    }
                });
                
                if (updateFields.length === 0) continue;
                
                // Add updated_at
                paramCount++;
                updateFields.push(`updated_at = $${paramCount}`);
                values.push(new Date());
                
                // Add WHERE clause
                paramCount++;
                values.push(id);
                paramCount++;
                values.push(userId);
                
                const query = `
                    UPDATE tasks 
                    SET ${updateFields.join(', ')} 
                    WHERE id = $${paramCount - 1} AND user_id = $${paramCount}
                    RETURNING *
                `;
                
                const result = await client.query(query, values);
                
                if (result.rows.length > 0) {
                    const row = result.rows[0];
                    updatedTasks.push({
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
            }
            
            await client.query('COMMIT');
            
            res.json({ 
                message: `成功更新 ${updatedTasks.length} 个任务`,
                tasks: updatedTasks 
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('Batch update tasks error:', error);
        res.status(500).json({ 
            message: '批量更新任务时发生内部服务器错误' 
        });
    }
});

// Batch delete
router.delete('/batch', async (req, res) => {
    try {
        const { userId } = req.user;
        const { taskIds } = req.body;
        
        if (!Array.isArray(taskIds) || taskIds.length === 0) {
            return res.status(400).json({ 
                message: '任务ID数组是必需的' 
            });
        }
        
        // Create placeholders for the IN clause
        const placeholders = taskIds.map((_, index) => `$${index + 2}`).join(', ');
        
        const result = await pool.query(
            `DELETE FROM tasks WHERE user_id = $1 AND id IN (${placeholders}) RETURNING *`,
            [userId, ...taskIds]
        );
        
        const deletedTasks = result.rows.map(row => ({
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
            message: `成功删除 ${deletedTasks.length} 个任务`,
            tasks: deletedTasks 
        });
        
    } catch (error) {
        console.error('Batch delete tasks error:', error);
        res.status(500).json({ 
            message: '批量删除任务时发生内部服务器错误' 
        });
    }
});

module.exports = router;