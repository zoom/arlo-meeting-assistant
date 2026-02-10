# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Arlo Meeting Assistant** is an open-source Zoom Apps reference implementation demonstrating how to build intelligent meeting assistants that capture real-time transcripts using RTMS (Real-Time Media Streams) — **without requiring a meeting bot**. The app runs natively inside Zoom meetings and provides AI-powered summaries, action items, and transcript search.

**Current Phase:** v0.5 MVP functional, frontend UI migrated to Base UI, feature push next.

## Development Commands

### Docker Setup (Recommended)

```bash
docker-compose up --build              # Start all services (Postgres, Backend, Frontend, RTMS)
docker-compose up --build -V           # Rebuild with fresh node_modules (use after adding/removing npm deps)
docker-compose logs -f backend         # View backend logs
docker-compose restart backend         # Restart specific service
docker-compose down -v && docker-compose up --build  # Clean restart (deletes DB data)
```

### Manual Development

```bash
npm run dev              # Start all services concurrently (backend + frontend + rtms)
npm run dev:backend      # Backend only (nodemon for auto-restart)
npm run dev:frontend     # Frontend only (CRA dev server)
npm run dev:rtms         # RTMS service only
npm run setup            # Install all workspace dependencies
```

### Database (Prisma)

```bash
npm run db:migrate       # Run migrations (from root)
npm run db:generate      # Generate Prisma client after schema changes
npm run db:studio        # Open Prisma Studio GUI at localhost:5555
npm run db:reset         # Reset database (WARNING: deletes all data)

# Or from backend directory:
cd backend
npx prisma migrate dev --name description_of_change   # Create new migration
```

### Frontend Build

```bash
cd frontend && npx react-scripts build
```

### ngrok (Required for Zoom App Testing)

```bash
ngrok http 3000                                        # Random domain (changes each restart)
ngrok http 3000 --domain=yourname-arlo.ngrok-free.app  # Static domain (recommended)
# Then update PUBLIC_URL in .env
```

## Architecture

### Two-Component System (Currently Implemented)

1. **In-Meeting Zoom App** (`frontend/`) — React 18 + Base UI + Zoom Apps SDK
   - Runs embedded in Zoom client during meetings
   - Live transcript display, AI suggestions, highlights
   - Start/stop RTMS via `zoomSdk.callZoomApi('startRTMS')`

2. **Backend API** (`backend/`) — Node.js/Express + PostgreSQL + Prisma
   - Zoom OAuth 2.0 (PKCE flow), session management with httpOnly cookies
   - REST API for meetings, transcripts, search, AI, highlights
   - WebSocket server for live transcript broadcast
   - AI orchestration via OpenRouter (free models, no API key required)

3. **RTMS Service** (`rtms/`) — @zoom/rtms v1.0.2
   - Webhook handlers for `meeting.rtms_started` / `meeting.rtms_stopped`
   - WebSocket-based transcript ingestion from Zoom

**Note:** A Post-Meeting Web App (Next.js) is planned but not yet implemented.

### Data Flow

```
Zoom RTMS WebSocket → RTMS Service → Backend (normalize, buffer, batch insert to Postgres)
    → WebSocket broadcast → Frontend (live transcript display, < 1s end-to-end)
```

### Authentication Flow (Zoom OAuth PKCE)

```
Frontend: GET /api/auth/authorize → { codeChallenge, state }
Frontend: zoomSdk.authorize({ codeChallenge, state })
Zoom handles OAuth UI → SDK fires onAuthorized → { code, state }
Frontend: POST /api/auth/callback { code, state }
Backend: Exchanges code for tokens, stores encrypted in Postgres, creates session cookie
```

## Key Files

### Backend (`backend/src/`)
- `server.js` — Express app setup, middleware, route mounting
- `config.js` — Environment variable validation
- `routes/auth.js` — OAuth routes (authorize, callback, me)
- `routes/meetings.js` — Meeting CRUD and transcript endpoints
- `routes/ai.js` — AI chat and suggestions (OpenRouter)
- `routes/rtms.js` — RTMS webhook handlers
- `routes/search.js` — Full-text search
- `routes/highlights.js` — Meeting highlights/bookmarks
- `services/auth.js` — Token management, PKCE
- `services/openrouter.js` — LLM API client
- `services/websocket.js` — WebSocket broadcast server
- `middleware/auth.js` — Session authentication middleware

