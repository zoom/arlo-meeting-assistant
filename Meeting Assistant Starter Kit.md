
## Problems

- Difficulty clearly communicating **what RTMS is**, **why to use it**, and **how it enables more powerful products**.
- Difficulty explaining **what Zoom Apps are** and how RTMS integrates with existing apps.
- Meeting intelligence developers do not know they can build Zoom Apps or the value it would bring. 
- Targeted customers (Meeting Intelligence devs, enterprises) lack clear demo/example of Apps with Meeting Surface + RTMS. We lack a compelling functionality demo - "What can you build", "Why should you build"; value prop of connected components of RTMS + Meetings surfaces. 
- Teams lack demo'able boilerplate of a tangible use case in a meeting; "What's the user experience" problem, 
- Meeting bots think they only need to extract data from the platform. 
## Root cause

- Meeting Bots and Zoom Apps have been different things, so there isn't enough Zoom App knowledge amongst Meeting Intelligence devs
- RTMS is a **new product**, so there are not yet enough:
    - Use case and functionality examples/demos
    - Documentation and resources
    - Communication, marketing and evangelism efforts
As a result, customers and partners lack the context and confidence needed to adopt and experiment with RTMS. 

## Solution

1. **Create a starter app** that is:
    - Hackable, forkable, and deeply customizable - Tell people how to remove & rebuild what we've built; "how to make this your own" 
    - Simple to understand for both developers and customers
    - Easy to plug into existing environments
2. **Drive awareness and adoption** by:
    - Marketing the starter app effectively
    - Ensuring customers know about RTMS and can experiment with it quickly
    - Providing resources and storytelling that demonstrate RTMS’s value in real-world scenarios

