# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Arlo Meeting Assistant** is an open-source Zoom Apps reference implementation demonstrating how to build intelligent meeting assistants that capture real-time transcripts using RTMS (Real-Time Media Streams) - **without requiring a meeting bot**. The app runs natively inside Zoom meetings and provides AI-powered summaries, action items, and transcript search.

**Key Value Proposition:** *"You don't need a bot. Build a meeting assistant AS A ZOOM APP."*

## Development Commands

### Docker Setup (Recommended)

```bash
# Start all services (Postgres, Backend, Frontend)
docker-compose up --build

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart specific service
docker-compose restart backend

# Clean restart (removes volumes)
docker-compose down -v && docker-compose up --build

# Stop all services
docker-compose down
```

### Manual Development

```bash
# Terminal 1: Backend (with hot reload)
cd backend
npm install
npm run dev          # Runs with nodemon for auto-restart

# Terminal 2: Frontend
cd frontend
npm install
npm start            # React dev server with hot reload

# Terminal 3: Database (if not using Docker)
# Install Postgres 15+ and create database
psql -U postgres -c "CREATE DATABASE meeting_assistant;"

# Run Prisma migrations
cd backend
npx prisma migrate dev

# Terminal 4: ngrok (for local Zoom App testing)
ngrok http 3000
# Copy the HTTPS URL and update PUBLIC_URL in .env
```

### Database Commands

```bash
# Generate Prisma client after schema changes
cd backend
npx prisma generate

# Create new migration
npx prisma migrate dev --name description_of_change

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Open Prisma Studio (database GUI)
npx prisma studio
```

### Environment Setup

```bash
# Copy example environment file
cp .env.example .env

# Generate secure secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"  # REDIS_ENCRYPTION_KEY

# After starting ngrok, update .env:
PUBLIC_URL=https://your-ngrok-url.ngrok-free.app
ZOOM_APP_REDIRECT_URI=https://your-ngrok-url.ngrok-free.app/api/zoomapp/auth
```

## Architecture Overview

### Three-Component System

1. **In-Meeting Zoom App** (React + Zoom Apps SDK)
   - Runs embedded in Zoom client during meetings
   - Live transcript display with < 1s latency
   - Real-time AI suggestions
   - Start/stop RTMS via `zoomSdk.callZoomApi('startRTMS')`

2. **Backend API** (Node.js/Express + Postgres)
   - Zoom OAuth 2.0 authentication (PKCE flow)
   - RTMS ingestion via WebSocket
   - WebSocket server for live updates
   - REST API for meetings/transcripts
   - AI orchestration (OpenRouter integration)

3. **Post-Meeting Web App** (Next.js)
   - Meeting history browser
   - Full-text transcript search
   - Chat with transcripts (RAG)
   - Export VTT/JSON

### Data Flow: RTMS → Database → Client

```
[Zoom RTMS WebSocket]
        ↓
[Backend: RTMS Ingestion Worker]
├─ Normalize transcript events
├─ Buffer 2-3s (reorder out-of-order segments)
├─ Batch insert to Postgres (50-100 segments)
└─ Broadcast via WebSocket to clients
        ↓
[Frontend: Live Transcript Display]
    (< 1s end-to-end latency)
```

### Authentication Flow (Zoom OAuth PKCE)

```
1. Frontend: GET /api/auth/authorize → { codeChallenge, state }
2. Frontend: zoomSdk.authorize({ codeChallenge, state })
3. Zoom handles OAuth UI in Zoom client
4. SDK fires onAuthorized event → { code, state }
5. Frontend: POST /api/auth/callback { code, state }
6. Backend: Exchanges code for tokens (validates PKCE verifier)
7. Backend: Stores encrypted tokens in Postgres
8. Backend: Creates HTTPOnly session cookie
```

## Key Files and Entry Points

### Backend
- `backend/server.js` - Express app setup, middleware, routes
- `backend/config.js` - Environment variable validation
- `backend/api/zoomapp/router.js` - OAuth routes
- `backend/api/zoomapp/controller.js` - OAuth logic (PKCE)
- `backend/api/zoom/router.js` - Zoom REST API proxy
- `backend/util/zoom-api.js` - Zoom API client with token refresh
- `backend/util/zoom-helpers.js` - OAuth helpers (PKCE generation)
- `backend/middleware.js` - Session management, security headers

### Frontend (Zoom App)
- `frontend/src/App.js` - Main component, SDK configuration
- `frontend/src/apis.js` - SDK API demonstrations
- `frontend/src/components/Authorization.js` - OAuth flows
- `frontend/public/index.html` - Loads Zoom Apps SDK script

### RTMS
- `rtms/sdk/index.js` - Official @zoom/rtms SDK implementation
- `rtms/websocket/index.js` - Custom WebSocket implementation (alternative)
- Webhook handlers for `meeting.rtms_started` and `meeting.rtms_stopped`

