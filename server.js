require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const path = require('path');
const pool = require('./db');

const app = express();
const PORT = parseInt(process.env.NODE_PORT) || 6007;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
    store: new PgSession({ pool, tableName: 'system_http_sessions' }),
    secret: process.env.SESSION_SECRET || 'erp-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, secure: false, httpOnly: true }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/templates', authRoutes.requireAuth, require('./routes/templates'));
app.use('/api/workflows', authRoutes.requireAuth, require('./routes/workflows'));
app.use('/api/tasks', authRoutes.requireAuth, require('./routes/tasks'));
app.use('/api/dashboard', authRoutes.requireAuth, require('./routes/dashboard'));
app.use('/api/penalties', authRoutes.requireAuth, require('./routes/penalties'));
app.use('/api/docs', authRoutes.requireAuth, require('./routes/docs'));

// SPA fallback
app.get('/', (req, res) => {
    if (!req.session.userId) return res.redirect('/login.html');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start SLA tracker
const SLATracker = require('./services/sla-tracker');

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ERP] Business ERP running on http://0.0.0.0:${PORT}`);
    SLATracker.start();
});
