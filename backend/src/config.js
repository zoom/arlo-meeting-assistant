require('dotenv').config({ path: '../.env' });

/**
 * Configuration validation and exports
 * Validates all required environment variables on startup
 */

// =============================================================================
// REQUIRED VARIABLES
// =============================================================================

const requiredEnvVars = [
  'ZOOM_CLIENT_ID',
  'ZOOM_CLIENT_SECRET',
  'PUBLIC_URL',
  'DATABASE_URL',
  'SESSION_SECRET',
  'REDIS_ENCRYPTION_KEY',
];

// Validate required variables
const missing = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach((varName) => console.error(`   - ${varName}`));
  console.error('\nPlease copy .env.example to .env and fill in the values.');
  process.exit(1);
}

// Validate encryption key length (must be 32 characters for AES-256)
if (process.env.REDIS_ENCRYPTION_KEY.length !== 32) {
  console.error('❌ REDIS_ENCRYPTION_KEY must be exactly 32 characters');
  console.error(`   Current length: ${process.env.REDIS_ENCRYPTION_KEY.length}`);
  console.error('   Generate with: node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))"');
  process.exit(1);
}

// =============================================================================
// CONFIGURATION EXPORT
// =============================================================================

module.exports = {
  // Zoom App
  zoomClientId: process.env.ZOOM_CLIENT_ID,
  zoomClientSecret: process.env.ZOOM_CLIENT_SECRET,
  publicUrl: process.env.PUBLIC_URL,
  redirectUri: process.env.ZOOM_APP_REDIRECT_URI || `${process.env.PUBLIC_URL}/api/auth/callback`,

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Security
  sessionSecret: process.env.SESSION_SECRET,
  encryptionKey: process.env.REDIS_ENCRYPTION_KEY,

  // Redis
  redisUrl: process.env.REDIS_URL || null,

  // AI Configuration
  aiEnabled: process.env.AI_ENABLED === 'true',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || null,
  defaultModel: process.env.DEFAULT_MODEL || 'google/gemini-2.0-flash-thinking-exp:free',
  fallbackModel: process.env.FALLBACK_MODEL || 'meta-llama/llama-3.2-3b-instruct:free',

  // Feature Flags
  extractionEnabled: process.env.EXTRACTION_ENABLED === 'true',
  publicLinksEnabled: process.env.PUBLIC_LINKS_ENABLED === 'true',

  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',

  // RTMS
  rtmsWebhookSecret: process.env.RTMS_WEBHOOK_SECRET || null,
  rtmsPort: parseInt(process.env.RTMS_PORT || '3002', 10),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Rate Limiting
  rateLimitFree: parseInt(process.env.RATE_LIMIT_FREE || '10', 10),
  rateLimitPremium: parseInt(process.env.RATE_LIMIT_PREMIUM || '100', 10),

  // File Storage
  vttStoragePath: process.env.VTT_STORAGE_PATH || './storage/vtt',
  s3Bucket: process.env.S3_BUCKET || null,
  s3Region: process.env.S3_REGION || null,
  s3AccessKey: process.env.S3_ACCESS_KEY || null,
  s3SecretKey: process.env.S3_SECRET_KEY || null,
};
