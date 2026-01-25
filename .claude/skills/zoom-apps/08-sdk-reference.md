# Zoom Apps SDK Reference Guide

## Overview

This reference guide provides comprehensive documentation of Zoom Apps JavaScript SDK methods, data structures, events, and common patterns.

## SDK Global Object

```javascript
/* globals zoomSdk */

// The SDK is available globally when your app runs in Zoom
// No import statement needed
```

## Configuration

### zoomSdk.config()

Configure the SDK with required capabilities before using any other methods.

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

```javascript
const context = await zoomSdk.getMeetingContext()
```

**Returns:**
```javascript
{
  meetingUUID: string,
  meetingID: string,
  meetingTopic: string,
  meetingNumber: string,
  role: 'host' | 'coHost' | 'attendee',
  participantUUID: string,
  participantID: string,
}
```

### zoomSdk.getMeetingUUID()

```javascript
const { meetingUUID } = await zoomSdk.getMeetingUUID()
```

### zoomSdk.getMeetingJoinUrl()

```javascript
const { joinUrl } = await zoomSdk.getMeetingJoinUrl()
// e.g., 'https://zoom.us/j/1234567890'
```

### zoomSdk.getMeetingParticipants()

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
    }
  ]
}
```

## Running Context

### zoomSdk.getRunningContext()

```javascript
const { context } = await zoomSdk.getRunningContext()
```

**Context Values:**
- `inMeeting` - Inside a Zoom meeting
- `inMainClient` - Zoom desktop/mobile client (not in meeting)
- `inWebinar` - Inside a Zoom webinar
- `inCollaborate` - In a collaborate session

## Authentication

### zoomSdk.authorize()

Initiate in-client OAuth flow using PKCE.

```javascript
await zoomSdk.authorize({
  codeChallenge: string,
  state: string
})
```

**Flow:**
1. Get code challenge from backend: `GET /api/zoomapp/authorize`
2. Call `zoomSdk.authorize()` with challenge and state
3. `onAuthorized` event fires with authorization code
4. Send code to backend: `POST /api/zoomapp/onauthorized`

### zoomSdk.promptAuthorize()

For guest mode:

```javascript
await zoomSdk.promptAuthorize()
```

### zoomSdk.getUserContext()

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

```javascript
await zoomSdk.setVirtualBackground({
  fileUrl: 'https://example.com/background.jpg'
})
```

**Requirements:**
- Format: JPEG, PNG
- Size: Recommended 1920x1080
- HTTPS URL required

### zoomSdk.removeVirtualBackground()

```javascript
await zoomSdk.removeVirtualBackground()
```

## Recording

### zoomSdk.cloudRecording()

```javascript
await zoomSdk.cloudRecording({
  action: 'start' | 'stop' | 'pause' | 'resume'
})
```

### zoomSdk.getRecordingContext()

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

```javascript
await zoomSdk.allowParticipantToRecord({
  participantUUID: string,
  allow: boolean
})
```

## Real-Time Media Streams

### zoomSdk.callZoomApi('startRTMS')

```javascript
await zoomSdk.callZoomApi('startRTMS')
```

**Note:** Triggers `meeting.rtms_started` webhook event.

### zoomSdk.callZoomApi('stopRTMS')

```javascript
await zoomSdk.callZoomApi('stopRTMS')
```

**Note:** Triggers `meeting.rtms_stopped` webhook event.

## User Interface

### zoomSdk.showNotification()

```javascript
await zoomSdk.showNotification({
  type: 'info' | 'warning' | 'error' | 'success',
  title: string,
  message: string
})
```

### zoomSdk.openUrl()

```javascript
await zoomSdk.openUrl({
  url: 'https://www.example.com/'
})
```

### zoomSdk.expandApp()

```javascript
await zoomSdk.expandApp()
```

## App Collaboration

### zoomSdk.connect()

Connect app instances (main client ↔ in-meeting).

```javascript
// Only call in meeting context
if (runningContext === 'inMeeting') {
  zoomSdk.addEventListener('onConnect', (event) => {
    console.log('Connected:', event)
  })

  await zoomSdk.connect()
}
```

### zoomSdk.postMessage()

```javascript
await zoomSdk.postMessage({
  payload: any
})
```

**Example:**
```javascript
await zoomSdk.postMessage({
  payload: {
    action: 'updateState',
    data: { count: 5 },
  },
})
```

## App Invitations

### zoomSdk.sendAppInvitationToAllParticipants()

```javascript
await zoomSdk.sendAppInvitationToAllParticipants()
```

### zoomSdk.sendAppInvitation()

```javascript
await zoomSdk.sendAppInvitation({
  participantUUIDs: [uuid1, uuid2]
})
```

### zoomSdk.showAppInvitationDialog()

```javascript
await zoomSdk.showAppInvitationDialog()
```

## Device Access

### zoomSdk.listCameras()

```javascript
const { cameras } = await zoomSdk.listCameras()
```

**Returns:**
```javascript
{
  cameras: [
    { id: string, name: string }
  ]
}
```

## Video Effects

### zoomSdk.setVideoMirrorEffect()

```javascript
await zoomSdk.setVideoMirrorEffect({
  mirrorMyVideo: boolean
})
```

## Screen Sharing

### zoomSdk.shareApp()

```javascript
await zoomSdk.shareApp({
  action: 'start' | 'stop'
})
```

## Utility Methods

### zoomSdk.getSupportedJsApis()

```javascript
const { supportedApis } = await zoomSdk.getSupportedJsApis()

