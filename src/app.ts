import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { logger } from './logger';
import chatRoutes from './routes/chat.routes';
import { rateLimitMiddleware } from './middleware/rateLimiter';
import { requestLoggingMiddleware } from './middleware/logging.middleware';
import { errorMiddleware } from './middleware/error.middleware';

const app: express.Express = express();
const PORT: number = Number(process.env.PORT) || 3000;

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);
app.use(requestLoggingMiddleware);
// Apply rate limiting
app.use(rateLimitMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply request logging middleware


app.get('/', (req, res) => {
  logger.info('Root endpoint accessed', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.requestId
  });
  res.json({ 
    message: 'Backend is running!', 
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0'
  });
});

app.get('/health', (req, res) => {
  logger.debug('Health check endpoint accessed', {
    ip: req.ip,
    requestId: req.requestId
  });
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '1.0.0'
  });
});

app.use('/api', chatRoutes);

// Global error handler (must be last middleware)
app.use(errorMiddleware);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason, promise });
  process.exit(1);
});
console.log(PORT)
app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
    pid: process.pid,
    timestamp: new Date().toISOString()
  });
});

export default app;