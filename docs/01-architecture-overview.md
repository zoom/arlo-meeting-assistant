# Zoom Apps Architecture Overview

## Introduction

This document provides a comprehensive overview of the Zoom Apps reference application architecture. This app demonstrates a full-featured Zoom App with three main components that work together to provide an interactive experience within Zoom meetings.

## Three-Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Zoom Client                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Frontend React App                         │    │
│  │  (Runs in Zoom's embedded browser)                 │    │
│  │  - Zoom Apps SDK integration                       │    │
│  │  - User interface components                       │    │
│  │  - SDK API demonstrations                          │    │
│  └─────────────────┬──────────────────────────────────┘    │
└────────────────────┼───────────────────────────────────────┘
                     │
                     │ HTTPS/REST API
                     │
         ┌───────────▼──────────────┐
         │   Backend Server         │
         │   (Node.js/Express)      │
         │   - OAuth 2.0 flows      │
         │   - Session management   │
         │   - API proxy            │
         │   - Token refresh        │
         └───────┬──────────────────┘
                 │
      ┏━━━━━━━━━━┻━━━━━━━━━━┓
      ┃                     ┃
┌─────▼──────┐    ┌─────────▼──────────┐
│   Redis    │    │   RTMS Server      │
│  Storage   │    │   (Realtime Media) │
│  - Sessions│    │   - Audio streams  │
│  - Tokens  │    │   - Video streams  │
│  - State   │    │   - Transcripts    │
└────────────┘    └────────────────────┘
```

## Component Details

### 1. Frontend Component (React App)

**Location:** `/frontend/`

**Purpose:** Provides the user interface that runs inside Zoom's embedded browser environment

**Technology Stack:**
- React 17
- React Router v6
- Bootstrap 5
- Zoom Apps SDK (JavaScript)

**Key Responsibilities:**
- Initialize and configure Zoom Apps SDK
- Request SDK capabilities at startup
- Provide UI for demonstrating SDK features
- Handle in-client OAuth flows
- Manage multi-instance communication (main client ↔ in-meeting)
- Control RTMS (Real-Time Media Streams) start/stop

**Entry Point:** `frontend/src/App.js`

### 2. Backend Component (Node.js/Express)

**Location:** `/backend/`

**Purpose:** Handles server-side operations that cannot be performed in the browser

**Technology Stack:**
- Node.js
- Express 4.x
- Redis for session storage
- http-proxy-middleware

**Key Responsibilities:**
- OAuth 2.0 authentication flows (web-based and in-client PKCE)
- Session management with Redis backing
- Secure token storage with encryption
- Automatic token refresh
- Proxy Zoom REST API calls with authentication
- Generate OAuth deeplinks
- Security headers and CSP configuration
- Optional third-party authentication (Auth0)

**Entry Point:** `backend/server.js`

### 3. RTMS Component (Real-Time Media Streams)

**Location:** `/rtms/`

**Purpose:** Receives and processes live audio, video, and transcript data from ongoing meetings

**Two Implementation Options:**

#### Option A: SDK Mode (`rtms/sdk/`)
- Uses Zoom's official `@zoom/rtms` npm package
- Webhook-based event handling
- Simplified stream management

#### Option B: WebSocket Mode (`rtms/websocket/`)
- Custom WebSocket client implementation
- Direct connection to Zoom's signaling servers
- More control over stream handling

**Key Responsibilities:**
- Listen for RTMS webhook events
- Connect to media streams when meeting starts
- Buffer audio, video, and transcript data
- Convert raw streams to standard formats (WAV, MP4, TXT)
- Clean up resources when meeting ends

**Utilities:** `rtms/utils/` contains shared audio, video, and transcript processing logic

## Data Flow Diagrams

### OAuth Web-Based Flow

```
┌────────┐     ┌─────────┐     ┌──────────┐     ┌────────┐
│  User  │────▶│ Backend │────▶│  Zoom    │────▶│Backend │
└────────┘     │ /install│     │  OAuth   │     │ /auth  │
   Clicks      └─────────┘     │  Server  │     └────────┘
   "Add App"         │         └──────────┘          │
                     │                │              │
                     │         Redirects             │
                     │         with code             │
                     │                │              │
                     │                └──────────────▶
                     │                     Exchange code
                     │                     for tokens
                     │                          │
                     │         ┌────────────────▼─────┐
                     └────────▶│  Deeplink to Zoom    │
                               │  Client with token   │
                               └──────────────────────┘
```

### In-Client OAuth Flow (PKCE)

```
┌──────────┐     ┌─────────┐     ┌──────────┐
│ Frontend │────▶│ Backend │────▶│ Frontend │
│          │     │/authorize     │          │
└──────────┘     └─────────┘     └──────────┘
   Request         Generate          Receive
   challenge       PKCE              challenge
                   challenge
                        │
                        │
┌──────────┐     ┌─────▼─────┐     ┌──────────┐
│ Frontend │────▶│ Zoom SDK  │────▶│ Frontend │
│          │     │.authorize()     │          │
└──────────┘     └───────────┘     └──────────┘
   Call SDK        Zoom handles        onAuthorized
   method          OAuth UI            event fires
                        │
                        │
┌──────────┐     ┌─────▼─────┐
│ Frontend │────▶│ Backend   │
│          │     │/onauth... │
└──────────┘     └───────────┘
   Send code       Exchange for
   to backend      tokens
```

### RTMS Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Frontend │────▶│ Zoom SDK │────▶│   Zoom   │
│          │     │.startRTMS     │  Servers  │
└──────────┘     └──────────┘     └──────────┘
   User clicks      Initiates         Webhook
   "Start RTMS"     streaming         sent
        │                                  │
        │                                  │
        │           ┌──────────────────────▼────┐
        │           │    RTMS Server            │
        │           │  - Receives webhook       │
        │           │  - Connects to streams    │
        │           │  - Buffers audio/video    │
        │           │  - Saves transcripts      │
        │           └───────────────────────────┘
        │                       │
        │                       │ On meeting end
        │                       │
        │           ┌───────────▼───────────────┐
        └──────────▶│  Convert to files         │
                    │  - WAV (audio)            │
                    │  - MP4 (video)            │
                    │  - TXT (transcripts)      │
                    └───────────────────────────┘
```

## Project Structure

```
zoomapps-advancedsample-react/
│
├── frontend/                    # React application
│   ├── public/
│   │   └── index.html          # HTML template
│   ├── src/
│   │   ├── App.js              # Main app component, SDK config
│   │   ├── apis.js             # SDK API demonstrations
│   │   ├── components/
│   │   │   ├── Authorization.js    # OAuth flows
│   │   │   ├── Home.js             # Landing page
│   │   │   └── ...
│   │   └── helpers/
│   │       └── axios.js        # HTTP client configuration
│   ├── package.json
│   └── .env.example
│
├── backend/                     # Node.js/Express server
│   ├── server.js               # Express app setup
│   ├── config.js               # Environment validation
│   ├── middleware.js           # Session & security
│   ├── api/
│   │   ├── zoomapp/
│   │   │   ├── router.js       # OAuth routes
│   │   │   └── controller.js   # OAuth logic
│   │   ├── zoom/
│   │   │   ├── router.js       # API proxy routes
│   │   │   └── middleware.js   # Token refresh
│   │   └── thirdpartyauth/     # Optional Auth0
│   ├── util/
│   │   ├── zoom-api.js         # Zoom API client
│   │   ├── zoom-helpers.js     # OAuth helpers
│   │   ├── store.js            # Redis persistence
│   │   └── encrypt.js          # AES encryption
│   └── package.json
│
├── rtms/                        # Real-Time Media Streams
│   ├── sdk/                    # @zoom/rtms implementation
│   │   ├── index.js            # Webhook handler
│   │   └── package.json
│   ├── websocket/              # WebSocket implementation
│   │   ├── index.js            # Express server
│   │   ├── api/
│   │   │   └── controller.js   # Webhook logic
│   │   ├── lib/
│   │   │   └── RtmsClient.js   # WebSocket client
│   │   └── package.json
│   └── utils/                  # Shared utilities
│       ├── audio.js            # WAV conversion
│       ├── video.js            # MP4 conversion
│       └── transcript.js       # Text processing
│
├── docker-compose.yml           # Multi-container setup
├── .env.example                 # Configuration template
└── README.md
```

## Environment Configuration

All three components share configuration from the root `.env` file:

```bash
# Zoom App Credentials (from Marketplace)
ZOOM_APP_CLIENT_ID=your_client_id
ZOOM_APP_CLIENT_SECRET=your_client_secret

# Public URL (ngrok for local dev)
PUBLIC_URL=https://your-subdomain.ngrok-free.app

# Security Keys
SESSION_SECRET=random_secret_key
REDIS_ENCRYPTION_KEY=32_byte_encryption_key

# Optional: Third-party OAuth
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=auth0_client_id
AUTH0_CLIENT_SECRET=auth0_client_secret
```

## App Installation and Launch Process

### Installation Paths

Zoom Apps can be installed through three methods:

1. **Local Test** - Available in Marketplace app configuration for development testing
2. **Marketplace Listing** - Public installation from the [Zoom App Marketplace](https://marketplace.zoom.us/)
3. **Zoom Client** - Direct installation from the Zoom Apps listing in the Zoom client

When published on the Marketplace, a 'Visit Site to Install' button redirects users to your Direct Landing URL, allowing you to intercept the request, generate OAuth state parameters, and initiate the authorization flow before launching the app.

### App Launch Flow

1. **Authorization** - User authorizes the app through OAuth (web-based or in-client)
2. **Deep Link Generation** - Backend makes a POST request to Zoom's deep link API:
   ```bash
   POST /v2/zoomapp/deeplink/ HTTP/1.1
   Host: https://api.zoom.us
   Authorization: Bearer <access_token>
   Content-Type: application/json

   {"action": "go"}
   ```
   Note: The `action` parameter has a 256 character limit.

3. **Client Launch** - Zoom client redirects to the deep link and makes a GET request to your app's Home URL
4. **Context Validation** - Your app decrypts the `X-Zoom-App-Context` header to validate the request came from Zoom and extract user/meeting information

## OWASP Secure Headers Requirement

**CRITICAL:** The Zoom Apps platform enforces OWASP security headers. Your app's Home URL must return HTTP responses with the following headers:

- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `Content-Security-Policy`
- `Referrer-Policy`

The Zoom client validates all document responses (MIME type `text/html`) with a 200 status code for these headers. Apps that don't include these headers will fail to load.

For detailed CSP configuration, see [Security Best Practices](./07-security-guide.md).

## Zoom Client User-Agent

All requests originating from the Zoom Client include a consistent User-Agent header:

```
Mozilla/5.0 ZoomWebKit/537.36 (KHTML, like Gecko) ZoomApps/1.0
```

This header is OS-agnostic and can be used to identify requests from Zoom clients across all platforms.

## Embedded Browser Engines

The Zoom client uses different browser engines depending on the platform:

**Windows:**
- Microsoft Edge WebView2 (Chromium-based rendering engine)
- CEF (Chromium Embedded Framework)
  - 32-bit: 1.0 GB JavaScript memory limit (512 MB allocation recommended)
  - 64-bit: 4.0 GB JavaScript memory limit

**macOS:**
- WKWebView (uses the version tied to Safari)

**Android Zoom Rooms:**
- Android system's built-in Chromium WebView (version found in Settings > About > Chromium)

## Communication Patterns

### Frontend ↔ Backend

**REST API Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/zoomapp/home` | GET | Load app in Zoom client |
| `/api/zoomapp/install` | GET | Initiate web-based OAuth |
| `/api/zoomapp/auth` | GET | OAuth callback handler |
| `/api/zoomapp/authorize` | GET | Get PKCE challenge |
| `/api/zoomapp/onauthorized` | POST | Exchange in-client OAuth code |
| `/zoom/api/*` | GET/POST | Proxied Zoom REST API calls |

### Frontend ↔ Zoom SDK

**SDK Method Calls (40+ capabilities):**
- `zoomSdk.config()` - Initialize with capabilities
- `zoomSdk.authorize()` - In-client OAuth
- `zoomSdk.getMeetingContext()` - Get meeting info
- `zoomSdk.getMeetingParticipants()` - Get participant list
- `zoomSdk.setVirtualBackground()` - Set background image
- `zoomSdk.cloudRecording()` - Control recording
- `zoomSdk.startRTMS()` - Start media streaming
- `zoomSdk.postMessage()` - Send messages between instances

**SDK Event Listeners:**
- `onAuthorized` - OAuth completed
- `onMessage` - Receive messages from other instances
- `onMyUserContextChange` - User context changed
- `onConnect` - Instance connection status changed

### Backend ↔ Zoom APIs

**OAuth Endpoints:**
- `POST /oauth/token` - Exchange code for tokens
- `POST /oauth/token` - Refresh expired tokens

**REST API (proxied through backend):**
- `GET /v2/users/me` - Get current user info
- All other Zoom REST API endpoints available

### RTMS ↔ Zoom

**Webhook Events:**
- `meeting.rtms_started` - Meeting RTMS session started
- `meeting.rtms_stopped` - Meeting RTMS session stopped

**Stream Connections:**
- WebSocket to signaling server
- Binary data streams for audio/video
- JSON messages for transcripts

## Deployment

### Local Development (Docker)

```bash
# Start all services (frontend, backend, Redis)
docker-compose up --build

# Start with RTMS WebSocket server
docker-compose up --build rtms-websocket

# Start with RTMS SDK server
docker-compose --profile sdk up --build
```

### Production Considerations

1. **Environment Variables:**
   - Use production Zoom App credentials
   - Generate strong SESSION_SECRET and encryption keys
   - Use production Redis instance

2. **Security:**
   - Enable HTTPS only
   - Configure CORS for your domain
   - Implement rate limiting
   - Add request logging and monitoring

3. **Scaling:**
   - Use Redis cluster for session storage
   - Load balance backend instances
   - Consider CDN for frontend assets

4. **RTMS:**
   - Ensure sufficient bandwidth for media streams
   - Plan storage for audio/video files
   - Implement cleanup policies for old recordings

## Key Features Demonstrated

This reference app showcases:

- OAuth 2.0 flows (web-based, in-client PKCE, guest mode)
- Zoom Apps SDK configuration and initialization
- 30+ SDK API method demonstrations
- Token management and automatic refresh
- Security best practices (CSP, encryption, PKCE)
- Multi-instance communication (main client ↔ in-meeting)
- Real-Time Media Streams capture and conversion
- Virtual backgrounds with external images
- Cloud recording control
- Meeting context and participant access
- App collaboration features
- Third-party authentication integration

## Next Steps

For detailed implementation guidance, see:

- [SDK Setup and Initialization](./02-sdk-setup.md)
- [Frontend Implementation Guide](./03-frontend-guide.md)
- [Backend Authentication and API](./04-backend-guide.md)
- [RTMS Implementation Guide](./05-rtms-guide.md)
- [SDK Reference and Structures](./06-sdk-reference.md)
- [Security Best Practices](./07-security-guide.md)
