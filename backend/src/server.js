require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
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
      fontSrc: ["'self'"],
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

// Cookie parsing (required for session management)
app.use(cookieParser());

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
app.use('/api/highlights', require('./routes/highlights'));
app.use('/api/home', require('./routes/home'));

// =============================================================================
// FRONTEND PROXY (with friendly startup page)
// =============================================================================

const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');

// Track frontend readiness
let frontendReady = false;

// Check frontend health
async function checkFrontendHealth() {
  try {
    await axios.get('http://frontend:3000', { timeout: 2000 });
    if (!frontendReady) {
      console.log('✅ Frontend is now ready');
    }
    frontendReady = true;
    return true;
  } catch {
    frontendReady = false;
    return false;
  }
}

// Start checking immediately, then periodically until ready
checkFrontendHealth().then(ready => {
  if (!ready) {
    console.log('⏳ Waiting for frontend to be ready...');
    const healthCheckInterval = setInterval(async () => {
      if (await checkFrontendHealth()) {
        clearInterval(healthCheckInterval);
      }
    }, 2000);
  }
});

// HTML page shown while frontend is starting up
const getStartupPage = () => `
<!DOCTYPE html>
<html>
<head>
  <title>Arlo Meeting Assistant - Starting Up</title>
  <meta http-equiv="refresh" content="3">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255,255,255,0.1);
      border-left-color: #4f46e5;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1.5rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: rgba(255,255,255,0.7); font-size: 0.9rem; }
    .subtext { margin-top: 1rem; font-size: 0.8rem; color: rgba(255,255,255,0.5); }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Arlo Meeting Assistant</h1>
    <p>Starting up... please wait</p>
    <p class="subtext">This page will refresh automatically</p>
  </div>
</body>
</html>
`;

// Proxy middleware - DO NOT use ws:true as it intercepts ALL WebSocket upgrades
// Our WebSocket server (initialized separately) handles /ws connections
const frontendProxy = createProxyMiddleware({
  target: 'http://frontend:3000',
  changeOrigin: true,
  ws: false, // IMPORTANT: Don't proxy WebSockets - our WebSocket.Server handles /ws
  logLevel: 'warn',
  onError: (err, req, res) => {
    console.error('Proxy error:', err.message, 'for path:', req.path);
    // Only show startup page for frontend requests, not API requests
    if (!frontendReady && !req.path.startsWith('/api/')) {
      res.writeHead(503, {
        'Content-Type': 'text/html',
        'Retry-After': '3',
      });
      res.end(getStartupPage());
    } else {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway - Frontend temporarily unavailable');
    }
  },
});

// Apply proxy for frontend routes only
app.use((req, res, next) => {
  // Skip API routes, health check, and WebSocket path
  if (req.path.startsWith('/api/') || req.path === '/health' || req.path.startsWith('/ws')) {
    return next();
  }

  // Log Zoom Marketplace webhook validation attempts
  if (req.headers['user-agent']?.includes('Zoom Marketplace')) {
    console.log('⚠️ Zoom Marketplace POST to:', req.path);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('💡 This should be going to /api/rtms/webhook instead');
  }

  // Use the proxy middleware for frontend requests
  frontendProxy(req, res, next);
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
  console.log(`🚀 Arlo Meeting Assistant Backend Server`);
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
