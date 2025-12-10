# Backend Authentication and API Guide

## Overview

This guide covers the Node.js/Express backend implementation for Zoom Apps, including OAuth 2.0 flows, token management, session handling, and Zoom REST API proxy.

## Backend Architecture

```
backend/
├── server.js                   # Express app setup
├── config.js                   # Environment validation
├── middleware.js               # Session & security headers
├── api/
│   ├── zoomapp/
│   │   ├── router.js          # OAuth routes
│   │   └── controller.js      # OAuth handlers
│   ├── zoom/
│   │   ├── router.js          # API proxy routes
│   │   ├── middleware.js      # Token refresh & auth
│   │   └── controller.js      # API proxy logic
│   └── thirdpartyauth/         # Optional third-party OAuth
└── util/
    ├── zoom-api.js            # Zoom API client
    ├── zoom-helpers.js        # OAuth utilities
    ├── store.js               # Redis data persistence
    └── encrypt.js             # AES encryption
```

## Express Server Setup

### Main Server Configuration

**Reference:** `backend/server.js`

```javascript
const express = require('express')
const morgan = require('morgan')
const middleware = require('./middleware')

// Import route handlers
const zoomAppRouter = require('./api/zoomapp/router')
const zoomRouter = require('./api/zoom/router')
const thirdPartyOAuthRouter = require('./api/thirdpartyauth/router')

const app = express()

// View engine (for error pages)
app.set('view engine', 'pug')

// Middleware
app.use(morgan('dev'))                     // HTTP logging
app.use(express.json())                    // Parse JSON bodies
app.use(express.urlencoded({ extended: true }))  // Parse URL-encoded bodies
app.use(middleware.session)                // Session management
app.use(middleware.setResponseHeaders)     // Security headers

// Routes
app.use('/api/zoomapp', zoomAppRouter)     // Zoom App OAuth
app.use('/zoom', zoomRouter)               // Zoom API proxy
app.use('/api/auth0', thirdPartyOAuthRouter)  // Third-party OAuth (optional)

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500)
  res.json({ error: err.message })
})

// Start server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
```

## Environment Configuration

### Required Variables

**Reference:** `backend/config.js`

```javascript
const requiredEnvVars = [
  'ZOOM_APP_CLIENT_ID',
  'ZOOM_APP_CLIENT_SECRET',
  'PUBLIC_URL',
  'SESSION_SECRET',
  'REDIS_ENCRYPTION_KEY',
]

// Validate all required variables exist
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`)
  }
})

// Derived variables
process.env.ZOOM_HOST = process.env.ZOOM_HOST || 'https://zoom.us'
process.env.ZOOM_APP_REDIRECT_URI = `${process.env.PUBLIC_URL}/api/zoomapp/auth`
process.env.ZOOM_APP_CLIENT_URL = process.env.ZOOM_APP_CLIENT_URL || 'http://localhost:9090'
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379'
```

### Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `ZOOM_APP_CLIENT_ID` | App client ID from Marketplace | `abc123` |
| `ZOOM_APP_CLIENT_SECRET` | App client secret from Marketplace | `secret456` |
| `PUBLIC_URL` | Public HTTPS URL (ngrok for dev) | `https://xyz.ngrok-free.app` |
| `SESSION_SECRET` | Random string for session signing | `random_secret_key` |
| `REDIS_ENCRYPTION_KEY` | 32-byte key for AES encryption | `32_byte_encryption_key` |
| `REDIS_URL` | Redis connection URL | `redis://redis:6379` |
| `ZOOM_HOST` | Zoom OAuth server (optional) | `https://zoom.us` |

## Middleware

### Session Management

**Reference:** `backend/middleware.js`

```javascript
const session = require('express-session')
const RedisStore = require('connect-redis')(session)
const redis = require('redis')

const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
})

const sessionMiddleware = session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
    httpOnly: true,                                 // No client-side access
    maxAge: 365 * 24 * 60 * 60 * 1000,            // 1 year
  },
})

module.exports = { session: sessionMiddleware }
```

### Security Headers

**Reference:** `backend/middleware.js`

```javascript
const setResponseHeaders = (req, res, next) => {
  // HSTS - Force HTTPS for 1 year
  res.setHeader('Strict-Transport-Security', 'max-age=31536000')

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://appssdk.zoom.us",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://zoom.us wss://localhost:* ws://localhost:*",
      "frame-src 'self'",
      "form-action 'self'",
    ].join('; ')
  )

  next()
}

module.exports = { setResponseHeaders }
```

