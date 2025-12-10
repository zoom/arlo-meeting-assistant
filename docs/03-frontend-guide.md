# Frontend Implementation Guide

## Overview

This guide covers how to implement the frontend of a Zoom App using React and the Zoom Apps JavaScript SDK. It includes patterns for calling SDK methods, handling OAuth, managing multi-instance communication, and building UI components.

## Project Structure

```
frontend/
├── public/
│   └── index.html          # HTML template (SDK loaded by Zoom)
├── src/
│   ├── App.js              # Main application component
│   ├── App.css             # Main styles
│   ├── apis.js             # SDK API definitions and invocation
│   ├── components/
│   │   ├── Authorization.js    # OAuth flows and user management
│   │   ├── ApiScrollview.js    # SDK API demonstration UI
│   │   ├── Home.js             # Landing page
│   │   ├── Header.js           # Navigation header
│   │   ├── UserInfo.js         # User profile display
│   │   ├── IFrame.js           # IFrame demonstration
│   │   ├── Image.js            # Image display
│   │   └── Auth0User.js        # Third-party auth integration
│   ├── helpers/
│   │   └── axios.js        # HTTP client configuration
│   └── index.js            # React entry point
└── package.json
```

## Main App Component

The App component is the heart of your Zoom App, responsible for SDK configuration, context management, and multi-instance communication.

### Key Responsibilities

**Reference:** `frontend/src/App.js`

1. **SDK Configuration** - Initialize SDK with capabilities
2. **Context Management** - Track running context and user status
3. **Instance Communication** - Handle main client ↔ in-meeting sync
4. **Feature Controls** - Provide UI for RTMS and other features

### State Management

```javascript
function App() {
  // Error handling
  const [error, setError] = useState(null)

  // User data
  const [user, setUser] = useState(null)

  // SDK context
  const [runningContext, setRunningContext] = useState(null)
  const [userContextStatus, setUserContextStatus] = useState('')

  // Multi-instance communication
  const [connected, setConnected] = useState(false)
  const [preMeeting, setPreMeeting] = useState(true)

  // RTMS controls
  const [rtmsMessage, setRtmsMessage] = useState('')

  // SDK reconfiguration
  const [counter, setCounter] = useState(0)

  // ... component logic
}
```

## SDK Method Invocation

### Generic API Invocation Pattern

**Reference:** `frontend/src/apis.js:3-14`

Create a reusable function to invoke any SDK method:

```javascript
const invokeZoomAppsSdk = (api) => () => {
  const { name, buttonName = '', options = null } = api
  const zoomAppsSdkApi = zoomSdk[name].bind(zoomSdk)

  zoomAppsSdkApi(options)
    .then((clientResponse) => {
      console.log(
        `${buttonName || name} success with response: ${JSON.stringify(clientResponse)}`
      )
    })
    .catch((clientError) => {
      console.log(
        `${buttonName || name} error: ${JSON.stringify(clientError)}`
      )
    })
}
```

### API Definitions

**Reference:** `frontend/src/apis.js:30-140`

Define your SDK method demonstrations with options:

```javascript
export const apis = [
  // Simple method call (no parameters)
  {
    name: 'getMeetingContext',
  },

  // Method with options
  {
    name: 'setVirtualBackground',
    options: {
      fileUrl: 'https://images.unsplash.com/photo-1533743983669-94fa5c4338ec',
    },
  },

  // Method with custom button name
  {
    buttonName: 'cloudRecording (start)',
    name: 'cloudRecording',
    options: { action: 'start' },
  },
  {
    buttonName: 'cloudRecording (stop)',
    name: 'cloudRecording',
    options: { action: 'stop' },
  },

  // Boolean options
  {
    buttonName: 'setVideoMirrorEffect (true)',
    name: 'setVideoMirrorEffect',
    options: {
      mirrorMyVideo: true,
    },
  },

  // Action-based methods
  {
    buttonName: 'shareApp (start)',
    name: 'shareApp',
    options: {
      action: 'start',
    },
  },
  {
    buttonName: 'shareApp (stop)',
    name: 'shareApp',
    options: {
      action: 'stop',
    },
  },
].sort(sortListByName)
```

### Common SDK Methods

