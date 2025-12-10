# Zoom Apps SDK Setup and Initialization

## Overview

This guide covers how to properly set up and initialize the Zoom Apps JavaScript SDK in your frontend application. The SDK must be configured before any SDK methods can be called.

## Prerequisites

1. A Zoom App created in the Zoom Marketplace
2. SDK capabilities selected in Marketplace (Features → Zoom App SDK → Add APIs)
3. Frontend app hosted and accessible via HTTPS
4. Zoom client that supports Zoom Apps

## Enabling Developer Tools

By default, developer tools (DevTools) are disabled in the Zoom Client. Enable them for debugging and development:

**On Windows:**
Add the following to the `zoom.us.ini` file located in `%appdata%/Zoom/data`:

```ini
[ZoomChat]
webview.context.menu=true
```

**On macOS:**
Run this command in Terminal:

```bash
defaults write ZoomChat webview.context.menu true
```

**Important:** You must restart the Zoom app after making these changes.

Once enabled, right-click inside your Zoom App and select "Inspect Element" to access Chrome DevTools for debugging, viewing console logs, inspecting network requests, and more.

## SDK Installation

The Zoom Apps SDK is loaded via a script tag in your HTML, not through npm. It provides a global `zoomSdk` object.

### HTML Setup

**File:** `frontend/public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Zoom App</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>

    <!-- Zoom Apps SDK - Loaded by Zoom client automatically -->
    <!-- No script tag needed - zoomSdk is provided globally -->
  </body>
</html>
```

### JavaScript Setup

Access the SDK through the global `zoomSdk` object:

```javascript
/* globals zoomSdk */

// The SDK is available globally when your app runs in Zoom
// No import statement needed
```

## SDK Configuration

### Basic Configuration Pattern

The SDK must be configured using `zoomSdk.config()` before any other SDK methods can be called. This is typically done in your main App component's useEffect hook.

**Reference:** `frontend/src/App.js:24-85`

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
            // List of SDK methods and events you want to use
            'getMeetingContext',
            'getMeetingParticipants',
            'authorize',
            'onAuthorized',
            // ... more capabilities
          ],
          version: '0.16.0', // SDK version
        })

        console.log('App configured', configResponse)

        // Store important configuration data
        setRunningContext(configResponse.runningContext)
        setUserContextStatus(configResponse.auth.status)

      } catch (error) {
        console.log(error)
        setError('There was an error configuring the JS SDK')
      }
    }

    configureSdk()
  }, [])

  // Rest of your app...
}
```

### Configuration Response

The `config()` method returns important information about your app's running context:

```javascript
{
  "runningContext": "inMeeting",        // or "inMainClient", "inWebinar", etc.
  "auth": {
    "status": "authenticated"           // or "unauthenticated"
  },
  "unsupportedApis": [],                // APIs not available in current context
  "clientVersion": "5.10.0"            // Zoom client version
}
```

## Capabilities Configuration

### Understanding Capabilities

Capabilities are SDK methods and events your app wants to use. You must declare them during configuration.

**Two types:**
1. **Methods** - Functions you call (e.g., `getMeetingContext`, `setVirtualBackground`)
2. **Events** - Listeners you subscribe to (e.g., `onAuthorized`, `onMessage`)

### Complete Capabilities Example

**Reference:** `frontend/src/App.js:34-63`

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
    'onAuthorized',          // OAuth completed
    'onConnect',             // Instance connected
    'onMessage',             // Message from another instance
    'onMyUserContextChange', // User auth status changed
    'onSendAppInvitation',   // App invitation sent
    'onShareApp',            // App shared
    'onActiveSpeakerChange', // Active speaker changed
    'onMeeting',             // Meeting status changed
  ],
  version: '0.16.0',
})
```

### Dynamic Capabilities from API List

For apps that demonstrate many SDK features, you can dynamically generate capabilities from an API list:

**Reference:** `frontend/src/App.js:34-63` and `frontend/src/apis.js:30-end`

```javascript
// apis.js - Define your API demonstrations
export const apis = [
  {
    name: 'getMeetingContext',
  },
  {
    name: 'setVirtualBackground',
    options: {
      fileUrl: 'https://example.com/background.jpg',
    },
  },
  {
    name: 'cloudRecording',
    buttonName: 'cloudRecording (start)',
    options: { action: 'start' },
  },
  // ... more APIs
]

// App.js - Use in configuration
import { apis } from './apis'

const configResponse = await zoomSdk.config({
  capabilities: [
    // Dynamically add all API names
    ...apis.map((api) => api.name),

    // Add events separately
    'onAuthorized',
    'onConnect',
    'onMessage',
    // ... more events
  ],
  version: '0.16.0',
})
```