```markdown
# Meeting Assistant Starter Kit — App Spec

Single source of truth for routes, UX, data, and APIs. Point your IDE/codegen at this doc for autocomplete context.

---

## 1) Routes & App Structure

| Route | Purpose |
|---|---|
| `/` | Landing & authorization (Sign in with Zoom / Google). |
| `/home` | **Dashboard + Chat** (“Chat with your Notetaker”). Highlights this week, reminders from yesterday, suggested prompts, link to meetings. |
| `/meetings` | **Meetings list** (title + date first-class; not UUIDs). Filter/sort/search. |
| `/meetings/[meetingID]` | **Meeting detail / playback**: summary, transcript/timeline, video, participants, highlights/tasks. |
| `/meeting/{currentMeetingUUID}` | **In-meeting** (live transcript, notes, actions, risk signals). |

---

## 2) Home (`/home`)

- Chat with Notetaker (RAG over transcripts; citations → jump to meeting/time).
- Highlights from this week.
- Reminders / takeaways from yesterday.
- Suggested prompts:
  - What did I commit to this week?
  - Decisions made last meeting?
  - Action items from yesterday?
- Link to “View My Meetings”.
- Empty state: “No meetings yet — connect your Zoom account.”

**Data**
- `GET /api/meetings?limit=5`
- `GET /api/search`
- `POST /api/ai/chat`
- `GET /api/tasks?date_range=yesterday`

---

## 3) Meetings List (`/meetings`)

- Table or cards: Title, Date, Duration, Participants, Open.
- Filters (date range, tags). Search box.
- Empty state when none exist.

**Data**
- `GET /api/meetings` (title & date are primary; IDs secondary)
- Derived: `duration`, `participants_count`

---

## 4) Meeting Detail (`/meetings/[meetingID]`)

Sections:
1. **Summary**: description/AI summary; mini “Ask about this meeting” chat.
2. **Transcript / Timeline**: scrollable, speaker labels, timestamps, jump to hits, follow-live (if active).
3. **Recording**: video player (v2), optional active speaker overlay.
4. **Participants**: attendance & speaking duration. “Active speaker switch.”
5. **Highlights & Tasks**: takeaways; table `Owner | Task | Due | Source (timestamp)`.

**Data**
- `GET /api/meetings/:id`
- `GET /api/meetings/:id/transcript`
- `GET /api/meetings/:id/vtt`
- `GET /api/tasks?meeting_id=`
- `POST /api/ai/chat` (inline Q&A)
- (v2) video URL from Zoom/Supabase

---

## 5) In-Meeting (`/meeting/{currentMeetingUUID}`)

- **Transcript/Timeline**: live RTMS stream (≤1s P95). Scroll-up detaches follow-live.
- **Notes & Takeaways**: real-time draft notes; confirm/assign action items with owners.
- **Suggestions (real time)**: assistant nudges to clarify, summarize, or capture commitments.
- **Risk assessments** (optional): domain flags (finserv, lending, medical, legal).

> “Not a recorder—an assistant. Make me look smarter and faster. Real-time augmentation > post-hoc.”

---

## 6) Version Roadmap

- **v0.5**: Ask about transcript; list meetings; meeting detail; in-meeting live transcript.
- **v1**: Store meeting transcripts in DB; full-text search.
- **v2**: Store recordings; video replay (Fathom-style).

---

## 7) Minimal Data Model

- `meetings`: id, title, start_time, end_time, owner_user_id, status, language, timezone
- `speakers`: id, meeting_id, display_name, role
- `transcript_segments`: id, meeting_id, speaker_id, t_start_ms, t_end_ms, text, seq_no
- `vtt_files`: id, meeting_id, storage_key, version
- `highlights`: id, meeting_id, t_start_ms, t_end_ms, title, notes
- `tasks`: id, meeting_id, owner_name, description, due_date, status, source_timestamps

---

## 8) API (Preview)

- `GET /api/meetings`
- `GET /api/meetings/:id`
- `GET /api/meetings/:id/transcript?from_ms&to_ms&limit&after_seq`
- `GET /api/meetings/:id/vtt`
- `GET /api/search?q&meeting_id&from&to`
- `POST /api/ai/chat` (SSE)
- `GET /api/tasks?date_range&status&meeting_id`

---

## 9) Developer Notes

- Auth: Supabase/Auth0/Clerk linked with Zoom user ID.
- Postgres for transcript + metadata.
- Frontend: Next.js + Tailwind + shadcn/ui.
- Vector retrieval optional (pgvector or external service).
- Feature flags: `AI_ENABLED`, `EXTRACTION_ENABLED`, `PUBLIC_LINKS_ENABLED`.

---

## 10) Design Intent

- Neutral, forkable UI (gray base with blue/purple accent).
- Dual-mode support (light/dark).
- Clean component library for Tailwind/shadcn.
- Emphasis on clarity, developer readability, and extensibility.

---

_Last updated: {{ auto_date }}_
```



# Summary

Open-source **Meeting Assistant Starter Kit** for DevRel demos. It ingests** Zoom meeting transcripts via Realtime Media Streams** over WebSocket, renders **live captions** in a Zoom App, **stores** normalized segments in some way, generates **VTT**, exposes a **searchable web UI** and **public API**, and (optionally) adds an **LLM assistant** to “chat with your transcripts,” including quick-action prompts (commitments, action items) with timestamped citations. Two modules: **Core** (required) and **AI Assistant** (feature-flagged).
## Stage 1 — Core (Transcript capture, storage, search)

### Functional Requirements

- **Ingestion**
    - RTMS WebSocket client per meeting; normalize, dedupe, reorder (2–3s buffer), batch write.
    - Idempotency on (meeting_id, seq_no); auto-reconnect with jitter.
    - Latency target: ingest→UI ≤ **1s P95**.
- **Storage**
    - Postgres (e.g., Supabase). Tables: users, meetings, speakers, transcript_segments, vtt_files, highlights.
    - Generate **WebVTT** post-meeting; store object key + version.
    - Optional data retention + purge.