### Database
- `backend/prisma/schema.prisma` - Database schema (PostgreSQL)
- Key tables: User, Meeting, Speaker, TranscriptSegment, Highlight, VttFile

## Critical Configuration Requirements

### Zoom Marketplace Setup (Must Do)

1. **Domain Allowlist** - Add `appssdk.zoom.us` to allowed domains
2. **OAuth Redirect URL** - Configure BEFORE users can install app
3. **RTMS Scopes** - Enable Transcripts scope minimum
4. **SDK Capabilities** - Add all required APIs (see `/docs/02-sdk-setup.md`)
5. **Home URL** - Points to your ngrok/production URL

### Environment Variables (Required)

```bash
# Zoom App (from Marketplace)
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
PUBLIC_URL=https://your-domain.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/meeting_assistant

# Security (generate with crypto.randomBytes)
SESSION_SECRET=64_char_random_string
REDIS_ENCRYPTION_KEY=32_char_random_string

# AI (Optional - free models work without key)
OPENROUTER_API_KEY=sk-or-v1-xxx
DEFAULT_MODEL=google/gemini-2.0-flash-thinking-exp:free
```

## Database Schema Key Points

### Core Models

- **User** - Zoom user, linked by `zoomUserId`
- **Meeting** - Each meeting instance with title, timestamps, owner
- **Speaker** - Meeting participants (linked to participants)
- **TranscriptSegment** - Individual caption lines with timestamps
  - Indexed by: (meetingId, seqNo), (meetingId, tStartMs)
  - Full-text search index on `text` column
- **Highlight** - User-created bookmarks with time ranges
- **VttFile** - WebVTT exports linked to meetings

### Important Constraints

- `TranscriptSegment.seqNo` is UNIQUE per meeting (idempotency)
- All tables have Row-Level Security (RLS) filters by ownerId
- Full-text search uses Postgres built-in GIN index

## WebSocket Protocol

### Connection
```
ws://api.example.com/ws?meeting_id={uuid}&token={jwt}
```

### Client → Server
```javascript
{ type: 'subscribe', meetingId: 'uuid' }
```

### Server → Client Events
```javascript
// New transcript segment
{
  type: 'transcript.segment',
  data: { meetingId, segment: { speakerId, text, tStartMs, tEndMs, seqNo } }
}

// AI suggestion (real-time)
{
  type: 'ai.suggestion',
  data: { meetingId, suggestion: { type, text, owner, tStartMs } }
}

// Meeting status change
{
  type: 'meeting.status',
  data: { meetingId, status: 'rtms_started' | 'rtms_stopped' | 'completed' }
}
```

## REST API Key Endpoints

### Authentication
- `GET /api/auth/authorize` - Get PKCE challenge for in-client OAuth
- `POST /api/auth/callback` - Exchange code for tokens
- `GET /api/auth/me` - Get current authenticated user

### Meetings
- `GET /api/meetings?from=&to=&limit=&cursor=` - List user's meetings
- `GET /api/meetings/:id` - Meeting details
- `GET /api/meetings/:id/transcript?from_ms=&to_ms=&limit=&after_seq=` - Paginated segments
- `GET /api/meetings/:id/vtt` - Download WebVTT file

### AI Features
- `GET /api/search?q=&meeting_id=&from=&to=` - Full-text search across transcripts
- `POST /api/ai/chat` - Chat with transcripts (Server-Sent Events stream)
- `POST /api/ai/suggest` - Get AI suggestions (in-meeting)

## AI Integration (OpenRouter)

### Default Configuration (No API Key Required)

```javascript
{
  provider: 'OpenRouter',
  defaultModel: 'google/gemini-2.0-flash-thinking-exp:free',
  fallbackModel: 'meta-llama/llama-3.2-3b-instruct:free',
  rateLimits: { free: '10 req/min', premium: '100 req/min' }
}
```

### RAG Pipeline

1. User asks question → Backend receives query
2. Full-text search on `TranscriptSegment.text` (Postgres FTS)
3. Build context window from top results
4. Call OpenRouter with prompt template + context
5. Stream response via Server-Sent Events
6. Extract citations (meeting ID + timestamp)
7. Frontend displays with clickable timestamps

### Prompt Templates (Planned)

- `summary.prompt` - Meeting summary generation
- `action-items.prompt` - Extract tasks with owners
- `next-steps.prompt` - Suggest follow-up actions
- `decisions.prompt` - Identify key decisions

## Zoom Apps SDK Usage Patterns

### Required Capabilities

