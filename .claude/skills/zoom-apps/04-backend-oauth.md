# Backend Authentication and OAuth Guide

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
└── util/
    ├── zoom-api.js            # Zoom API client
    ├── zoom-helpers.js        # OAuth utilities
    ├── store.js               # Data persistence
    └── encrypt.js             # AES encryption
```

## Express Server Setup

```javascript
const express = require('express')
const morgan = require('morgan')
const middleware = require('./middleware')

const zoomAppRouter = require('./api/zoomapp/router')
const zoomRouter = require('./api/zoom/router')

const app = express()

// View engine (for error pages)
app.set('view engine', 'pug')

// Middleware
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(middleware.session)
app.use(middleware.setResponseHeaders)

// Routes
app.use('/api/zoomapp', zoomAppRouter)
app.use('/zoom', zoomRouter)

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500)
  res.json({ error: err.message })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
```

## Environment Configuration

### Required Variables

```javascript
const requiredEnvVars = [
  'ZOOM_APP_CLIENT_ID',
  'ZOOM_APP_CLIENT_SECRET',
  'PUBLIC_URL',
  'SESSION_SECRET',
  'REDIS_ENCRYPTION_KEY',
]

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`)
  }
})

// Derived variables
process.env.ZOOM_HOST = process.env.ZOOM_HOST || 'https://zoom.us'
process.env.ZOOM_APP_REDIRECT_URI = `${process.env.PUBLIC_URL}/api/zoomapp/auth`
```

### Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `ZOOM_APP_CLIENT_ID` | App client ID from Marketplace | `abc123` |
| `ZOOM_APP_CLIENT_SECRET` | App client secret from Marketplace | `secret456` |
| `PUBLIC_URL` | Public HTTPS URL | `https://xyz.ngrok-free.app` |
| `SESSION_SECRET` | Random string for session signing | `random_secret_key` |
| `REDIS_ENCRYPTION_KEY` | 32-byte key for AES encryption | `32_byte_encryption_key` |

## Middleware

### Session Management

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
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
  },
})

