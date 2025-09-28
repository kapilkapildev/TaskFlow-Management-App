const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const router = express.Router();

// Database pool (in production, this would be imported from a db module)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/taskflow_db',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Middleware to authenticate JWT tokens
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        
        req.user = user;
        next();
    });
};

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Validate input
        if (!username || !password) {
            return res.status(400).json({ 
                message: '用户名和密码是必需的' 
            });
        }
        
        // Find user in database
        const userResult = await pool.query(
            'SELECT id, username, password_hash, display_name FROM users WHERE username = $1',
            [username]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ 
                message: '用户名或密码无效' 
            });
        }
        
        const user = userResult.rows[0];
        
        // Verify password
        const passwordValid = await bcrypt.compare(password, user.password_hash);
        
        if (!passwordValid) {
            return res.status(401).json({ 
                message: '用户名或密码无效' 
            });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        // Update last login time
        await pool.query(
            'UPDATE users SET updated_at = now() WHERE id = $1',
            [user.id]
        );
        
        res.json({
            message: '登录成功',
            token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            message: '登录时发生内部服务器错误' 
        });
    }
});

// Register endpoint
router.post('/register', async (req, res) => {
    try {
        const { username, password, displayName } = req.body;
        
        // Validate input
        if (!username || !password) {
            return res.status(400).json({ 
                message: '用户名和密码是必需的' 
            });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ 
                message: '用户名必须至少3个字符' 
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ 
                message: '密码必须至少6个字符' 
            });
        }
        
        // Check if username already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ 
                message: '用户名已存在' 
            });
        }
        
        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Create user
        const newUserResult = await pool.query(
            'INSERT INTO users (username, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, username, display_name',
            [username, passwordHash, displayName || username]
        );
        
        const newUser = newUserResult.rows[0];
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: newUser.id, 
                username: newUser.username 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.status(201).json({
            message: '用户注册成功',
            token,
            user: {
                id: newUser.id,
                username: newUser.username,
                displayName: newUser.display_name
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            message: '注册时发生内部服务器错误' 
        });
    }
});

// Logout endpoint
router.post('/logout', authenticateToken, (req, res) => {
    // In a real application, you might want to blacklist the token
    // For now, we'll just return a success message
    res.json({ message: '成功登出' });
});

// Refresh token endpoint
router.post('/refresh', authenticateToken, async (req, res) => {
    try {
        const { userId, username } = req.user;
        
        // Verify user still exists
        const userResult = await pool.query(
            'SELECT id, username, display_name FROM users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ 
                message: '用户不存在' 
            });
        }
        
        const user = userResult.rows[0];
        
        // Generate new token
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.json({
            message: 'Token刷新成功',
            token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name
            }
        });
        
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ 
            message: '刷新token时发生内部服务器错误' 
        });
    }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        
        const userResult = await pool.query(
            'SELECT id, username, display_name, created_at FROM users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ 
                message: '用户未找到' 
            });
        }
        
        const user = userResult.rows[0];
        
        res.json({
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                createdAt: user.created_at
            }
        });
        
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ 
            message: '获取用户资料时发生内部服务器错误' 
        });
    }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { displayName } = req.body;
        
        if (!displayName || displayName.trim().length === 0) {
            return res.status(400).json({ 
                message: '显示名称是必需的' 
            });
        }
        
        const updatedUserResult = await pool.query(
            'UPDATE users SET display_name = $1, updated_at = now() WHERE id = $2 RETURNING id, username, display_name',
            [displayName.trim(), userId]
        );
        
        if (updatedUserResult.rows.length === 0) {
            return res.status(404).json({ 
                message: '用户未找到' 
            });
        }
        
        const user = updatedUserResult.rows[0];
        
        res.json({
            message: '用户资料更新成功',
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name
            }
        });
        
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ 
            message: '更新用户资料时发生内部服务器错误' 
        });
    }
});

// Change password
router.put('/password', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                message: '当前密码和新密码都是必需的' 
            });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ 
                message: '新密码必须至少6个字符' 
            });
        }
        
        // Get current password hash
        const userResult = await pool.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ 
                message: '用户未找到' 
            });
        }
        
        const user = userResult.rows[0];
        
        // Verify current password
        const passwordValid = await bcrypt.compare(currentPassword, user.password_hash);
        
        if (!passwordValid) {
            return res.status(401).json({ 
                message: '当前密码不正确' 
            });
        }
        
        // Hash new password
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
        
        // Update password
        await pool.query(
            'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
            [newPasswordHash, userId]
        );
        
        res.json({ message: '密码更新成功' });
        
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ 
            message: '更改密码时发生内部服务器错误' 
        });
    }
});

// Export the router and middleware
module.exports = router;
module.exports.authenticateToken = authenticateToken;