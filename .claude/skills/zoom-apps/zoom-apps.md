# Zoom Apps Development Skill

## What This Skill Does

This skill provides comprehensive guidance for building Zoom Apps, including:

- **Answer Questions** about Zoom Apps SDK, OAuth, RTMS, and REST API
- **Generate Code** for common Zoom Apps patterns and integrations
- **Provide Marketplace Configuration** guidance and checklists
- **Troubleshoot Issues** with SDK, webhooks, and authentication

## Four Pillars of Zoom Apps Development

### 1. Zoom Apps SDK (Frontend)
JavaScript SDK that runs inside the Zoom client's embedded browser.

**Key Topics:**
- SDK initialization and configuration
- Capabilities and running contexts
- Event listeners and method invocation
- Multi-instance communication (main client ↔ in-meeting)

**See:** [02-sdk-setup.md](./02-sdk-setup.md), [08-sdk-reference.md](./08-sdk-reference.md)

### 2. OAuth/Backend (Authentication)
Server-side OAuth 2.0 flows for user authentication.

**Key Topics:**
- Web-based OAuth flow (redirect)
- In-client OAuth with PKCE (Proof Key for Code Exchange)
- Token storage, refresh, and encryption
- Session management

**See:** [04-backend-oauth.md](./04-backend-oauth.md), [07-security.md](./07-security.md)

### 3. RTMS (Real-Time Media Streams)
Live access to meeting audio, video, and transcripts.

**Key Topics:**
- @zoom/rtms SDK implementation
- WebSocket-based implementation
- Webhook handling (meeting.rtms_started/stopped)
- Audio/video/transcript processing

**See:** [05-rtms-integration.md](./05-rtms-integration.md)

### 4. Zoom REST API
Backend API calls on behalf of authenticated users.

**Key Topics:**
- API proxy pattern with automatic token refresh
- Common endpoints (users, meetings, participants)
- Pagination, rate limiting, and error handling
- Required scopes by use case

**See:** [06-rest-api.md](./06-rest-api.md)

## Quick Reference

### SDK Initialization Template

```javascript
/* globals zoomSdk */

useEffect(() => {
  async function configureSdk() {
    try {
      const configResponse = await zoomSdk.config({
        capabilities: [
          // Core
          'getMeetingContext',
          'getRunningContext',
          'getUserContext',
          'getMeetingUUID',

          // Authentication
          'authorize',
          'onAuthorized',

          // Meeting features
          'getMeetingParticipants',
          'sendAppInvitation',
          'showNotification',

          // RTMS (if needed)
          'startRTMS',
          'stopRTMS',

          // Multi-instance
          'connect',
          'postMessage',
          'onMessage',
        ],
        version: '0.16.0',
      })

      console.log('Running context:', configResponse.runningContext)
      console.log('Auth status:', configResponse.auth.status)
    } catch (error) {
      console.error('SDK config error:', error)
    }
  }

  configureSdk()
}, [])
```

### OAuth PKCE Flow Template

**Frontend:**
```javascript
const authorize = async () => {
  // 1. Get challenge from backend
  const { codeChallenge, state } = await fetch('/api/zoomapp/authorize')
    .then(r => r.json())

  // 2. Call SDK authorize
  await zoomSdk.authorize({ codeChallenge, state })
}

// 3. Listen for completion
zoomSdk.addEventListener('onAuthorized', async (event) => {
  const { code, state } = event
  await fetch('/api/zoomapp/onauthorized', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state, href: window.location.href }),
  })
})
```

**Backend:**
```javascript
// GET /api/zoomapp/authorize
const codeVerifier = crypto.randomBytes(32).toString('base64url')
const state = crypto.randomBytes(32).toString('hex')
req.session.codeVerifier = codeVerifier
req.session.state = state
res.json({ codeChallenge: codeVerifier, state })

// POST /api/zoomapp/onauthorized
const tokenResponse = await getZoomAccessToken(code, href, req.session.codeVerifier)
await store.upsertUser(zoomUserId, tokenResponse.access_token, tokenResponse.refresh_token)
```

### RTMS Start/Stop Template

```javascript
const handleStartRTMS = async () => {
  try {
    await zoomSdk.callZoomApi('startRTMS')
    console.log('RTMS started')
  } catch (error) {
    console.error('RTMS error:', error)
  }
}

const handleStopRTMS = async () => {
  try {
    await zoomSdk.callZoomApi('stopRTMS')
    console.log('RTMS stopped')
  } catch (error) {
    console.error('RTMS error:', error)
  }
}
```

