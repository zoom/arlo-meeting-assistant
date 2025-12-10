# Zoom Apps SDK Reference Guide

## Overview

This reference guide provides comprehensive documentation of Zoom Apps JavaScript SDK methods, data structures, events, and common patterns found in this reference implementation.

## SDK Global Object

The Zoom Apps SDK is available globally as `zoomSdk`:

```javascript
/* globals zoomSdk */

// The SDK is available globally when your app runs in Zoom
// No import statement needed
```

## Configuration

### zoomSdk.config()

Configure the SDK with required capabilities before using any other methods.

**Syntax:**
```javascript
const configResponse = await zoomSdk.config({
  capabilities: Array<string>,
  version: string
})
```

**Parameters:**
- `capabilities` - Array of SDK method names and event names
- `version` - SDK version (e.g., `'0.16.0'`)

**Returns:**
```javascript
{
  runningContext: 'inMeeting' | 'inMainClient' | 'inWebinar' | 'inCollaborate',
  auth: {
    status: 'authenticated' | 'unauthenticated' | 'authorized'
  },
  unsupportedApis: Array<string>,
  clientVersion: string
}
```

**Example:**
```javascript
const configResponse = await zoomSdk.config({
  capabilities: [
    'getMeetingContext',
    'authorize',
    'onAuthorized',
  ],
  version: '0.16.0',
})

console.log('Running context:', configResponse.runningContext)
console.log('Auth status:', configResponse.auth.status)
```

## Meeting Context

### zoomSdk.getMeetingContext()

Get information about the current meeting.

**Syntax:**
```javascript
const context = await zoomSdk.getMeetingContext()
```

**Returns:**
```javascript
{
  meetingUUID: string,           // Unique meeting identifier
  meetingID: string,             // Meeting ID (readable)
  meetingTopic: string,          // Meeting topic/title
  meetingNumber: string,         // Meeting number
  role: 'host' | 'coHost' | 'attendee',
  participantUUID: string,       // Current participant's UUID
  participantID: string,         // Current participant's ID
}
```

**Example:**
```javascript
const context = await zoomSdk.getMeetingContext()
console.log('Meeting UUID:', context.meetingUUID)
console.log('User role:', context.role)
```

### zoomSdk.getMeetingUUID()

Get just the meeting UUID.

**Syntax:**
```javascript
const { meetingUUID } = await zoomSdk.getMeetingUUID()
```

**Returns:**
```javascript
{
  meetingUUID: string
}
```

### zoomSdk.getMeetingJoinUrl()

Get the meeting join URL.

**Syntax:**
```javascript
const { joinUrl } = await zoomSdk.getMeetingJoinUrl()
```

**Returns:**
```javascript
{
  joinUrl: string  // e.g., 'https://zoom.us/j/1234567890'
}
```

### zoomSdk.getMeetingParticipants()

Get list of all meeting participants.

**Syntax:**
```javascript
const { participants } = await zoomSdk.getMeetingParticipants()
```

**Returns:**
```javascript
{
  participants: [
    {
      participantUUID: string,
      participantID: string,
      screenName: string,
      role: 'host' | 'coHost' | 'attendee' | 'panelist',
      audioState: 'muted' | 'unmuted',
      videoState: 'on' | 'off',
      isHost: boolean,
      isCoHost: boolean,
      isGuest: boolean
    },
    // ... more participants
  ]
}
```

**Example:**
```javascript
const { participants } = await zoomSdk.getMeetingParticipants()
console.log(`${participants.length} participants in meeting`)

const hosts = participants.filter(p => p.isHost)
console.log('Host:', hosts[0]?.screenName)
```

## Running Context

### zoomSdk.getRunningContext()

Get the current running context of the app.

**Syntax:**
```javascript
const { context } = await zoomSdk.getRunningContext()
```

**Returns:**
```javascript
{
  context: 'inMeeting' | 'inMainClient' | 'inWebinar' | 'inCollaborate'
}
```

**Context Values:**
- `inMeeting` - App is running inside a Zoom meeting
- `inMainClient` - App is running in Zoom desktop/mobile client (not in meeting)
- `inWebinar` - App is running inside a Zoom webinar
- `inCollaborate` - App is running in a collaborate session

## Authentication

### zoomSdk.authorize()

Initiate in-client OAuth flow using PKCE.