### Frontend (`frontend/src/`)
- `App.js` — Main component, Zoom SDK initialization
- `index.css` — CSS design tokens (`:root` custom properties) and shared Base UI styles
- `components/ZoomApp.js` — OAuth flow, meeting context, main app shell
- `components/LiveTranscript.js` — Real-time transcript display
- `components/AIPanel.js` — AI summary/actions/chat tabs
- `components/MeetingSuggestions.js` — Duration picker, progress, AI suggestions
- `components/MeetingHistory.js` — Past meetings list
- `components/HighlightsPanel.js` — Meeting bookmarks
- `components/RTMSControls.js` — Start/stop RTMS controls
- `components/TestPage.js` — Developer test page

### RTMS (`rtms/src/`)
- `index.js` — RTMS client using @zoom/rtms v1.0 class-based API

### Database
- `backend/prisma/schema.prisma` — PostgreSQL schema
- Key models: User, Meeting, Speaker, TranscriptSegment, Highlight, VttFile, UserToken
- `TranscriptSegment.seqNo` is UNIQUE per meeting (idempotency)
- Full-text search uses Postgres GIN index on `text` column
- All queries filtered by `ownerId` (row-level data isolation)

## Frontend UI (Base UI)

The frontend uses `@base-ui/react` for accessible, unstyled components, styled with plain CSS and CSS custom properties.

### Critical: CRA Import Pattern

CRA 5 does NOT support package.json `exports` subpath patterns. Always import from the main entry:

```javascript
// CORRECT
import { Tabs, Collapsible, Tooltip } from '@base-ui/react';

// WRONG — fails at runtime in CRA
import { Tabs } from '@base-ui/react/tabs';
```

### Base UI Components in Use

Tabs (AIPanel, MeetingHistory), Collapsible (MeetingHistory), Progress (MeetingSuggestions), Toggle/ToggleGroup (MeetingSuggestions), ScrollArea (LiveTranscript), Tooltip (multiple), AlertDialog (TestPage), Field (HighlightsPanel).

### Styling Conventions

- CSS data attributes for state: `[data-active]`, `[data-pressed]`, `[data-panel-open]`
- Design tokens in `frontend/src/index.css` under `:root` — use `var(--color-*)`, `var(--radius-*)` etc.
- ToggleGroup uses array values even in single mode: `value={['60']}`, `onValueChange` receives array
- Separator component not available (CRA subpath issue) — use plain `<hr>` instead

## REST API Endpoints

### Authentication
- `GET /api/auth/authorize` — Get PKCE challenge for in-client OAuth
- `POST /api/auth/callback` — Exchange code for tokens
- `GET /api/auth/me` — Get current authenticated user

### Meetings & Transcripts
- `GET /api/meetings` — List user's meetings (params: from, to, limit, cursor)
- `GET /api/meetings/:id` — Meeting details
- `GET /api/meetings/:id/transcript` — Paginated segments (params: from_ms, to_ms, limit, after_seq)
- `GET /api/meetings/:id/vtt` — Download WebVTT file

### AI & Search
- `GET /api/search` — Full-text search (params: q, meeting_id, from, to)
- `POST /api/ai/chat` — Chat with transcripts (SSE stream)
- `POST /api/ai/suggest` — In-meeting AI suggestions

### Highlights
- Routes in `backend/src/routes/highlights.js`

## WebSocket Protocol

```
Connection: ws://host/ws?meeting_id={uuid}&token={jwt}
Client → Server: { type: 'subscribe', meetingId: 'uuid' }
Server → Client: { type: 'transcript.segment', data: { meetingId, segment: {...} } }
Server → Client: { type: 'ai.suggestion', data: { meetingId, suggestion: {...} } }
Server → Client: { type: 'meeting.status', data: { meetingId, status: '...' } }
```

## Environment Variables

Required in `.env` (copy from `.env.example`):

