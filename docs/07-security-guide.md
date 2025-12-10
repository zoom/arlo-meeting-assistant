# Security Best Practices Guide

## Overview

This guide covers security best practices for Zoom Apps, including OAuth security, data protection, session management, and secure coding patterns demonstrated in this reference implementation.

## Security Principles

1. **Defense in Depth** - Multiple layers of security controls
2. **Least Privilege** - Minimal permissions necessary
3. **Secure by Default** - Security built into the design
4. **Fail Securely** - Errors don't expose sensitive information
5. **Never Trust User Input** - Validate and sanitize all inputs

## OAuth 2.0 Security

### CSRF Protection with State Parameter

The `state` parameter prevents Cross-Site Request Forgery attacks.

**Reference:** `backend/api/zoomapp/controller.js:110, 172-176`

```javascript
// Generate random state
req.session.state = crypto.randomBytes(32).toString('hex')

// Redirect to OAuth with state
const redirectUrl = `${domain}/oauth/authorize?client_id=${clientId}&state=${req.session.state}`

// Validate state on callback
if (req.query.state !== req.session.state) {
  throw new Error('Invalid state parameter - possible CSRF attack')
}
```

**Best Practices:**
- Always generate cryptographically random state values
- Store state in server-side session (never trust client)
- Validate state matches exactly before proceeding
- Use one-time state values (don't reuse)

### PKCE (Proof Key for Code Exchange)

PKCE protects in-client OAuth from code interception attacks.

**Reference:** `backend/api/zoomapp/controller.js:14-31`

```javascript
// Generate code verifier and challenge
const codeVerifier = crypto.randomBytes(32).toString('base64url')
const codeChallenge = codeVerifier  // S256 method

// Store verifier securely in session
req.session.codeVerifier = codeVerifier
req.session.state = generateState()

// Return challenge to frontend (safe to expose)
return res.json({
  codeChallenge,
  state,
})
```

**Flow:**
1. Backend generates random code verifier
2. Backend creates code challenge (S256: base64url(sha256(verifier)))
3. Frontend calls SDK with challenge
4. OAuth server stores challenge
5. Frontend receives authorization code
6. Backend exchanges code + verifier for tokens
7. OAuth server validates challenge matches verifier

**Why PKCE?**
- Prevents authorization code interception
- No client secret exposed in client-side code
- Required for native/mobile apps
- Best practice even for confidential clients

### Token Storage

Never store tokens in client-side code or localStorage.

**Secure Storage (Backend):**

**Reference:** `backend/util/store.js:35-53`

```javascript
// Encrypt before storing in Redis
const encryptedData = encrypt.afterSerialization(
  JSON.stringify({
    accessToken,
    refreshToken,
    expired_at,
  })
)

await redis.set(userId, encryptedData)

// Decrypt when retrieving
const userData = await redis.get(userId)
const decrypted = JSON.parse(encrypt.beforeDeserialization(userData))
```

**Why encrypt?**
- Defense against Redis compromise
- Compliance requirements (PCI DSS, HIPAA)
- Best practice for sensitive data

### Token Refresh

Implement automatic token refresh with expiration buffer.

**Reference:** `backend/api/zoom/middleware.js:25-57`

```javascript
const refreshToken = async (req, res, next) => {
  const user = req.appUser
  const { expired_at, refreshToken } = user

  // Check expiration with 5-second buffer
  if (Date.now() >= expired_at - 5000) {
    console.log('Token expired - refreshing')

    const tokenResponse = await zoomApi.refreshZoomAccessToken(refreshToken)

    // Update user with new tokens
    await store.updateUser(req.session.user, {
      accessToken: tokenResponse.data.access_token,
      refreshToken: tokenResponse.data.refresh_token,
      expired_at: Date.now() + tokenResponse.data.expires_in * 1000,
    })
  }

  return next()
}
```

**Best Practices:**
- Refresh proactively (before expiration)
- Use 5-10 second buffer to prevent race conditions
- Update both access and refresh tokens
- Handle refresh failures gracefully
- Log refresh attempts for monitoring

### Session Destruction

Destroy sessions after web-based OAuth for fresh start.

**Reference:** `backend/api/zoomapp/controller.js:160`

```javascript
// After exchanging code for token
const zoomState = req.session.state

// Destroy session immediately for security
req.session.destroy()

// Continue with token exchange
const tokenResponse = await getZoomAccessToken(code)
```

**Why destroy?**
- Prevent session fixation attacks
- Clean slate for new user session
- Remove temporary OAuth state

## Session Management

### Secure Session Configuration

**Reference:** `backend/middleware.js:25-39`

```javascript
const session = require('express-session')
const RedisStore = require('connect-redis')(session)

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,  // Strong random secret
  resave: false,                       // Don't save unchanged sessions
  saveUninitialized: false,           // Don't create empty sessions
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
    httpOnly: true,                                  // No client JS access
    maxAge: 365 * 24 * 60 * 60 * 1000,             // 1 year
    sameSite: 'lax',                                // CSRF protection
  },
  store: new RedisStore({
    client: redisClient,
  }),
})
```

**Security Features:**
- **httpOnly** - Prevents XSS from stealing session cookies
- **secure** - Ensures cookies only sent over HTTPS
- **sameSite** - Prevents CSRF attacks
- **Redis backing** - Distributed session storage
- **Strong secret** - Used for signing cookies

### Session Secret Generation

```bash
# Generate strong session secret (32+ bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Best Practices:**
- Use cryptographically random secrets
- Never commit secrets to version control
- Rotate secrets periodically
- Use different secrets per environment

## Data Encryption

### Encryption at Rest

**Reference:** `backend/util/encrypt.js`

```javascript
const crypto = require('crypto')

const ENCRYPTION_KEY = Buffer.from(
  process.env.REDIS_ENCRYPTION_KEY,
  'base64'
)
const ALGORITHM = 'aes-256-gcm'  // Authenticated encryption

function afterSerialization(data) {
  // Generate random IV for each encryption
  const iv = crypto.randomBytes(16)

  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)

  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  // Get authentication tag
  const authTag = cipher.getAuthTag()

  return JSON.stringify({
    iv: iv.toString('hex'),
    data: encrypted,
    authTag: authTag.toString('hex'),  // Ensures integrity
  })
}