- **APIs**
    - GET /api/meetings, GET /api/meetings/:id.
    - GET /api/meetings/:id/transcript?from_ms|to_ms|after_seq|limit.
    - GET /api/meetings/:id/vtt (download/redirect).
    - GET /api/search?q&meeting_id&from&to.
- **Auth / Security**
    - Zoom context inside Zoom App; web auth via Supabase/Auth0/Clerk; link to zoom_user_id.
    - Tenant isolation (RLS), httpOnly cookies, no client secrets.
- **UIs**
    - **Zoom App (in-meeting):** live scroll, Follow Live, pause/scroll-back, speaker/timestamp toggles, font size, status (Connected/Reconnecting/Disabled).
    - **Web (post-meeting):** Home list (search/sort), Transcript detail (inline search, jump to time, highlights CRUD, VTT/JSON export).
- **Search**
    - Postgres FTS on transcript_segments.text; filters: date, meeting, speaker, tags.
- **Observability / Ops**
    - JSON logs (meeting_id, seq_no, request_id), metrics (segments/sec, lag, error rate), health endpoints.
    - Docker Compose dev: Postgres(+pgvector), storage, seed + RTMS replay script.
### Core Feature Summary (User-Facing)

- Live captions in-meeting.
- Automatic transcript persistence.
- Browse & search past meetings.
- Highlights with timestamp ranges.
- One-click **VTT** export (is this necessary?)
- REST API for integration.




---
## Stage 2 — AI Assistant (optional; feature flag AI_ENABLED)

### Functional Requirements

- **Retrieval-Augmented Chat**
    - Hybrid retrieval (FTS + pgvector) over user’s transcripts; strict tenant filters.
    - Chunking 30–60s with overlap; de-dupe; reciprocal-rank fusion.
    - **Citations required**: meeting title + HH:MM:SS–HH:MM:SS per claim; clickable → transcript jump.
- **Chat API + Orchestration**
    - POST /api/retrieve → ranked spans.
    - POST /api/ai/chat (SSE streaming) with filters (date range, meetings, speakers, tags) and modes (Summary | Structured).
    - Cost/latency guardrails; stream start ≤ **1.5s**, typical answer ≤ **5s**.
- **Quick Actions**
    - “What did I commit to do this week?”
    - “What are my action items from yesterday?”
    - “Decisions made last meeting”
    - Returns structured table: **Owner | Task | Due | Source (timestamp)**.
- **Background Extraction (optional** **`EXTRACTION_ENABLED`****)**
    - Post-meeting job to draft extracted_tasks and decisions with confidence; user confirm/complete endpoints.
- **Data Model Additions**
    - embeddings(meeting_id, segment_id, embedding, metadata).
    - ai_sessions, ai_messages(filters, content), ai_citations.
    - extracted_tasks(status: draft|confirmed|done, source_timestamps).
- **UI Additions**
    - Chat pane with suggested prompts + filters; streaming answer with citation chips/hover preview.
    - Tasks view (confirm/complete) with links to sources.
    - “Ask about this meeting” mini-chat on Transcript detail.
- **Privacy & Integrations**
    - Redaction before embedding (emails/phones/IDs).
    - Pluggable LLM/vector backends (OpenAI/Anthropic/local; pgvector/Pinecone/etc.).
### AI Feature Summary (User-Facing)

- “Chat with your transcripts” across selected meetings.
- Timestamped, clickable citations for every claim.
- One-click prompts for **commitments**, **action items**, **decisions**.
- Tasks table with confirm/complete workflow.


---
## Two modules in one repo:

- **Core (required):** real-time transcript capture, storage, search, VTT export, in-meeting UI, post-meeting UI, public API.
- **AI Assistant (optional / feature-flagged):** “chat with transcripts”, quick actions (commitments, action items), citations.
Ship as a monorepo with clear separation: /core and /ai.

---
## 1. Functional Requirements

### 1.1 Core