## OAuth 2.0 Implementation

### Web-Based OAuth Flow

The traditional OAuth flow redirects users to Zoom for authentication.

#### Step 1: Install Handler

**Reference:** `backend/api/zoomapp/controller.js:104-141`

```javascript
// Route: GET /api/zoomapp/install
install(req, res) {
  console.log('INSTALL HANDLER - Begin add app flow')

  // 1. Generate and save state for CSRF protection
  req.session.state = generateState()
  console.log('Generated state:', req.session.state)

  // 2. Build OAuth authorization URL
  const domain = process.env.ZOOM_HOST  // https://zoom.us
  const path = 'oauth/authorize'

  const params = {
    redirect_uri: process.env.ZOOM_APP_REDIRECT_URI,  // Your callback URL
    response_type: 'code',
    client_id: process.env.ZOOM_APP_CLIENT_ID,
    state: req.session.state,  // CSRF protection
  }

  const authRequestParams = createRequestParamString(params)
  const redirectUrl = `${domain}/${path}?${authRequestParams}`

  console.log('Redirect URL:', redirectUrl)

  // 3. Redirect user to Zoom OAuth page
  res.redirect(redirectUrl)
}
```

#### Step 2: OAuth Callback Handler

**Reference:** `backend/api/zoomapp/controller.js:145-241`

```javascript
// Route: GET /api/zoomapp/auth?code=XXX&state=YYY
async auth(req, res, next) {
  console.log('ZOOM OAUTH REDIRECT HANDLER')

  // 1. Extract and validate code and state
  const zoomAuthorizationCode = req.query.code
  const zoomAuthorizationState = req.query.state
  const zoomState = req.session.state

  // Destroy session for security (fresh start)
  req.session.destroy()

  // 1a. Validate authorization code exists
  if (!zoomAuthorizationCode) {
    const error = new Error('No authorization code was provided')
    error.status = 400
    return next(error)
  }

  console.log('Code param exists:', req.query.code)

  // 1b. Validate state matches (CSRF protection)
  if (!zoomAuthorizationState || zoomAuthorizationState !== zoomState) {
    const error = new Error('Invalid state parameter')
    error.status = 400
    return next(error)
  }

  console.log('State param is correct:', req.query.state)

  try {
    // 2. Exchange code for tokens
    console.log('Getting Zoom access token and user')

    const tokenResponse = await getZoomAccessToken(zoomAuthorizationCode)
    const zoomAccessToken = tokenResponse.data.access_token

    console.log('Token response:', tokenResponse.data)

    // 3. Get user info with access token
    const userResponse = await getZoomUser(zoomAccessToken)
    const zoomUserId = userResponse.data.id

    console.log('User response:', userResponse.data)

    // 4. Save tokens to persistent store (Redis)
    console.log('Saving tokens to store')

    await store.upsertUser(
      zoomUserId,
      tokenResponse.data.access_token,
      tokenResponse.data.refresh_token,
      Date.now() + tokenResponse.data.expires_in * 1000
    )

    // 5. Generate deeplink to return user to Zoom client
    const deepLinkResponse = await getDeeplink(zoomAccessToken)
    const deeplink = deepLinkResponse.data.deeplink

    console.log('Generated deeplink:', deeplink)

    // 6. Redirect to Zoom client via deeplink
    console.log('Redirecting to Zoom client')
    res.redirect(deeplink)

  } catch (error) {
    return next(error)
  }
}
```

### In-Client OAuth Flow (PKCE)

The in-client flow uses PKCE (Proof Key for Code Exchange) for enhanced security.

#### Step 1: Generate Code Challenge

**Reference:** `backend/api/zoomapp/controller.js:8-32`

```javascript
// Route: GET /api/zoomapp/authorize
async inClientAuthorize(req, res, next) {
  console.log('IN-CLIENT AUTHORIZE HANDLER')

  try {
    // 1. Generate code verifier, code challenge and state
    console.log('Generate code verifier, code challenge and state')

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = codeVerifier  // S256 challenge
    const zoomInClientState = generateState()

    // 2. Save code verifier and state to session
    console.log('Save code verifier and state to session')

    req.session.codeVerifier = codeVerifier
    req.session.state = zoomInClientState

    // 3. Return code challenge and state to frontend
    console.log('Return code challenge and state to frontend')

    return res.json({
      codeChallenge,
      state: zoomInClientState,
    })
  } catch (error) {
    return next(error)
  }
}
```

