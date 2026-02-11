# Arlo Meeting Assistant — Specification

An open-source Zoom Apps reference implementation that demonstrates how to build intelligent meeting assistants using Real-Time Media Streams (RTMS) — **without requiring a meeting bot**. The app runs natively inside Zoom meetings and provides live transcription, AI-powered summaries, action items, transcript search, and more.

This document is the authoritative feature specification for contributors and forkers.

---

## Current State (v0.9)

Feature inventory organized by component. Each feature is marked **WORKING** (implemented and functional) or **STUB** (placeholder, not yet implemented).

### In-Meeting Zoom App

| Feature | Status |
|---------|--------|
| Live transcript display via RTMS WebSocket | WORKING |
| Start/Stop RTMS controls | WORKING |
| AI Summary (`POST /api/ai/summary`) | WORKING |
| AI Action Items (`POST /api/ai/action-items`) | WORKING |
| AI Chat Q&A (`POST /api/ai/chat`) | WORKING |
| Auto-suggestions at configurable meeting duration | WORKING |
| Meeting history with transcript viewing | WORKING |
| Meeting highlights CRUD | WORKING |
| Full-text search across transcripts | WORKING |
| VTT export | WORKING |
| Meeting rename / delete | WORKING |
| Real-time in-meeting suggestions (`POST /api/ai/suggest`) | STUB |

### Backend API

| Feature | Status |
|---------|--------|
| Zoom OAuth 2.0 (PKCE, in-client flow) | WORKING |
| Encrypted token storage (AES-256) with auto-refresh | WORKING |
| Session management (httpOnly cookies) | WORKING |
| Meeting CRUD (list, detail, rename, delete) | WORKING |
| Transcript storage with idempotent writes (`seqNo` unique) | WORKING |
| AI orchestration via OpenRouter (free models) | WORKING |
| WebSocket broadcast server (per-meeting rooms) | WORKING |
| Full-text search with PostgreSQL GIN index | WORKING |
| WebVTT generation and download | WORKING |
| Highlights CRUD with timestamps and tags | WORKING |
| AI status endpoint | WORKING |

### RTMS Service

| Feature | Status |
|---------|--------|
| @zoom/rtms v1.0.2 class-based Client API | WORKING |
| Webhook handlers (`meeting.rtms_started` / `meeting.rtms_stopped`) | WORKING |
| Multi-meeting support (per-meeting Client instances) | WORKING |
| Transcript normalization, buffering, batch insert | WORKING |

---

## Version Milestones

| Version | Label | Scope |
|---------|-------|-------|
| **v0.9** | Current | Everything listed as WORKING above |
| **v1.0** | Production Ready | Implement `POST /api/ai/suggest` (real-time suggestions), automated tests, CI pipeline, demo video, security audit, GitHub issue templates, end-to-end fresh install test |
| **v1.5** | Standalone Web App | Post-meeting web experience (Next.js or similar): landing page, meeting browser, transcript viewer, dashboard with chat |
| **v2.0** | Enterprise | Video recording + replay, background task extraction, vector embeddings (pgvector), multi-language, team/workspace features, calendar integration, risk/compliance signals, public sharing links |

---

## Tech Stack

| Component | Choice | Notes |
|-----------|--------|-------|
| Frontend | React 18 + CRA 5 | In-meeting Zoom App |
| UI Library | `@base-ui/react` + plain CSS | Unstyled, accessible components; CSS custom properties for design tokens |
| Zoom SDK | `@zoom/appssdk` 0.16+ | In-client OAuth, RTMS initiation |
| Backend | Node.js 20+ / Express.js (JavaScript) | REST API + WebSocket server |
| Database | PostgreSQL 15+ | Full-text search (GIN index), JSON support |
| ORM | Prisma | Migrations, type-safe client |
| AI Provider | OpenRouter | Free models (Gemini Flash), no API key required |
| RTMS | `@zoom/rtms` v1.0.2 | Class-based Client API, requires `linux/amd64` |
| WebSocket | `ws` library | Real-time transcript broadcast |
| Containerization | Docker Compose | Postgres, Backend, Frontend, RTMS services |
| Auth | Zoom OAuth 2.0 (PKCE) | httpOnly session cookies, encrypted tokens |

---

## Data Model

Core Prisma models defined in `backend/prisma/schema.prisma`:

| Model | Purpose |
|-------|---------|
| **User** | Zoom user, linked by `zoomUserId` |
| **UserToken** | Encrypted OAuth tokens (AES-256), auto-refresh |
| **Meeting** | Meeting instance with title, timestamps, status, owner |
| **Speaker** | Meeting participants with labels and roles |
| **TranscriptSegment** | Caption lines with BigInt timestamps, `@@unique([meetingId, seqNo])` for idempotency |
| **VttFile** | WebVTT export file references |
| **Highlight** | User-created bookmarks with time ranges and tags |
| **AiSession** | AI chat session |
| **AiMessage** | Chat messages (user/assistant/system) with optional search filters |
| **AiCitation** | Transcript citations linked to AI messages |

All tables use `@@map()` for snake_case naming. All user-scoped tables cascade delete from User/Meeting. Row-level data isolation via `ownerId` filtering on all queries.

---

## API Reference

### Authentication

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/auth/authorize` | WORKING | Get PKCE challenge for in-client OAuth |
| POST | `/api/auth/callback` | WORKING | Exchange authorization code for tokens |
| GET | `/api/auth/me` | WORKING | Get current authenticated user |

### Meetings & Transcripts

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/meetings` | WORKING | List user's meetings (params: `from`, `to`, `limit`, `cursor`) |
| GET | `/api/meetings/:id` | WORKING | Meeting details |
| PATCH | `/api/meetings/:id` | WORKING | Rename meeting |
| DELETE | `/api/meetings/:id` | WORKING | Delete meeting (cascades) |
| GET | `/api/meetings/:id/transcript` | WORKING | Paginated segments (params: `from_ms`, `to_ms`, `limit`, `after_seq`) |
| GET | `/api/meetings/:id/vtt` | WORKING | Download WebVTT file |

### Search

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/search` | WORKING | Full-text search (params: `q`, `meeting_id`, `from`, `to`) |

### AI

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/api/ai/summary` | WORKING | Generate meeting summary |
| POST | `/api/ai/action-items` | WORKING | Extract action items from transcript |
| POST | `/api/ai/chat` | WORKING | Chat with transcripts (SSE stream, RAG) |
| POST | `/api/ai/suggest` | STUB | Real-time in-meeting suggestions |
| GET | `/api/ai/status` | WORKING | AI service status and model info |

### Highlights

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/api/meetings/:id/highlights` | WORKING | Create highlight |
| GET | `/api/meetings/:id/highlights` | WORKING | List highlights for meeting |
| PATCH | `/api/highlights/:id` | WORKING | Update highlight |
| DELETE | `/api/highlights/:id` | WORKING | Delete highlight |

### WebSocket

| Event | Direction | Description |
|-------|-----------|-------------|
| `subscribe` | Client -> Server | Subscribe to meeting transcript feed |
| `transcript.segment` | Server -> Client | New caption line |
| `ai.suggestion` | Server -> Client | Real-time AI insight |
| `meeting.status` | Server -> Client | RTMS started/stopped/completed |

Connection: `ws://host/ws?meeting_id={uuid}&token={jwt}`

### RTMS Webhooks

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/api/rtms/webhook` | WORKING | Handles `meeting.rtms_started` and `meeting.rtms_stopped` events |

---

## Architecture Overview

Three-component system:

1. **In-Meeting Zoom App** (`frontend/`) — React SPA running embedded in the Zoom client. Handles OAuth, live transcript display, AI panels, highlights, search.

2. **Backend API** (`backend/`) — Express server providing REST API, WebSocket broadcast, RTMS webhook handling, AI orchestration, and session management.

3. **RTMS Service** (`rtms/`) — Dedicated transcript ingestion worker using `@zoom/rtms` SDK. Receives raw transcript events from Zoom, normalizes and buffers them, batch-inserts to Postgres, and forwards to WebSocket broadcast.

**Data flow:** Zoom RTMS -> RTMS Service -> Backend (normalize, buffer, batch insert) -> WebSocket broadcast -> Frontend (< 1s end-to-end latency).

For detailed architecture diagrams, data flow, deployment options, and security model, see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Scope Boundaries

Explicitly **out of scope** for this project:

- Production infrastructure (Terraform, Kubernetes, managed hosting)
- Multi-tenant / SaaS architecture
- Billing, subscriptions, or payment processing
- Video capture, recording, or replay
- Mobile app
- SSO beyond Zoom OAuth
- Custom AI model hosting (uses OpenRouter as a proxy)
- Automated CI/CD pipeline (v1.0 goal)
