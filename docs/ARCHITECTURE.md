# Arlo Meeting Assistant Architecture

## Executive Summary

This document outlines the architecture for a Zoom Apps-based meeting assistant that demonstrates the power of Real-Time Media Streams (RTMS) **without requiring a meeting bot**. The application showcases how developers can build intelligent meeting assistants that run natively inside Zoom meetings, providing real-time transcription, AI-powered summaries, action items, and meeting insights.

**Key Value Proposition:**
> "You don't need a bot. Build a meeting assistant AS A ZOOM APP."

**Core Capabilities:**
- Real-time transcript capture and display via RTMS
- Live AI-powered suggestions during meetings
- Post-meeting summaries and action items
- Meeting history with full-text search
- Chat with your meeting transcripts (RAG)
- Personal meeting intelligence (user sees only their meetings)

---

## System Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Zoom Meeting                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Arlo Meeting Assistant Zoom App (React)                 │  │
│  │  - Live transcript display                               │  │
│  │  - Real-time AI suggestions                              │  │
│  │  - Meeting notes/highlights                              │  │
│  │  - Action item tracking                                  │  │
│  └────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────────┘
                          │ HTTPS + WebSocket
                          │
         ┌────────────────▼────────────────┐
         │   Backend API Server            │
         │   (Node.js/Express)             │
         │   - Zoom OAuth 2.0              │
         │   - WebSocket server            │
         │   - RTMS ingestion              │
         │   - REST API                    │
         │   - AI orchestration            │
         └────┬───────────┬────────────────┘
              │           │
    ┌─────────▼───┐   ┌───▼─────────────┐
    │  Postgres   │   │  OpenRouter     │
    │  Database   │   │  (LLM Provider) │
    │  - Meetings │   │  - Free models  │
    │  - Trans.   │   │  - Premium opts │
    │  - Users    │   └─────────────────┘
    └─────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Post-Meeting Web App (Next.js)                              │
│  - Meeting history                                           │
│  - Transcript search                                         │
│  - Chat with transcripts                                     │
│  - Export VTT/JSON                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Zoom App Component (In-Meeting)

**Location:** `/frontend/`

**Technology:**
- React 18 (Create React App 5)
- Zoom Apps SDK 0.16+
- `@base-ui/react` (unstyled, accessible components) + plain CSS
- CSS custom properties (design tokens) in `src/index.css`
- WebSocket client

**Key Features:**

**Live Transcript View:**
```javascript
// Real-time caption display with < 1s latency
- ScrollArea (Base UI) with auto-scroll
- "Resume Live" button when scrolled up
- Speaker labels
- Timestamps
- Search/highlight
```

**AI Assistant Panel:**
```javascript
// Real-time meeting intelligence
- "Suggest Next Steps" button
- Auto-trigger at 50min mark (configurable)
- Action items with owners
- Key decisions highlight
- Meeting summary (live-updating)
```

**Controls:**
```javascript
// Meeting management
- Start/Stop RTMS (via SDK)
- Pause/Resume transcript
- Create highlight
- Mark important moment
- Export transcript
```

**SDK Capabilities Required:**
```javascript
zoomSdk.config({
  capabilities: [
    'getMeetingContext',      // Get meeting ID, user info
    'getMeetingUUID',         // Unique meeting identifier
    'getUserContext',         // User authorization
    'authorize',              // In-client OAuth
    'onAuthorized',          // Auth callback
    'callZoomApi',           // Call startRTMS
    'onMessage',             // WebSocket messages (optional)
    'showNotification'       // User alerts
  ]
})
```

**RTMS Initiation:**
```javascript
// User clicks "Start Assistant" or auto-start on meeting join
async function startRTMS() {
  try {
    await zoomSdk.callZoomApi('startRTMS', {
      audioOptions: {
        rawAudio: false  // We want transcript only
      },
      transcriptOptions: {
        caption: true    // Enable live captions
      }
    })
    console.log('RTMS started successfully')
  } catch (error) {
    console.error('Failed to start RTMS:', error)
  }
}
```

---

### 2. Backend API Server

**Location:** `/backend/`

**Technology:**
- Node.js 20+
- Express.js (JavaScript, not TypeScript)
- ws (WebSocket server)
- Prisma (ORM)

