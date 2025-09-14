import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import { Server as socketIo } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import SocketHandlers from './handlers/socketHandlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '.env') });

import { testConnection } from './config/database.js';
import { 
  sanitizeInput, 
  errorHandler, 
  notFoundHandler 
} from './middleware/validation.js';
import { 
  intrusionDetection, 
  sessionSecurity 
} from './middleware/security.js';

// Import routes
import authRoutes from './routes/auth.js';
import agentRoutes from './routes/agents.js';
import adminRoutes from './routes/admin.js';
import conversationRoutes from './routes/conversations.js';
import chatRoutes from './routes/chat.js';
import whatsappRoutes from './routes/whatsapp.js';
import paymentRoutes from './routes/payment.js';
import integrationRoutes from './routes/integrations.js';
import backupRoutes from './routes/backup.js';
import notificationRoutes from './routes/notifications.js';
import analyticsRoutes from './routes/analytics.js';
import barbeariaRoutes from './routes/barbearia.js';

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://yourdomain.com'] 
      : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080', 'http://localhost'],
    methods: ['GET', 'POST']
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.tailwindcss.com"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

// Middleware de detecção de intrusão
app.use(intrusionDetection);

// Middleware de segurança de sessão
app.use(sessionSecurity);

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080', 'http://localhost'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));



// Logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Body parsing middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Input sanitization
app.use(sanitizeInput);

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);



// Serve admin panel static files
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/barbearia', barbeariaRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Initialize Socket.IO handlers
const socketHandlers = new SocketHandlers(io);
socketHandlers.initialize();

// Make io and socketHandlers available to routes
app.set('io', io);
app.set('socketHandlers', socketHandlers);

// 404 handler
app.use(notFoundHandler);

// Global error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🔄 Received ${signal}. Shutting down gracefully...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.log('❌ Forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.log('⚠️  Starting server without database connection');
      console.log('📝 Please check your database configuration in .env file');
    }
    
    // Initialize integration service
    const { default: integrationService } = await import('./services/integrationService.js');
    integrationService.loadIntegrations().catch(console.error);
    
    // Initialize backup service
    const { default: backupService } = await import('./services/backupService.js');
    await backupService.initializeScheduledJobs();
    console.log('✅ Backup service initialized');
    
    // Initialize notification service
    const { default: notificationService } = await import('./services/notificationService.js');
    await notificationService.initializeScheduledNotifications();
    console.log('✅ Notification service initialized');
    
    // Initialize analytics service
    const { default: analyticsService } = await import('./services/analyticsService.js');
    
    // Limpeza automática de dados antigos de analytics (manter 1 ano)
    setInterval(() => {
        analyticsService.cleanupOldData(365);
    }, 24 * 60 * 60 * 1000); // Executar diariamente
    console.log('✅ Analytics service initialized');
    
    server.listen(PORT, () => {
      console.log('\n🚀 ===================================');
      console.log(`🚀 Dinâmica Server Running`);
      console.log(`🚀 Port: ${PORT}`);
      console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🚀 ===================================`);
      console.log(`📊 Admin Panel: http://localhost:${PORT}/admin`);
      console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
      console.log(`🌐 Frontend: http://localhost:5173`);
      console.log('🚀 ===================================\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { app, server, io };