function beforeDeserialization(encrypted) {
  const { iv, data, authTag } = JSON.parse(encrypted)

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(iv, 'hex')
  )

  // Set authentication tag for verification
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))

  let decrypted = decipher.update(data, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
```

**Why AES-256-GCM?**
- Industry standard authenticated encryption
- Provides confidentiality AND integrity
- Prevents tampering with encrypted data
- Fast and secure

**Key Management:**
```bash
# Generate 32-byte encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Best Practices:**
- Use authenticated encryption (GCM mode)
- Generate random IV for each encryption
- Store keys securely (environment variables, key management service)
- Never commit keys to version control
- Rotate keys periodically

## HTTP Security Headers

### Content Security Policy (CSP)

**Reference:** `backend/middleware.js:15-18`

```javascript
res.setHeader(
  'Content-Security-Policy',
  [
    "default-src 'self'",  // Only load from same origin by default
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://appssdk.zoom.us",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://zoom.us wss://localhost:* ws://localhost:*",
    "frame-src 'self'",
    "form-action 'self'",  // Forms can only submit to same origin
  ].join('; ')
)
```

**CSP Directives Explained:**
- `default-src 'self'` - Whitelist approach, deny by default
- `script-src` - Only allow scripts from approved sources
- `connect-src` - Restrict API calls and WebSocket connections
- `form-action` - Prevent form submission to external sites
- `img-src` - Control image sources (important for user-generated content)

**Why CSP?**
- Prevents XSS attacks
- Blocks unauthorized script execution
- Restricts data exfiltration
- Defense in depth

**Generating CSP:**
Use [CSP Evaluator](https://csp-evaluator.withgoogle.com/) to test your policy.

### Other Security Headers

**Reference:** `backend/middleware.js:9-21`

```javascript
// HTTP Strict Transport Security (HSTS)
// Forces HTTPS for 1 year
res.setHeader('Strict-Transport-Security', 'max-age=31536000')

// Prevent MIME type sniffing
// Stops browser from guessing content types
res.setHeader('X-Content-Type-Options', 'nosniff')

// Referrer Policy
// Control what referrer info is sent
res.setHeader('Referrer-Policy', 'same-origin')

// Frame Options
// Prevent clickjacking
res.setHeader('X-Frame-Options', 'SAMEORIGIN')
```

## Input Validation

### Zoom App Context Header Validation

**Reference:** `backend/api/zoomapp/controller.js:252-275`

```javascript
home(req, res, next) {
  try {
    // 1. Validate header exists
    if (!req.headers['x-zoom-app-context']) {
      throw new Error('x-zoom-app-context header is required')
    }

    // 2. Decrypt and parse context
    const decryptedAppContext = decryptZoomAppContext(
      req.headers['x-zoom-app-context'],
      process.env.ZOOM_APP_CLIENT_SECRET
    )

    // 3. Validate expiration
    if (!decryptedAppContext.exp || decryptedAppContext.exp < Date.now()) {
      throw new Error('x-zoom-app-context header is expired')
    }

    // 4. Use validated data
    req.session.user = decryptedAppContext.uid
    req.session.meetingUUID = decryptedAppContext.mid

  } catch (error) {
    return next(error)
  }

  res.redirect('/api/zoomapp/proxy')
}
```

**Best Practices:**
- Validate all required fields exist
- Check data types
- Verify expiration timestamps
- Decrypt using server secret (not trusting client)
- Fail securely on validation errors

### OAuth Parameter Validation

```javascript
// Validate authorization code
if (!zoomAuthorizationCode) {
  const error = new Error('No authorization code was provided')
  error.status = 400
  return next(error)
}

// Validate state parameter
if (!zoomAuthorizationState || zoomAuthorizationState !== zoomState) {
  const error = new Error('Invalid state parameter')
  error.status = 400
  return next(error)
}
```

### User Input Sanitization

```javascript
// Example: Sanitize meeting UUID for file system use
const meetingUUID = payload.meeting_uuid || 'unknown_meeting'
const safeMeetingUUID = meetingUUID.replace(/[^a-zA-Z0-9]/g, '_')

// Use sanitized value for file paths
const fileName = `${timestamp}_${safeMeetingUUID}.wav`
```

## Webhook Security

### URL Validation Challenge

**Reference:** `rtms/websocket/api/controller.js:54-64`

```javascript
function handleUrlValidation(payload, res) {
  if (!payload?.plainToken) {
    return res.sendStatus(400)
  }

  // Generate HMAC-SHA256 signature
  const encryptedToken = crypto
    .createHmac('sha256', process.env.ZOOM_SECRET_TOKEN)
    .update(payload.plainToken)
    .digest('hex')

  return res.json({
    plainToken: payload.plainToken,
    encryptedToken,
  })
}
```

**Why validate webhooks?**
- Ensures webhook comes from Zoom
- Prevents unauthorized webhook calls
- Required for RTMS webhooks

### Webhook Signature Verification

```javascript
function verifyWebhookSignature(req) {
  const signature = req.headers['x-zoom-signature']
  const timestamp = req.headers['x-zoom-timestamp']

  // Verify timestamp to prevent replay attacks
  if (Math.abs(Date.now() - timestamp) > 300000) {  // 5 minutes
    throw new Error('Webhook timestamp too old')
  }

  // Generate expected signature
  const message = `${timestamp}.${JSON.stringify(req.body)}`
  const expectedSignature = crypto
    .createHmac('sha256', process.env.ZOOM_SECRET_TOKEN)
    .update(message)
    .digest('hex')

  // Compare signatures securely
  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )) {
    throw new Error('Invalid webhook signature')
  }
}
```

## API Security

### Authentication Middleware

**Reference:** `backend/api/zoom/middleware.js:60-80`

```javascript
const setZoomAuthHeader = async (req, res, next) => {
  try {
    // 1. Verify user session exists
    if (!req.session.user) {
      throw new Error('No user in session')
    }

    // 2. Get user from secure store
    const user = await store.getUser(req.session.user)

    if (!user) {
      throw new Error('User not found')
    }

    // 3. Verify access token exists
    if (!user.accessToken) {
      throw new Error('No access token for this user')
    }

    // 4. Add authorization header
    req.headers['Authorization'] = `Bearer ${user.accessToken}`

    return next()
  } catch (error) {
    return next(error)
  }
}
```

**Middleware Pipeline:**
```javascript
router.use(
  '/api',
  getUser,              // Load user from session
  refreshToken,         // Auto-refresh if needed
  setZoomAuthHeader,    // Add auth header
  proxyMiddleware       // Forward to Zoom API
)
```

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit')

// Limit OAuth requests to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                   // Max 10 requests per window
  message: 'Too many authentication attempts',
})