**Ingestion**
- Connect to Zoom RTMS via WebSocket per active meeting.
- Parse transcript events (text, timestamps, speaker/participant id, confidence).
- Reconnect strategy with jitter; idempotent segment writes using (meeting_id, seq_no) or provider segment id.
- Small reorder buffer (2–3s) for out-of-order segments; monotonic t_start_ms.
**Storage**
- Persist segments as rows with meeting_id, t_start_ms, t_end_ms, speaker_id, text, seq_no, confidence.
- Write completion status at meeting end; compute duration.
- Generate and store **VTT** artifacts (versioned per regeneration).
- Optional retention policy: purge after N days.
**Search**
- Keyword search over transcript text; results return (meeting_id, t_start_ms, context_snippet).
- Filters: time range, meeting id(s), speaker(s), tags.
**APIs**
- Meetings list/detail.
- Paginated transcript retrieval by time and/or after_seq.
- VTT download (stream or 302).
- Search endpoint (keyword).
**In-Meeting UI (Zoom App)**
- Live scroll of transcript lines with “Follow Live” toggle.
- User can pause, scroll back, resume live.
- Optional speaker filter, timestamps toggle, font-size controls.
- Connection status indicator.
**Post-Meeting UI (Web)**
- Home: list past meetings with search/sort.
- Transcript detail: full transcript view, inline search, jump to timestamp, VTT download, highlights CRUD.
**Security/Auth**
- Zoom user context inside Zoom App.
- Web app auth via Supabase/Auth0/Clerk (pick one) and link to zoom_user_id.
- Row-level scoping by user/tenant. Public sharing disabled by default; tokenized links optional.
**Observability**
- JSON logs with meeting_id, seq_no, request_id.
- Metrics: ingest lag, UI render lag, error rates, segments/sec, VTT build time.

---
### 1.2 AI Assistant (Optional Module, Feature Flag: AI_ENABLED)

**Chat with Transcripts**
- Chat UI with streaming responses.
- Hybrid retrieval (keyword + vector) across user’s transcripts; strict tenant filters.
- Citations (meeting title + 00:MM:SS–00:MM:SS) for each claim; clickable to open the transcript detail at the span.
- Filters in chat: date range, meetings, speakers, tags.
**Quick Actions**
- “What did I commit to do this week?”
- “What are my action items from yesterday?”
- “Decisions made last meeting”
- Returns structured rows: Owner | Task | Due | Source (timestamp).
**Background Extraction (Optional)**
- Post-meeting job to extract draft tasks/decisions with confidence; stored and shown in transcript detail and a Tasks view.
**Safeguards**
- Refuse unsupported answers; prompt user to widen scope.
- Redaction hooks before embedding (emails/phones/etc.).

---
## 2. UI Requirements

### 2.1 In-Meeting (Zoom App)

**Views**
- **Live Transcript**
    - Virtualized list of caption lines (speaker label, timestamp optional).
    - Controls: Follow Live, Pause, Font ±, Contrast, Show timestamps, Speaker filter.
    - Status bar: Connected/Reconnecting/Disabled by host.
- **Empty/Errors**
    - “Transcripts unavailable” with host instructions.
    - Reconnect with backoff and manual retry.
**Interactions**
- Scrolling up detaches auto-follow; sticky “Resume Live”.
- Keyboard: j/k move, g/G top/bottom, f follow toggle.
### 2.2 Post-Meeting (Web)

**Home**
- Table/grid: Title, Date, Duration, Speakers, Tags, Actions (Open, VTT).
- Search box (keyword), filters (date range, tags).
**Transcript Detail**
- Left: transcript pane (group by time buckets or speakers).
- Right: outline (time buckets or speaker list), highlights panel.
- Inline search (regex + keyword), jump to hits.
- Actions: VTT download, JSON export, Create Highlight (t_start_ms–t_end_ms, title, notes).
**AI (if enabled)**
- Chat drawer/pane with suggested prompts.
- Filters (date range, meetings, speakers, tags).
- Streaming answers with inline citations; hover preview; click → jump in transcript.
- Tasks tab: table of extracted tasks; confirm/complete; source links.
**Accessibility**
- ARIA live region for new captions; WCAG AA color/contrast; full keyboard navigation.