**Key Services:**

#### A. OAuth Service (`/api/auth/`)
```javascript
// Zoom-only authentication
Routes:
- GET  /api/auth/authorize     // Get PKCE challenge
- POST /api/auth/callback      // Exchange code for tokens
- GET  /api/auth/me            // Get current user
- POST /api/auth/refresh       // Refresh access token
- POST /api/auth/logout        // Logout

Implementation:
- In-client OAuth with PKCE
- Token storage in Postgres (encrypted)
- Automatic token refresh
- Session management
```

#### B. RTMS Ingestion Service
```javascript
// Real-time transcript processing (@zoom/rtms v1.0, class-based Client API)
// Each meeting gets its own rtms.Client() instance enabling multi-meeting support
Components:
- Per-meeting rtms.Client instances (stored in activeSessions Map)
- Transcript normalization
- Speaker identification
- Segment buffering (2-3s)
- Batch write to DB

Flow:
1. Receive transcript event from RTMS
2. Normalize: {
     meeting_id,
     speaker_id,
     text,
     t_start_ms,
     t_end_ms,
     confidence,
     seq_no
   }
3. Buffer in memory (handle out-of-order)
4. Batch insert to DB (50-100 segments)
5. Broadcast to connected WebSocket clients
```

#### C. WebSocket Broadcast Service
```javascript
// Real-time updates to Zoom App clients
Architecture:
- ws library for WebSocket server
- Redis pub/sub for multi-instance scaling
- Room-based subscriptions (per meeting)

Events:
- 'transcript.segment' → New caption line
- 'meeting.status'     → RTMS started/stopped
- 'ai.suggestion'      → Real-time AI insight
- 'connection.status'  → Health check

Client connection:
ws://api.example.com/ws?meeting_id={uuid}&token={jwt}
```

#### D. REST API Service
```javascript
// Meetings and transcripts
Routes:
- GET    /api/meetings                    // List user's meetings
- GET    /api/meetings/:id                // Meeting details
- GET    /api/meetings/:id/transcript     // Paginated transcript
- GET    /api/meetings/:id/vtt            // Export WebVTT
- POST   /api/meetings/:id/highlights     // Create highlight
- DELETE /api/meetings/:id                // Delete meeting

- GET    /api/search                      // Full-text search
- POST   /api/ai/chat                     // Chat with transcripts (SSE)
- POST   /api/ai/suggest                  // Get AI suggestions

Rate Limiting:
- Free tier: 10 AI requests/minute
- Authenticated: 100 requests/minute
```

#### E. AI Orchestration Service
```javascript
// OpenRouter integration with free models
Default Configuration:
{
  provider: 'OpenRouter',
  defaultModel: 'google/gemini-2.0-flash-thinking-exp:free',
  fallbackModel: 'meta-llama/llama-3.2-3b-instruct:free',
  requiresKey: false,  // Works without API key
  rateLimits: {
    free: { requests: 10, per: '1m' },
    premium: { requests: 100, per: '1m' }
  }
}

Features:
- Chat with transcripts (RAG)
- Real-time meeting summaries
- Action item extraction
- Next steps suggestions
- Meeting highlights
- Decision tracking

Prompt Templates:
- summary.prompt      → Meeting summary
- action-items.prompt → Extract tasks/owners
- next-steps.prompt   → Suggest next actions
- decisions.prompt    → Identify key decisions
```

---

### 3. Database Schema (Postgres)

**Location:** `/backend/prisma/schema.prisma`

See `backend/prisma/schema.prisma` for the full schema. Key models:

- **User** — Zoom user, linked by `zoomUserId`
- **UserToken** — Encrypted OAuth tokens (AES-256), auto-refresh
- **Meeting** — Meeting instance with title, timestamps, status, owner
- **Speaker** — Meeting participants with labels and roles
- **TranscriptSegment** — Caption lines with BigInt timestamps (`tStartMs`, `tEndMs`, `seqNo`)
  - `@@unique([meetingId, seqNo])` for idempotent writes
  - Indexed by `(meetingId, tStartMs)` and `(meetingId, seqNo)`
- **VttFile** — WebVTT export files
- **Highlight** — User-created bookmarks with time ranges and tags
- **AiSession / AiMessage / AiCitation** — AI chat history with transcript citations

