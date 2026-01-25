# Frontend Implementation Patterns

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
│   ├── apis.js             # SDK API definitions
│   ├── components/
│   │   ├── Authorization.js    # OAuth flows
│   │   └── UserInfo.js         # User profile display
│   ├── helpers/
│   │   └── axios.js        # HTTP client configuration
│   └── index.js            # React entry point
└── package.json
```

## Main App Component

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

  // ... component logic
}
```

## SDK Method Invocation

### Generic API Invocation Pattern

```javascript
const invokeZoomAppsSdk = (api) => () => {
  const { name, buttonName = '', options = null } = api
  const zoomAppsSdkApi = zoomSdk[name].bind(zoomSdk)

  zoomAppsSdkApi(options)
    .then((clientResponse) => {
      console.log(
        `${buttonName || name} success: ${JSON.stringify(clientResponse)}`
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

```javascript
export const apis = [
  // Simple method call (no parameters)
  { name: 'getMeetingContext' },

  // Method with options
  {
    name: 'setVirtualBackground',
    options: {
      fileUrl: 'https://images.unsplash.com/photo-example',
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

  // Action-based methods
  {
    buttonName: 'shareApp (start)',
    name: 'shareApp',
    options: { action: 'start' },
  },
]
```

## RTMS Controls

```javascript
const [rtmsMessage, setRtmsMessage] = useState('')

const handleStartRTMS = async () => {
  try {
    const res = await zoomSdk.callZoomApi('startRTMS')
    setRtmsMessage(`RTMS started successfully`)
  } catch (error) {
    setRtmsMessage(`RTMS error: ${error}`)
  }
}

const handleStopRTMS = async () => {
  try {
    const res = await zoomSdk.callZoomApi('stopRTMS')
    setRtmsMessage(`RTMS stopped successfully`)
  } catch (error) {
    setRtmsMessage(`RTMS error: ${error}`)
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

1. **Traditional Web-Based OAuth** - User redirected to Zoom for auth
2. **In-Client OAuth (PKCE)** - OAuth handled within Zoom client
3. **Guest Mode** - Unauthenticated access with promptAuthorize

### In-Client OAuth Flow (PKCE)

```javascript
const authorize = async () => {
  console.log('Authorize flow begins here')

  // Step 1: Get code challenge and state from backend
  let authorizeResponse
  try {
    authorizeResponse = await (await fetch('/api/zoomapp/authorize')).json()

    if (!authorizeResponse || !authorizeResponse.codeChallenge) {
      console.error('Error in the authorize flow')
      setShowInClientOAuthPrompt(true)
      return
    }
  } catch (e) {
    console.error(e)
    return
  }

  const { codeChallenge, state } = authorizeResponse

  // Step 2: Call SDK authorize method
  const authorizeOptions = {
    codeChallenge: codeChallenge,
    state: state,
  }

  try {
    const zoomAuthResponse = await zoomSdk.authorize(authorizeOptions)
    console.log(zoomAuthResponse)
  } catch (e) {
    console.error(e)
  }
}
```

### Handling onAuthorized Event

```javascript
useEffect(() => {
  zoomSdk.addEventListener('onAuthorized', (event) => {
    const { code, state } = event

    // Exchange code for token on backend
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
      console.log('Backend successfully exchanged code for auth token')
      setUserAuthorized(true)
    })
  })
}, [])
```

### Guest Mode with promptAuthorize

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

### Authentication Best Practices

**Link Accounts with Zoom user_id:**
- Use the `user_id` from the app context to restore user sessions
- The `user_id` is available in the `X-Zoom-App-Context` header

**Avoid Cookie-Based Sessions:**
- Cookies are removed when users log out of meetings
- Use `user_id` for session management instead

**Leverage System Browser Authentication:**
- Use the `openUrl` SDK method to capture active browser sessions
- Reduces friction by avoiding re-authentication

### Fetching User Info

```javascript
useEffect(() => {
  zoomSdk.addEventListener('onMyUserContextChange', (event) => {
    handleUserContextStatus(event.status)
  })

  async function fetchUser() {
    try {
      const response = await fetch('/zoom/api/v2/users/me')
      if (response.status !== 200) throw new Error()

      const user = await response.json()
      handleUser(user)
      setShowInClientOAuthPrompt(false)
    } catch (error) {
      console.error(error)
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
}, [userContextStatus])
```

## Multi-Instance Communication

Zoom Apps can run in two places simultaneously:
- **Main Client** - Zoom desktop/mobile app (outside meeting)
- **In-Meeting** - Inside the meeting window

### Pre-Meeting Synchronization

#### Main Client Listens for Meeting Instance

```javascript
const [preMeeting, setPreMeeting] = useState(true)

let on_message_handler_client = useCallback(
  (message) => {
    let content = message.payload.payload

    if (content === 'connected' && preMeeting === true) {
      console.log('Meeting instance exists.')
      zoomSdk.removeEventListener('onMessage', on_message_handler_client)

      console.log("Letting meeting instance know client's current state.")
      sendMessage(window.location.hash, 'client')

      setPreMeeting(false)
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

#### Meeting Instance Connects and Announces

```javascript
const [connected, setConnected] = useState(false)

useEffect(() => {
  async function connectInstances() {
    if (runningContext === 'inMeeting') {
      zoomSdk.addEventListener('onConnect', (event) => {
        console.log('Connected')
        setConnected(true)

        if (preMeeting === true) {
          console.log('Letting client know meeting instance exists.')
          sendMessage('connected', 'meeting')

          let on_message_handler_mtg = (message) => {
            console.log('Message from client received:', message.payload.payload)
            window.location.replace(message.payload.payload)
            zoomSdk.removeEventListener('onMessage', on_message_handler_mtg)
            setPreMeeting(false)
          }

          zoomSdk.addEventListener('onMessage', on_message_handler_mtg)
        }
      })

      await zoomSdk.connect()
    }
  }

  if (connected === false) {
    connectInstances()
  }
}, [connected, preMeeting, runningContext])
```

#### Send Messages

```javascript
async function sendMessage(msg, sender) {
  console.log('Message sent from ' + sender + ' with data: ' + JSON.stringify(msg))
  await zoomSdk.postMessage({
    payload: msg,
  })
}
```

### Post-Meeting Communication

```javascript
useEffect(() => {
  async function communicateTabChange() {
    if (runningContext === 'inMeeting' && connected && preMeeting === false) {
      sendMessage(location.pathname, runningContext)
    } else if (runningContext === 'inMainClient' && preMeeting === false) {
      receiveMessage(runningContext, 'for tab change')
    }
  }

  communicateTabChange()
}, [connected, location, preMeeting, runningContext])
```

## UI Components

### User Info Display

```javascript
function UserInfo({ user, userContextStatus, showInClientOAuthPrompt, onClick }) {
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
            <button onClick={onClick}>Authorize</button>
          )}
        </div>
      )}
    </div>
  )
}
```

### Conditional Rendering Based on Context

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

## HTTP Client Configuration

```javascript
import axios from 'axios'