**Syntax:**
```javascript
const response = await zoomSdk.authorize({
  codeChallenge: string,
  state: string
})
```

**Parameters:**
- `codeChallenge` - PKCE code challenge (from backend)
- `state` - Random state for CSRF protection (from backend)

**Returns:**
```javascript
{
  success: boolean
}
```

**Flow:**
1. Get code challenge from backend: `GET /api/zoomapp/authorize`
2. Call `zoomSdk.authorize()` with challenge and state
3. User completes OAuth in Zoom UI
4. `onAuthorized` event fires with authorization code
5. Send code to backend: `POST /api/zoomapp/onauthorized`

**Example:**
```javascript
// Step 1: Get challenge from backend
const { codeChallenge, state } = await fetch('/api/zoomapp/authorize')
  .then(res => res.json())

// Step 2: Call authorize
await zoomSdk.authorize({
  codeChallenge,
  state,
})

// Step 3: Listen for onAuthorized event (see Events section)
```

### zoomSdk.promptAuthorize()

Prompt user to authorize the app (for guest mode).

**Syntax:**
```javascript
const response = await zoomSdk.promptAuthorize()
```

**Returns:**
```javascript
{
  success: boolean
}
```

**Example:**
```javascript
// For apps that support guest mode
if (userContextStatus === 'unauthenticated') {
  await zoomSdk.promptAuthorize()
}
```

### zoomSdk.getUserContext()

Get current user's authentication context.

**Syntax:**
```javascript
const context = await zoomSdk.getUserContext()
```

**Returns:**
```javascript
{
  status: 'authenticated' | 'unauthenticated' | 'authorized',
  role: 'host' | 'coHost' | 'attendee',
  screenName: string
}
```

## Virtual Backgrounds

### zoomSdk.setVirtualBackground()

Set the user's virtual background.

**Syntax:**
```javascript
await zoomSdk.setVirtualBackground({
  fileUrl: string
})
```

**Parameters:**
- `fileUrl` - HTTPS URL to background image (JPEG, PNG)

**Example:**
```javascript
await zoomSdk.setVirtualBackground({
  fileUrl: 'https://images.unsplash.com/photo-1533743983669-94fa5c4338ec'
})
```

**Image Requirements:**
- Format: JPEG, PNG
- Size: Recommended 1920x1080 or 16:9 aspect ratio
- HTTPS URL required

### zoomSdk.removeVirtualBackground()

Remove the virtual background.

**Syntax:**
```javascript
await zoomSdk.removeVirtualBackground()
```

**Example:**
```javascript
await zoomSdk.removeVirtualBackground()
```

## Recording

### zoomSdk.cloudRecording()

Control cloud recording.

**Syntax:**
```javascript
await zoomSdk.cloudRecording({
  action: 'start' | 'stop' | 'pause' | 'resume'
})
```

**Parameters:**
- `action` - Recording action to perform

**Example:**
```javascript
// Start recording
await zoomSdk.cloudRecording({ action: 'start' })

// Pause recording
await zoomSdk.cloudRecording({ action: 'pause' })

// Resume recording
await zoomSdk.cloudRecording({ action: 'resume' })

// Stop recording
await zoomSdk.cloudRecording({ action: 'stop' })
```

### zoomSdk.getRecordingContext()

Get current recording status.

**Syntax:**
```javascript
const context = await zoomSdk.getRecordingContext()
```

**Returns:**
```javascript
{
  cloudRecordingStatus: 'started' | 'stopped' | 'paused',
  localRecordingStatus: 'started' | 'stopped' | 'paused'
}
```

### zoomSdk.allowParticipantToRecord()

Allow participant to record locally.

**Syntax:**
```javascript
await zoomSdk.allowParticipantToRecord({
  participantUUID: string,
  allow: boolean
})
```

**Parameters:**
- `participantUUID` - UUID of participant
- `allow` - `true` to allow, `false` to disallow

## Real-Time Media Streams

### zoomSdk.startRTMS() / callZoomApi('startRTMS')

Start Real-Time Media Streams.

**Syntax:**
```javascript
await zoomSdk.callZoomApi('startRTMS')
```

**Note:** Triggers `meeting.rtms_started` webhook event on your backend.