## Configuration Timeout Handling

The SDK configuration expires after 2 hours. You should handle re-configuration:

**Reference:** `frontend/src/App.js:26-29, 80-85`

```javascript
function App() {
  const [counter, setCounter] = useState(0)

  useEffect(() => {
    async function configureSdk() {
      // Re-configure after 2 hours
      const configTimer = setTimeout(() => {
        setCounter(counter + 1)
      }, 120 * 60 * 1000) // 2 hours in milliseconds

      try {
        const configResponse = await zoomSdk.config({
          capabilities: [ /* ... */ ],
          version: '0.16.0',
        })

        // ... handle configuration

      } catch (error) {
        setError('There was an error configuring the JS SDK')
      }

      // Cleanup timeout on unmount
      return () => {
        clearTimeout(configTimer)
      }
    }

    configureSdk()
  }, [counter]) // Re-run when counter changes
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

**Reference:** `frontend/src/App.js:68, 104-107, 132-166`

```javascript
function App() {
  const [runningContext, setRunningContext] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    async function configureSdk() {
      const configResponse = await zoomSdk.config({ /* ... */ })
      setRunningContext(configResponse.runningContext)
    }
    configureSdk()
  }, [])

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

## User Context Status

Track whether the user is authenticated:

**Reference:** `frontend/src/App.js:69, 215`

```javascript
function App() {
  const [userContextStatus, setUserContextStatus] = useState('')

  useEffect(() => {
    async function configureSdk() {
      const configResponse = await zoomSdk.config({ /* ... */ })
      setUserContextStatus(configResponse.auth.status)
    }
    configureSdk()
  }, [])

  return (
    <div>
      <p>User Context Status: {userContextStatus}</p>
      {/* "authenticated" or "unauthenticated" */}
    </div>
  )
}
```

## Event Listeners

Set up event listeners after SDK configuration:

**Reference:** `frontend/src/App.js:70-75`

```javascript
useEffect(() => {
  async function configureSdk() {
    const configResponse = await zoomSdk.config({
      capabilities: [
        'onSendAppInvitation',
        'onShareApp',
        'onActiveSpeakerChange',
        // ... other capabilities
      ],
      version: '0.16.0',
    })

    // Add event listeners after successful configuration
    zoomSdk.onSendAppInvitation((data) => {
      console.log('App invitation sent:', data)
      // Handle invitation sent event
    })

    zoomSdk.onShareApp((data) => {
      console.log('App shared:', data)
      // Handle app share event
    })

    zoomSdk.onActiveSpeakerChange((data) => {
      console.log('Active speaker changed:', data)
      // Handle active speaker change
    })
  }

  configureSdk()
}, [])
```

### Alternative addEventListener Pattern

For more control over event listeners:

**Reference:** `frontend/src/App.js:105, 136, 153`

```javascript
// Add event listener
zoomSdk.addEventListener('onMessage', (message) => {
  console.log('Message received:', message)
  // Handle message
})

// Remove event listener
const handleMessage = (message) => {
  console.log('Message received:', message)
}

zoomSdk.addEventListener('onMessage', handleMessage)

// Later, remove it
zoomSdk.removeEventListener('onMessage', handleMessage)
```

## Error Handling

Always wrap SDK configuration in try-catch:

```javascript
useEffect(() => {
  async function configureSdk() {
    try {
      const configResponse = await zoomSdk.config({
        capabilities: [ /* ... */ ],
        version: '0.16.0',
      })

      // Success - continue with app initialization
      setRunningContext(configResponse.runningContext)

    } catch (error) {
      console.error('SDK configuration error:', error)

      // Show user-friendly error message
      setError('There was an error configuring the JS SDK')

      // Log details for debugging
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
      })
    }
  }

  configureSdk()
}, [])
```

## Marketplace Configuration

Before SDK capabilities work, they must be enabled in the Zoom Marketplace:

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/)
2. Navigate to your app
3. Go to **Features** → **Zoom App SDK**
4. Click **Add APIs**
5. Select all capabilities your app uses
6. Save changes

