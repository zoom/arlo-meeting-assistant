# Zoom REST API Integration Guide

## Overview

This guide covers how to make authenticated REST API calls from within Zoom Apps using OAuth access tokens. It includes practical examples for common in-meeting use cases, token management patterns, and best practices for API integration.

## Architecture for API Calls

```
┌─────────────────────────────────────────────┐
│         Zoom App (Frontend)                 │
│  ┌────────────────────────────────────────┐ │
│  │  User clicks button in app             │ │
│  │  "Get Meeting Participants"            │ │
│  └──────────────┬─────────────────────────┘ │
└─────────────────┼───────────────────────────┘
                  │ fetch('/zoom/api/v2/meetings/...')
                  │
         ┌────────▼─────────────────────────────┐
         │   Backend Server (Proxy)             │
         │  1. Check session for user ID        │
         │  2. Get stored access token          │
         │  3. Auto-refresh if expired          │
         │  4. Add Bearer token to headers      │
         │  5. Proxy to Zoom API                │
         └────────┬─────────────────────────────┘
                  │ Authorization: Bearer <token>
                  │
         ┌────────▼─────────────────────────────┐
         │   Zoom REST API                      │
         │   https://api.zoom.us/v2/...         │
         │   - Validate token                   │
         │   - Check scopes                     │
         │   - Return data                      │
         └──────────────────────────────────────┘
```

## Prerequisites

1. **OAuth Access Token** - User must authorize your app first
2. **Backend API Proxy** - Server-side proxy to handle token management
3. **Required Scopes** - App must have appropriate scopes for the API endpoints
4. **Active Session** - User session with stored user ID

## Token Management Lifecycle

### 1. OAuth Authorization Flow

Before making API calls, users must authorize your app:

```javascript
// Frontend: Initiate in-client OAuth
const authorize = async () => {
  // Get PKCE challenge from backend
  const { codeChallenge, state } = await (
    await fetch('/api/zoomapp/authorize')
  ).json()

  // Call SDK authorize method
  await zoomSdk.authorize({ codeChallenge, state })
}

// Listen for authorization completion
zoomSdk.addEventListener('onAuthorized', async (event) => {
  const { code, state } = event

  // Exchange code for tokens on backend
  await fetch('/api/zoomapp/onauthorized', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state, href: window.location.href }),
  })

  console.log('User authorized - access token stored')
})
```

### 2. Token Storage

Backend stores tokens securely with encryption:

```javascript
// backend/util/store.js
const store = {
  // Store user's tokens (encrypted)
  upsertUser: async (zoomUserId, accessToken, refreshToken, expired_at) => {
    const encrypted = encrypt.afterSerialization(
      JSON.stringify({ accessToken, refreshToken, expired_at })
    )
    await redis.set(zoomUserId, encrypted)
  },

  // Retrieve user's tokens (decrypted)
  getUser: async (zoomUserId) => {
    const encrypted = await redis.get(zoomUserId)
    if (!encrypted) throw new Error('User not found')

    return JSON.parse(encrypt.beforeDeserialization(encrypted))
  },
}
```

### 3. Automatic Token Refresh

Backend middleware automatically refreshes expired tokens:

```javascript
// backend/api/zoom/middleware.js
const refreshTokenMiddleware = async (req, res, next) => {
  const user = req.appUser
  const { expired_at, refreshToken } = user

  // Check if token expired (with 5 second buffer)
  if (Date.now() >= expired_at - 5000) {
    // Refresh token with Zoom
    const response = await axios.post('https://zoom.us/oauth/token', null, {
      params: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${CLIENT_ID}:${CLIENT_SECRET}`
        ).toString('base64')}`,
      },
    })

    // Update stored tokens
    await store.updateUser(req.session.user, {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expired_at: Date.now() + response.data.expires_in * 1000,
    })
  }

  next()
}
```

## Making API Calls from Frontend

### Basic Pattern

```javascript
// Frontend API call pattern
async function callZoomAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`/zoom/api${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Zoom API error:', error)
    throw error
  }
}
```

### Example: Get Current User Info

```javascript
async function getCurrentUser() {
  const user = await callZoomAPI('/v2/users/me')

  console.log('User info:', {
    id: user.id,
    email: user.email,
    name: `${user.first_name} ${user.last_name}`,
    type: user.type, // 1=Basic, 2=Licensed, 3=On-prem
  })

  return user
}
```

## Common In-Meeting Use Cases

### 1. Get Meeting Information

```javascript
async function getMeetingInfo(meetingId) {
  // Get detailed meeting information
  const meeting = await callZoomAPI(`/v2/meetings/${meetingId}`)

  return {
    id: meeting.id,
    uuid: meeting.uuid,
    topic: meeting.topic,
    type: meeting.type,
    start_time: meeting.start_time,
    duration: meeting.duration,
    timezone: meeting.timezone,
    host_id: meeting.host_id,
    settings: meeting.settings,
  }
}