---
## 3. System Architecture

```plaintext
[Zoom Meeting] ──RTMS WS──> [Ingestion Worker]
                              | (normalize/buffer/dedupe)
                              v
                         [Postgres + Storage]
                             |        |
                      [REST API]   [VTT Builder]
                             |        |
                 [Zoom App UI]     [Web App UI]
                             |
                       [Search API]
                             |
                     (optional) [Vector Index + AI Orchestrator]
                                           |
                                         [LLM]

```
- **Services**
    - Ingestion Worker (Node/TS).
    - REST API (Fastify/Express).
    - VTT Builder (library + job).
    - Web UIs (Next.js; one for Zoom App, one for Web).
    - Optional AI Orchestrator (retrieval + prompting + SSE).
- **State**
    - Postgres (Supabase recommended) + pgvector (optional).
    - Object storage for VTT (Supabase Storage or S3-compatible).

---
## 4. Data Model (Postgres)

**users**
- id uuid pk
- zoom_user_id text unique null
- email text, name text, avatar_url text
- created_at timestamptz
**meetings**
- id uuid pk
- zoom_meeting_id text
- title text, start_time timestamptz, end_time timestamptz
- owner_user_id uuid fk → users
- status text check in ('ongoing','completed','failed')
- language text, timezone text
- created_at, updated_at
**speakers**
- id uuid pk
- meeting_id uuid fk
- label text -- e.g., “Speaker 1”
- zoom_participant_id text null
- display_name text null
- role text -- host/participant/system
**transcript_segments**
- id uuid pk
- meeting_id uuid fk
- speaker_id uuid fk null
- t_start_ms int, t_end_ms int
- seq_no bigint -- unique per meeting
- text text, confidence float null
- created_at
- **Indexes**: (meeting_id, t_start_ms), unique (meeting_id, seq_no), GIN FTS on text.
**vtt_files**
- id uuid pk
- meeting_id uuid fk
- storage_key text -- or object_url
- version int, generated_at
**highlights**
- id uuid pk
- meeting_id uuid fk, user_id uuid fk
- t_start_ms, t_end_ms
- title text, notes text, tags text[], created_at
**embeddings** (AI optional)
- id uuid pk
- meeting_id uuid fk, segment_id uuid fk
- embedding vector -- dims per model
- norm_text text, metadata jsonb
- Index: ivfflat on embedding, GIN on metadata.
**ai_sessions** (AI)
- id uuid pk, user_id uuid fk, title text null, created_at
**ai_messages** (AI)
- id uuid pk, session_id uuid fk, role text (user|assistant|system)
- content jsonb, filters jsonb, created_at
**ai_citations** (AI)
- id uuid pk, message_id uuid fk
- meeting_id uuid fk, segment_id uuid fk null
- t_start_ms, t_end_ms, confidence float
**extracted_tasks** (AI optional)
- id uuid pk, meeting_id uuid fk, created_by_ai_message_id uuid null
- owner_name text, owner_user_id uuid null
- description text, due_date timestamptz null
- status text (draft|confirmed|done), confidence float
- source_meeting_id uuid, source_t_start_ms, source_t_end_ms
Row-level security enabled for multi-tenant isolation.

---
## 5. Interfaces & Contracts

### 5.1 Ingestion WebSocket (to Zoom RTMS)