const hasRTMS = supportedApis.includes('startRTMS')
```

## Events

### onAuthorized

Fired when in-client OAuth completes.

```javascript
zoomSdk.addEventListener('onAuthorized', (event) => {
  const { code, state } = event
  // Exchange code for token on backend
})
```

### onConnect

Fired when app instances connect.

```javascript
zoomSdk.addEventListener('onConnect', (event) => {
  console.log('App instances connected')
  setConnected(true)
})
```

### onMessage

Fired when message received from another instance.

```javascript
zoomSdk.addEventListener('onMessage', (event) => {
  const path = event.payload.payload
  navigate({ pathname: path })
})
```

### onMyUserContextChange

Fired when user's authentication context changes.

```javascript
zoomSdk.addEventListener('onMyUserContextChange', (event) => {
  setUserContextStatus(event.status)
})
```

### onSendAppInvitation

Fired when app invitation is sent.

```javascript
zoomSdk.addEventListener('onSendAppInvitation', (event) => {
  console.log('Invitation UUID:', event.invitationUUID)
})
```

### onShareApp

Fired when app sharing status changes.

```javascript
zoomSdk.addEventListener('onShareApp', (event) => {
  console.log('Share action:', event.action)
})
```

### onActiveSpeakerChange

Fired when active speaker changes.

```javascript
zoomSdk.addEventListener('onActiveSpeakerChange', (event) => {
  console.log('Active speaker:', event.participantUUID)
})
```

### onMeeting

Fired on meeting status changes.

```javascript
zoomSdk.addEventListener('onMeeting', (event) => {
  console.log('Meeting status:', event.status)
})
```

## Event Listener Management

### addEventListener

```javascript
zoomSdk.addEventListener(eventName, callback)
```

### removeEventListener

```javascript
zoomSdk.removeEventListener(eventName, callback)
```

**Best Practice:**
```javascript
useEffect(() => {
  const handleMessage = (message) => {
    console.log('Message:', message)
  }

  zoomSdk.addEventListener('onMessage', handleMessage)

  return () => {
    zoomSdk.removeEventListener('onMessage', handleMessage)
  }
}, [])
```

## Common Patterns

### Generic API Invocation

```javascript
const invokeZoomAppsSdk = (api) => () => {
  const { name, options = null } = api
  const zoomAppsSdkApi = zoomSdk[name].bind(zoomSdk)

  zoomAppsSdkApi(options)
    .then((response) => console.log(`${name} success:`, response))
    .catch((error) => console.log(`${name} error:`, error))
}
```

### Conditional Rendering

```javascript
function App() {
  const [runningContext, setRunningContext] = useState(null)

  return (
    <div>
      {runningContext === 'inMeeting' && <MeetingFeatures />}
      {runningContext === 'inMainClient' && <MainClientFeatures />}
    </div>
  )
}
```

### Error Handling

```javascript
try {
  const result = await zoomSdk.getMeetingContext()
  console.log('Success:', result)
} catch (error) {
  console.error('Error:', {
    message: error.message,
    code: error.code,
  })
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `10001` | Method not supported in current context |
| `10002` | Missing required parameters |
| `10003` | Invalid parameter value |
| `10004` | User declined permission |
| `10005` | Method failed (generic) |
| `10006` | Not authenticated |
| `10007` | Rate limit exceeded |

## Next Steps

- [Frontend Patterns](./03-frontend-patterns.md) - Build UI with SDK
- [Security Best Practices](./07-security.md) - Security considerations
- [Getting Started](./01-getting-started.md) - Initial setup