// Usage in Zoom App
const handleGetMeetingInfo = async () => {
  // Get meeting UUID from SDK
  const { meetingUUID } = await zoomSdk.getMeetingContext()

  // Fetch meeting details
  const meetingInfo = await getMeetingInfo(meetingUUID)
  setMeetingData(meetingInfo)
}
```

### 2. Get Meeting Participants

```javascript
async function getMeetingParticipants(meetingId) {
  // Get list of current meeting participants
  const response = await callZoomAPI(
    `/v2/metrics/meetings/${meetingId}/participants`
  )

  return response.participants.map(p => ({
    id: p.id,
    user_id: p.user_id,
    name: p.name,
    email: p.user_email,
    join_time: p.join_time,
    leave_time: p.leave_time,
    duration: p.duration,
    status: p.status, // 'in_meeting' or 'in_waiting_room'
  }))
}

// Display in UI
const ParticipantsList = () => {
  const [participants, setParticipants] = useState([])

  useEffect(() => {
    async function loadParticipants() {
      const { meetingUUID } = await zoomSdk.getMeetingContext()
      const data = await getMeetingParticipants(meetingUUID)
      setParticipants(data)
    }

    loadParticipants()

    // Refresh every 10 seconds
    const interval = setInterval(loadParticipants, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      <h3>Meeting Participants ({participants.length})</h3>
      <ul>
        {participants.map(p => (
          <li key={p.id}>{p.name} - {p.status}</li>
        ))}
      </ul>
    </div>
  )
}
```

### 3. Get User's Meetings

```javascript
async function getUserMeetings(type = 'scheduled') {
  // type: 'scheduled', 'live', or 'upcoming'
  const response = await callZoomAPI('/v2/users/me/meetings', {
    params: { type, page_size: 30 },
  })

  return response.meetings.map(m => ({
    id: m.id,
    uuid: m.uuid,
    topic: m.topic,
    start_time: m.start_time,
    duration: m.duration,
    join_url: m.join_url,
  }))
}

// Display upcoming meetings
const UpcomingMeetings = () => {
  const [meetings, setMeetings] = useState([])

  useEffect(() => {
    getUserMeetings('upcoming').then(setMeetings)
  }, [])

  return (
    <div>
      <h3>Your Upcoming Meetings</h3>
      {meetings.map(m => (
        <div key={m.id}>
          <h4>{m.topic}</h4>
          <p>Starts: {new Date(m.start_time).toLocaleString()}</p>
          <p>Duration: {m.duration} minutes</p>
        </div>
      ))}
    </div>
  )
}
```

### 4. Create a Meeting

```javascript
async function createMeeting(topic, startTime, duration = 60) {
  const meeting = await callZoomAPI('/v2/users/me/meetings', {
    method: 'POST',
    body: {
      topic: topic,
      type: 2, // Scheduled meeting
      start_time: startTime,
      duration: duration,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        approval_type: 2, // No registration required
      },
    },
  })

  return {
    id: meeting.id,
    topic: meeting.topic,
    start_url: meeting.start_url,
    join_url: meeting.join_url,
    password: meeting.password,
  }
}

// Usage
const CreateMeetingButton = () => {
  const handleCreate = async () => {
    const startTime = new Date()
    startTime.setHours(startTime.getHours() + 1) // 1 hour from now

    const meeting = await createMeeting(
      'Team Standup',
      startTime.toISOString(),
      30
    )

    console.log('Meeting created:', meeting.join_url)
    alert(`Meeting created! Join URL: ${meeting.join_url}`)
  }

  return <button onClick={handleCreate}>Schedule Meeting</button>
}
```

### 5. Update Meeting Settings

```javascript
async function updateMeetingSettings(meetingId, settings) {
  await callZoomAPI(`/v2/meetings/${meetingId}`, {
    method: 'PATCH',
    body: { settings },
  })
}

// Enable waiting room mid-meeting
const toggleWaitingRoom = async (meetingId, enable) => {
  await updateMeetingSettings(meetingId, {
    waiting_room: enable,
  })

  console.log(`Waiting room ${enable ? 'enabled' : 'disabled'}`)
}
```

### 6. Get Cloud Recordings

```javascript
async function getUserRecordings(userId = 'me', from, to) {
  const response = await callZoomAPI('/v2/users/me/recordings', {
    params: {
      from: from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0], // 30 days ago
      to: to || new Date().toISOString().split('T')[0], // today
    },
  })

  return response.meetings.map(m => ({
    topic: m.topic,
    start_time: m.start_time,
    recording_count: m.recording_count,
    recording_files: m.recording_files.map(f => ({
      type: f.recording_type,
      download_url: f.download_url,
      play_url: f.play_url,
      file_size: f.file_size,
    })),
  }))
}
```

### 7. Send In-Meeting Chat Message (via Bot)

```javascript
async function sendChatMessage(meetingId, message, toUserId = null) {
  // Send chat message to meeting (requires chatbot token)
  await callZoomAPI('/v2/im/chat/messages', {
    method: 'POST',
    body: {
      message: message,
      to_meeting: meetingId,
      to_contact: toUserId, // optional, send to specific user
    },
  })
}
```

## Pagination Handling

Many Zoom API endpoints return paginated results:

```javascript
async function getAllPages(endpoint, params = {}) {
  const allResults = []
  let nextPageToken = null

  do {
    const response = await callZoomAPI(endpoint, {
      params: {
        ...params,
        page_size: 100,
        next_page_token: nextPageToken,
      },
    })

    allResults.push(...(response.meetings || response.users || response.participants))
    nextPageToken = response.next_page_token
  } while (nextPageToken)

  return allResults
}

