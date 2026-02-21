# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Arlo Meeting Assistant** is an open-source Zoom Apps reference implementation demonstrating how to build intelligent meeting assistants that capture real-time transcripts using RTMS (Real-Time Media Streams) — **without requiring a meeting bot**. The app runs natively inside Zoom meetings and provides AI-powered summaries, action items, and transcript search.

**Current Phase:** v1.0 — see [`SPEC.md`](./SPEC.md) for the full feature specification and version milestones.

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

### System Components

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

Implemented in `useZoomAuth` hook (`frontend/src/hooks/useZoomAuth.js`) — single source of truth for auth.

```
1. Frontend: GET /api/auth/authorize → { codeChallenge, state }
2. Frontend: Register onAuthorized listener BEFORE calling authorize() (avoids race condition)
3. Frontend: zoomSdk.authorize({ codeChallenge, state })
4. Zoom fires onAuthorized → { code } (NOTE: SDK does NOT return state — use closure from step 1)
5. Frontend: POST /api/auth/callback { code, state } (credentials: 'include')
6. Backend: Exchanges code for tokens, stores AES-128-CBC encrypted in Postgres, creates session cookie
7. Frontend: login(user, wsToken) → navigate to /home
```

**Session restoration:** On app load, `AuthContext` calls `GET /api/auth/me` to restore session from httpOnly cookie. A loading spinner displays during this check to prevent auth-screen flash.

**User info fallback:** If `user:read` OAuth scope is not configured, backend decodes JWT access token payload for user ID and name.

## Key Files & Architecture Details

### Backend (`backend/src/`)
- `server.js` — Express app setup, middleware, route mounting, rate limiting, graceful shutdown
- `config.js` — Environment variable validation
- `lib/prisma.js` — Singleton PrismaClient (all route/service modules import from here)
- `routes/` — 9 route modules: auth, meetings, ai, home, rtms, search, highlights, zoom-meetings, preferences
- `services/` — auth (token/PKCE/encryption), openrouter (LLM), websocket (broadcast), zoomApi (Zoom REST helper with token refresh + mutex)
- `middleware/auth.js` — `requireAuth` and `optionalAuth` session middleware

### Frontend (`frontend/src/`)
- `App.js` — HashRouter, route definitions, provider hierarchy: Theme → ZoomSdk → Auth → Meeting → Toast
- `index.css` — Design tokens, typography (Source Serif 4 + Inter), light/dark theme variables
- `views/` — 14 views (Auth, Home, MeetingsList, MeetingDetail, InMeeting, SearchResults, Settings, Upcoming, GuestNoMeeting, GuestInMeeting, LandingPage, Onboarding, OAuthError, NotFound)
- `contexts/` — AuthContext (session), ZoomSdkContext (SDK init), MeetingContext (active meeting + WS), ThemeContext (light/dark), ToastContext
- `hooks/useZoomAuth.js` — In-client OAuth PKCE flow hook
- `utils/formatters.js` — Shared utilities (formatTimestamp, formatDuration, formatMeetingDate)
- `components/AppShell.js` — Persistent header (back, logo, search, theme toggle, settings) + `<Outlet />`
- `components/ui/` — Unstyled primitives: Button, Card, Badge, Input, Textarea, LoadingSpinner

### Database
- `backend/prisma/schema.prisma` — PostgreSQL schema
- Key models: User, Meeting, Speaker, TranscriptSegment, Highlight, VttFile, UserToken, ParticipantEvent
- `Speaker` has `@@unique([meetingId, zoomParticipantId])` compound constraint
- `TranscriptSegment.seqNo` is UNIQUE per meeting (idempotency)
- Full-text search uses Postgres GIN index on `text` column
- All queries filtered by `ownerId` (row-level data isolation)
- Highlight/AiCitation timestamp fields use `BigInt` (epoch milliseconds)

### Monorepo (npm workspaces)

The root `package.json` defines 3 workspaces: `backend`, `frontend`, `rtms`. Install dependencies into a specific workspace:

```bash
npm install <package> -w backend      # Add to backend
npm install <package> -w frontend     # Add to frontend
npm install <package> -w rtms         # Add to rtms
```

### Docker Startup Behavior

Docker Compose runs `npx prisma db push --skip-generate` (not migrations) on backend startup to sync the schema. This means schema changes via `schema.prisma` are applied automatically when rebuilding containers — no migration files needed for development. Use `docker-compose up --build -V` when npm dependencies change (recreates volumes).

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

Tabs (MeetingDetailView, InMeetingView), ScrollArea (MeetingDetailView, InMeetingView).

### Styling Conventions

- CSS data attributes for state: `[data-active]`, `[data-pressed]`, `[data-panel-open]`
- Design tokens in `frontend/src/index.css` under `:root` — use `var(--color-*)`, `var(--radius-*)` etc.
- Dark mode: `.dark` class on `<html>`, toggled via ThemeContext, stored in `localStorage('arlo-theme')`
- OS dark mode detection via `prefers-color-scheme` media query (default when no saved preference)
- Fonts: Source Serif 4 (serif headings/body) + Inter (UI chrome) — self-hosted WOFF2 in `frontend/public/fonts/`
- Icons: `lucide-react` throughout the app
- Max width: 900px on `#root` with `border-x` for contained layout
- Separator component not available (CRA subpath issue) — use plain `<hr>` instead

