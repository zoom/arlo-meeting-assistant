require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { initWebSocketServer } = require('./services/websocket');
const config = require('./config');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Security headers (required by Zoom Apps)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "appssdk.zoom.us", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      frameSrc: ["'self'", "appssdk.zoom.us"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));

// CORS configuration
const corsOptions = {
  origin: config.corsOrigins,
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

// =============================================================================
// ROUTES
// =============================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '0.5.0',
  });
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/search', require('./routes/search'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/rtms', require('./routes/rtms'));

// Proxy all non-API requests to frontend (for Zoom App)
app.use((req, res, next) => {
  // Skip API routes and health check
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return next();
  }

  // Log Zoom Marketplace webhook validation attempts
  if (req.headers['user-agent']?.includes('Zoom Marketplace')) {
    console.log('⚠️ Zoom Marketplace POST to:', req.path);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('💡 This should be going to /api/rtms/webhook instead');
  }

  // Proxy to frontend
  const axios = require('axios');
  const frontendUrl = `http://frontend:3000${req.path}`;

  // Remove problematic headers that break React dev server
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;

  axios({
    method: req.method,
    url: frontendUrl,
    headers,
    data: req.body,
    responseType: 'stream',
  })
    .then(response => {
      res.status(response.status);
      Object.keys(response.headers).forEach(key => {
        res.setHeader(key, response.headers[key]);
      });
      response.data.pipe(res);
    })
    .catch(error => {
      console.error('Proxy error:', error.message);
      res.status(502).send('Bad Gateway - Frontend unavailable');
    });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: err.name || 'Error',
    message: message,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

// =============================================================================
// WEBSOCKET SERVER
// =============================================================================

initWebSocketServer(server);

// =============================================================================
// START SERVER
// =============================================================================

const PORT = config.port;

server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`🚀 Meeting Assistant Backend Server`);
  console.log('='.repeat(60));
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Port: ${PORT}`);
  console.log(`Public URL: ${config.publicUrl}`);
  console.log(`Database: ${config.databaseUrl ? 'Connected' : 'Not configured'}`);
  console.log(`AI Enabled: ${config.aiEnabled}`);
  console.log(`Default Model: ${config.defaultModel}`);
  console.log('='.repeat(60));
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server };