All tables use `@@map()` for snake_case table names and `@map()` for snake_case column names. All user-scoped tables cascade delete from User/Meeting.

---

### 4. Post-Meeting Web App (Planned — Not Yet Implemented)

A standalone web app for browsing meeting history outside of Zoom is planned for a future phase. See [PROJECT_STATUS.md](./PROJECT_STATUS.md) Phase 3 for details.

**Planned Technology:** Next.js (App Router), separate from the in-meeting Zoom App.

**Planned Routes:**
```
/                  → Landing page (sign in with Zoom)
/home              → Dashboard + chat with your notetaker
/meetings          → List of past meetings
/meetings/[id]     → Meeting detail with transcript
```

> **Note:** Some post-meeting features (meeting history, highlights, AI chat) are currently available within the in-meeting Zoom App itself via the `MeetingHistory` and `AIPanel` components.

---

## Data Flow Diagrams

### 1. RTMS Ingestion Flow

```
┌─────────────┐
│Zoom Meeting │
│   (RTMS)    │
└──────┬──────┘
       │ WebSocket
       │ (transcript events)
       ▼
┌──────────────────────────────────┐
│  Backend: RTMS Ingestion Worker  │
│                                  │
│  1. Receive transcript event     │
│  2. Normalize data               │
│  3. Map speaker ID               │
│  4. Buffer (2-3s)                │
│  5. Reorder by seq_no            │
│  6. Batch insert to DB           │
└──────┬────────────────┬──────────┘
       │                │
       │                │ Broadcast
       ▼                ▼
┌─────────────┐   ┌──────────────────┐
│  Postgres   │   │ WebSocket Server │
│  Database   │   │  (Redis Pub/Sub) │
└─────────────┘   └────────┬─────────┘
                           │
                           │ Push update
                           ▼
                  ┌─────────────────┐
                  │  Zoom App       │
                  │  (Live View)    │
                  │  < 1s latency   │
                  └─────────────────┘
```

### 2. In-Meeting AI Suggestions Flow

```
┌──────────────┐
│  Zoom App    │  User clicks "Suggest Next Steps"
│  (Meeting)   │  OR auto-trigger at 50min mark
└──────┬───────┘
       │ POST /api/ai/suggest
       │ { meetingId, type: 'next-steps' }
       ▼
┌──────────────────────────────┐
│  Backend: AI Orchestrator    │
│                              │
│  1. Fetch meeting transcript │
│  2. Build context (last 10m) │
│  3. Apply prompt template    │
│  4. Call OpenRouter API      │
│  5. Stream response (SSE)    │
└──────┬───────────────────────┘
       │
       │ OpenRouter API call
       ▼
┌──────────────────────────────┐
│  OpenRouter                  │
│  Model: gemini-flash (free)  │
│                              │
│  Prompt:                     │
│  "Analyze this meeting and   │
│   suggest next steps..."     │
└──────┬───────────────────────┘
       │
       │ Streaming response
       ▼
┌──────────────────────────────┐
│  Zoom App                    │
│  Displays:                   │
│  - Next steps                │
│  - Action items with owners  │
│  - Key decisions             │
│  - Suggestions               │
└──────────────────────────────┘
```

### 3. Post-Meeting Chat with Transcripts Flow

```
┌──────────────┐
│  Web App     │  User asks: "What commitments did I make?"
│  (/home)     │
└──────┬───────┘
       │ POST /api/ai/chat (SSE)
       │ { query, filters: { date_range: 'this-week' } }
       ▼
┌──────────────────────────────────┐
│  Backend: RAG Pipeline           │
│                                  │
│  1. Parse query                  │
│  2. Search transcripts (FTS)     │
│  3. Rank by relevance            │
│  4. Build context window         │
│  5. Generate prompt              │
│  6. Call LLM with context        │
│  7. Extract citations            │
│  8. Stream response              │
└──────┬───────────────────────────┘
       │
       ├─────────► Postgres (Full-text search on segments)
       │
       └─────────► OpenRouter (Generate answer with citations)

       │ SSE Stream
       ▼
┌──────────────────────────────────┐
│  Web App                         │
│  Displays:                       │
│  - Streaming answer              │
│  - Citations with timestamps     │
│  - Click citation → jump to      │
│    meeting detail at time        │
└──────────────────────────────────┘
```