// Usage: Get all user's meetings
const allMeetings = await getAllPages('/v2/users/me/meetings', {
  type: 'scheduled',
})
```

## Error Handling

### Frontend Error Handling

```javascript
async function callZoomAPIWithErrorHandling(endpoint, options) {
  try {
    const response = await fetch(`/zoom/api${endpoint}`, options)

    if (!response.ok) {
      const error = await response.json()

      // Handle specific error codes
      switch (response.status) {
        case 401:
          throw new Error('Unauthorized - please sign in again')
        case 403:
          throw new Error('Forbidden - missing required scope')
        case 404:
          throw new Error('Resource not found')
        case 429:
          throw new Error('Rate limit exceeded - please try again later')
        default:
          throw new Error(error.message || 'API request failed')
      }
    }

    return await response.json()
  } catch (error) {
    console.error('Zoom API error:', error)

    // Show user-friendly error
    showNotification({
      type: 'error',
      message: error.message,
    })

    throw error
  }
}
```

### Backend Error Handling

```javascript
// backend/api/zoom/middleware.js
const handleProxyErrors = (err, req, res, next) => {
  console.error('Zoom API proxy error:', err)

  if (err.message.includes('access token')) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Please authorize the app to access Zoom APIs',
    })
  }

  if (err.message.includes('refresh token')) {
    return res.status(401).json({
      error: 'session_expired',
      message: 'Your session has expired. Please sign in again.',
    })
  }

  res.status(500).json({
    error: 'internal_error',
    message: 'An error occurred while processing your request',
  })
}

app.use('/zoom', zoomRouter)
app.use(handleProxyErrors)
```

## Rate Limiting

Zoom API has rate limits. Handle them gracefully:

```javascript
async function callZoomAPIWithRetry(endpoint, options, maxRetries = 3) {
  let retries = 0

  while (retries < maxRetries) {
    try {
      const response = await fetch(`/zoom/api${endpoint}`, options)

      if (response.status === 429) {
        // Rate limited
        const retryAfter = response.headers.get('Retry-After') || 1
        console.log(`Rate limited. Retrying after ${retryAfter}s...`)

        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        retries++
        continue
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      if (retries === maxRetries - 1) throw error
      retries++
      await new Promise(resolve => setTimeout(resolve, 1000 * retries))
    }
  }
}
```

## Required Scopes by Use Case

| Use Case | Endpoint | Required Scope |
|----------|----------|----------------|
| Get user info | `GET /v2/users/me` | `user:read:user` |
| List meetings | `GET /v2/users/me/meetings` | `meeting:read:meeting` |
| Create meeting | `POST /v2/users/me/meetings` | `meeting:write:meeting` |
| Update meeting | `PATCH /v2/meetings/{id}` | `meeting:write:meeting` |
| Get participants | `GET /v2/metrics/meetings/{id}/participants` | `dashboard_meetings:read:admin` |
| Get recordings | `GET /v2/users/me/recordings` | `recording:read:recording` |
| Start RTMS | Zoom Apps SDK | `rtms:read` or `rtms:write` |
| Send chat | `POST /v2/im/chat/messages` | `imchat:bot` |

Configure scopes in Marketplace → Scopes.

## Best Practices

### 1. Cache API Responses

```javascript
const cache = new Map()

async function getCachedMeetingInfo(meetingId, ttl = 60000) {
  const cacheKey = `meeting:${meetingId}`
  const cached = cache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data
  }

  const data = await getMeetingInfo(meetingId)
  cache.set(cacheKey, { data, timestamp: Date.now() })

  return data
}
```

### 2. Use the `/me` Context

Instead of looking up user IDs, use `/me` for user-specific endpoints:

```javascript
// Good - uses /me
const user = await callZoomAPI('/v2/users/me')
const meetings = await callZoomAPI('/v2/users/me/meetings')