#### Step 2: Exchange Code for Token

**Reference:** `backend/api/zoomapp/controller.js:35-99`

```javascript
// Route: POST /api/zoomapp/onauthorized
async inClientOnAuthorized(req, res, next) {
  console.log('IN-CLIENT ON AUTHORIZED TOKEN HANDLER')

  // 1. Extract parameters from request
  const zoomAuthorizationCode = req.body.code
  const href = req.body.href
  const state = decodeURIComponent(req.body.state)
  const zoomInClientState = req.session.state
  const codeVerifier = req.session.codeVerifier

  console.log('Verify code exists and state matches')

  try {
    // 2. Validate state parameter (CSRF protection)
    if (!zoomAuthorizationCode || state !== zoomInClientState) {
      throw new Error('State mismatch')
    }

    // 3. Exchange authorization code for tokens
    console.log('Getting Zoom access token and user')

    const tokenResponse = await getZoomAccessToken(
      zoomAuthorizationCode,
      href,         // Redirect URI (from frontend)
      codeVerifier  // PKCE verifier
    )

    const zoomAccessToken = tokenResponse.data.access_token

    console.log('Token response data:', tokenResponse.data)

    // 4. Get user info
    console.log('Get Zoom user from Zoom API with access token')

    const userResponse = await getZoomUser(zoomAccessToken)
    const zoomUserId = userResponse.data.id

    req.session.user = zoomUserId

    console.log('User response data:', userResponse.data)

    // 5. Save tokens to persistent store
    console.log('Save the tokens in the store')

    await store.upsertUser(
      zoomUserId,
      tokenResponse.data.access_token,
      tokenResponse.data.refresh_token,
      Date.now() + tokenResponse.data.expires_in * 1000
    )

    return res.json({ result: 'Success' })

  } catch (error) {
    return next(error)
  }
}
```

### App Home URL Handler

When the app opens in Zoom, this handler decrypts the Zoom App context.

**Reference:** `backend/api/zoomapp/controller.js:245-280`

```javascript
// Route: GET /api/zoomapp/home
home(req, res, next) {
  console.log('ZOOM APP HOME URL HANDLER')

  try {
    // 1. Check for x-zoom-app-context header
    if (!req.headers['x-zoom-app-context']) {
      throw new Error('x-zoom-app-context header is required')
    }

    // 2. Decrypt the Zoom App context header
    const decryptedAppContext = decryptZoomAppContext(
      req.headers['x-zoom-app-context'],
      process.env.ZOOM_APP_CLIENT_SECRET
    )

    console.log('Decrypted Zoom App Context:', decryptedAppContext)

    // 3. Verify App Context has not expired
    if (!decryptedAppContext.exp || decryptedAppContext.exp < Date.now()) {
      throw new Error('x-zoom-app-context header is expired')
    }

    console.log(
      'Verifying Zoom App Context is not expired:',
      new Date(decryptedAppContext.exp).toString()
    )

    // 4. Persist user id and meetingUUID to session
    console.log('Persisting user id and meetingUUID')

    req.session.user = decryptedAppContext.uid
    req.session.meetingUUID = decryptedAppContext.mid

  } catch (error) {
    return next(error)
  }

  // 5. Redirect to frontend (React dev server)
  console.log('Redirect to frontend')
  res.redirect('/api/zoomapp/proxy')
}
```

## Zoom API Integration

### Token Storage and Encryption

**Reference:** `backend/util/store.js`