- RTMS auth: Zoom credentials (env).
- Receive messages (example payload shape):
```plaintext
{
  "type": "transcript",
  "meeting_id": "zoom-123",
  "participant_id": "p-456",
  "sequence": 1203,
  "t_start_ms": 73456,
  "t_end_ms": 75420,
  "confidence": 0.93,
  "text": "Let's review the backlog items for this week."
}

```
- Worker responsibilities:
    - Normalize UTF-8, trim whitespace.
    - Map participant_id → speaker_id (create if new).
    - Reorder within 2–3s window; assign seq_no if provider lacks it.
    - Batch insert (e.g., 50–200 segments per txn or ≤500ms per flush).
    - Emit Server-Sent Events (SSE) or WS to in-meeting UI for low-latency updates.
### 5.2 Internal Events (Worker → API/DB)

- Insert transcript_segments.
- Upsert speakers.
- Emit meeting_completed when RTMS closes; API triggers VTT generation job.
### 5.3 REST API (Core)

- GET /api/meetings?query=&from=&to=&limit=&cursor=
- GET /api/meetings/:id
- GET /api/meetings/:id/transcript?from_ms=&to_ms=&limit=&after_seq=
- GET /api/meetings/:id/vtt → 302 to object or stream
- GET /api/search?meeting_id=&q=&from=&to=&limit=
Auth: Bearer JWT (web) / Zoom context (Zoom App). Responses include request_id. Paginate with cursors.
### 5.4 REST API (AI, optional)

- POST /api/retrieve → hybrid results { meeting_id, t_start_ms, snippet, score }[]
- POST /api/ai/chat (SSE stream)<br/>Body: { session_id?, message, filters?, mode? }<br/>Stream chunks include tokens and citations[] on completion.
- GET /api/ai/sessions, GET /api/ai/sessions/:id/messages
- GET /api/tasks?date_range=&status=&owner=
- POST /api/tasks/:id/confirm, POST /api/tasks/:id/complete

---
## 6. VTT Generation Rules

- Header: WEBVTT\n\n
- Merge micro-fragments to 2–4s cues; never exceed ~6s unless silence.
- Cue format: HH:MM:SS.mmm --> HH:MM:SS.mmm
- Optional speaker labeling: add first line NOTE Speaker: <name|label> or prefix [Speaker] in text as configurable.
- Validate no overlapping cues; clamp to non-negative times; ensure sorted by start time.
- Store as object (storage_key), record version.

---
## 7. Non-Functional Requirements

**Performance**
- Ingestion: DB write latency ≤ 500ms P95 from receipt.
- UI: live caption display ≤ 1s P95 end-to-end.
- Search: keyword query ≤ 400ms P95 on 100k segments.
- AI (if enabled): stream start ≤ 1.5s; full answer ≤ 5s typical.
**Scalability**
- Baseline target: 100 concurrent meetings (5 segments/sec each).
- Stateless workers; horizontal scale with queue or partition by meeting id.
**Reliability**
- Exponential backoff reconnects; idempotent insert by (meeting_id, seq_no).
- Daily backup of DB; object storage with lifecycle rules.
**Security & Privacy**
- RLS on all tables by owner_user_id.
- Secrets only server-side; httpOnly cookies; CSRF on state-changing ops.
- Redaction hooks prior to indexing/embeddings.
**Accessibility**
- Screen-reader friendly, ARIA live regions, keyboard navigation, WCAG AA.

---
## 8. Component Breakdown (Implementation)

**/ingestion (Node/TS)**
- RTMS client (WS).
- Reorder buffer, dedupe, batcher.
- DB writer (Prisma/pg).
- SSE/WS broadcaster to in-meeting UI (optional if UI also polls API).
**/api (Fastify/Express, TS)**
- Auth middleware (Supabase/Auth0/Clerk JWT verify).
- Meetings, transcripts, search routes.
- VTT route (sign & redirect).
- (AI) retrieval, chat SSE, tasks routes.
- Rate limiting, structured logging.
**/web (Next.js)**
- Post-meeting UI.
- Pages: Home, Transcript Detail, (AI) Chat/Tasks.
- Data fetching with TanStack Query; virtualized lists.
- Theme + accessibility controls.
**/zoom-app (Next.js in Zoom App SDK)**
- Live transcript view.
- Zoom context auth + handoff-link to web.
**/packages**
- schema (Zod/Prisma schema + SQL migrations).
- vtt (cue builder/validator).
- search (FTS helpers).
- (AI) retrieval (hybrid retrieve, RRF), prompt (templates).
**Ops**
- Docker Compose (db + pgvector + storage + mailhog).
- env.example, Makefile/npm scripts.
- Seed fixtures and replay scripts for RTMS samples.