### API Proxy Call Template

```javascript
async function callZoomAPI(endpoint, options = {}) {
  const response = await fetch(`/zoom/api${endpoint}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  return response.json()
}

// Usage
const user = await callZoomAPI('/v2/users/me')
const meetings = await callZoomAPI('/v2/users/me/meetings')
```

## Critical Marketplace Setup Checklist

Before your app will work, ensure these are configured:

- [ ] **Domain Allowlist** - Add `appssdk.zoom.us` (no https://, no trailing slash)
- [ ] **OAuth Redirect URL** - Set to your ngrok/production URL + `/api/zoomapp/auth`
- [ ] **SDK Capabilities** - Add all APIs your app uses in Features > Zoom App SDK
- [ ] **Required Scopes** - Add OAuth scopes for API endpoints you'll call
- [ ] **RTMS Scopes** (if using) - Enable Transcripts/Audio/Video in Scopes
- [ ] **Webhook Events** (if using) - Subscribe to `meeting.rtms_started`, `meeting.rtms_stopped`

**See:** [01-getting-started.md](./01-getting-started.md)

## Required Security Headers

The Zoom Apps platform **requires** these HTTP headers:

```javascript
res.setHeader('Strict-Transport-Security', 'max-age=31536000')
res.setHeader('X-Content-Type-Options', 'nosniff')
res.setHeader('Content-Security-Policy',
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://appssdk.zoom.us")
res.setHeader('Referrer-Policy', 'same-origin')
```

Without these headers, your app will not load in the Zoom client.

## Common Patterns

### Conditional Rendering by Context

```javascript
{runningContext === 'inMeeting' && <MeetingOnlyFeatures />}
{runningContext === 'inMainClient' && <MainClientFeatures />}
```

### Check API Availability

```javascript
const { supportedApis } = await zoomSdk.getSupportedJsApis()
const hasRTMS = supportedApis.includes('startRTMS')
```

### Error Handling

```javascript
try {
  const result = await zoomSdk.getMeetingContext()
  console.log('Success:', result)
} catch (error) {
  console.error('SDK error:', {
    message: error.message,
    code: error.code,
  })
}
```

## Documentation Index

| Document | Topics |
|----------|--------|
| [01-getting-started.md](./01-getting-started.md) | Marketplace setup, environment config, quick start |
| [02-sdk-setup.md](./02-sdk-setup.md) | SDK initialization, capabilities, contexts |
| [03-frontend-patterns.md](./03-frontend-patterns.md) | React patterns, OAuth flows, multi-instance |
| [04-backend-oauth.md](./04-backend-oauth.md) | Express, OAuth flows, token management |
| [05-rtms-integration.md](./05-rtms-integration.md) | RTMS SDK, WebSocket, webhook handling |
| [06-rest-api.md](./06-rest-api.md) | API proxy, common endpoints, pagination |
| [07-security.md](./07-security.md) | PKCE, CSRF, encryption, headers |
| [08-sdk-reference.md](./08-sdk-reference.md) | Complete SDK API reference |

## How to Use This Skill

When users ask about Zoom Apps development:

1. **For questions**: Reference the appropriate documentation section and explain the concept
2. **For code generation**: Use the templates above as starting points, customizing for the user's needs
3. **For troubleshooting**: Check the troubleshooting sections in relevant docs
4. **For configuration**: Walk through the Marketplace setup checklist

## Common Questions

**Q: How do I start building a Zoom App?**
A: See [01-getting-started.md](./01-getting-started.md) for a complete quick start guide.

**Q: How do I authenticate users?**
A: Use OAuth PKCE for in-client authentication. See [04-backend-oauth.md](./04-backend-oauth.md).

**Q: How do I access meeting transcripts?**
A: Use RTMS (Real-Time Media Streams). See [05-rtms-integration.md](./05-rtms-integration.md).

**Q: Why won't my app load in Zoom?**
A: Check: (1) Domain allowlist includes `appssdk.zoom.us`, (2) Security headers are set, (3) ngrok URLs match Marketplace config.

## External Resources

- [Zoom Apps Official Documentation](https://developers.zoom.us/docs/zoom-apps/)
- [Zoom Apps SDK Reference](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html)
- [RTMS Documentation](https://developers.zoom.us/docs/rtms/)
- [Zoom Marketplace](https://marketplace.zoom.us/)