### Required Scopes

Some SDK methods require specific OAuth scopes:

| SDK Method | Required Scope |
|------------|----------------|
| `getMeetingParticipants` | `zoomapp:inmeeting` |
| `startRTMS`, `stopRTMS` | `rtms:read` or `rtms:write` |
| User info via REST API | `user:read:admin` or `user:read` |

Configure scopes in **Scopes** section of Marketplace.

## Common Patterns

### 1. Conditional Feature Availability

```javascript
function App() {
  const [runningContext, setRunningContext] = useState(null)

  // Only show recording controls in meetings
  const showRecordingControls = runningContext === 'inMeeting'

  // Only show RTMS in meetings
  const showRTMSControls = runningContext === 'inMeeting'

  return (
    <div>
      {showRecordingControls && (
        <RecordingControls />
      )}
      {showRTMSControls && (
        <RTMSControls />
      )}
    </div>
  )
}
```

### 2. Check Supported APIs

Query which APIs are available:

```javascript
async function checkSupport() {
  try {
    const response = await zoomSdk.getSupportedJsApis()
    console.log('Supported APIs:', response.supportedApis)

    // response.supportedApis is an array of API names
    const hasRTMS = response.supportedApis.includes('startRTMS')

    if (hasRTMS) {
      // Show RTMS features
    }
  } catch (error) {
    console.error('Error checking supported APIs:', error)
  }
}
```

### 3. Version Detection

Different Zoom client versions support different features:

```javascript
const configResponse = await zoomSdk.config({ /* ... */ })

console.log('Client version:', configResponse.clientVersion)

// Parse version and check feature availability
const [major, minor, patch] = configResponse.clientVersion
  .split('.')
  .map(Number)

if (major >= 5 && minor >= 10) {
  // Feature available in 5.10.0+
}
```

## Debugging

Enable detailed console logging in Zoom client:

1. In Zoom client settings, go to **Advanced** → **Show developer menu**
2. Open your Zoom App
3. Right-click anywhere in the app
4. Select **Inspect Element** to open DevTools
5. View console logs, network requests, etc.

### Useful Debug Logs

```javascript
// Log configuration response
const configResponse = await zoomSdk.config({ /* ... */ })
console.log('Config response:', JSON.stringify(configResponse, null, 2))

// Log all event data
zoomSdk.addEventListener('onMessage', (message) => {
  console.log('onMessage event:', JSON.stringify(message, null, 2))
})

// Log API responses
try {
  const result = await zoomSdk.getMeetingContext()
  console.log('getMeetingContext result:', JSON.stringify(result, null, 2))
} catch (error) {
  console.error('getMeetingContext error:', error)
}
```

## Implementation Experience & Best Practices

This section documents real-world learnings from implementing the RTMS Consent App with the Zoom Apps SDK.

### Context Provider Pattern

**Recommended approach:** Create a dedicated context provider for SDK initialization and state management.

**Reference:** `frontend/src/contexts/ZoomSDKContext.jsx`

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

  // Initialize SDK once
  useEffect(() => {
    async function initializeSDK() {
      try {
        // 1. Configure SDK
        const configResponse = await zoomSdk.config({
          capabilities: [
            'getMeetingContext',
            'getMeetingUUID',
            'getUserContext',
            'getMeetingParticipants',
            'sendAppInvitation',
            'sendMessageToChat',
            'startRTMS',
            'stopRTMS'
          ],
          version: '0.16.0'
        });

        console.log('✅ SDK configured:', configResponse);

        // 2. Gather meeting context from multiple sources
        const [context, uuid, user] = await Promise.all([
          zoomSdk.getMeetingContext(),
          zoomSdk.getMeetingUUID(),
          zoomSdk.getUserContext()
        ]);

        // 3. Merge context data
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
        console.error('❌ SDK initialization failed:', error);
      }
    }

    initializeSDK();
  }, []);

  const value = {
    sdkReady,
    meetingContext,
    participants,
    zoomSdk  // Expose SDK for direct calls
  };

  return (
    <ZoomSDKContext.Provider value={value}>
      {children}
    </ZoomSDKContext.Provider>
  );
};
```

**Why this pattern:**
- Centralizes SDK initialization
- Provides single source of truth for meeting context
- Allows child components to access SDK without re-initializing
- Handles loading states gracefully

### Merging Multiple Context APIs

The Zoom Apps SDK provides context through multiple methods. **Best practice: merge them into one complete context object.**

**Reference:** `frontend/src/contexts/ZoomSDKContext.jsx:34-62`

```javascript
// DON'T: Call APIs separately in each component
const MeetingInfo = () => {
  const [context, setContext] = useState(null);
  useEffect(() => {
    zoomSdk.getMeetingContext().then(setContext);
  }, []);
  // ...
};