---
## 9. Test Plan

**Unit**
- Segment normalization, ordering, dedupe.
- VTT cue generation & validation.
- Search tokenizer and result ranking.
**Integration**
- Simulated RTMS → DB → UI visible in under 1s P95.
- Meeting completion triggers VTT creation; file downloadable.
**E2E (Playwright)**
- Login, open meeting, live captions stream, pause/resume, search, highlight.
- Post-meeting browse, open transcript, download VTT.
**AI (optional)**
- Retrieval returns K spans with correct filters.
- Chat answers always include citations; links open correct offsets.
- Quick actions yield structured tasks with sources.
**Load**
- 100 concurrent meetings, 5 msg/sec; ensure latency and error rates within SLOs.

---
## 10. Acceptance Criteria (Core)

- Live captions display in-meeting with ≤1s P95 latency.
- Transcript persists and is viewable on Home within 30s after meeting end.
- Search finds keywords and jumps to the correct span.
- VTT downloads validate against a standard player.
- API endpoints documented (OpenAPI) and pass contract tests.
## 11. Acceptance Criteria (AI, when enabled)

- Chat answers stream and include citations per claim.
- Quick actions (“commitments this week”, “action items yesterday”) return structured results with sources.
- Retrieval respects user/tenant filters; no cross-tenant leakage.

---
## 12. Roadmap & Feature Flags

- AI_ENABLED (default off).
- EXTRACTION_ENABLED (task/decision background jobs, default off).
- PUBLIC_LINKS_ENABLED (tokenized sharing, default off).
**Milestones**
- **MVP Core**: ingestion, storage, in-meeting UI, post-meeting UI, search, VTT, API.
- **AI v1**: chat with transcripts, citations, quick actions.
- **AI v1.1**: extraction jobs, Tasks view, owners mapping to participants.

---
## 13. OpenAPI Sketch (Core)

- GET /api/meetings
- GET /api/meetings/{id}
- GET /api/meetings/{id}/transcript (params: from_ms, to_ms, after_seq, limit)
- GET /api/meetings/{id}/vtt
- GET /api/search (params: q, meeting_id, from, to, limit)
(AI)
- POST /api/retrieve
- POST /api/ai/chat (SSE)
- GET /api/tasks / POST /api/tasks/{id}/confirm / POST /api/tasks/{id}/complete

---
## 14. Sequence Flows (Text)

**A) Live Meeting**
1. Zoom App boots; requests meeting context.
2. Ingestion Worker connects to RTMS; receives segments.
3. Worker normalizes, buffers, batches → DB.
4. Worker emits SSE/WS → Zoom App; UI renders live lines (virtualized).
5. On end: Worker marks meeting completed, triggers VTT job.
**B) Post-Meeting Browse**
1. User logs into web; lists meetings via API.
2. User opens a meeting; paginated fetch of segments.
3. User searches; API returns matches with t_start_ms.
4. User downloads VTT; API signs and redirects to storage.
**C) AI Chat (optional)**
1. User opens Chat; sets filters and asks question.
2. Orchestrator runs hybrid retrieval; assembles context; prompts LLM.
3. Stream response with citations; user clicks citation → transcript jumps.

---
## 15. Implementation Defaults (Opinionated)