**Example:**
```javascript
try {
  const response = await zoomSdk.callZoomApi('startRTMS')
  console.log('RTMS started:', response)
} catch (error) {
  console.error('RTMS error:', error)
}
```

### zoomSdk.stopRTMS() / callZoomApi('stopRTMS')

Stop Real-Time Media Streams.

**Syntax:**
```javascript
await zoomSdk.callZoomApi('stopRTMS')
```

**Note:** Triggers `meeting.rtms_stopped` webhook event on your backend.

**Example:**
```javascript
try {
  const response = await zoomSdk.callZoomApi('stopRTMS')
  console.log('RTMS stopped:', response)
} catch (error) {
  console.error('RTMS error:', error)
}
```

## User Interface

### zoomSdk.showNotification()

Show an in-app notification.

**Syntax:**
```javascript
await zoomSdk.showNotification({
  type: 'info' | 'warning' | 'error' | 'success',
  title: string,
  message: string
})
```

**Parameters:**
- `type` - Notification type (affects icon and color)
- `title` - Notification title
- `message` - Notification message

**Example:**
```javascript
await zoomSdk.showNotification({
  type: 'info',
  title: 'Hello Zoom Apps',
  message: 'This is a notification message',
})
```

### zoomSdk.openUrl()

Open URL in user's default browser.

**Syntax:**
```javascript
await zoomSdk.openUrl({
  url: string
})
```

**Parameters:**
- `url` - HTTPS URL to open

**Example:**
```javascript
await zoomSdk.openUrl({
  url: 'https://www.example.com/',
})
```

### zoomSdk.expandApp()

Expand the app panel.

**Syntax:**
```javascript
await zoomSdk.expandApp()
```

**Example:**
```javascript
// Expand app to full screen
await zoomSdk.expandApp()
```

## App Collaboration

### zoomSdk.connect()

Connect app instances (main client ↔ in-meeting).

**Syntax:**
```javascript
await zoomSdk.connect()
```

**Note:** Only call this in meeting context (`runningContext === 'inMeeting'`).

**Example:**
```javascript
if (runningContext === 'inMeeting') {
  zoomSdk.addEventListener('onConnect', (event) => {
    console.log('Connected:', event)
    setConnected(true)
  })

  await zoomSdk.connect()
}
```

### zoomSdk.postMessage()

Send message to other app instances.

**Syntax:**
```javascript
await zoomSdk.postMessage({
  payload: any
})
```

**Parameters:**
- `payload` - Any JSON-serializable data

**Example:**
```javascript
// Send current route to other instance
await zoomSdk.postMessage({
  payload: window.location.pathname,
})

// Send complex data
await zoomSdk.postMessage({
  payload: {
    action: 'updateState',
    data: { count: 5 },
  },
})
```

## App Invitations

### zoomSdk.sendAppInvitationToAllParticipants()

Send app invitation to all participants.

**Syntax:**
```javascript
await zoomSdk.sendAppInvitationToAllParticipants()
```

**Example:**
```javascript
// Invite everyone to use the app
await zoomSdk.sendAppInvitationToAllParticipants()
```

### zoomSdk.sendAppInvitation()

Send app invitation to specific participants.

**Syntax:**
```javascript
await zoomSdk.sendAppInvitation({
  participantUUIDs: Array<string>
})
```

**Parameters:**
- `participantUUIDs` - Array of participant UUIDs to invite

**Example:**
```javascript
const { participants } = await zoomSdk.getMeetingParticipants()
const hostUUID = participants.find(p => p.isHost)?.participantUUID

await zoomSdk.sendAppInvitation({
  participantUUIDs: [hostUUID],
})
```

### zoomSdk.sendAppInvitationToMeetingOwner()

Send app invitation to meeting owner.

**Syntax:**
```javascript
await zoomSdk.sendAppInvitationToMeetingOwner()
```

### zoomSdk.showAppInvitationDialog()

Show app invitation dialog UI.

**Syntax:**
```javascript
await zoomSdk.showAppInvitationDialog()
```

**Example:**
```javascript
// Show Zoom's built-in invitation dialog
await zoomSdk.showAppInvitationDialog()
```

## Device Access

### zoomSdk.listCameras()

Get list of available cameras.

**Syntax:**
```javascript
const { cameras } = await zoomSdk.listCameras()
```