```bash
ZOOM_CLIENT_ID=...              # From Zoom Marketplace
ZOOM_CLIENT_SECRET=...
PUBLIC_URL=https://...          # ngrok HTTPS URL
DATABASE_URL=postgresql://...   # Postgres connection string
SESSION_SECRET=...              # 64 chars: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
REDIS_ENCRYPTION_KEY=...        # 32 chars: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
OPENROUTER_API_KEY=...          # Optional — free models work without it
DEFAULT_MODEL=google/gemini-2.0-flash-thinking-exp:free
```

## Common Development Workflows

### Adding a New API Endpoint

1. Create or edit route file in `backend/src/routes/{module}.js`
2. Add authentication middleware from `backend/src/middleware/auth.js` if needed
3. Mount route in `backend/src/server.js`: `app.use('/api/{module}', require('./routes/{module}'))`

### Adding a New Database Table

1. Update `backend/prisma/schema.prisma`
2. Run `npm run db:migrate` (or `cd backend && npx prisma migrate dev --name add_table_name`)
3. Run `npm run db:generate`

### Testing Zoom App Locally

1. Start ngrok: `ngrok http 3000 --domain=your-domain.ngrok-free.app`
2. Update `PUBLIC_URL` in `.env`
3. Update Home URL and OAuth Redirect URL in Zoom Marketplace
4. `docker-compose restart backend`
5. In Zoom: Apps → Find your app → Open
6. Right-click app → Inspect Element (DevTools)

## Zoom Marketplace Setup (Required)

1. **Domain Allowlist** — Add `appssdk.zoom.us`
2. **OAuth Redirect URL** — `https://{your-domain}/api/auth/callback`
3. **RTMS Scopes** — Enable Transcripts (requires RTMS access approval from Zoom)
4. **SDK Capabilities** — See `.claude/skills/zoom-apps/02-sdk-setup.md`
5. **Home URL** — Your ngrok/production URL
6. **Event Subscriptions** — `meeting.rtms_started`, `meeting.rtms_stopped`

## Security

- Access tokens stored **encrypted** (AES-256) in Postgres, auto-refresh before expiry
- httpOnly session cookies, never expose tokens to frontend
- All API calls from frontend use `fetch` with `credentials: 'include'`
- HTTP headers required by Zoom Apps: `Strict-Transport-Security`, `X-Content-Type-Options`, `Content-Security-Policy`, `Referrer-Policy`

## Project Structure

```
arlo-meeting-assistant/
├── backend/           # Express API (npm workspace)
│   ├── src/
│   │   ├── server.js
│   │   ├── config.js
│   │   ├── routes/    # auth, meetings, ai, rtms, search, highlights
│   │   ├── services/  # auth, openrouter, websocket
│   │   └── middleware/ # auth
│   └── prisma/
│       └── schema.prisma
├── frontend/          # React Zoom App (npm workspace, CRA)
│   ├── public/
│   │   └── index.html # Loads Zoom Apps SDK script
│   └── src/
│       ├── App.js
│       ├── index.css  # Design tokens
│       └── components/ # 8 components (ZoomApp, LiveTranscript, AIPanel, etc.)
├── rtms/              # RTMS transcript ingestion (npm workspace)
│   └── src/index.js
├── docs/              # Project documentation
│   ├── ARCHITECTURE.md
│   ├── PROJECT_STATUS.md
│   └── TROUBLESHOOTING.md
├── .claude/skills/zoom-apps/  # Reusable Zoom Apps development guides (8 docs)
├── docker-compose.yml
├── .env.example
└── package.json       # Root workspace config
```

## Documentation Reference

- `.claude/skills/zoom-apps/` — General Zoom Apps development guides (SDK, OAuth, RTMS, security)
- `/docs/ARCHITECTURE.md` — System architecture details
- `/docs/PROJECT_STATUS.md` — Roadmap and phase tracking
- `/docs/TROUBLESHOOTING.md` — Common issues and fixes

## Known Issues

- Pre-existing lint warnings in `ZoomApp.js` (missing deps in useEffect, unused var) — not to be fixed unless asked
- No automated tests exist yet (manual testing only)
- Frontend uses CRA (react-scripts), NOT Next.js
