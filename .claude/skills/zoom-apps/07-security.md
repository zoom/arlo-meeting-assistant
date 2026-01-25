# Security Best Practices Guide

## Overview

This guide covers security best practices for Zoom Apps, including OAuth security, data protection, session management, and secure coding patterns.

## Security Principles

1. **Defense in Depth** - Multiple layers of security controls
2. **Least Privilege** - Minimal permissions necessary
3. **Secure by Default** - Security built into the design
4. **Fail Securely** - Errors don't expose sensitive information
5. **Never Trust User Input** - Validate and sanitize all inputs

## OAuth 2.0 Security

### CSRF Protection with State Parameter

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
- Store state in server-side session
- Validate state matches exactly before proceeding
- Use one-time state values

### PKCE (Proof Key for Code Exchange)

```javascript
// Generate code verifier and challenge
const codeVerifier = crypto.randomBytes(32).toString('base64url')
const codeChallenge = codeVerifier

// Store verifier securely in session
req.session.codeVerifier = codeVerifier
req.session.state = generateState()

// Return challenge to frontend (safe to expose)
return res.json({ codeChallenge, state })
```

**Why PKCE?**
- Prevents authorization code interception
- No client secret exposed in client-side code
- Required for native/mobile apps
- Best practice even for confidential clients

### Token Storage

Never store tokens in client-side code or localStorage.

```javascript
// Encrypt before storing
const encryptedData = encrypt.afterSerialization(
  JSON.stringify({ accessToken, refreshToken, expired_at })
)

await redis.set(userId, encryptedData)

// Decrypt when retrieving
const userData = await redis.get(userId)
const decrypted = JSON.parse(encrypt.beforeDeserialization(userData))
```

### Token Refresh

```javascript
const refreshToken = async (req, res, next) => {
  const user = req.appUser
  const { expired_at, refreshToken } = user

  // Check expiration with 5-second buffer
  if (Date.now() >= expired_at - 5000) {
    const tokenResponse = await zoomApi.refreshZoomAccessToken(refreshToken)

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
- Use 5-10 second buffer
- Update both access and refresh tokens
- Handle refresh failures gracefully

## Session Management

### Secure Session Configuration

```javascript
const session = require('express-session')
const RedisStore = require('connect-redis')(session)

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
  store: new RedisStore({ client: redisClient }),
})
```

**Security Features:**
- **httpOnly** - Prevents XSS from stealing session cookies
- **secure** - Ensures cookies only sent over HTTPS
- **sameSite** - Prevents CSRF attacks

### Session Secret Generation

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Data Encryption

### Encryption at Rest (AES-256-GCM)

```javascript
const crypto = require('crypto')

const ENCRYPTION_KEY = Buffer.from(process.env.REDIS_ENCRYPTION_KEY, 'base64')
const ALGORITHM = 'aes-256-gcm'

function afterSerialization(data) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)

  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return JSON.stringify({
    iv: iv.toString('hex'),
    data: encrypted,
    authTag: authTag.toString('hex'),
  })
}

function beforeDeserialization(encrypted) {
  const { iv, data, authTag } = JSON.parse(encrypted)

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(iv, 'hex')
  )

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

## HTTP Security Headers

### Content Security Policy (CSP)

```javascript
res.setHeader(
  'Content-Security-Policy',
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://appssdk.zoom.us",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://zoom.us wss://localhost:*",
    "form-action 'self'",
  ].join('; ')
)
```

### Other Security Headers

```javascript
// HTTP Strict Transport Security
res.setHeader('Strict-Transport-Security', 'max-age=31536000')

// Prevent MIME type sniffing
res.setHeader('X-Content-Type-Options', 'nosniff')

// Referrer Policy
res.setHeader('Referrer-Policy', 'same-origin')

// Frame Options (prevent clickjacking)
res.setHeader('X-Frame-Options', 'SAMEORIGIN')
```

## Input Validation

### Zoom App Context Header Validation