| Method | Purpose | Options |
|--------|---------|---------|
| `getMeetingContext` | Get meeting info (UUID, join URL) | None |
| `getMeetingParticipants` | Get list of participants | None |
| `getRunningContext` | Get app's running context | None |
| `getUserContext` | Get user auth status | None |
| `getSupportedJsApis` | List available SDK methods | None |
| `setVirtualBackground` | Set user's background image | `{ fileUrl: string }` |
| `removeVirtualBackground` | Remove background | None |
| `cloudRecording` | Control cloud recording | `{ action: 'start'\|'stop'\|'pause'\|'resume' }` |
| `showNotification` | Show in-app notification | `{ type, title, message }` |
| `openUrl` | Open URL in browser | `{ url: string }` |
| `expandApp` | Expand app panel | None |
| `sendAppInvitationToAllParticipants` | Invite all to use app | None |
| `showAppInvitationDialog` | Show invitation UI | None |
| `listCameras` | Get available cameras | None |
| `startRTMS` | Start media streaming | None |
| `stopRTMS` | Stop media streaming | None |

## RTMS Controls

**Reference:** `frontend/src/App.js:191-207`

Implement controls for starting and stopping Real-Time Media Streams:

```javascript
const [rtmsMessage, setRtmsMessage] = useState('')

const handleStartRTMS = async () => {
  try {
    const res = await zoomSdk.callZoomApi('startRTMS')
    setRtmsMessage(`startRTMS success response: ${res}`)
  } catch (error) {
    setRtmsMessage(`startRTMS error response: ${error}`)
  }
}

const handleStopRTMS = async () => {
  try {
    const res = await zoomSdk.callZoomApi('stopRTMS')
    setRtmsMessage(`stopRTMS success response: ${res}`)
  } catch (error) {
    setRtmsMessage(`stopRTMS error response: ${error}`)
  }
}

// In your JSX
return (
  <div>
    {rtmsMessage && <p className='fw-bold'>{rtmsMessage}</p>}

    <button onClick={handleStartRTMS}>Start RTMS</button>
    <button onClick={handleStopRTMS}>Stop RTMS</button>
  </div>
)
```

## OAuth Implementation

### Three OAuth Patterns

The Authorization component demonstrates three authentication patterns:

**Reference:** `frontend/src/components/Authorization.js`

1. **Traditional Web-Based OAuth** - User redirected to Zoom for auth
2. **In-Client OAuth (PKCE)** - OAuth handled within Zoom client
3. **Guest Mode** - Unauthenticated access with promptAuthorize

### In-Client OAuth Flow (PKCE)

**Reference:** `frontend/src/components/Authorization.js:33-67`

```javascript
const authorize = async () => {
  console.log('Authorize flow begins here')

  // Step 1: Get code challenge and state from backend
  console.log('1. Get code challenge and state from backend...')
  let authorizeResponse
  try {
    authorizeResponse = await (await fetch('/api/zoomapp/authorize')).json()
    console.log(authorizeResponse)

    if (!authorizeResponse || !authorizeResponse.codeChallenge) {
      console.error('Error in the authorize flow - likely an outdated user session')
      setShowInClientOAuthPrompt(true)
      return
    }
  } catch (e) {
    console.error(e)
    return
  }

  const { codeChallenge, state } = authorizeResponse

  console.log('1a. Code challenge from backend:', codeChallenge)
  console.log('1b. State from backend:', state)

  // Step 2: Call SDK authorize method
  const authorizeOptions = {
    codeChallenge: codeChallenge,
    state: state,
  }

  console.log('2. Invoke authorize, eg zoomSdk.authorize(authorizeOptions)')
  try {
    const zoomAuthResponse = await zoomSdk.authorize(authorizeOptions)
    console.log(zoomAuthResponse)
  } catch (e) {
    console.error(e)
  }
}
```

### Handling onAuthorized Event

**Reference:** `frontend/src/components/Authorization.js:69-103`

Listen for the authorization completion event:

```javascript
useEffect(() => {
  console.log('In-Client OAuth flow: onAuthorized event listener added')

  zoomSdk.addEventListener('onAuthorized', (event) => {
    const { code, state } = event

    console.log('3. onAuthorized event fired.')
    console.log('3a. Event with code and state:', event)
    console.log('4. POST code and state to backend to exchange for token...')

    // Step 3: Exchange code for token on backend
    fetch('/api/zoomapp/onauthorized', {
      method: 'POST',
      body: JSON.stringify({
        code,
        state,
        href: window.location.href,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(() => {
      console.log('4. Backend successfully exchanged code for auth token')
      setUserAuthorized(true)
      handleError(null)
    })
  })
}, [handleError])
```

### Guest Mode with promptAuthorize

**Reference:** `frontend/src/components/Authorization.js:24-31`

For apps supporting unauthenticated access:

```javascript
const promptAuthorize = async () => {
  try {
    const promptAuthResponse = await zoomSdk.promptAuthorize()
    console.log(promptAuthResponse)
  } catch (e) {
    console.error(e)
  }
}
```

### Testing In-Client OAuth During Development

The in-client app flow to add an app is not available for unpublished apps. Use these workarounds for testing:

**Single User Test (self-invitation):**
1. Log into Zoom Marketplace web portal and add your app to your user account
2. Open the Zoom client and start a meeting
3. Open your app and send the app invitation to all participants
4. In the Zoom client, close the app (but do not end the meeting)
5. Go to the Zoom Marketplace and remove the app
6. Return to the meeting in the Zoom client, locate the app invitation in the chat tab, and accept it

**Two Users Test (multi-user invitation):**
1. User1 logs into Zoom Marketplace web portal and adds the app to their account
2. User1 opens the Zoom client and starts a meeting
3. User2 (who hasn't added the app) joins the meeting
4. User1 sends User2 an invite to add the app
5. User2 locates the app invitation in the chat tab and accepts it

### Authentication Best Practices

**Link Accounts with Zoom user_id:**
- Use the `user_id` from the app context to restore user sessions
- Avoid repeated authentication requests by mapping Zoom user IDs to your app's user accounts
- The `user_id` is available in the `X-Zoom-App-Context` header

**Avoid Cookie-Based Sessions:**
- Cookies are removed when users log out of meetings
- This triggers re-authorizations when users log in again
- Instead, use `user_id` for session management

**Leverage System Browser Authentication:**
- If users have active sessions with your service in their default browser, use the `openUrl` SDK method
- This captures the active authentication from the browser
- Reduces friction by avoiding re-authentication

**Use System Browsers for OAuth:**
- Authentication providers can block credentials in embedded browsers
- Your app can access user credentials saved in system browsers
- Better security and user experience

**First-Party Login Forms:**
- Use first-party login and password forms in embedded views for your own authentication
- Avoid iframes for sensitive authentication when possible

### Fetching User Info

**Reference:** `frontend/src/components/Authorization.js:109-135`

Fetch user information via Zoom REST API:

```javascript
useEffect(() => {
  // Listen for user context changes
  zoomSdk.addEventListener('onMyUserContextChange', (event) => {
    handleUserContextStatus(event.status)
  })

  async function fetchUser() {
    try {
      // Call Zoom REST API via backend proxy
      const response = await fetch('/zoom/api/v2/users/me')
      if (response.status !== 200) throw new Error()

      const user = await response.json()
      handleUser(user)
      setShowInClientOAuthPrompt(false)
    } catch (error) {
      console.error(error)
      console.log('Request failed - no Zoom access token exists')
      setShowInClientOAuthPrompt(true)
    }
  }

  if (userContextStatus === 'authorized') {
    setInGuestMode(false)
    fetchUser()
  } else if (
    userContextStatus === 'unauthenticated' ||
    userContextStatus === 'authenticated'
  ) {
    setInGuestMode(true)
  }
}, [handleUser, handleUserContextStatus, userAuthorized, userContextStatus])
```

## Multi-Instance Communication

Zoom Apps can run in two places simultaneously:
- **Main Client** - Zoom desktop/mobile app (outside meeting)
- **In-Meeting** - Inside the meeting window

These instances need to communicate to stay synchronized.

### Pre-Meeting Synchronization

When a user joins a meeting, sync the main client's state to the meeting instance.

**Reference:** `frontend/src/App.js:87-166`

#### Step 1: Main Client Listens for Meeting Instance

```javascript
const [preMeeting, setPreMeeting] = useState(true)

// Main client handler
let on_message_handler_client = useCallback(
  (message) => {
    let content = message.payload.payload

    if (content === 'connected' && preMeeting === true) {
      console.log('Meeting instance exists.')
      zoomSdk.removeEventListener('onMessage', on_message_handler_client)

      console.log("Letting meeting instance know client's current state.")
      sendMessage(window.location.hash, 'client')

      setPreMeeting(false) // Client is finished with pre-meeting sync
    }
  },
  [preMeeting]
)

useEffect(() => {
  if (runningContext === 'inMainClient' && preMeeting === true) {
    zoomSdk.addEventListener('onMessage', on_message_handler_client)
  }
}, [on_message_handler_client, preMeeting, runningContext])
```

#### Step 2: Meeting Instance Connects and Announces

```javascript
const [connected, setConnected] = useState(false)

useEffect(() => {
  async function connectInstances() {
    // Only call connect when in-meeting
    if (runningContext === 'inMeeting') {
      zoomSdk.addEventListener('onConnect', (event) => {
        console.log('Connected')
        setConnected(true)

        // Send initial message to main client
        if (preMeeting === true) {
          console.log('Letting client know meeting instance exists.')
          sendMessage('connected', 'meeting')

          console.log("Adding message listener for client's current state.")
          let on_message_handler_mtg = (message) => {
            console.log(
              'Message from client received. Updating state:',
              message.payload.payload
            )

            // Update meeting instance to match client state
            window.location.replace(message.payload.payload)

            zoomSdk.removeEventListener('onMessage', on_message_handler_mtg)
            setPreMeeting(false) // Meeting instance finished with pre-meeting
          }

          zoomSdk.addEventListener('onMessage', on_message_handler_mtg)
        }
      })

      await zoomSdk.connect()
      console.log('Connecting...')
    }
  }

  if (connected === false) {
    connectInstances()
  }
}, [connected, preMeeting, runningContext])
```

#### Step 3: Send Messages

```javascript
async function sendMessage(msg, sender) {
  console.log('Message sent from ' + sender + ' with data: ' + JSON.stringify(msg))
  console.log('Calling postMessage...', msg)

  await zoomSdk.postMessage({
    payload: msg,
  })
}
```

### Post-Meeting Communication

After pre-meeting sync, keep instances synchronized as user navigates.

**Reference:** `frontend/src/App.js:168-180`

```javascript
useEffect(() => {
  async function communicateTabChange() {
    // Only proceed after pre-meeting sync is done
    if (runningContext === 'inMeeting' && connected && preMeeting === false) {
      // Meeting instance sends navigation changes to main client
      sendMessage(location.pathname, runningContext)
    } else if (runningContext === 'inMainClient' && preMeeting === false) {
      // Main client receives navigation changes
      receiveMessage(runningContext, 'for tab change')
    }
  }

  communicateTabChange()
}, [connected, location, preMeeting, receiveMessage, runningContext])
```

#### Receive Message Handler

```javascript
const receiveMessage = useCallback(
  (receiver, reason = '') => {
    let on_message_handler = (message) => {
      let content = message.payload.payload
      console.log('Message received ' + receiver + ' ' + reason + ': ' + content)

      // Navigate to the path sent by other instance
      navigate({ pathname: content })
    }

    // Prevent duplicate listeners
    if (once === 0) {
      zoomSdk.addEventListener('onMessage', on_message_handler)
      once = 1
    }
  },
  [navigate]
)
```

## UI Components

### User Info Display

Create a component to display user information after authentication:

```javascript
function UserInfo({ user, userContextStatus, showInClientOAuthPrompt, onClick, showGuestModePrompt }) {
  return (
    <div>
      <h2>User Information</h2>

      {user ? (
        <div>
          <p>Name: {user.first_name} {user.last_name}</p>
          <p>Email: {user.email}</p>
          <p>User ID: {user.id}</p>
        </div>
      ) : (
        <div>
          <p>User Context Status: {userContextStatus}</p>

          {showInClientOAuthPrompt && (
            <button onClick={onClick}>
              {showGuestModePrompt ? 'promptAuthorize' : 'authorize'}
            </button>
          )}

          {!showInClientOAuthPrompt && (
            <p>Loading user information...</p>
          )}
        </div>
      )}
    </div>
  )
}
```

### Navigation Header

```javascript
import { Link } from 'react-router-dom'

function Header({ navLinks }) {
  return (
    <nav>
      <ul>
        {Object.entries(navLinks).map(([key, label]) => (
          <li key={key}>
            <Link to={`/${key}`}>{label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

### API Demonstration UI

```javascript
import Button from 'react-bootstrap/Button'
import { apis, invokeZoomAppsSdk } from '../apis'

function ApiScrollview({ onStartRTMS, onStopRTMS }) {
  return (
    <div>
      <h2>SDK API Demonstrations</h2>

      {apis.map((api) => (
        <Button
          key={api.buttonName || api.name}
          onClick={invokeZoomAppsSdk(api)}
          variant="primary"
        >
          {api.buttonName || api.name}
        </Button>
      ))}

      <hr />

      <h3>RTMS Controls</h3>
      <Button onClick={onStartRTMS} variant="success">
        Start RTMS
      </Button>
      <Button onClick={onStopRTMS} variant="danger">
        Stop RTMS
      </Button>
    </div>
  )
}
```

## HTTP Client Configuration

Configure axios or fetch for backend API calls:

**Reference:** `frontend/src/helpers/axios.js`

```javascript
import axios from 'axios'

const instance = axios.create({
  baseURL: '/', // Relative to your backend
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
instance.interceptors.request.use(
  (config) => {
    console.log('Request:', config.method.toUpperCase(), config.url)
    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
instance.interceptors.response.use(
  (response) => {
    console.log('Response:', response.status, response.config.url)
    return response
  },
  (error) => {
    console.error('Response error:', error)
    return Promise.reject(error)
  }
)

export default instance
```

## Styling with Bootstrap

**Reference:** `frontend/src/App.js:8`

```javascript
import 'bootstrap/dist/css/bootstrap.min.css'
import Button from 'react-bootstrap/Button'

function App() {
  return (
    <div className="container">
      <h1 className="text-center my-4">My Zoom App</h1>

      <Button variant="primary" onClick={handleClick}>
        Click Me
      </Button>

      <div className="row">
        <div className="col-md-6">
          <p className="fw-bold">Left column</p>
        </div>
        <div className="col-md-6">
          <p className="text-muted">Right column</p>
        </div>
      </div>
    </div>
  )
}
```

## Best Practices

### 1. Error Handling

Always wrap SDK calls in try-catch:

```javascript
async function callSdkMethod() {
  try {
    const result = await zoomSdk.getMeetingContext()
    console.log('Success:', result)
    // Handle success
  } catch (error) {
    console.error('Error:', error)
    // Show user-friendly error message
    setError('Failed to get meeting context. Please try again.')
  }
}
```

### 2. Event Listener Cleanup

Remove event listeners when components unmount:

```javascript
useEffect(() => {
  const handleMessage = (message) => {
    console.log('Message received:', message)
  }

  zoomSdk.addEventListener('onMessage', handleMessage)

  return () => {
    zoomSdk.removeEventListener('onMessage', handleMessage)
  }
}, [])
```

### 3. Prevent Duplicate Listeners

Use a flag or state to prevent adding multiple listeners:

```javascript
let listenerAdded = false

useEffect(() => {
  if (!listenerAdded) {
    zoomSdk.addEventListener('onMessage', handleMessage)
    listenerAdded = true
  }
}, [])
```

### 4. Conditional Feature Rendering

Only show features available in current context:

```javascript
function App() {
  const [runningContext, setRunningContext] = useState(null)

  return (
    <div>
      {runningContext === 'inMeeting' && (
        <div>
          <button onClick={handleStartRecording}>Start Recording</button>
          <button onClick={handleStartRTMS}>Start RTMS</button>
        </div>
      )}

      {runningContext === 'inMainClient' && (
        <div>
          <p>Join a meeting to access recording and RTMS features</p>
        </div>
      )}
    </div>
  )
}
```

### 5. Loading States

Show loading indicators during async operations:

```javascript
function Authorization() {
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)

  async function fetchUser() {
    setLoading(true)
    try {
      const response = await fetch('/zoom/api/v2/users/me')
      const userData = await response.json()
      setUser(userData)
    } catch (error) {
      console.error('Error fetching user:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {loading && <p>Loading user information...</p>}
      {!loading && user && <UserInfo user={user} />}
      {!loading && !user && <button onClick={fetchUser}>Load User</button>}
    </div>
  )
}
```

## Debugging Tips

### Enable Detailed Logging

```javascript
// Log all SDK calls
const originalLog = console.log
console.log = (...args) => {
  originalLog('[APP]', new Date().toISOString(), ...args)
}

// Log SDK responses
zoomSdk.addEventListener('onMessage', (message) => {
  console.log('onMessage:', JSON.stringify(message, null, 2))
})
```

### DevTools in Zoom Client

1. Enable developer menu in Zoom settings
2. Right-click in your app → Inspect Element
3. Use Console, Network, and Sources tabs

### Common Issues

**Issue: SDK methods not working**
- Check if capability is in `config()` capabilities array
- Verify capability is enabled in Marketplace
- Check running context (some methods only work in meetings)

**Issue: OAuth not working**
- Check backend is running and accessible
- Verify environment variables are set
- Check browser console for error messages
- Ensure session is not expired

**Issue: Multi-instance communication not working**
- Verify both instances have called `config()`
- Check that in-meeting instance called `connect()`
- Ensure `postMessage` and `onMessage` are in capabilities

## Next Steps

- [Backend Authentication and API](./04-backend-guide.md) - Set up OAuth and API proxy
- [SDK Reference and Structures](./06-sdk-reference.md) - Complete SDK method reference
- [Security Best Practices](./07-security-guide.md) - Security considerations
