import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import { initDatabase, closeDatabase } from './config/database.js';
import authRoutes from './routes/auth.js';
import claimRoutes from './routes/claims.js';
import verificationRoutes from './routes/verifications.js';
import statsRoutes from './routes/stats.js';
import notificationRoutes from './routes/notifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || ['https://testing-five-omega-90.vercel.app/', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/verifications', verificationRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notifications', notificationRoutes);

// API Welcome endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Selamat datang di Jasa Raharja SAMSAT API (PostgreSQL)',
    version: '2.0.0',
    database: 'PostgreSQL',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        profile: 'GET /api/auth/profile'
      },
      claims: {
        create: 'POST /api/claims',
        search: 'GET /api/claims/search/:query',
        list: 'GET /api/claims (admin)',
        updateStatus: 'PUT /api/claims/:id/status (admin)',
        uploadTransfer: 'POST /api/claims/:id/transfer-proof (admin)'
      },
      verifications: {
        create: 'POST /api/verifications',
        search: 'GET /api/verifications/search/:query',
        list: 'GET /api/verifications (admin)'
      },
      stats: {
        public: 'GET /api/stats/public',
        dashboard: 'GET /api/stats/dashboard (admin)'
      },
      notifications: {
        list: 'GET /api/notifications',
        markRead: 'PUT /api/notifications/:id/read',
        markAllRead: 'PUT /api/notifications/read-all'
      }
    }
  });
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const { getOne } = await import('./config/database.js');
    await getOne('SELECT 1');
    
    res.json({ 
      status: 'OK', 
      message: 'Jasa Raharja SAMSAT API is running',
      database: 'PostgreSQL - Connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'Database connection failed',
      database: 'PostgreSQL - Disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan server',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🔄 Shutting down gracefully...');
  try {
    await closeDatabase();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const startServer = async () => {
  try {
    await initDatabase();
    console.log('✅ PostgreSQL Database connected');

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Jasa Raharja SAMSAT Backend Server                   ║
║                                                            ║
║   Server running on: http://localhost:${PORT}                ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(12)}                      ║
║   Database: PostgreSQL                                     ║
║                                                            ║
║   API Endpoints:                                           ║
║   - Auth:          /api/auth                              ║
║   - Claims:        /api/claims                            ║
║   - Verifications: /api/verifications                     ║
║   - Stats:         /api/stats                             ║
║   - Notifications: /api/notifications                     ║
║   - Health:        /api/health                            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