app.use('/api/zoomapp/authorize', authLimiter)
app.use('/api/zoomapp/onauthorized', authLimiter)
```

## Secure Coding Practices

### Error Handling

Don't expose sensitive information in error messages:

```javascript
// BAD - Exposes internal details
catch (error) {
  res.status(500).json({ error: error.message })
}

// GOOD - Generic user-facing message
catch (error) {
  console.error('Internal error:', error)  // Log details
  res.status(500).json({
    error: 'An error occurred. Please try again.'
  })
}
```

### Logging

Log security events but not sensitive data:

```javascript
// GOOD - Log actions
console.log('User authenticated:', userId)
console.log('Token refreshed for user:', userId)

// BAD - Never log sensitive data
console.log('Access token:', accessToken)  // DON'T DO THIS
console.log('User password:', password)    // DON'T DO THIS
```

### SQL Injection Prevention

Use parameterized queries, never string concatenation:

```javascript
// BAD - Vulnerable to SQL injection
const query = `SELECT * FROM users WHERE id = '${userId}'`

// GOOD - Use parameterized query
const query = 'SELECT * FROM users WHERE id = ?'
db.query(query, [userId])
```

### Command Injection Prevention

**Reference:** `rtms/utils/audio.js:43-52`

```javascript
// Sanitize file paths for command execution
async function convertRawToWav(inputFile, outputFile) {
  // Use double quotes to handle spaces safely
  const command = `ffmpeg -y -f s16le -ar 16000 -ac 1 -i "${inputFile}" "${outputFile}"`

  try {
    await execAsync(command)
  } catch (err) {
    console.error('Conversion failed:', err)
  } finally {
    // Cleanup temporary files
    fs.unlinkSync(inputFile)
  }
}
```

**Better approach - Use programmatic API:**
```javascript
const ffmpeg = require('fluent-ffmpeg')