**Returns:**
```javascript
{
  cameras: [
    {
      id: string,
      name: string
    },
    // ... more cameras
  ]
}
```

**Example:**
```javascript
const { cameras } = await zoomSdk.listCameras()
console.log('Available cameras:', cameras.map(c => c.name))
```

## Video Effects

### zoomSdk.setVideoMirrorEffect()

Set video mirror effect.

**Syntax:**
```javascript
await zoomSdk.setVideoMirrorEffect({
  mirrorMyVideo: boolean
})
```

**Parameters:**
- `mirrorMyVideo` - `true` to mirror, `false` to disable

**Example:**
```javascript
// Enable mirror effect
await zoomSdk.setVideoMirrorEffect({ mirrorMyVideo: true })

// Disable mirror effect
await zoomSdk.setVideoMirrorEffect({ mirrorMyVideo: false })
```

## Screen Sharing

### zoomSdk.shareApp()

Control app sharing.

**Syntax:**
```javascript
await zoomSdk.shareApp({
  action: 'start' | 'stop'
})
```

**Parameters:**
- `action` - Sharing action

**Example:**
```javascript
// Start sharing app
await zoomSdk.shareApp({ action: 'start' })

// Stop sharing app
await zoomSdk.shareApp({ action: 'stop' })
```

## Utility Methods

### zoomSdk.getSupportedJsApis()

Get list of supported SDK methods in current context.

**Syntax:**
```javascript
const { supportedApis } = await zoomSdk.getSupportedJsApis()
```

**Returns:**
```javascript
{
  supportedApis: Array<string>
}
```

**Example:**
```javascript
const { supportedApis } = await zoomSdk.getSupportedJsApis()
console.log('Supported APIs:', supportedApis)

const hasRTMS = supportedApis.includes('startRTMS')
if (hasRTMS) {
  // Show RTMS controls
}
```

## Events

### onAuthorized

Fired when in-client OAuth completes.

**Syntax:**
```javascript
zoomSdk.addEventListener('onAuthorized', (event) => {
  const { code, state } = event
  // Handle authorization
})
```

**Event Data:**
```javascript
{
  code: string,      // Authorization code
  state: string,     // State parameter
  timestamp: number
}
```

**Example:**
```javascript
zoomSdk.addEventListener('onAuthorized', async (event) => {
  const { code, state } = event

  // Exchange code for token on backend
  await fetch('/api/zoomapp/onauthorized', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state, href: window.location.href }),
  })

  console.log('Authorization complete')
})
```

### onConnect

Fired when app instances connect.

**Syntax:**
```javascript
zoomSdk.addEventListener('onConnect', (event) => {
  // Handle connection
})
```

**Event Data:**
```javascript
{
  connected: boolean,
  timestamp: number
}
```

**Example:**
```javascript
zoomSdk.addEventListener('onConnect', (event) => {
  console.log('App instances connected')
  setConnected(true)
})
```

### onMessage

Fired when message received from another instance.

**Syntax:**
```javascript
zoomSdk.addEventListener('onMessage', (event) => {
  const { payload } = event
  // Handle message
})
```

**Event Data:**
```javascript
{
  payload: {
    payload: any  // Your data sent via postMessage()
  },
  timestamp: number
}
```

**Example:**
```javascript
zoomSdk.addEventListener('onMessage', (event) => {
  const path = event.payload.payload
  console.log('Received path from other instance:', path)

  // Navigate to the received path
  navigate({ pathname: path })
})
```

### onMyUserContextChange

Fired when user's authentication context changes.

**Syntax:**
```javascript
zoomSdk.addEventListener('onMyUserContextChange', (event) => {
  const { status } = event
  // Handle context change
})
```

**Event Data:**
```javascript
{
  status: 'authenticated' | 'unauthenticated' | 'authorized',
  timestamp: number
}
```

**Example:**
```javascript
zoomSdk.addEventListener('onMyUserContextChange', (event) => {
  console.log('User context changed:', event.status)
  setUserContextStatus(event.status)
})
```

### onSendAppInvitation

Fired when app invitation is sent.

**Syntax:**
```javascript
zoomSdk.addEventListener('onSendAppInvitation', (event) => {
  // Handle invitation sent
})
```

**Event Data:**
```javascript
{
  invitationUUID: string,
  timestamp: number
}
```

### onShareApp

Fired when app sharing status changes.

