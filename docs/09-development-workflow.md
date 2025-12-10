# Development Workflow Guide

## Overview

This guide covers day-to-day development practices for building Zoom Apps, including local development setup, testing strategies, debugging techniques, and common workflows.

## Daily Development Cycle

### Typical Workflow

```
1. Start ngrok (if URL changed → update Marketplace)
2. Start services (backend, frontend, redis)
3. Open app in Zoom client
4. Make code changes
5. Refresh app in Zoom (or auto-reload)
6. Check DevTools console
7. Test changes
8. Commit when working
```

## Local Development Setup

### Using Docker (Recommended)

**Advantages:**
- Consistent environment across team
- All services start with one command
- Redis included automatically
- Easy to reset/clean

**Start all services:**
```bash
docker-compose up --build
```

**View logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Restart specific service:**
```bash
docker-compose restart backend
```

**Stop all services:**
```bash
docker-compose down
```

**Clean restart (remove volumes):**
```bash
docker-compose down -v
docker-compose up --build
```

### Manual Development (Without Docker)

**Advantages:**
- Faster hot reload
- Direct access to processes
- Easier debugging with breakpoints

**Terminal 1 - Redis:**
```bash
redis-server
```

**Terminal 2 - Backend:**
```bash
cd backend
npm run dev  # Uses nodemon for auto-reload
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm start    # Create React App dev server
```

**Terminal 4 - ngrok:**
```bash
ngrok http 3000
```

## Managing ngrok

### Starting ngrok

```bash
ngrok http 3000
```

You'll get output like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

### When ngrok URL Changes

ngrok free tier gives you a new URL each time. When this happens:

**1. Update `.env`:**
```bash
PUBLIC_URL=https://new-url.ngrok-free.app
ZOOM_APP_REDIRECT_URI=https://new-url.ngrok-free.app/api/zoomapp/auth
```

**2. Update Zoom Marketplace:**
- Navigate to your app
- **Basic Information:**
  - Update OAuth Redirect URL
  - Update OAuth Allow List
- **Features → Surface:**
  - Update Home URL
  - Update Domain Allow List
- Click **Save**

**3. Restart backend:**
```bash
# Docker:
docker-compose restart backend

# Manual:
# Ctrl+C and restart: npm run dev
```

**4. Clear Zoom cache (if needed):**
- Quit Zoom completely
- Reopen Zoom
- Or: Zoom menu → Settings → Advanced → Restart

### Using a Fixed ngrok URL

**Paid ngrok plan benefits:**
- Reserved domain (no updates needed)
- Custom subdomain
- More connections

```bash
# With reserved domain
ngrok http --domain=myapp.ngrok-free.app 3000
```

Set this once in `.env` and Marketplace - no more updates needed!

## Hot Reload & Live Development

### Frontend Hot Reload

React dev server automatically reloads on changes:

```bash
cd frontend
npm start
```

Changes to `.js`, `.jsx`, `.css` files trigger instant reload.

**Force refresh in Zoom:**
- Right-click → Inspect Element
- In DevTools: Right-click reload button → Empty Cache and Hard Reload

### Backend Hot Reload

Using nodemon for auto-restart:

```bash
cd backend
npm run dev
```

**package.json:**
```json
{
  "scripts": {
    "dev": "nodemon server.js"
  },
  "devDependencies": {
    "nodemon": "^2.0.0"
  }
}
```

**nodemon.json:**
```json
{
  "watch": ["*.js", "api/**/*.js", "util/**/*.js"],
  "ext": "js,json",
  "ignore": ["node_modules/", "data/"],
  "delay": "1000"
}
```

Changes to backend files automatically restart the server.

### RTMS Development

RTMS webhooks can be tricky during development:

**Testing RTMS locally:**
1. Ensure ngrok is running
2. Update webhook URL in Marketplace
3. Start RTMS server
4. Start meeting and trigger RTMS
5. Check server logs for webhook calls

**Debugging RTMS webhooks:**
```bash
# Watch RTMS logs
docker-compose logs -f rtms-websocket

# Or manual:
cd rtms/websocket
npm run dev
```

## Testing in Zoom Client

### Opening Your App

**In Meeting:**
1. Start or join a meeting
2. Click **Apps** button in toolbar
3. Select your app
4. Click to open