// DO: Merge in one place and share via context
const initializeSDK = async () => {
  const [context, uuid, user] = await Promise.all([
    zoomSdk.getMeetingContext(),      // Basic meeting info
    zoomSdk.getMeetingUUID(),         // Meeting UUID
    zoomSdk.getUserContext()          // Participant info
  ]);

  // Create unified context object
  const fullContext = {
    // From getMeetingContext
    meetingID: context.meetingID,           // e.g., "123456789"
    meetingNumber: context.meetingNumber,   // Same as meetingID
    participantID: context.participantID,   // e.g., "16778240" (SDK format)

    // From getMeetingUUID
    meetingUUID: uuid.meetingUUID,          // e.g., "abc123==" (webhook format)

    // From getUserContext
    participantUUID: user.participantUUID,  // e.g., "abc123==" (webhook format)
    screenName: user.screenName,            // e.g., "John Doe"
    role: user.role,                        // "host" | "attendee" | "coHost"
    status: user.status                     // "authorized" | "unauthorized"
  };

  return fullContext;
};
```

**Key learnings:**
- `getMeetingContext()` returns basic meeting info but **lacks meeting UUID**
- `getMeetingUUID()` provides the **webhook-compatible UUID** (different from meetingID!)
- `getUserContext()` provides participant-specific info (name, role, UUID)
- **Meeting UUID formats differ:** SDK uses numeric IDs, webhooks use base64 UUIDs

### UUID Format Mismatches

**CRITICAL:** The SDK and webhooks use **different formats** for participant/meeting IDs.

| Source | Format | Example | Used For |
|--------|--------|---------|----------|
| `getMeetingContext().meetingID` | Numeric string | `"123456789"` | Display only |
| `getMeetingUUID().meetingUUID` | Base64 UUID | `"abc123=="` | Backend matching |
| `getMeetingContext().participantID` | Numeric string | `"16778240"` | SDK calls |
| `getUserContext().participantUUID` | Base64 UUID | `"xyz789=="` | Backend matching |

**Problem:** If you try to match `participantID` from SDK with `participantUUID` from webhooks, **they won't match.**

**Solution:** Always use UUIDs for backend communication.

**Reference:** `frontend/src/contexts/ZoomSDKContext.jsx:62, ConsentContext.jsx:179`

```javascript
// ❌ WRONG: Using SDK participantID for backend
const response = await fetch('/api/consent/submit', {
  method: 'POST',
  body: JSON.stringify({
    meetingId: meetingContext.meetingID,        // Wrong format!
    participantId: meetingContext.participantID // Won't match webhooks!
  })
});