module.exports = { session: sessionMiddleware }
```

### Security Headers

```javascript
const setResponseHeaders = (req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://appssdk.zoom.us",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://zoom.us wss://localhost:* ws://localhost:*",
    ].join('; ')
  )

  next()
}
```

## OAuth 2.0 Implementation

### Web-Based OAuth Flow

#### Install Handler

```javascript
// Route: GET /api/zoomapp/install
install(req, res) {
  // 1. Generate and save state for CSRF protection
  req.session.state = generateState()

  // 2. Build OAuth authorization URL
  const domain = process.env.ZOOM_HOST
  const path = 'oauth/authorize'

  const params = {
    redirect_uri: process.env.ZOOM_APP_REDIRECT_URI,
    response_type: 'code',
    client_id: process.env.ZOOM_APP_CLIENT_ID,
    state: req.session.state,
  }

  const authRequestParams = createRequestParamString(params)
  const redirectUrl = `${domain}/${path}?${authRequestParams}`

  // 3. Redirect user to Zoom OAuth page
  res.redirect(redirectUrl)
}
```

#### OAuth Callback Handler

```javascript
// Route: GET /api/zoomapp/auth?code=XXX&state=YYY
async auth(req, res, next) {
  const zoomAuthorizationCode = req.query.code
  const zoomAuthorizationState = req.query.state
  const zoomState = req.session.state

  // Destroy session for security
  req.session.destroy()

  // Validate authorization code
  if (!zoomAuthorizationCode) {
    const error = new Error('No authorization code was provided')
    error.status = 400
    return next(error)
  }

  // Validate state (CSRF protection)
  if (!zoomAuthorizationState || zoomAuthorizationState !== zoomState) {
    const error = new Error('Invalid state parameter')
    error.status = 400
    return next(error)
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await getZoomAccessToken(zoomAuthorizationCode)
    const zoomAccessToken = tokenResponse.data.access_token

    // Get user info
    const userResponse = await getZoomUser(zoomAccessToken)
    const zoomUserId = userResponse.data.id

    // Save tokens to store
    await store.upsertUser(
      zoomUserId,
      tokenResponse.data.access_token,
      tokenResponse.data.refresh_token,
      Date.now() + tokenResponse.data.expires_in * 1000
    )

    // Generate deeplink to return to Zoom client
    const deepLinkResponse = await getDeeplink(zoomAccessToken)
    res.redirect(deepLinkResponse.data.deeplink)

  } catch (error) {
    return next(error)
  }
}
```

### In-Client OAuth Flow (PKCE)

#### Generate Code Challenge

```javascript
// Route: GET /api/zoomapp/authorize
async inClientAuthorize(req, res, next) {
  try {
    // Generate code verifier, challenge and state
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = codeVerifier
    const zoomInClientState = generateState()

    // Save to session
    req.session.codeVerifier = codeVerifier
    req.session.state = zoomInClientState

    // Return to frontend
    return res.json({
      codeChallenge,
      state: zoomInClientState,
    })
  } catch (error) {
    return next(error)
  }
}
```

#### Exchange Code for Token

```javascript
// Route: POST /api/zoomapp/onauthorized
async inClientOnAuthorized(req, res, next) {
  const zoomAuthorizationCode = req.body.code
  const href = req.body.href
  const state = decodeURIComponent(req.body.state)
  const zoomInClientState = req.session.state
  const codeVerifier = req.session.codeVerifier

  try {
    // Validate state
    if (!zoomAuthorizationCode || state !== zoomInClientState) {
      throw new Error('State mismatch')
    }

    // Exchange code for tokens with PKCE verifier
    const tokenResponse = await getZoomAccessToken(
      zoomAuthorizationCode,
      href,
      codeVerifier
    )

    const zoomAccessToken = tokenResponse.data.access_token

    // Get user info
    const userResponse = await getZoomUser(zoomAccessToken)
    const zoomUserId = userResponse.data.id

    req.session.user = zoomUserId

    // Save tokens
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

```javascript
// Route: GET /api/zoomapp/home
home(req, res, next) {
  try {
    // Check for x-zoom-app-context header
    if (!req.headers['x-zoom-app-context']) {
      throw new Error('x-zoom-app-context header is required')
    }

    // Decrypt the Zoom App context header
    const decryptedAppContext = decryptZoomAppContext(
      req.headers['x-zoom-app-context'],
      process.env.ZOOM_APP_CLIENT_SECRET
    )

    // Verify not expired
    if (!decryptedAppContext.exp || decryptedAppContext.exp < Date.now()) {
      throw new Error('x-zoom-app-context header is expired')
    }

    // Persist user id and meetingUUID to session
    req.session.user = decryptedAppContext.uid
    req.session.meetingUUID = decryptedAppContext.mid

  } catch (error) {
    return next(error)
  }

  res.redirect('/api/zoomapp/proxy')
}
```

## Token Storage and Encryption

```javascript
const redis = require('redis')
const encrypt = require('./encrypt')

const db = redis.createClient({
  url: process.env.REDIS_URL,
})

module.exports = {
  getUser: async function (zoomUserId) {
    const user = await db.get(zoomUserId)
    if (!user) {
      return Promise.reject('User not found')
    }
    return JSON.parse(encrypt.beforeDeserialization(user))
  },

  upsertUser: function (zoomUserId, accessToken, refreshToken, expired_at) {
    return db.set(
      zoomUserId,
      encrypt.afterSerialization(
        JSON.stringify({ accessToken, refreshToken, expired_at })
      )
    )
  },

  updateUser: async function (zoomUserId, data) {
    const userData = await db.get(zoomUserId)
    const existingUser = JSON.parse(encrypt.beforeDeserialization(userData))
    const updatedUser = { ...existingUser, ...data }
    return db.set(
      zoomUserId,
      encrypt.afterSerialization(JSON.stringify(updatedUser))
    )
  },

  deleteUser: (zoomUserId) => db.del(zoomUserId),
}
```

## Token Refresh Middleware

```javascript
const refreshToken = async (req, res, next) => {
  const user = req.appUser
  const { expired_at = 0, refreshToken = null } = user

  if (!refreshToken) {
    return next(new Error('No refresh token saved for this user'))
  }

  // Check if expired with 5 second buffer
  if (expired_at && Date.now() >= expired_at - 5000) {
    try {
      const tokenResponse = await refreshZoomAccessToken(user.refreshToken)

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

## API Proxy Setup

```javascript
const { getUser, refreshToken, setZoomAuthHeader } = require('./middleware')
const { createProxyMiddleware } = require('http-proxy-middleware')

const router = express.Router()

router.use(
  '/api',
  getUser,
  refreshToken,
  setZoomAuthHeader,
  createProxyMiddleware({
    target: 'https://api.zoom.us',
    changeOrigin: true,
    pathRewrite: {
      '^/zoom/api': '',
    },
  })
)

module.exports = router
```

### Set Authorization Header

```javascript
const setZoomAuthHeader = async (req, res, next) => {
  try {
    if (!req.session.user) {
      throw new Error('No user in session')
    }

    const user = await store.getUser(req.session.user)

    if (!user || !user.accessToken) {
      throw new Error('No Zoom REST API access token for this user')
    }

    req.headers['Authorization'] = `Bearer ${user.accessToken}`

    return next()
  } catch (error) {
    return next(error)
  }
}
```

## Zoom API Helper Functions

```javascript
const axios = require('axios')

async function getZoomAccessToken(code, redirectUri, codeVerifier) {
  const data = {
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri || process.env.ZOOM_APP_REDIRECT_URI,
  }

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

async function getZoomUser(accessToken) {
  return axios.get('https://api.zoom.us/v2/users/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

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
```

## OAuth Helpers

```javascript
const crypto = require('crypto')

function generateState() {
  return crypto.randomBytes(32).toString('hex')
}

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url')
}

function createRequestParamString(params) {
  return Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&')
}

function decryptZoomAppContext(encryptedContext, secret) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(secret, 'base64'),
    Buffer.alloc(12, 0)
  )

  let decrypted = decipher.update(encryptedContext, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return JSON.parse(decrypted)
}
```

## Data Encryption

```javascript
const crypto = require('crypto')

const ENCRYPTION_KEY = Buffer.from(
  process.env.REDIS_ENCRYPTION_KEY,
  'base64'
)
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

## API Routes Reference

### Zoom App Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/zoomapp/install` | Initiate web-based OAuth |
| GET | `/api/zoomapp/auth` | OAuth callback handler |
| GET | `/api/zoomapp/authorize` | Get PKCE challenge (in-client) |
| POST | `/api/zoomapp/onauthorized` | Exchange code for token (in-client) |
| GET | `/api/zoomapp/home` | App home URL (decrypt context) |

### Zoom API Proxy Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/zoom/api/*` | Proxied Zoom REST API calls |

Example: `/zoom/api/v2/users/me` proxies to `https://api.zoom.us/v2/users/me`

## Best Practices

### 1. State Parameter Validation

```javascript
if (req.query.state !== req.session.state) {
  throw new Error('Invalid state parameter')
}
```

### 2. Token Expiration Buffer

```javascript
if (Date.now() >= expired_at - 5000) {
  // Refresh token
}
```

### 3. Session Cleanup

```javascript
// After exchanging code for token
req.session.destroy()
```

### 4. Error Handling

```javascript
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  })
})
```

## Next Steps

- [RTMS Integration](./05-rtms-integration.md) - Real-Time Media Streams
- [Security Best Practices](./07-security.md) - Security considerations
- [SDK Reference](./08-sdk-reference.md) - SDK method reference
