const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const router = express.Router();

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

        const { rows } = await pool.query(
            'SELECT * FROM system_users WHERE username = $1 AND is_active = 1', [username]
        );
        const user = rows[0];
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        // Update last login
        await pool.query('UPDATE system_users SET last_login = NOW() WHERE id = $1', [user.id]);

        // Set session
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        req.session.department = user.department;
        req.session.displayName = user.display_name || user.username;
        req.session.employeeId = user.employee_id;

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                department: user.department,
                display_name: user.display_name || user.username,
                employee_id: user.employee_id
            }
        });
    } catch (err) {
        console.error('[AUTH] Login error:', err.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

// Current user
router.get('/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    res.json({
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role,
        department: req.session.department,
        display_name: req.session.displayName,
        employee_id: req.session.employeeId,
        isManager: ['owner', 'admin'].includes(req.session.role)
    });
});

// Middleware to require authentication
function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
    next();
}

function requireManager(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
    if (!['owner', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Manager access required' });
    next();
}

router.requireAuth = requireAuth;
router.requireManager = requireManager;

module.exports = router;