// Avoid - requires user ID lookup
const userId = await lookupUserId()
const user = await callZoomAPI(`/v2/users/${userId}`)
```

### 3. Handle Token Expiration Gracefully

```javascript
async function callAPIWithAuthRetry(endpoint, options) {
  try {
    return await callZoomAPI(endpoint, options)
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      // Token might be expired, prompt re-auth
      console.log('Token expired, prompting user to re-authorize')
      await promptReauthorization()

      // Retry once after re-auth
      return await callZoomAPI(endpoint, options)
    }
    throw error
  }
}

async function promptReauthorization() {
  const shouldReauth = window.confirm(
    'Your session has expired. Would you like to sign in again?'
  )

  if (shouldReauth) {
    // Trigger OAuth flow
    await authorize()
  }
}
```

### 4. Batch Requests When Possible

```javascript
async function getBatchUserInfo(userIds) {
  // Instead of N API calls, batch them
  return await Promise.all(
    userIds.map(id => callZoomAPI(`/v2/users/${id}`))
  )
}
```

### 5. Log API Calls for Debugging

```javascript
const originalFetch = window.fetch

window.fetch = async function(url, options) {
  if (url.includes('/zoom/api')) {
    console.log('API Call:', {
      url,
      method: options?.method || 'GET',
      timestamp: new Date().toISOString(),
    })
  }

  const response = await originalFetch(url, options)

  if (url.includes('/zoom/api')) {
    console.log('API Response:', {
      url,
      status: response.status,
      timestamp: new Date().toISOString(),
    })
  }

  return response
}
```

## Complete Example: Meeting Dashboard

```javascript
import { useState, useEffect } from 'react'

function MeetingDashboard() {
  const [meetingInfo, setMeetingInfo] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadMeetingData() {
      try {
        // Get meeting context from SDK
        const { meetingUUID } = await zoomSdk.getMeetingContext()

        // Fetch meeting info and participants in parallel
        const [info, parts] = await Promise.all([
          callZoomAPI(`/v2/meetings/${meetingUUID}`),
          callZoomAPI(`/v2/metrics/meetings/${meetingUUID}/participants`),
        ])

        setMeetingInfo(info)
        setParticipants(parts.participants)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadMeetingData()

    // Refresh participants every 30 seconds
    const interval = setInterval(() => {
      zoomSdk.getMeetingContext().then(({ meetingUUID }) => {
        callZoomAPI(`/v2/metrics/meetings/${meetingUUID}/participants`)
          .then(data => setParticipants(data.participants))
      })
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  if (loading) return <div>Loading meeting data...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="meeting-dashboard">
      <h2>{meetingInfo.topic}</h2>
      <p>Host: {meetingInfo.host_email}</p>
      <p>Started: {new Date(meetingInfo.start_time).toLocaleString()}</p>

      <h3>Participants ({participants.length})</h3>
      <ul>
        {participants.map(p => (
          <li key={p.id}>
            {p.name} ({p.status})
            {p.leave_time && ` - Left at ${new Date(p.leave_time).toLocaleTimeString()}`}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

## Troubleshooting

### Issue: 401 Unauthorized

**Causes:**
- User hasn't authorized the app
- Access token expired and refresh failed
- Invalid or missing token

**Solutions:**
- Check if user has completed OAuth flow
- Verify token refresh middleware is working
- Check backend logs for token refresh errors
- Prompt user to re-authorize

### Issue: 403 Forbidden

**Causes:**
- Missing required scope
- Insufficient permissions
- Account-level restrictions

**Solutions:**
- Verify scope is added in Marketplace → Scopes
- Check user's role and permissions
- Review scope descriptions in scope request

### Issue: 404 Not Found

**Causes:**
- Invalid meeting/user ID
- Meeting has ended
- Resource deleted

**Solutions:**
- Verify ID format (use UUID for meetings)
- Check if meeting is active
- Handle deleted resources gracefully

## Next Steps

- [Backend Authentication Guide](./04-backend-guide.md) - OAuth implementation details
- [Security Best Practices](./07-security-guide.md) - Secure token storage
- [Frontend Implementation Guide](./03-frontend-guide.md) - SDK integration patterns
- [Zoom REST API Documentation](https://developers.zoom.us/docs/api/) - Complete API reference