// ✅ CORRECT: Using UUIDs from getUserContext/getMeetingUUID
const response = await fetch('/api/consent/submit', {
  method: 'POST',
  body: JSON.stringify({
    meetingId: meetingContext.meetingUUID,      // Matches webhook format
    participantId: meetingContext.participantUUID // Matches webhook format
  })
});
```

### Participant Tracking: SDK-First Approach

**Best practice:** Use SDK as primary source, webhooks as backup.

**Why:** SDK provides immediate, accurate participant data. Webhooks may lag or be missed.

**Reference:** `frontend/src/hooks/useParticipantTracking.js:19-78`

```javascript
const useParticipantTracking = () => {
  const { zoomSdk, meetingContext } = useZoomSDK();
  const [participants, setParticipants] = useState([]);

  // Fetch participants via SDK
  const refreshParticipants = useCallback(async () => {
    try {
      const response = await zoomSdk.getMeetingParticipants();

      // response.participants is an array
      const participantList = response.participants.map(p => ({
        participantID: p.participantId,       // SDK numeric ID
        participantUUID: p.participantUUID,   // Webhook-compatible UUID
        screenName: p.screenName,
        role: p.role,
        audio: p.audio,
        video: p.video
      }));

      setParticipants(participantList);

    } catch (error) {
      console.error('Failed to get participants:', error);
    }
  }, [zoomSdk]);

  // Auto-refresh on mount and when participants change
  useEffect(() => {
    if (!zoomSdk) return;

    // Initial fetch
    refreshParticipants();

    // Listen for participant events
    const handleParticipantChange = () => {
      refreshParticipants();
    };

    zoomSdk.addEventListener('onParticipantChange', handleParticipantChange);

    return () => {
      zoomSdk.removeEventListener('onParticipantChange', handleParticipantChange);
    };
  }, [zoomSdk, refreshParticipants]);

  return { participants, refreshParticipants };
};
```

**Pattern summary:**
1. Use `getMeetingParticipants()` as source of truth
2. Listen to `onParticipantChange` events for updates
3. Map SDK data to your app's format
4. Provide `refresh()` function for manual updates
5. Use webhooks only as fallback/verification

### SDK API Call Patterns

Different SDK methods have different call patterns. Here's what we learned:

**Reference:** `frontend/src/contexts/ConsentContext.jsx:124-141`

#### Pattern 1: Direct Method Calls

```javascript
// Works for simple info retrieval
const context = await zoomSdk.getMeetingContext();
const participants = await zoomSdk.getMeetingParticipants();
const uuid = await zoomSdk.getMeetingUUID();
```

#### Pattern 2: callZoomApi() for Actions

```javascript
// RTMS controls use callZoomApi
await zoomSdk.callZoomApi('startRTMS');  // NOT zoomSdk.startRTMS()
await zoomSdk.callZoomApi('stopRTMS');   // NOT zoomSdk.stopRTMS()
```

**Why:** Some SDK methods are exposed via `callZoomApi()` instead of direct methods. Check the SDK documentation for each API.

#### Pattern 3: Methods with Options

```javascript
// App invitations with options
await zoomSdk.sendAppInvitation({
  participantUUIDs: [uuid1, uuid2]  // Array of UUIDs
});

// OR invite all
await zoomSdk.sendAppInvitationToAllParticipants();

// Send chat message
await zoomSdk.sendMessageToChat({
  message: 'Your message here'
});
```

#### Pattern 4: Testing API Availability

**Always check if an API is supported before calling it.**

**Reference:** `frontend/src/contexts/ZoomSDKContext.jsx:25-32`

```javascript
const testApiAvailability = async () => {
  try {
    const response = await zoomSdk.getSupportedJsApis();
    console.log('✅ Supported APIs:', response.supportedApis);

    // Check specific APIs
    const hasRTMS = response.supportedApis.includes('startRTMS');
    const hasChat = response.supportedApis.includes('sendMessageToChat');

    if (!hasRTMS) {
      console.warn('⚠️ RTMS not supported in this client version');
      // Hide RTMS features in UI
    }

    return response.supportedApis;
  } catch (error) {
    console.error('❌ Failed to check API support:', error);
    return [];
  }
};
```

### Error Handling Best Practices

**Always wrap SDK calls in try-catch with detailed logging.**

**Reference:** `frontend/src/contexts/ConsentContext.jsx:121-151`

```javascript
// ❌ BAD: Silent failures
const startRTMS = async () => {
  await zoomSdk.callZoomApi('startRTMS');
};