**In Main Client:**
1. Click **Apps** in sidebar
2. Select your app
3. Click to open

### Quick Testing Cycles

**Fast iteration:**
1. Make code change
2. Save file
3. In Zoom app: Right-click → Inspect → Hard Reload
4. Test immediately

**When to full restart:**
- Environment variable changes
- Package.json changes
- Major SDK configuration changes
- Weird behavior (clear cache)

### Testing Different Contexts

Your app behaves differently based on where it runs:

**In Meeting (`inMeeting`):**
- Full SDK access
- Meeting-specific methods work
- RTMS available
- Participant data available

**Main Client (`inMainClient`):**
- Limited SDK methods
- No meeting context
- Good for settings/configuration

**Test both contexts:**
```javascript
useEffect(() => {
  async function checkContext() {
    const config = await zoomSdk.config({ capabilities: [...] })
    console.log('Running context:', config.runningContext)

    if (config.runningContext === 'inMeeting') {
      // Test meeting features
    } else {
      // Test main client features
    }
  }
  checkContext()
}, [])
```

## Debugging Techniques

### Using DevTools

**Open DevTools in Zoom:**
1. Right-click in your app
2. Select "Inspect Element"
3. DevTools opens (Chrome DevTools)

**Essential DevTools panels:**
- **Console:** View logs, errors, SDK responses
- **Network:** See API calls, webhooks, timings
- **Sources:** Set breakpoints, debug code
- **Application:** View localStorage, cookies, session

### Console Debugging

**Add strategic logging:**
```javascript
// SDK calls
console.log('Calling getMeetingContext...')
const context = await zoomSdk.getMeetingContext()
console.log('Meeting context:', context)

// API calls
console.log('Fetching participants...')
const response = await fetch('/zoom/api/v2/meetings/...')
console.log('API response status:', response.status)
const data = await response.json()
console.log('Participants:', data)

// State changes
useEffect(() => {
  console.log('Participants updated:', participants)
}, [participants])
```

**Structured logging:**
```javascript
const log = {
  api: (name, data) => console.log(`[API] ${name}:`, data),
  sdk: (name, data) => console.log(`[SDK] ${name}:`, data),
  error: (name, error) => console.error(`[ERROR] ${name}:`, error),
}

log.sdk('getMeetingContext', context)
log.api('participants', participants)
log.error('fetchFailed', error)
```

### Backend Debugging

**View backend logs:**
```bash
# Docker
docker-compose logs -f backend

# Manual
# Logs appear in terminal where you ran npm run dev
```

**Add backend logging:**
```javascript
// In middleware
console.log('Session user:', req.session.user)
console.log('Access token exists:', !!user.accessToken)

// In API calls
console.log('Making Zoom API call:', endpoint)
console.log('Response status:', response.status)

// In error handlers
console.error('Error details:', {
  message: error.message,
  stack: error.stack,
  endpoint: req.url,
})
```

### Network Debugging

**Check API calls in DevTools:**
1. Open DevTools → Network tab
2. Filter by `/zoom/api/` to see backend proxy calls
3. Check request headers (Authorization present?)
4. Check response (200 OK? 401 Unauthorized?)

**Common issues:**
- **401 Unauthorized:** Token expired or missing
- **403 Forbidden:** Missing scope
- **404 Not Found:** Wrong endpoint or meeting ID
- **500 Server Error:** Check backend logs

### SDK Debugging

**Check SDK configuration:**
```javascript
const config = await zoomSdk.config({
  capabilities: ['getMeetingContext', 'authorize', 'onAuthorized'],
})

console.log('SDK configured:', {
  runningContext: config.runningContext,
  clientVersion: config.clientVersion,
  userContext: config.auth,
})

// Check supported APIs
const { supportedApis } = await zoomSdk.getSupportedJsApis()
console.log('Supported APIs:', supportedApis)
console.log('Has startRTMS?', supportedApis.includes('startRTMS'))
```

**Test individual SDK methods:**
```javascript
// Wrap in try-catch to see errors
try {
  const result = await zoomSdk.getMeetingContext()
  console.log('Success:', result)
} catch (error) {
  console.error('SDK Error:', {
    message: error.message,
    code: error.code,
    details: error,
  })
}
```