ffmpeg(inputFile)
  .inputFormat('s16le')
  .audioFrequency(16000)
  .audioChannels(1)
  .save(outputFile)
```

## Environment Variables

### Required Security Variables

```bash
# OAuth credentials (from Zoom Marketplace)
ZOOM_APP_CLIENT_ID=your_client_id
ZOOM_APP_CLIENT_SECRET=your_client_secret

# Session signing key (32+ bytes, random)
SESSION_SECRET=random_secret_key_here

# Data encryption key (32 bytes, base64 encoded)
REDIS_ENCRYPTION_KEY=base64_encoded_key_here

# Webhook secret (for RTMS)
ZOOM_SECRET_TOKEN=webhook_secret_token

# Public URL (HTTPS required)
PUBLIC_URL=https://your-domain.com
```

### Environment Variable Management

**Best Practices:**
- Never commit `.env` files to version control
- Use different values per environment (dev, staging, prod)
- Rotate secrets regularly
- Use key management service in production (AWS KMS, Azure Key Vault)
- Limit access to production secrets

### .gitignore

```
# Environment variables
.env
.env.local
.env.*.local

# Secrets
secrets/
*.key
*.pem
```

## Production Deployment

### HTTPS Only

```javascript
// Redirect HTTP to HTTPS
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
    res.redirect(`https://${req.header('host')}${req.url}`)
  } else {
    next()
  }
})
```

### Security Checklist

Before deploying to production:

- [ ] All secrets in environment variables (not code)
- [ ] HTTPS enforced on all endpoints
- [ ] CSP configured correctly
- [ ] Session secret is strong and random
- [ ] Token encryption enabled
- [ ] Rate limiting configured
- [ ] Error messages don't expose internal details
- [ ] Logging doesn't include sensitive data
- [ ] Dependencies updated (no known vulnerabilities)
- [ ] Webhook signature verification enabled
- [ ] CORS configured for your domain only
- [ ] Input validation on all user inputs
- [ ] SQL queries use parameterized statements
- [ ] File operations validate paths
- [ ] Authentication required on protected routes

### Security Headers Validation

Use [Security Headers](https://securityheaders.com/) to test your deployment.

### Dependency Security

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

## Compliance

### GDPR Considerations

- Obtain user consent for data processing
- Provide data deletion mechanism
- Implement data portability
- Log data access and modifications
- Encrypt personal data at rest and in transit

### Data Retention

```javascript
// Example: Auto-delete old RTMS recordings
const MAX_AGE_DAYS = 30