```javascript
home(req, res, next) {
  try {
    // Validate header exists
    if (!req.headers['x-zoom-app-context']) {
      throw new Error('x-zoom-app-context header is required')
    }

    // Decrypt and parse context
    const decryptedAppContext = decryptZoomAppContext(
      req.headers['x-zoom-app-context'],
      process.env.ZOOM_APP_CLIENT_SECRET
    )

    // Validate expiration
    if (!decryptedAppContext.exp || decryptedAppContext.exp < Date.now()) {
      throw new Error('x-zoom-app-context header is expired')
    }

    req.session.user = decryptedAppContext.uid
    req.session.meetingUUID = decryptedAppContext.mid

  } catch (error) {
    return next(error)
  }
}
```

### User Input Sanitization

```javascript
// Sanitize meeting UUID for file system use
const meetingUUID = payload.meeting_uuid || 'unknown_meeting'
const safeMeetingUUID = meetingUUID.replace(/[^a-zA-Z0-9]/g, '_')

const fileName = `${timestamp}_${safeMeetingUUID}.wav`
```

## Webhook Security

### URL Validation Challenge

```javascript
function handleUrlValidation(payload, res) {
  if (!payload?.plainToken) {
    return res.sendStatus(400)
  }

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

### Webhook Signature Verification

```javascript
function verifyWebhookSignature(req) {
  const signature = req.headers['x-zoom-signature']
  const timestamp = req.headers['x-zoom-timestamp']

  // Verify timestamp (prevent replay attacks)
  if (Math.abs(Date.now() - timestamp) > 300000) {
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

```javascript
const setZoomAuthHeader = async (req, res, next) => {
  try {
    if (!req.session.user) {
      throw new Error('No user in session')
    }

    const user = await store.getUser(req.session.user)

    if (!user || !user.accessToken) {
      throw new Error('No access token for this user')
    }

    req.headers['Authorization'] = `Bearer ${user.accessToken}`

    return next()
  } catch (error) {
    return next(error)
  }
}
```

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit')

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  message: 'Too many authentication attempts',
})

app.use('/api/zoomapp/authorize', authLimiter)
```

## Secure Coding Practices

### Error Handling

```javascript
// BAD - Exposes internal details
catch (error) {
  res.status(500).json({ error: error.message })
}

// GOOD - Generic user-facing message
catch (error) {
  console.error('Internal error:', error)
  res.status(500).json({
    error: 'An error occurred. Please try again.'
  })
}
```

### Logging

```javascript
// GOOD - Log actions
console.log('User authenticated:', userId)

// BAD - Never log sensitive data
console.log('Access token:', accessToken)  // DON'T DO THIS
```

### SQL Injection Prevention

```javascript
// BAD - Vulnerable
const query = `SELECT * FROM users WHERE id = '${userId}'`

// GOOD - Parameterized query
const query = 'SELECT * FROM users WHERE id = ?'
db.query(query, [userId])
```

## Environment Variables

### Required Security Variables

```bash
# OAuth credentials
ZOOM_APP_CLIENT_ID=your_client_id
ZOOM_APP_CLIENT_SECRET=your_client_secret

# Session signing key (32+ bytes)
SESSION_SECRET=random_secret_key_here

# Data encryption key (32 bytes, base64)
REDIS_ENCRYPTION_KEY=base64_encoded_key_here

# Webhook secret
ZOOM_SECRET_TOKEN=webhook_secret_token

# Public URL (HTTPS required)
PUBLIC_URL=https://your-domain.com
```

### .gitignore

```
.env
.env.local
.env.*.local
secrets/
*.key
*.pem
```

## Production Security Checklist

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
- [ ] Authentication required on protected routes

## Security Headers Validation

Use [Security Headers](https://securityheaders.com/) to test your deployment.

## Dependency Security

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

## GDPR Considerations

- Obtain user consent for data processing
- Provide data deletion mechanism
- Implement data portability
- Log data access and modifications
- Encrypt personal data at rest and in transit

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Zoom App Security Best Practices](https://developers.zoom.us/docs/zoom-apps/security/)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

## Next Steps

- [Backend OAuth](./04-backend-oauth.md) - OAuth implementation
- [SDK Reference](./08-sdk-reference.md) - SDK method reference