## Common Development Issues

### Issue: App Won't Load in Zoom

**Symptoms:**
- Blank screen in Zoom
- Loading spinner forever
- "Unable to load" error

**Debug steps:**
1. Check ngrok is running: Visit ngrok URL in browser
2. Check backend is running: `curl http://localhost:3000/health`
3. Check OWASP headers: View page source, check headers
4. Check Marketplace URLs match ngrok URL
5. Check browser console for CORS errors
6. Clear Zoom cache and restart

**Fix:**
```bash
# Verify backend
curl -I https://your-ngrok-url.ngrok-free.app

# Should see:
# HTTP/1.1 200 OK
# Content-Security-Policy: ...
# X-Content-Type-Options: nosniff
# Strict-Transport-Security: ...

# If missing headers, check backend/middleware.js
```

### Issue: OAuth Not Working

**Symptoms:**
- "Please authorize" prompt loops
- 401 errors on API calls
- Token refresh fails

**Debug steps:**
1. Check backend logs during OAuth flow
2. Verify Client ID and Secret in `.env`
3. Check redirect URI matches exactly
4. Check session is being created
5. Check Redis is running (if using)

**Fix:**
```bash
# Check Redis
redis-cli ping
# Should return: PONG

# Check session in backend logs
# Should see: "Session created for user: <user_id>"

# Test OAuth flow manually
curl http://localhost:3000/api/zoomapp/authorize
# Should return: {"codeChallenge": "...", "state": "..."}
```

### Issue: SDK Methods Fail

**Symptoms:**
- SDK method returns error
- "Not authorized" or "Not available"
- Method doesn't exist

**Debug steps:**
1. Check method in Marketplace → Features → Zoom App SDK
2. Check method in `capabilities` array
3. Check running context (meeting vs. main client)
4. Check client version supports method

**Fix:**
```javascript
// Check if method is supported
const { supportedApis } = await zoomSdk.getSupportedJsApis()
console.log('Method supported?', supportedApis.includes('yourMethod'))

// Check running context
const config = await zoomSdk.config({ capabilities: [...] })
console.log('Context:', config.runningContext)

// Some methods only work in meetings
if (config.runningContext === 'inMeeting') {
  // Safe to call meeting-specific methods
}
```

### Issue: Changes Not Appearing

**Symptoms:**
- Code changes don't show up
- Old version still running
- Styles not updating

**Debug steps:**
1. Check file saved (obvious but often missed!)
2. Check hot reload is working (see terminal)
3. Hard refresh in Zoom (DevTools → Empty cache)
4. Check you're editing the right file
5. Restart backend if backend changes

**Fix:**
```bash
# Frontend not updating:
# Hard reload in DevTools
# Or: Stop and restart npm start

# Backend not updating:
# Check nodemon is watching files
# Or: Restart manually

# Docker not updating:
docker-compose down
docker-compose up --build
```

### Issue: RTMS Webhook Not Received

**Symptoms:**
- No webhook calls in logs
- RTMS data not appearing
- Meeting ends but no files

**Debug steps:**
1. Check ngrok URL is publicly accessible
2. Check webhook URL in Marketplace is correct
3. Check RTMS server is running
4. Check events are subscribed in Marketplace
5. Check webhook signature validation

**Fix:**
```bash
# Test webhook URL
curl -X POST https://your-ngrok-url.ngrok-free.app/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"endpoint.url_validation","payload":{"plainToken":"test"}}'

# Should return encrypted token

# Check RTMS logs
docker-compose logs -f rtms-websocket

# Check Marketplace subscriptions
# Features → Event Subscriptions → Check enabled
```

## Testing Strategies

### Manual Testing Checklist

Before committing changes:

- [ ] App loads in Zoom client
- [ ] OAuth flow works (get user info)
- [ ] API calls return data
- [ ] Error states show properly
- [ ] Works in meeting context
- [ ] Works in main client context
- [ ] No console errors
- [ ] Network requests succeed

### Testing OAuth Flows