function cleanupOldRecordings() {
  const cutoffDate = Date.now() - (MAX_AGE_DAYS * 24 * 60 * 60 * 1000)

  // Delete files older than cutoff
  fs.readdirSync(audioDir).forEach(file => {
    const filePath = path.join(audioDir, file)
    const stats = fs.statSync(filePath)

    if (stats.mtime.getTime() < cutoffDate) {
      fs.unlinkSync(filePath)
      console.log('Deleted old recording:', file)
    }
  })
}

// Run cleanup daily
setInterval(cleanupOldRecordings, 24 * 60 * 60 * 1000)
```

## Incident Response

### Security Monitoring

Log security-relevant events:

```javascript
// Authentication events
console.log('[SECURITY] User authenticated:', { userId, timestamp, ip: req.ip })
console.log('[SECURITY] Authentication failed:', { error, ip: req.ip })

// Authorization events
console.log('[SECURITY] Token refreshed:', { userId, timestamp })
console.log('[SECURITY] Invalid token:', { error, ip: req.ip })

// Access events
console.log('[SECURITY] Sensitive data accessed:', { userId, resource, timestamp })
```

### Alerting

```javascript
// Alert on suspicious activity
function alertSecurityTeam(event) {
  console.error('[ALERT]', event)

  // Send to monitoring service
  // e.g., Sentry, Datadog, PagerDuty
}

// Example: Alert on repeated auth failures
let authFailures = {}
function trackAuthFailure(ip) {
  authFailures[ip] = (authFailures[ip] || 0) + 1

  if (authFailures[ip] > 5) {
    alertSecurityTeam({
      type: 'repeated_auth_failures',
      ip,
      count: authFailures[ip],
    })
  }
}
```

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Zoom App Security Best Practices](https://developers.zoom.us/docs/zoom-apps/security/)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

## Next Steps

- [Architecture Overview](./01-architecture-overview.md) - System architecture
- [Backend Implementation](./04-backend-guide.md) - Backend security implementation
- [SDK Reference](./06-sdk-reference.md) - SDK method reference