**Syntax:**
```javascript
zoomSdk.addEventListener('onShareApp', (event) => {
  // Handle share status change
})
```

**Event Data:**
```javascript
{
  action: 'start' | 'stop',
  timestamp: number
}
```

### onActiveSpeakerChange

Fired when active speaker changes.

**Syntax:**
```javascript
zoomSdk.addEventListener('onActiveSpeakerChange', (event) => {
  const { participantUUID } = event
  // Handle active speaker change
})
```

**Event Data:**
```javascript
{
  participantUUID: string,
  timestamp: number
}
```

### onMeeting

Fired on meeting status changes.

**Syntax:**
```javascript
zoomSdk.addEventListener('onMeeting', (event) => {
  const { status } = event
  // Handle meeting status change
})
```

**Event Data:**
```javascript
{
  status: 'started' | 'ended' | 'joined' | 'left',
  timestamp: number
}
```

## Event Listener Management

### addEventListener

Add an event listener.

**Syntax:**
```javascript
zoomSdk.addEventListener(eventName, callback)
```

**Example:**
```javascript
const handleMessage = (event) => {
  console.log('Message received:', event)
}

zoomSdk.addEventListener('onMessage', handleMessage)
```

### removeEventListener

Remove an event listener.

**Syntax:**
```javascript
zoomSdk.removeEventListener(eventName, callback)
```

**Example:**
```javascript
// Remove specific listener
zoomSdk.removeEventListener('onMessage', handleMessage)
```

**Best Practice:**
```javascript
useEffect(() => {
  const handleMessage = (message) => {
    console.log('Message:', message)
  }

  zoomSdk.addEventListener('onMessage', handleMessage)

  // Cleanup on unmount
  return () => {
    zoomSdk.removeEventListener('onMessage', handleMessage)
  }
}, [])
```

## Common Patterns

### Generic API Invocation

**Reference:** `frontend/src/apis.js`

```javascript
const invokeZoomAppsSdk = (api) => () => {
  const { name, buttonName = '', options = null } = api
  const zoomAppsSdkApi = zoomSdk[name].bind(zoomSdk)

  zoomAppsSdkApi(options)
    .then((clientResponse) => {
      console.log(
        `${buttonName || name} success:`,
        JSON.stringify(clientResponse)
      )
    })
    .catch((clientError) => {
      console.log(
        `${buttonName || name} error:`,
        JSON.stringify(clientError)
      )
    })
}

// Usage
const apis = [
  { name: 'getMeetingContext' },
  { name: 'setVirtualBackground', options: { fileUrl: 'https://...' } },
]

apis.forEach(api => {
  const invoke = invokeZoomAppsSdk(api)
  // Call invoke() to execute
})
```

### Conditional Rendering Based on Context

```javascript
function App() {
  const [runningContext, setRunningContext] = useState(null)

  return (
    <div>
      {runningContext === 'inMeeting' && (
        <MeetingFeatures />
      )}

      {runningContext === 'inMainClient' && (
        <MainClientFeatures />
      )}
    </div>
  )
}
```

### Error Handling

```javascript
async function callSdkMethod() {
  try {
    const result = await zoomSdk.getMeetingContext()
    console.log('Success:', result)
    return result
  } catch (error) {
    console.error('Error:', error)

    // Show user-friendly error
    setError('Failed to get meeting context')

    // Log detailed error
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    })

    return null
  }
}
```

## Error Codes

Common error codes returned by SDK methods:

| Code | Description |
|------|-------------|
| `10001` | Method not supported in current context |
| `10002` | Missing required parameters |
| `10003` | Invalid parameter value |
| `10004` | User declined permission |
| `10005` | Method failed (generic) |
| `10006` | Not authenticated |
| `10007` | Rate limit exceeded |

**Example:**
```javascript
try {
  await zoomSdk.cloudRecording({ action: 'start' })
} catch (error) {
  if (error.code === 10006) {
    console.log('User is not authenticated')
  } else if (error.code === 10001) {
    console.log('Recording not available in this context')
  }
}
```

## Next Steps

- [Frontend Implementation Guide](./03-frontend-guide.md) - Build UI with SDK
- [Security Best Practices](./07-security-guide.md) - Security considerations
- [Architecture Overview](./01-architecture-overview.md) - System architecture
