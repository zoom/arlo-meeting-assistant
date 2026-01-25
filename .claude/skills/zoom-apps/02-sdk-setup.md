# Zoom Apps SDK Setup and Initialization

## Overview

This guide covers how to properly set up and initialize the Zoom Apps JavaScript SDK in your frontend application. The SDK must be configured before any SDK methods can be called.

## Prerequisites

1. A Zoom App created in the Zoom Marketplace
2. SDK capabilities selected in Marketplace (Features → Zoom App SDK → Add APIs)
3. Frontend app hosted and accessible via HTTPS
4. Zoom client that supports Zoom Apps

## Enabling Developer Tools

By default, developer tools (DevTools) are disabled in the Zoom Client.

**On Windows:**
Add to `%appdata%/Zoom/data/zoom.us.ini`:
```ini
[ZoomChat]
webview.context.menu=true
```

**On macOS:**
```bash
defaults write ZoomChat webview.context.menu true
```

**Restart the Zoom app** after making these changes.

## SDK Installation

The Zoom Apps SDK is loaded via a script tag, not through npm. It provides a global `zoomSdk` object.

### JavaScript Setup

```javascript
/* globals zoomSdk */

// The SDK is available globally when your app runs in Zoom
// No import statement needed
```

## SDK Configuration

### Basic Configuration Pattern

The SDK must be configured using `zoomSdk.config()` before any other SDK methods can be called.

```javascript
import { useEffect, useState } from 'react'

function App() {
  const [error, setError] = useState(null)
  const [runningContext, setRunningContext] = useState(null)
  const [userContextStatus, setUserContextStatus] = useState('')

  useEffect(() => {
    async function configureSdk() {
      try {
        const configResponse = await zoomSdk.config({
          capabilities: [
            'getMeetingContext',
            'getMeetingParticipants',
            'authorize',
            'onAuthorized',
            // ... more capabilities
          ],
          version: '0.16.0',
        })

        console.log('App configured', configResponse)
        setRunningContext(configResponse.runningContext)
        setUserContextStatus(configResponse.auth.status)

      } catch (error) {
        console.log(error)
        setError('There was an error configuring the JS SDK')
      }
    }

    configureSdk()
  }, [])
}
```

### Configuration Response

The `config()` method returns important information:

```javascript
{
  "runningContext": "inMeeting",        // or "inMainClient", "inWebinar"
  "auth": {
    "status": "authenticated"           // or "unauthenticated"
  },
  "unsupportedApis": [],                // APIs not available
  "clientVersion": "5.10.0"             // Zoom client version
}
```

## Capabilities Configuration

### Complete Capabilities Example

```javascript
const configResponse = await zoomSdk.config({
  capabilities: [
    // ===== API Methods =====
    // Meeting context
    'getMeetingContext',
    'getRunningContext',
    'getMeetingUUID',
    'getMeetingJoinUrl',
    'getMeetingParticipants',

    // Virtual backgrounds
    'setVirtualBackground',
    'removeVirtualBackground',

    // Recording
    'cloudRecording',
    'getRecordingContext',
    'allowParticipantToRecord',

    // Real-Time Media Streams
    'startRTMS',
    'stopRTMS',

    // User interface
    'openUrl',
    'showNotification',
    'expandApp',

    // App invitations
    'sendAppInvitationToAllParticipants',
    'sendAppInvitation',
    'showAppInvitationDialog',

    // Device access
    'listCameras',

    // Authentication
    'authorize',
    'promptAuthorize',
    'getUserContext',

    // Multi-instance communication
    'connect',
    'postMessage',

    // Utility
    'getSupportedJsApis',

    // ===== Event Listeners =====
    'onAuthorized',
    'onConnect',
    'onMessage',
    'onMyUserContextChange',
    'onSendAppInvitation',
    'onShareApp',
    'onActiveSpeakerChange',
    'onMeeting',
  ],
  version: '0.16.0',
})
```

## Configuration Timeout Handling

The SDK configuration expires after 2 hours. Handle re-configuration:

```javascript
function App() {
  const [counter, setCounter] = useState(0)

  useEffect(() => {
    async function configureSdk() {
      const configTimer = setTimeout(() => {
        setCounter(counter + 1)
      }, 120 * 60 * 1000) // 2 hours

      try {
        const configResponse = await zoomSdk.config({
          capabilities: [ /* ... */ ],
          version: '0.16.0',
        })
        // ... handle configuration
      } catch (error) {
        setError('There was an error configuring the JS SDK')
      }

      return () => {
        clearTimeout(configTimer)
      }
    }

    configureSdk()
  }, [counter])
}
```

## Running Context

The running context tells you where your app is being used:

```javascript
const configResponse = await zoomSdk.config({ /* ... */ })
const context = configResponse.runningContext

// Possible values:
// - "inMainClient"  - Zoom desktop/mobile client (not in meeting)
// - "inMeeting"     - Inside a Zoom meeting
// - "inWebinar"     - Inside a Zoom webinar
// - "inCollaborate" - In a collaborate session
```

### Using Running Context

```javascript
function App() {
  const [runningContext, setRunningContext] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    async function connectInstances() {
      // Only call connect() when in a meeting
      if (runningContext === 'inMeeting') {
        zoomSdk.addEventListener('onConnect', (event) => {
          console.log('Connected')
          setConnected(true)
        })

        await zoomSdk.connect()
      }
    }

    if (connected === false) {
      connectInstances()
    }
  }, [connected, runningContext])

  return (
    <div>
      <p>
        {runningContext
          ? `Running Context: ${runningContext}`
          : 'Configuring Zoom JavaScript SDK...'}
      </p>
    </div>
  )
}
```

## Event Listeners

Set up event listeners after SDK configuration:

```javascript
useEffect(() => {
  async function configureSdk() {
    const configResponse = await zoomSdk.config({
      capabilities: [
        'onSendAppInvitation',
        'onShareApp',
        'onActiveSpeakerChange',
      ],
      version: '0.16.0',
    })

    // Add event listeners after successful configuration
    zoomSdk.onSendAppInvitation((data) => {
      console.log('App invitation sent:', data)
    })

    zoomSdk.onShareApp((data) => {
      console.log('App shared:', data)
    })

    zoomSdk.onActiveSpeakerChange((data) => {
      console.log('Active speaker changed:', data)
    })
  }

  configureSdk()
}, [])
```

### Alternative addEventListener Pattern

```javascript
// Add event listener
zoomSdk.addEventListener('onMessage', (message) => {
  console.log('Message received:', message)
})

// Remove event listener
const handleMessage = (message) => {
  console.log('Message received:', message)
}

zoomSdk.addEventListener('onMessage', handleMessage)
zoomSdk.removeEventListener('onMessage', handleMessage)
```

## Context Provider Pattern

Create a dedicated context provider for SDK initialization:

```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';

const ZoomSDKContext = createContext(null);

export const useZoomSDK = () => {
  const context = useContext(ZoomSDKContext);
  if (!context) {
    throw new Error('useZoomSDK must be used within ZoomSDKProvider');
  }
  return context;
};

export const ZoomSDKProvider = ({ children }) => {
  const [sdkReady, setSdkReady] = useState(false);
  const [meetingContext, setMeetingContext] = useState(null);
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    async function initializeSDK() {
      try {
        const configResponse = await zoomSdk.config({
          capabilities: [
            'getMeetingContext',
            'getMeetingUUID',
            'getUserContext',
            'getMeetingParticipants',
            'sendAppInvitation',
            'startRTMS',
            'stopRTMS'
          ],
          version: '0.16.0'
        });

        // Gather meeting context from multiple sources
        const [context, uuid, user] = await Promise.all([
          zoomSdk.getMeetingContext(),
          zoomSdk.getMeetingUUID(),
          zoomSdk.getUserContext()
        ]);

        const fullContext = {
          ...context,
          meetingUUID: uuid.meetingUUID,
          participantUUID: user.participantUUID,
          screenName: user.screenName,
          role: user.role
        };

        setMeetingContext(fullContext);
        setSdkReady(true);

      } catch (error) {
        console.error('SDK initialization failed:', error);
      }
    }

    initializeSDK();
  }, []);

  const value = {
    sdkReady,
    meetingContext,
    participants,
    zoomSdk
  };

  return (
    <ZoomSDKContext.Provider value={value}>
      {children}
    </ZoomSDKContext.Provider>
  );
};
```