```javascript
const redis = require('redis')
const encrypt = require('./encrypt')

const db = redis.createClient({
  url: process.env.REDIS_URL,
})

module.exports = {
  // Get user from Redis
  getUser: async function (zoomUserId) {
    const user = await db.get(zoomUserId)

    if (!user) {
      console.log('User not found')
      return Promise.reject('User not found')
    }

    // Decrypt before returning
    return JSON.parse(encrypt.beforeDeserialization(user))
  },

  // Insert or update user
  upsertUser: function (zoomUserId, accessToken, refreshToken, expired_at) {
    const isValidUser = Boolean(
      typeof zoomUserId === 'string' &&
      typeof accessToken === 'string' &&
      typeof refreshToken === 'string' &&
      typeof expired_at === 'number'
    )

    if (!isValidUser) {
      return Promise.reject('Invalid user input')
    }

    // Encrypt before storing
    return db.set(
      zoomUserId,
      encrypt.afterSerialization(
        JSON.stringify({ accessToken, refreshToken, expired_at })
      )
    )
  },

  // Update existing user
  updateUser: async function (zoomUserId, data) {
    const userData = await db.get(zoomUserId)
    const existingUser = JSON.parse(encrypt.beforeDeserialization(userData))
    const updatedUser = { ...existingUser, ...data }

    // Encrypt updated data
    return db.set(
      zoomUserId,
      encrypt.afterSerialization(JSON.stringify(updatedUser))
    )
  },

  // Delete user
  deleteUser: (zoomUserId) => db.del(zoomUserId),
}
```

### Token Refresh Middleware

**Reference:** `backend/api/zoom/middleware.js:25-57`

```javascript
// Automatically refresh expired tokens
const refreshToken = async (req, res, next) => {
  console.log('Check validity of access token')

  const user = req.appUser
  const { expired_at = 0, refreshToken = null } = user

  if (!refreshToken) {
    return next(new Error('No refresh token saved for this user'))
  }

  // Check if token is expired (5 second buffer)
  if (expired_at && Date.now() >= expired_at - 5000) {
    try {
      console.log('User access token expired')
      console.log('Refresh Zoom REST API access token')

      // Call Zoom API to refresh token
      const tokenResponse = await refreshZoomAccessToken(user.refreshToken)

      console.log('Save refreshed user token')

      // Update user with new tokens
      await store.updateUser(req.session.user, {
        accessToken: tokenResponse.data.access_token,
        refreshToken: tokenResponse.data.refresh_token,
        expired_at: Date.now() + tokenResponse.data.expires_in * 1000,
      })

    } catch (error) {
      return next(new Error('Error refreshing user token'))
    }
  }

  return next()
}
```

### API Proxy Setup

**Reference:** `backend/api/zoom/middleware.js` and `backend/api/zoom/router.js`

```javascript
const { getUser, refreshToken, setZoomAuthHeader } = require('./middleware')
const { createProxyMiddleware } = require('http-proxy-middleware')

const router = express.Router()

// Middleware pipeline: get user → refresh token → set auth header → proxy
router.use(
  '/api',
  getUser,                // Load user from session
  refreshToken,           // Auto-refresh if expired
  setZoomAuthHeader,      // Add Bearer token to headers
  createProxyMiddleware({ // Proxy to Zoom API
    target: 'https://api.zoom.us',
    changeOrigin: true,
    pathRewrite: {
      '^/zoom/api': '',  // Remove /zoom/api prefix
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log('Proxying:', req.method, req.url)
    },
  })
)

module.exports = router
```

### Set Authorization Header

**Reference:** `backend/api/zoom/middleware.js:60-80`

```javascript
const setZoomAuthHeader = async (req, res, next) => {
  try {
    // 1. Check user exists in session
    if (!req.session.user) {
      throw new Error('No user in session')
    }

    // 2. Get user from store
    const user = await store.getUser(req.session.user)

    if (!user) {
      throw new Error('User from this session not found')
    } else if (!user.accessToken) {
      throw new Error('No Zoom REST API access token for this user yet')
    }

    // 3. Add Authorization header
    req.headers['Authorization'] = `Bearer ${user.accessToken}`

    return next()
  } catch (error) {
    return next(error)
  }
}
```

## Zoom API Helper Functions

### Token Exchange

**Reference:** `backend/util/zoom-api.js`

```javascript
const axios = require('axios')

// Exchange authorization code for access token
async function getZoomAccessToken(code, redirectUri, codeVerifier) {
  const data = {
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri || process.env.ZOOM_APP_REDIRECT_URI,
  }

  // Add code verifier for PKCE flow
  if (codeVerifier) {
    data.code_verifier = codeVerifier
  }

  return axios.post('https://zoom.us/oauth/token', null, {
    params: data,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    auth: {
      username: process.env.ZOOM_APP_CLIENT_ID,
      password: process.env.ZOOM_APP_CLIENT_SECRET,
    },
  })
}

// Refresh expired access token
async function refreshZoomAccessToken(refreshToken) {
  return axios.post('https://zoom.us/oauth/token', null, {
    params: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
    auth: {
      username: process.env.ZOOM_APP_CLIENT_ID,
      password: process.env.ZOOM_APP_CLIENT_SECRET,
    },
  })
}

// Get user info
async function getZoomUser(accessToken) {
  return axios.get('https://api.zoom.us/v2/users/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

// Generate deeplink to return to Zoom client
async function getDeeplink(accessToken) {
  return axios.post(
    'https://api.zoom.us/v2/zoomapp/deeplink',
    {
      action: JSON.stringify({
        url: '/',
        role_name: 'Owner',
        verified: 1,
        role_id: 0,
      }),
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
}

module.exports = {
  getZoomAccessToken,
  refreshZoomAccessToken,
  getZoomUser,
  getDeeplink,
}
```