---

## API Specifications

### Core REST Endpoints

```javascript
// Authentication
POST   /api/auth/authorize          // Start OAuth flow
POST   /api/auth/callback           // Exchange code for tokens
GET    /api/auth/me                 // Get current user
POST   /api/auth/refresh            // Refresh access token
POST   /api/auth/logout             // Logout

// Meetings
GET    /api/meetings                // List user's meetings
       Query: ?from=&to=&limit=&cursor=
       Response: { meetings[], cursor, total }

GET    /api/meetings/:id            // Meeting details
       Response: { id, title, startTime, duration, speakers[], ... }

GET    /api/meetings/:id/transcript // Get transcript segments
       Query: ?from_ms=&to_ms=&limit=&after_seq=
       Response: { segments[], cursor }

GET    /api/meetings/:id/vtt        // Download WebVTT
       Response: 302 redirect or stream

DELETE /api/meetings/:id            // Delete meeting

// Highlights
POST   /api/meetings/:id/highlights // Create highlight
       Body: { tStartMs, tEndMs, title, notes?, tags? }

// Search
GET    /api/search                  // Full-text search
       Query: ?q=&meeting_id=&from=&to=&limit=
       Response: { results[], total }

// AI Features
POST   /api/ai/chat                 // Chat with transcripts (SSE)
       Body: { sessionId?, message, filters? }
       Response: Server-Sent Events stream

POST   /api/ai/suggest              // Get AI suggestions
       Body: { meetingId, type: 'next-steps'|'summary'|'action-items' }
       Response: { suggestions[], citations[] }
```

### WebSocket Protocol

```javascript
// Connection
ws://api.example.com/ws?meeting_id={uuid}&token={jwt}

// Client → Server
{
  type: 'subscribe',
  meetingId: 'uuid'
}

// Server → Client Events
{
  type: 'transcript.segment',
  data: {
    meetingId: 'uuid',
    segment: {
      speakerId: 'uuid',
      speakerLabel: 'Speaker 1',
      text: 'Let me share my screen',
      tStartMs: 123456,
      tEndMs: 125789,
      seqNo: 1042
    }
  }
}

{
  type: 'ai.suggestion',
  data: {
    meetingId: 'uuid',
    suggestion: {
      type: 'action-item',
      text: 'John to follow up on Q4 budget',
      owner: 'John',
      tStartMs: 234567
    }
  }
}

{
  type: 'meeting.status',
  data: {
    meetingId: 'uuid',
    status: 'rtms_started' | 'rtms_stopped' | 'completed'
  }
}
```

---

## Security Architecture

### Authentication Flow

```javascript
// In-Client OAuth (PKCE)
1. User opens Zoom App
2. App calls: GET /api/auth/authorize
   → Returns: { codeChallenge, state }

3. App calls: zoomSdk.authorize({ codeChallenge, state })
   → Zoom handles OAuth UI

4. SDK fires: onAuthorized event with { code, state }

5. App calls: POST /api/auth/callback { code, state }
   → Backend exchanges code for tokens
   → Returns: { accessToken, refreshToken, user }

6. Store tokens in Postgres (encrypted)
7. Create session (httpOnly cookie)
```

### Token Management

```javascript
// Storage (encrypted in Postgres)
{
  userId: 'uuid',
  accessToken: encrypt(token),      // AES-256
  refreshToken: encrypt(token),
  expiresAt: timestamp,
  scopes: ['meeting:read:meeting', ...]
}

// Auto-refresh middleware
if (token.expiresAt < Date.now() + 5min) {
  const newTokens = await refreshZoomToken(refreshToken)
  updateStoredTokens(userId, newTokens)
}
```

### Data Isolation

```javascript
// Row-Level Security (RLS)
CREATE POLICY user_meetings ON meetings
  FOR ALL
  USING (owner_id = current_user_id());

// All queries automatically filtered
SELECT * FROM meetings WHERE owner_id = :currentUserId
```

---

## Deployment Architecture

### Development (Docker Compose)

See `docker-compose.yml` for the full configuration. Services:

| Service | Port | Notes |
|---------|------|-------|
| `postgres` | 5432 | PostgreSQL 15, healthcheck enabled |
| `backend` | 3000 | Express API, reads `.env` file, nodemon for dev |
| `frontend` | 3001 | CRA dev server, proxies API to backend |
| `rtms` | 3002 | RTMS SDK, forced `linux/amd64` (Rosetta on Apple Silicon) |
| `redis` | 6379 | Optional (profile: `with-redis`), for WebSocket scaling |

```bash
docker-compose up --build              # Start all (except redis)
docker-compose up --build -V           # Recreate node_modules volumes
docker-compose --profile with-redis up # Include redis
```

### Production (Self-Hosted)

**Recommended Stack:**
- **Hosting**: Railway, Render, Fly.io, or VPS
- **Database**: Managed Postgres (Supabase, Neon, Railway)
- **File Storage**: Local disk (VTT files) or S3-compatible
- **WebSocket**: Redis pub/sub for multi-instance scaling
- **Reverse Proxy**: Nginx or Caddy for HTTPS

**Environment Variables:** See `.env.example` for the full list. Key variables:
```bash
ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET    # From Zoom Marketplace
PUBLIC_URL                             # Your public HTTPS URL
DATABASE_URL                           # Postgres connection string
SESSION_SECRET                         # 64-char random string
REDIS_ENCRYPTION_KEY                   # 32-char random string (token encryption)
OPENROUTER_API_KEY                     # Optional (free models work without)
DEFAULT_MODEL                          # Default: google/gemini-2.0-flash-thinking-exp:free
```

---

## Performance Targets

### Latency Goals

| Metric | Target | Notes |
|--------|--------|-------|
| RTMS → DB write | < 500ms P95 | Ingestion latency |
| DB → WebSocket client | < 300ms P95 | Broadcast latency |
| End-to-end (RTMS → UI) | < 1s P95 | Total user-visible latency |
| AI suggestion generation | < 5s P90 | Including LLM response time |
| Transcript search | < 400ms P95 | Full-text search across meetings |
| Page load (meetings list) | < 2s | Including auth + data fetch |

### Scalability

| Metric | Target | Notes |
|--------|--------|-------|
| Concurrent meetings | 100+ | With horizontal scaling |
| Segments per meeting | 10,000+ | ~2hr meeting at 5 seg/sec |
| Total meetings per user | 1,000+ | No auto-deletion |
| Search index size | 1M+ segments | Efficient full-text search |
| WebSocket connections | 500+ | Per server instance |

---

## Technology Stack Summary

### Frontend (In-Meeting Zoom App)
- **Framework**: React 18 (Create React App 5)
- **UI Components**: `@base-ui/react` (unstyled, accessible) + plain CSS
- **Styling**: CSS custom properties (design tokens in `index.css`)
- **WebSocket**: Native WebSocket API
- **SDK**: Zoom Apps SDK 0.16+ (`@zoom/appssdk`)

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: JavaScript (not TypeScript)
- **ORM**: Prisma
- **WebSocket**: ws library
- **Authentication**: Zoom OAuth 2.0 (PKCE) with httpOnly session cookies

### Database
- **Primary**: PostgreSQL 15+
- **Features**: Full-text search (GIN index)
- **Optional**: Redis (WebSocket pub/sub, profile: `with-redis`)

### AI
- **Provider**: OpenRouter
- **Default Model**: google/gemini-2.0-flash-thinking-exp (free, no API key required)
- **Fallback**: meta-llama/llama-3.2-3b-instruct:free
- **Features**: RAG via Postgres FTS, summarization, action items

### DevOps
- **Containerization**: Docker + Docker Compose
- **RTMS**: `@zoom/rtms` v1.0.2 (requires `linux/amd64`)

---

## Next Steps

See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for current implementation status and roadmap (v0.5 → v1.0 → v2.0).

For Zoom Apps development guidance, see the reusable skill at `/.claude/skills/zoom-apps/`:
- `02-sdk-setup.md` — SDK initialization, capabilities, contexts
- `05-rtms-integration.md` — RTMS SDK, WebSocket, webhook handling
- `04-backend-oauth.md` — Express, OAuth flows, token management
- `07-security.md` — PKCE, CSRF, encryption, headers