## REST API Endpoints

### Authentication
- `GET /api/auth/authorize` — Get PKCE challenge for in-client OAuth
- `POST /api/auth/callback` — Exchange code for tokens (in-client PKCE)
- `GET /api/auth/me` — Get current authenticated user
- `GET /api/auth/start` — Redirect to Zoom OAuth (web/Marketplace install flow)
- `GET /api/auth/callback` — Handle Zoom OAuth redirect (web flow, exchanges code with client_secret)
- `POST /api/auth/logout` — Clear session

### Meetings & Transcripts
- `GET /api/meetings` — List user's meetings (params: from, to, limit, cursor)
- `GET /api/meetings/:id` — Meeting details
- `GET /api/meetings/:id/transcript` — Paginated segments (params: from_ms, to_ms, limit, after_seq)
- `GET /api/meetings/:id/vtt` — Download WebVTT file
- `PATCH /api/meetings/:id` — Rename meeting
- `DELETE /api/meetings/:id` — Delete meeting
- `POST /api/meetings/:id/generate-title` — AI-generate title from transcript/summary

### AI & Search
- `GET /api/search` — Full-text search (params: q, meeting_id, from, to)
- `POST /api/ai/chat` — Chat with transcripts (SSE stream)
- `POST /api/ai/suggest` — In-meeting AI suggestions

### Home Dashboard
- `GET /api/home/highlights` — This week's meeting highlights (uses `optionalAuth`)
- `GET /api/home/reminders` — Yesterday's reminders (uses `optionalAuth`)

### AI Summary & Export
- `POST /api/ai/summary` — Generate/cache meeting summary (cached in `Meeting.summary`)
- `GET /api/meetings/:id/export/markdown` — Export meeting as Markdown

### Highlights
- Routes in `backend/src/routes/highlights.js`

### Preferences
- `GET /api/preferences` — Get user preferences
- `PUT /api/preferences` — Update user preferences (shallow merge)

### Zoom Meetings (Upcoming + Auto-Open)
- `GET /api/zoom-meetings` — List upcoming meetings from Zoom calendar (proxies `GET /v2/users/me/meetings?type=upcoming`)
- `POST /api/zoom-meetings/:meetingId/auto-open` — Register auto-open via Zoom `open_apps` API
- `DELETE /api/zoom-meetings/:meetingId/auto-open` — Remove auto-open registration

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
ZOOM_APP_ID=...                 # Marketplace App ID (for open_apps API, different from Client ID)
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
4. **Meeting Scopes** — `meeting:read` (upcoming meetings list), `meeting:write:open_app` (auto-open registration)
5. **SDK Capabilities** — See `.claude/skills/zoom-apps/02-sdk-setup.md`
6. **Home URL** — Your ngrok/production URL
7. **Event Subscriptions** — `meeting.rtms_started`, `meeting.rtms_stopped`
8. **App ID** — Copy from Marketplace app overview page → set as `ZOOM_APP_ID` in `.env` (different from Client ID)
9. **App Manifest (Beta)** — If enrolled in the manifest beta, upload `zoom-app-manifest.json` to pre-configure steps 1-7 (replace placeholder URLs first). See README for details.

## Security

- Access tokens stored **encrypted** (AES-128-CBC, 16-byte key from `REDIS_ENCRYPTION_KEY`) in Postgres, auto-refresh before expiry
- httpOnly session cookies, never expose tokens to frontend
- All API calls from frontend use `fetch` with `credentials: 'include'`
- HTTP headers required by Zoom Apps: `Strict-Transport-Security`, `X-Content-Type-Options`, `Content-Security-Policy`, `Referrer-Policy`
- **Rate limiting:** Global (1000/15min), auth endpoints (30/15min), AI endpoints (20/1min) via `express-rate-limit`
- **Ownership checks:** All meeting routes enforce `ownerId: req.user.id` — users can only access their own data
- **Timing-safe JWT comparison:** `crypto.timingSafeEqual` in `services/auth.js`
- **RTMS webhook HMAC:** `x-zm-signature` verification with replay protection in RTMS service
- **Token refresh mutex:** Per-user lock prevents concurrent Zoom token refresh race conditions

## Documentation Reference

- `/SPEC.md` — Authoritative feature specification and version milestones
- `.claude/skills/zoom-apps/` — General Zoom Apps development guides (SDK, OAuth, RTMS, security)
- `/docs/ARCHITECTURE.md` — System architecture details
- `/docs/PROJECT_STATUS.md` — Current status and next actions
- `/docs/TROUBLESHOOTING.md` — Common issues and fixes

## Known Issues

- No automated tests exist yet (manual testing only)
- Frontend uses CRA (react-scripts), NOT Next.js
- If RTMS stream starts before the app is opened in a meeting, the "Start" chat notice is never sent. The disclaimer/notice should be sent when the app opens and detects RTMS is already active.
- Guest transcript access is permissive — anyone with a Zoom meeting ID can read transcripts via WebSocket or REST. See ROADMAP.md for planned mitigation.
- HomeView weekly digest, action items, and recurring topics sections use hardcoded mock data (API endpoints planned)
