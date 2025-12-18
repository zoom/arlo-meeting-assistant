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

**Location:** `/frontend/zoom-app/`

**Technology:**
- React 18
- Zoom Apps SDK 0.16+
- Tailwind CSS + shadcn/ui
- WebSocket client

**Key Features:**

**Live Transcript View:**
```javascript
// Real-time caption display with < 1s latency
- Virtualized scrolling (react-window)
- "Follow Live" toggle
- Speaker labels
- Timestamps
- Search/highlight
- Font size controls
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
- Express.js
- TypeScript
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
// Real-time transcript processing
Components:
- WebSocket client to Zoom RTMS
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

```prisma
// Core Models

model User {
  id            String    @id @default(uuid())
  zoomUserId    String    @unique
  email         String
  displayName   String
  avatarUrl     String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  meetings      Meeting[]
  highlights    Highlight[]
  aiSessions    AiSession[]
}

model Meeting {
  id              String    @id @default(uuid())
  zoomMeetingId   String
  title           String    // From API or AI-generated
  startTime       DateTime
  endTime         DateTime?
  duration        Int?      // milliseconds
  status          String    // 'ongoing' | 'completed' | 'failed'
  language        String    @default("en")
  timezone        String
  ownerId         String
  owner           User      @relation(fields: [ownerId], references: [id])

  speakers        Speaker[]
  segments        TranscriptSegment[]
  highlights      Highlight[]
  vttFiles        VttFile[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([ownerId, startTime])
  @@index([zoomMeetingId])
}

model Speaker {
  id                  String  @id @default(uuid())
  meetingId           String
  meeting             Meeting @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  label               String  // "Speaker 1", "Speaker 2"
  zoomParticipantId   String?
  displayName         String?
  role                String? // 'host' | 'participant'

  segments            TranscriptSegment[]

  @@index([meetingId])
}

model TranscriptSegment {
  id          String    @id @default(uuid())
  meetingId   String
  meeting     Meeting   @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  speakerId   String?
  speaker     Speaker?  @relation(fields: [speakerId], references: [id], onDelete: SetNull)

  tStartMs    Int       // Timestamp start (milliseconds)
  tEndMs      Int       // Timestamp end (milliseconds)
  seqNo       BigInt    // Sequence number for ordering
  text        String    // Transcript text
  confidence  Float?    // Speech-to-text confidence

  createdAt   DateTime  @default(now())

  @@unique([meetingId, seqNo])
  @@index([meetingId, tStartMs])
  @@index([meetingId, seqNo])
  @@fulltext([text])  // Full-text search index
}

model VttFile {
  id            String    @id @default(uuid())
  meetingId     String
  meeting       Meeting   @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  storageKey    String    // File path or S3 key
  version       Int       @default(1)
  generatedAt   DateTime  @default(now())

  @@index([meetingId])
}

model Highlight {
  id          String    @id @default(uuid())
  meetingId   String
  meeting     Meeting   @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  userId      String
  user        User      @relation(fields: [userId], references: [id])

  tStartMs    Int       // Highlight start time
  tEndMs      Int       // Highlight end time
  title       String
  notes       String?
  tags        String[]  // Array of tags

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([meetingId])
  @@index([userId])
}

// AI Features (Optional, feature-flagged)

model AiSession {
  id          String      @id @default(uuid())
  userId      String
  user        User        @relation(fields: [userId], references: [id])
  title       String?
  createdAt   DateTime    @default(now())

  messages    AiMessage[]
}

model AiMessage {
  id          String    @id @default(uuid())
  sessionId   String
  session     AiSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role        String    // 'user' | 'assistant' | 'system'
  content     String    @db.Text
  filters     Json?     // Search filters used

  citations   AiCitation[]

  createdAt   DateTime  @default(now())

  @@index([sessionId])
}

model AiCitation {
  id          String    @id @default(uuid())
  messageId   String
  message     AiMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  meetingId   String
  segmentId   String?
  tStartMs    Int
  tEndMs      Int
  confidence  Float?

  @@index([messageId])
}
```

---

### 4. Post-Meeting Web App

**Location:** `/frontend/web-app/`

**Technology:**
- Next.js 14 (App Router)
- React Server Components
- Tailwind CSS + shadcn/ui
- TanStack Query (data fetching)
- react-virtual (transcript virtualization)

**Routes:**

```javascript
// App structure
/                          → Landing page (sign in with Zoom)
/home                      → Dashboard + chat with your notetaker
/meetings                  → List of past meetings
/meetings/[id]             → Meeting detail with transcript
```

**Key Pages:**

#### `/home` - Dashboard
```javascript
Features:
- Chat with your transcripts (RAG)
- Highlights from this week
- Reminders from yesterday
- Quick prompts:
  • "What did I commit to this week?"
  • "Action items from yesterday?"
  • "Decisions from last meeting?"
- Link to meetings list

Components:
- <ChatInterface />
- <WeeklyHighlights />
- <QuickPrompts />
- <RecentMeetings />
```

#### `/meetings` - Meetings List
```javascript
Features:
- Table view: Title, Date, Duration, Participants
- Search: Full-text search across all transcripts
- Filters: Date range, tags
- Sort: By date, duration, title
- Export: VTT, JSON

Components:
- <MeetingsTable />
- <SearchBar />
- <FilterPanel />
```

#### `/meetings/[id]` - Meeting Detail
```javascript
Sections:
1. Summary
   - AI-generated description
   - Key highlights
   - "Ask about this meeting" mini-chat

2. Transcript / Timeline
   - Virtualized scrolling
   - Speaker labels + timestamps
   - Inline search with jump-to
   - Follow-live mode (if meeting ongoing)

3. Highlights & Action Items
   - User-created highlights
   - AI-extracted action items
   - Table: Owner | Task | Due | Source (timestamp)
   - Click timestamp → jump to transcript

4. Export Options
   - Download VTT (for video players)
   - Export JSON (for integrations)
   - Share link (future feature)

Components:
- <MeetingSummary />
- <TranscriptViewer />
- <HighlightsPanel />
- <ActionItemsTable />
```

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

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: meeting_assistant
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://dev:dev@postgres:5432/meeting_assistant
      ZOOM_CLIENT_ID: ${ZOOM_CLIENT_ID}
      ZOOM_CLIENT_SECRET: ${ZOOM_CLIENT_SECRET}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      SESSION_SECRET: ${SESSION_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3000
    ports:
      - "3001:3000"
```

### Production (Self-Hosted)

**Recommended Stack:**
- **Hosting**: Railway, Render, Fly.io, or VPS
- **Database**: Managed Postgres (Supabase, Neon, Railway)
- **File Storage**: Local disk (VTT files) or S3-compatible
- **WebSocket**: Redis pub/sub for multi-instance scaling
- **Reverse Proxy**: Nginx or Caddy for HTTPS

**Environment Variables:**
```bash
# Required
ZOOM_CLIENT_ID=xxx
ZOOM_CLIENT_SECRET=xxx
DATABASE_URL=postgresql://...
SESSION_SECRET=random_64_char_string

# Optional (free tier works without)
OPENROUTER_API_KEY=sk-or-v1-xxx

# Features
AI_ENABLED=true
DEFAULT_MODEL=google/gemini-2.0-flash-thinking-exp:free
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

### Frontend
- **Framework**: React 18, Next.js 14
- **UI Components**: Tailwind CSS, shadcn/ui
- **Data Fetching**: TanStack Query
- **WebSocket**: Native WebSocket API
- **SDK**: Zoom Apps SDK 0.16+

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma
- **WebSocket**: ws library
- **Authentication**: Zoom OAuth 2.0 (PKCE)

### Database
- **Primary**: PostgreSQL 15+
- **Features**: Full-text search (built-in)
- **Optional**: Redis (WebSocket pub/sub)

### AI/ML
- **Provider**: OpenRouter
- **Default Model**: google/gemini-2.0-flash-thinking-exp (free)
- **Features**: RAG, summarization, extraction

### DevOps
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx / Caddy
- **Process Manager**: PM2 (production)

---

## Next Steps

See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for:
- Current implementation status
- Feature roadmap (v0.5, v1, v2)
- Development phases
- Testing checklist
- Deployment guide

See individual guides:
- [SDK_SETUP.md](./SDK_SETUP.md) - Zoom Apps SDK configuration
- [RTMS_GUIDE.md](./RTMS_GUIDE.md) - Real-time transcript ingestion
- [AI_INTEGRATION.md](./AI_INTEGRATION.md) - OpenRouter + RAG setup
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Self-hosting instructions