## UUID Format Differences

**CRITICAL:** The SDK and webhooks use **different formats** for participant/meeting IDs.

| Source | Format | Example | Used For |
|--------|--------|---------|----------|
| `getMeetingContext().meetingID` | Numeric string | `"123456789"` | Display only |
| `getMeetingUUID().meetingUUID` | Base64 UUID | `"abc123=="` | Backend matching |
| `getUserContext().participantUUID` | Base64 UUID | `"xyz789=="` | Backend matching |

**Always use UUIDs for backend communication.**

```javascript
// ✅ CORRECT: Using UUIDs
const response = await fetch('/api/consent/submit', {
  method: 'POST',
  body: JSON.stringify({
    meetingId: meetingContext.meetingUUID,
    participantId: meetingContext.participantUUID
  })
});
```

## SDK API Call Patterns

### Pattern 1: Direct Method Calls

```javascript
const context = await zoomSdk.getMeetingContext();
const participants = await zoomSdk.getMeetingParticipants();
```

### Pattern 2: callZoomApi() for Actions

```javascript
// RTMS controls use callZoomApi
await zoomSdk.callZoomApi('startRTMS');
await zoomSdk.callZoomApi('stopRTMS');
```

### Pattern 3: Methods with Options

```javascript
await zoomSdk.sendAppInvitation({
  participantUUIDs: [uuid1, uuid2]
});

await zoomSdk.sendAppInvitationToAllParticipants();
```

## Check API Availability

```javascript
const { supportedApis } = await zoomSdk.getSupportedJsApis()
const hasRTMS = supportedApis.includes('startRTMS')

if (hasRTMS) {
  // Show RTMS features
}
```

## Error Handling

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

## Performance Considerations

### Batch SDK Calls

```javascript
// ✅ GOOD: Parallel calls
const [context, uuid, user] = await Promise.all([
  zoomSdk.getMeetingContext(),
  zoomSdk.getMeetingUUID(),
  zoomSdk.getUserContext()
]);
```

### Debounce Participant Refreshes

```javascript
const debouncedRefresh = debounce(refreshParticipants, 1000);
zoomSdk.addEventListener('onParticipantChange', debouncedRefresh);
```

## Marketplace Configuration

Before SDK capabilities work, they must be enabled:

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/)
2. Navigate to your app
3. Go to **Features** → **Zoom App SDK**
4. Click **Add APIs**
5. Select all capabilities your app uses
6. Save changes

## Common Gotchas

### CORS Errors Loading SDK Script

**Symptom:**
```
Access to script at 'https://appssdk.zoom.us/...' has been blocked by CORS policy
```

**Solution:** Add to Marketplace → Features → Zoom App SDK → Domain Allowlist:
```
appssdk.zoom.us
```
**WITHOUT** `https://` or trailing slash.

### SDK Ready But Context Empty

**Cause:** Called `zoomSdk.config()` but didn't call context APIs.

**Solution:**
```javascript
const configResponse = await zoomSdk.config({ /* ... */ });
// Must call these separately:
const context = await zoomSdk.getMeetingContext();
const uuid = await zoomSdk.getMeetingUUID();
```

## Production Checklist

- [ ] All SDK capabilities enabled in Zoom Marketplace
- [ ] OAuth scopes configured if using authentication
- [ ] Domain allowlist includes `appssdk.zoom.us`
- [ ] Error handling added to all SDK calls
- [ ] Loading states for SDK initialization
- [ ] Graceful degradation if SDK unavailable
- [ ] Testing on different Zoom client versions

## Next Steps

- [Frontend Patterns](./03-frontend-patterns.md) - Build UI with SDK
- [SDK Reference](./08-sdk-reference.md) - Complete SDK API reference
- [Backend OAuth](./04-backend-oauth.md) - Set up authentication
