# Zoom REST API Integration Guide

## Overview

This guide covers how to make authenticated REST API calls from Zoom Apps using OAuth access tokens. It includes practical examples for common in-meeting use cases, token management patterns, and best practices.

## Architecture

```
┌─────────────────────────────────────────────┐
│         Zoom App (Frontend)                 │
│  ┌────────────────────────────────────────┐ │
│  │  User clicks button in app             │ │
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
         └──────────────────────────────────────┘
```

## Prerequisites

1. **OAuth Access Token** - User must authorize your app first
2. **Backend API Proxy** - Server-side proxy to handle tokens
3. **Required Scopes** - App must have appropriate scopes
4. **Active Session** - User session with stored user ID

## Making API Calls from Frontend

### Basic Pattern

```javascript
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

### Get Current User Info

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

### Get Meeting Information

```javascript
async function getMeetingInfo(meetingId) {
  const meeting = await callZoomAPI(`/v2/meetings/${meetingId}`)

  return {
    id: meeting.id,
    uuid: meeting.uuid,
    topic: meeting.topic,
    type: meeting.type,
    start_time: meeting.start_time,
    duration: meeting.duration,
    host_id: meeting.host_id,
    settings: meeting.settings,
  }
}

// Usage in Zoom App
const handleGetMeetingInfo = async () => {
  const { meetingUUID } = await zoomSdk.getMeetingContext()
  const meetingInfo = await getMeetingInfo(meetingUUID)
  setMeetingData(meetingInfo)
}
```

### Get Meeting Participants

```javascript
async function getMeetingParticipants(meetingId) {
  const response = await callZoomAPI(
    `/v2/metrics/meetings/${meetingId}/participants`
  )

  return response.participants.map(p => ({
    id: p.id,
    user_id: p.user_id,
    name: p.name,
    email: p.user_email,
    join_time: p.join_time,
    status: p.status, // 'in_meeting' or 'in_waiting_room'
  }))
}
```

### Get User's Meetings

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
```

### Create a Meeting

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
        approval_type: 2,
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
```

### Update Meeting Settings

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
}
```

### Get Cloud Recordings

```javascript
async function getUserRecordings(from, to) {
  const response = await callZoomAPI('/v2/users/me/recordings', {
    params: {
      from: from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0],
      to: to || new Date().toISOString().split('T')[0],
    },
  })

  return response.meetings.map(m => ({
    topic: m.topic,
    start_time: m.start_time,
    recording_files: m.recording_files.map(f => ({
      type: f.recording_type,
      download_url: f.download_url,
      play_url: f.play_url,
    })),
  }))
}
```

## Pagination Handling

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

// Usage
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
    throw error
  }
}
```

## Rate Limiting

```javascript
async function callZoomAPIWithRetry(endpoint, options, maxRetries = 3) {
  let retries = 0

  while (retries < maxRetries) {
    try {
      const response = await fetch(`/zoom/api${endpoint}`, options)

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 1
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

```javascript
// Good - uses /me
const user = await callZoomAPI('/v2/users/me')
const meetings = await callZoomAPI('/v2/users/me/meetings')

// Avoid - requires user ID lookup
const userId = await lookupUserId()
const user = await callZoomAPI(`/v2/users/${userId}`)
```

### 3. Handle Token Expiration

```javascript
async function callAPIWithAuthRetry(endpoint, options) {
  try {
    return await callZoomAPI(endpoint, options)
  } catch (error) {
    if (error.message.includes('401')) {
      console.log('Token expired, prompting re-auth')
      await promptReauthorization()
      return await callZoomAPI(endpoint, options)
    }
    throw error
  }
}
```

### 4. Batch Requests

```javascript
async function getBatchUserInfo(userIds) {
  return await Promise.all(
    userIds.map(id => callZoomAPI(`/v2/users/${id}`))
  )
}
```

## Complete Example: Meeting Dashboard

```javascript
function MeetingDashboard() {
  const [meetingInfo, setMeetingInfo] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadMeetingData() {
      try {
        const { meetingUUID } = await zoomSdk.getMeetingContext()

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
      <h3>Participants ({participants.length})</h3>
      <ul>
        {participants.map(p => (
          <li key={p.id}>{p.name} ({p.status})</li>
        ))}
      </ul>
    </div>
  )
}
```

## Troubleshooting

### 401 Unauthorized

**Causes:**
- User hasn't authorized the app
- Access token expired
- Invalid or missing token

**Solutions:**
- Check if user has completed OAuth flow
- Verify token refresh middleware is working
- Prompt user to re-authorize

### 403 Forbidden

**Causes:**
- Missing required scope
- Insufficient permissions

**Solutions:**
- Verify scope is added in Marketplace → Scopes
- Check user's role and permissions

### 404 Not Found

**Causes:**
- Invalid meeting/user ID
- Meeting has ended

**Solutions:**
- Verify ID format (use UUID for meetings)
- Check if meeting is active

## Next Steps

- [Backend OAuth](./04-backend-oauth.md) - OAuth implementation
- [Security Best Practices](./07-security.md) - Secure token storage
- [Frontend Patterns](./03-frontend-patterns.md) - SDK integration
- [Zoom REST API Documentation](https://developers.zoom.us/docs/api/)