**Test in-client OAuth:**
```javascript
// Frontend test
const testOAuth = async () => {
  try {
    // 1. Get challenge
    const { codeChallenge, state } = await fetch('/api/zoomapp/authorize')
      .then(r => r.json())
    console.log('✓ Got challenge')

    // 2. Authorize
    await zoomSdk.authorize({ codeChallenge, state })
    console.log('✓ Authorization started')

    // 3. Wait for onAuthorized event
    // (handled in event listener)

    // 4. Test API call
    const user = await fetch('/zoom/api/v2/users/me').then(r => r.json())
    console.log('✓ Got user:', user.email)
  } catch (error) {
    console.error('✗ OAuth failed:', error)
  }
}
```

### Testing API Integration

**Create test helper:**
```javascript
// frontend/src/testHelpers.js
export const testAPI = {
  async getCurrentUser() {
    console.log('Testing: GET /v2/users/me')
    const response = await fetch('/zoom/api/v2/users/me')
    console.log('Status:', response.status)
    const data = await response.json()
    console.log('Response:', data)
    return data
  },

  async getMeetingParticipants(meetingId) {
    console.log('Testing: GET /v2/metrics/meetings/:id/participants')
    const response = await fetch(`/zoom/api/v2/metrics/meetings/${meetingId}/participants`)
    console.log('Status:', response.status)
    const data = await response.json()
    console.log('Participants:', data.participants.length)
    return data
  },
}

// Use in DevTools console:
// import { testAPI } from './testHelpers'
// testAPI.getCurrentUser()
```

### Testing RTMS

**RTMS test checklist:**
1. Start meeting
2. Open app in meeting
3. Click "Start RTMS"
4. Check backend logs for webhook
5. Speak in meeting (generate audio)
6. Click "Stop RTMS"
7. Check `rtms/app/data/` for files

## Performance Optimization

### Frontend Performance

**Avoid unnecessary re-renders:**
```javascript
// Use React.memo for expensive components
const ParticipantList = React.memo(({ participants }) => {
  return <ul>{participants.map(p => <li key={p.id}>{p.name}</li>)}</ul>
})

// Use useMemo for expensive calculations
const sortedParticipants = useMemo(() => {
  return participants.sort((a, b) => a.name.localeCompare(b.name))
}, [participants])

// Use useCallback for event handlers
const handleClick = useCallback(() => {
  console.log('Clicked')
}, [])
```

**Debounce API calls:**
```javascript
import { useState, useEffect } from 'react'

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// Usage:
const [searchTerm, setSearchTerm] = useState('')
const debouncedSearch = useDebounce(searchTerm, 500)

useEffect(() => {
  if (debouncedSearch) {
    // Make API call only after 500ms of no typing
    searchUsers(debouncedSearch)
  }
}, [debouncedSearch])
```

### Backend Performance

**Cache API responses:**
```javascript
const cache = new Map()

async function getCachedUser(userId) {
  const key = `user:${userId}`

  if (cache.has(key)) {
    const { data, timestamp } = cache.get(key)
    if (Date.now() - timestamp < 60000) { // 1 minute TTL
      return data
    }
  }

  const data = await fetchUserFromZoom(userId)
  cache.set(key, { data, timestamp: Date.now() })
  return data
}
```

## Version Control Best Practices

### What to Commit

**Always commit:**
- Source code (.js, .jsx, .css)
- Package.json and package-lock.json
- Configuration files (except .env)
- .env.example (without secrets)
- Documentation

**Never commit:**
- .env (secrets!)
- node_modules/
- Build artifacts (dist/, build/)
- Log files
- OS files (.DS_Store)
- IDE files (.vscode/, .idea/)

### .gitignore

```gitignore
# Environment
.env
.env.local

# Dependencies
node_modules/
package-lock.json  # or yarn.lock if team uses npm

# Build
dist/
build/
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Data
rtms/app/data/
*.wav
*.mp4
*.txt
```

### Commit Messages

**Good commit messages:**
```bash
git commit -m "Add participant list with live updates"
git commit -m "Fix OAuth redirect loop on token expiry"
git commit -m "Implement RTMS audio streaming"
```

**Bad commit messages:**
```bash
git commit -m "fix bug"
git commit -m "updates"
git commit -m "WIP"
```

## Next Steps

- [Security Best Practices](./07-security-guide.md) - Before going to production
- [API Integration Guide](./08-api-integration-guide.md) - Building features
- [Troubleshooting](./README.md#troubleshooting) - When things go wrong