// ✅ GOOD: Explicit error handling
const startRTMS = async () => {
  try {
    console.log('🚀 Starting RTMS via Zoom SDK...');
    await zoomSdk.callZoomApi('startRTMS');
    console.log('✅ RTMS started successfully');
  } catch (error) {
    console.error('❌ RTMS SDK call failed:', error);
    console.error('   Make sure startRTMS is enabled in Zoom Marketplace');
    console.error('   Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    // Show user-friendly error
    showNotification('Failed to start media access. Please try again.');
  }
};
```

**Common error causes:**
1. API not enabled in Zoom Marketplace → Add to SDK capabilities
2. Missing OAuth scopes → Add to Marketplace scopes section
3. Unsupported in client version → Check `getSupportedJsApis()`
4. Network issues → Check browser console for CORS errors

### Helper Function Pattern

**Wrap SDK calls in helper functions for reusability.**

**Reference:** `frontend/src/contexts/ZoomSDKContext.jsx:125-136`

```javascript
export const ZoomSDKProvider = ({ children }) => {
  // ... state setup ...

  // Helper: Send chat message
  const sendChatMessage = async (message) => {
    try {
      console.log('📤 Sending chat message:', message);
      await zoomSdk.sendMessageToChat({ message });
      console.log('✅ Chat message sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to send chat message:', error.message);
      return false;
    }
  };

  // Helper: Refresh participant list
  const refreshParticipants = async () => {
    try {
      const response = await zoomSdk.getMeetingParticipants();
      setParticipants(response.participants);
      return response.participants;
    } catch (error) {
      console.error('❌ Failed to refresh participants:', error);
      return [];
    }
  };

  const value = {
    sdkReady,
    meetingContext,
    participants,
    sendChatMessage,    // Expose helpers
    refreshParticipants,
    zoomSdk
  };

  return (
    <ZoomSDKContext.Provider value={value}>
      {children}
    </ZoomSDKContext.Provider>
  );
};
```

**Benefits:**
- Consistent error handling across app
- Easier to test (mock helpers instead of SDK)
- Centralized logging
- Returns boolean success flags for UI feedback

### Conditional Rendering Based on SDK State

**Don't render SDK-dependent components until SDK is ready.**

**Reference:** `frontend/src/App.jsx:44-55`

```javascript
function App() {
  const { sdkReady, meetingContext } = useZoomSDK();

  if (!sdkReady) {
    return (
      <Container className="mt-4">
        <Alert variant="info">
          Initializing Zoom SDK...
        </Alert>
      </Container>
    );
  }

  if (!meetingContext) {
    return (
      <Container className="mt-4">
        <Alert variant="warning">
          Unable to load meeting context. Please reopen the app.
        </Alert>
      </Container>
    );
  }

  // Safe to render components that use SDK
  return (
    <Container>
      <ConsentPrompt />
      <ParticipantList />
      <RTMSControls />
    </Container>
  );
}
```

**Why this matters:**
- Prevents "zoomSdk is not defined" errors
- Avoids race conditions with API calls
- Provides better UX with loading states
- Makes debugging easier (know exactly when SDK failed)

### WebSocket + SDK Hybrid Pattern

**Use SDK for actions, WebSocket for state synchronization.**

**Reference:** `frontend/src/contexts/ConsentContext.jsx:32-75`

```javascript
export const ConsentProvider = ({ children }) => {
  const { meetingContext, zoomSdk } = useZoomSDK();
  const { socket, isConnected } = useWebSocket();
  const [consentState, setConsentState] = useState({ /* ... */ });

  // 1. WebSocket provides state updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleStateUpdate = (data) => {
      console.log('📩 Consent state update via WebSocket');
      setConsentState(data);  // Update UI from backend
    };

    socket.on('consent_state_update', handleStateUpdate);
    socket.on('full_state', handleStateUpdate);

    return () => {
      socket.off('consent_state_update', handleStateUpdate);
      socket.off('full_state', handleStateUpdate);
    };
  }, [socket, isConnected]);

  // 2. SDK provides actions
  const startRTMS = async () => {
    await zoomSdk.callZoomApi('startRTMS');
  };

  const inviteParticipant = async (uuid) => {
    await zoomSdk.sendAppInvitation({ participantUUIDs: [uuid] });
  };

  // 3. Combine both for complete UX
  return (
    <ConsentContext.Provider value={{
      consentState,    // From WebSocket
      startRTMS,       // From SDK
      inviteParticipant // From SDK
    }}>
      {children}
    </ConsentContext.Provider>
  );
};
```

**Pattern summary:**
- **WebSocket** = backend state, multi-user sync, persistence
- **SDK** = Zoom actions, participant info, real-time events
- **Result** = Fast UI updates + reliable state management

### Common Gotchas and Solutions

#### Gotcha 1: SDK Ready But Context Empty

**Symptom:**
```javascript
sdkReady: true
meetingContext: { meetingID: null, participantUUID: null }
```

**Cause:** Called `zoomSdk.config()` but didn't call context APIs.

**Solution:** Always fetch context after configuration:
```javascript
const configResponse = await zoomSdk.config({ /* ... */ });
// Config successful, but context still empty!