```javascript
zoomSdk.config({
  capabilities: [
    'getMeetingContext',   // meetingUUID, participantUUID
    'getMeetingUUID',      // Unique meeting identifier
    'getUserContext',      // User info and auth status
    'authorize',           // In-client OAuth
    'onAuthorized',        // OAuth callback
    'callZoomApi',         // For startRTMS/stopRTMS
    'showNotification',    // User notifications
    'onMessage'            // Multi-instance communication
  ]
})
```

### Starting RTMS

```javascript
await zoomSdk.callZoomApi('startRTMS', {
  audioOptions: { rawAudio: false },
  transcriptOptions: { caption: true }
})
```

### OAuth Flow

```javascript
// 1. Get PKCE challenge from backend
const { codeChallenge, state } = await fetch('/api/auth/authorize').then(r => r.json())

// 2. Trigger OAuth in Zoom client
await zoomSdk.authorize({ codeChallenge, state })

// 3. Listen for completion
zoomSdk.onAuthorized(async ({ code, state }) => {
  await fetch('/api/auth/callback', {
    method: 'POST',
    body: JSON.stringify({ code, state })
  })
})
```

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| RTMS → DB write | < 500ms P95 | Ingestion latency |
| DB → WebSocket client | < 300ms P95 | Broadcast latency |
| End-to-end (RTMS → UI) | < 1s P95 | Total user-visible latency |
| AI suggestion | < 5s P90 | Including LLM response |
| Transcript search | < 400ms P95 | Full-text search |
| Page load | < 2s | Including auth + data |

## Common Development Workflows

### Adding a New API Endpoint

1. Define route in `backend/api/{module}/router.js`
2. Implement handler in `backend/api/{module}/controller.js`
3. Add authentication middleware if needed
4. Update CORS settings if frontend needs access
5. Document in relevant `/docs/` file

### Adding a New Database Table

1. Update `backend/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name add_table_name`
3. Run `npx prisma generate` to update client
4. Implement model access in controllers
5. Add RLS policies if user-scoped data

### Testing Zoom App Locally

1. Start ngrok: `ngrok http 3000`
2. Copy HTTPS URL
3. Update `PUBLIC_URL` in `.env`
4. Update Zoom Marketplace → Home URL
5. Update Zoom Marketplace → OAuth Redirect URL
6. Restart backend: `docker-compose restart backend`
7. In Zoom client: Apps → Find your app → Open
8. Right-click app → Inspect Element (DevTools)

### Debugging RTMS Issues

1. Check webhook delivery in Zoom Marketplace → Feature → Event Subscriptions
2. View backend logs: `docker-compose logs -f backend | grep RTMS`
3. Verify RTMS scopes enabled in Marketplace
4. Check WebSocket connection in browser DevTools → Network → WS
5. Verify segments written to database: `npx prisma studio`

## Security Considerations

### Token Management
- Access tokens stored **encrypted** in Postgres (AES-256)
- Auto-refresh 5 minutes before expiry
- Never expose tokens to frontend
- Use httpOnly cookies for sessions

### Data Isolation
- All queries filtered by `owner_id` (Row-Level Security)
- User can only access their own meetings
- Webhook signature validation on incoming events

### HTTP Security Headers (Required)
```javascript
// These headers are REQUIRED by Zoom Apps platform
'Strict-Transport-Security': 'max-age=31536000'
'X-Content-Type-Options': 'nosniff'
'Content-Security-Policy': "default-src 'self'; script-src 'self' appssdk.zoom.us"
'Referrer-Policy': 'strict-origin-when-cross-origin'
```

## Documentation Reference

The `/docs/` directory contains **15 comprehensive guides**:

- **00-quick-start.md** - Get up and running in 30 minutes
- **01-architecture-overview.md** - Detailed system architecture
- **02-sdk-setup.md** - SDK configuration and initialization
- **03-frontend-guide.md** - React component patterns
- **04-backend-guide.md** - OAuth and API proxy implementation
- **05-rtms-guide.md** - Real-time media streams integration
- **06-sdk-reference.md** - Complete SDK API reference
- **07-security-guide.md** - OWASP best practices
- **07-critical-setup-requirements.md** - Must-do Marketplace config
- **08-api-integration-guide.md** - Making Zoom REST API calls
- **09-development-workflow.md** - Day-to-day development
- **ARCHITECTURE.md** - Arlo Meeting Assistant specific architecture
- **PROJECT_STATUS.md** - Roadmap (v0.5 → v1.0 → v2.0)
- **TROUBLESHOOTING.md** - Common issues and fixes
- **README.md** - Documentation index

**Always reference these docs** before making architectural decisions or when unsure about implementation patterns.

## Project Status

**Current Phase:** Planning & Architecture Complete
**Target:** v0.5 MVP (2-3 weeks) → v1.0 Production (4-6 weeks)
**Tech Readiness:** All architecture documented, no code written yet

See `/docs/PROJECT_STATUS.md` for detailed roadmap and phase breakdowns.