- **DB/Auth**: Supabase (Postgres + RLS + Storage + Auth).
- **Runtime**: Node 20+, TypeScript, pnpm, Turborepo.
- **API**: Fastify, Zod schemas, OpenAPI generated.
- **UI**: Next.js, Tailwind, shadcn/ui, TanStack Query, react-virtual.
- **AI**: pgvector, embeddings pluggable; LLM provider abstracted (env-select).


### Team Responsibilities

- Jen Brissman: PM the project, help with requirements doc, help with UI decisions, create video with final app working, work with marketing/sales to share this video
- Michael Harrington: Help with UI design and requirements doc, oversee all 
- Lars Rosenquist: Help with requirements doc and making architecture decisions, overall development, TBD what specific focus will be
- Chun Siong Tan (陈俊雄): Help with requirements doc and making architecture decisions, overall development, TBD what specific focus will be
- Ojus Save~~: Lead development after completing current tasks (recording websockets demo this week). Focus on backend. ~~
- Max Mansfield~~: Overall development. Help with specifications and development, focus on frontend?~~
- Potential support from Kevin Oh or Austin for UI design
### Timeline Considerations

- Ojus estimated 3-4 days of focused work (??)
- Initial focus on requirements documentation - extremely imporant that we scope everything out accurately 
- V1: Basic transcript functionality
- V2 (future): Add recording capabilities and media mixing

---
UI
Sign up, create an account
login 
user's home page
- Chat with your notetaker on the home page 
- RAG / ask questions of the transcript context
- Gives Highlights from this week
- Reminders/takeaways from yesterday
- Prompts for the user to ask your notetaker 
- Link to view user's meetings
List of meetings - /history or /meetings or /my-week
- view your meetings
    - empty if no meetings
- Click into a meeting for more details
Detail page of meeting - /meetings/{meetingID}
> What data do you have that can be built with; what data is provided and what's easy to do with it 
- shows history of that meeting, description, metadata 
- Shows a recording of the meeting, active speaker, stored video 
- video player 
- uses past meeting api? 
- shows a description / summary of that meeting
- lists who attended and for how long? 
- active speaker switch → how long did x person speak 
- shows takeaways and key highlights from the meeting
- shows timeline of the meeting (who spoke, said what, 

during the meeting
- Notes & Takeaways - Creates meeting notes in real time
- Creates action items with owners 
- Gives suggestions (real time) for the user to 
- Transcript / Timeline
- timeline of the meeting
- Scroll up in the transcript
- shows live transcript
- identifies risk assessments given legal guidance (finserv, lending, medical, etc)
- 

"I don't just need my app collecting data, I need it acting with me in the meeting" "I need it providing me value in the meeting" I don't need a recorder, I need an assistant in the meeting 
"Insightful" "Make me look smarter" "Make me look better" -- that's different than a notetaker, a notetaker still puts responsibility on the user, augment the person, assist 
realtime makes things more efficient, the laterness of it all is so yesterday, you need augmentation, assistant in real time 
its great to have a good UI that displays things in real time, 
how can RTMS + Zoom Apps make your users look better, save you money, 
prompt the user, given all their meetings, 

version 0.5 - ask a question about your transcript, show list of previous meetings, show detail view of a meeting, in meeting app shows current live meeting, 
version 1 - stores meeting transcripts in database 
version 2 - stores meeting recordings in database, shows video replay (Fathom)

---

Need new routes: 
- index - Landing/Authorization
- /home - Dashboard & LLM chat -- This is the "Query meeting summaries" -- This is the currently implemented "chat with openrouter" component
- /meetings - Shows list of meetings (pulls from file system, needs meeting TITLES and dates, not UUIDs) (so might need meeting details via API)
- /meetings/[UUID] - history / playback or live view of a meeting during a meeting, Show detail page of a meeting transcript
In meeting experience loads /meeting/{currentMeetingUUID} and shows the live transcript, sentiment, live summary / query about the meeting


Other - change data identifier from meeting UUID to stream ID