// Must call these separately:
const context = await zoomSdk.getMeetingContext();
const uuid = await zoomSdk.getMeetingUUID();
```

#### Gotcha 2: Participant List Empty in getMeetingParticipants

**Symptom:**
```javascript
const response = await zoomSdk.getMeetingParticipants();
console.log(response.participants); // []
```

**Cause:** Called too early (before participants joined) or missing scope.

**Solution:**
1. Check Marketplace scopes include participant access
2. Add delay or retry logic
3. Use `onParticipantChange` event to know when list updates

#### Gotcha 3: API Works in Development, Fails in Production

**Symptom:** SDK calls succeed locally but fail when installed by others.

**Cause:** API not published or approved in Marketplace.

**Solution:**
1. Go to Marketplace → Features → Zoom App SDK
2. Ensure all APIs are added and saved
3. For published apps, some APIs require approval

#### Gotcha 4: CORS Errors Loading SDK Script

**Symptom:**
```
Access to script at 'https://appssdk.zoom.us/...' has been blocked by CORS policy
```

**Cause:** Domain allowlist missing `appssdk.zoom.us`.

**Solution:** Add to Marketplace → Features → Zoom App SDK → Domain Allowlist:
```
appssdk.zoom.us
```
**WITHOUT** `https://` or trailing slash.

See [Critical Setup Requirements](./07-critical-setup-requirements.md#1-domain-allowlist-critical) for details.

### Performance Considerations

1. **Batch SDK Calls**
   ```javascript
   // ❌ BAD: Sequential calls
   const context = await zoomSdk.getMeetingContext();
   const uuid = await zoomSdk.getMeetingUUID();
   const user = await zoomSdk.getUserContext();
   // Takes 3x longer

   // ✅ GOOD: Parallel calls
   const [context, uuid, user] = await Promise.all([
     zoomSdk.getMeetingContext(),
     zoomSdk.getMeetingUUID(),
     zoomSdk.getUserContext()
   ]);
   // Much faster!
   ```

2. **Debounce Participant Refreshes**
   ```javascript
   // Don't refresh on every participant change
   // Use debounce to batch updates
   const debouncedRefresh = debounce(refreshParticipants, 1000);

   zoomSdk.addEventListener('onParticipantChange', debouncedRefresh);
   ```

3. **Memoize SDK Helpers**
   ```javascript
   const sendChatMessage = useCallback(async (message) => {
     await zoomSdk.sendMessageToChat({ message });
   }, [zoomSdk]);
   // Prevents re-creation on every render
   ```

### Debugging Tips

#### Enable Verbose Logging

```javascript
// Log all SDK calls
const originalCallZoomApi = zoomSdk.callZoomApi.bind(zoomSdk);
zoomSdk.callZoomApi = async (...args) => {
  console.log('🔵 SDK Call:', args[0], args.slice(1));
  const result = await originalCallZoomApi(...args);
  console.log('🟢 SDK Response:', result);
  return result;
};
```

#### Check SDK Configuration Response

```javascript
const configResponse = await zoomSdk.config({ /* ... */ });
console.log('SDK Config Response:', JSON.stringify(configResponse, null, 2));

// Look for:
// - runningContext: Should be "inMeeting" for meeting features
// - auth.status: Should be "authenticated" if using OAuth
// - unsupportedApis: Empty array = all APIs available
// - clientVersion: Minimum version for your features
```

#### Test in Zoom DevTools Console

```javascript
// Open DevTools in Zoom App (right-click → Inspect Element)
// Test SDK directly in console:

// Check SDK availability
console.log(typeof zoomSdk); // "object"

// Test API call
zoomSdk.getMeetingContext().then(console.log);

// Check supported APIs
zoomSdk.getSupportedJsApis().then(r => console.log(r.supportedApis));
```

### Production Checklist

Before deploying to production:

- [ ] All SDK capabilities enabled in Zoom Marketplace
- [ ] OAuth scopes configured if using authentication
- [ ] Domain allowlist includes `appssdk.zoom.us`
- [ ] Error handling added to all SDK calls
- [ ] Loading states for SDK initialization
- [ ] Graceful degradation if SDK unavailable
- [ ] Testing on different Zoom client versions
- [ ] Console.log() calls removed or conditional
- [ ] SDK call results not logged to avoid PII exposure

---

## Next Steps

- [Frontend Implementation Guide](./03-frontend-guide.md) - Learn how to build UI components and call SDK methods
- [SDK Reference and Structures](./06-sdk-reference.md) - Complete reference of SDK methods and data structures
- [Backend Authentication](./04-backend-guide.md) - Set up OAuth and API proxy
- [Critical Setup Requirements](./07-critical-setup-requirements.md) - Required Marketplace configuration