### OAuth Helpers

**Reference:** `backend/util/zoom-helpers.js`

```javascript
const crypto = require('crypto')

// Generate random state for CSRF protection
function generateState() {
  return crypto.randomBytes(32).toString('hex')
}

// Generate PKCE code verifier
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url')
}

// Create URL query string from params object
function createRequestParamString(params) {
  return Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&')
}

// Decrypt x-zoom-app-context header
function decryptZoomAppContext(encryptedContext, secret) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(secret, 'base64'),
    Buffer.alloc(12, 0)  // IV of 12 bytes filled with 0
  )

  let decrypted = decipher.update(encryptedContext, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return JSON.parse(decrypted)
}

module.exports = {
  generateState,
  generateCodeVerifier,
  createRequestParamString,
  decryptZoomAppContext,
}
```

## Data Encryption

**Reference:** `backend/util/encrypt.js`

```javascript
const crypto = require('crypto')

const ENCRYPTION_KEY = Buffer.from(
  process.env.REDIS_ENCRYPTION_KEY,
  'base64'
)
const ALGORITHM = 'aes-256-gcm'

// Encrypt data before storing in Redis
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

// Decrypt data after retrieving from Redis
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

module.exports = {
  afterSerialization,
  beforeDeserialization,
}
```

## API Routes Reference

### Zoom App Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/zoomapp/install` | Initiate web-based OAuth |
| GET | `/api/zoomapp/auth` | OAuth callback handler |
| GET | `/api/zoomapp/authorize` | Get PKCE challenge (in-client) |
| POST | `/api/zoomapp/onauthorized` | Exchange code for token (in-client) |
| GET | `/api/zoomapp/home` | App home URL (decrypt context) |
| ALL | `/api/zoomapp/proxy` | Proxy to frontend dev server |

### Zoom API Proxy Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/zoom/api/*` | Proxied Zoom REST API calls |

Example: `/zoom/api/v2/users/me` proxies to `https://api.zoom.us/v2/users/me`

## Best Practices

### 1. State Parameter Validation

Always validate the state parameter to prevent CSRF attacks:

```javascript
if (req.query.state !== req.session.state) {
  throw new Error('Invalid state parameter')
}
```

### 2. Token Expiration Buffer

Check token expiration with a buffer to prevent race conditions:

```javascript
// Check if expired with 5 second buffer
if (Date.now() >= expired_at - 5000) {
  // Refresh token
}
```

### 3. Session Cleanup

Destroy sessions after web-based OAuth for security:

```javascript
// After exchanging code for token
req.session.destroy()
```

### 4. Error Handling

Provide clear error messages with appropriate HTTP status codes:

```javascript
app.use((err, req, res, next) => {
  console.error('Error:', err)

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  })
})
```

### 5. Logging

Log all critical operations for debugging:

```javascript
console.log('Step 1: Generate code challenge')
console.log('Step 2: Exchange code for token')
console.log('Step 3: Save tokens to store')
```

## Testing

### Test OAuth Flow

```bash
# 1. Start backend server
npm start

# 2. Navigate to install URL
curl http://localhost:3000/api/zoomapp/install

# 3. Follow redirect to Zoom OAuth

# 4. After authorization, verify callback
# Check server logs for token exchange
```

### Test API Proxy

```bash
# Test proxied API call (requires valid session)
curl http://localhost:3000/zoom/api/v2/users/me \
  -H "Cookie: connect.sid=<session_id>"
```

## Next Steps

- [RTMS Implementation Guide](./05-rtms-guide.md) - Real-Time Media Streams
- [Security Best Practices](./07-security-guide.md) - Security considerations
- [SDK Reference](./06-sdk-reference.md) - SDK method reference