const instance = axios.create({
  baseURL: '/',
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

## Best Practices

### 1. Error Handling

```javascript
async function callSdkMethod() {
  try {
    const result = await zoomSdk.getMeetingContext()
    console.log('Success:', result)
  } catch (error) {
    console.error('Error:', error)
    setError('Failed to get meeting context. Please try again.')
  }
}
```

### 2. Event Listener Cleanup

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

### 3. Loading States

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

### DevTools in Zoom Client

1. Enable developer menu in Zoom settings
2. Right-click in your app → Inspect Element
3. Use Console, Network, and Sources tabs

### Common Issues

**Issue: SDK methods not working**
- Check if capability is in `config()` capabilities array
- Verify capability is enabled in Marketplace
- Check running context

**Issue: OAuth not working**
- Check backend is running and accessible
- Verify environment variables are set
- Check browser console for error messages

**Issue: Multi-instance communication not working**
- Verify both instances have called `config()`
- Check that in-meeting instance called `connect()`
- Ensure `postMessage` and `onMessage` are in capabilities

## Next Steps

- [Backend OAuth](./04-backend-oauth.md) - Set up OAuth and API proxy
- [SDK Reference](./08-sdk-reference.md) - Complete SDK method reference
- [Security Best Practices](./07-security.md) - Security considerations
