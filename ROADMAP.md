# Arlo Meeting Assistant Roadmap

This roadmap outlines what's been built, what's coming next, and where contributors can help. Items are grouped by priority tier with difficulty labels to help you find a good starting point.

> **Difficulty guide:** `good-first-issue` = isolated change, clear scope · `intermediate` = touches multiple files or requires Zoom SDK knowledge · `advanced` = architectural change or deep Zoom platform integration

---

## Completed

- [x] **Home page empty state** — The home dashboard shows a friendly message when no meetings exist yet (`frontend/src/views/HomeView.js`).
- [x] **Summary storage in database** — AI-generated summaries are cached in a `Meeting.summary` JSON field so they don't need to be regenerated on every view (`POST /api/ai/summary`).
- [x] **Transcript API endpoint** — Paginated transcript retrieval via `GET /api/meetings/:id/transcript` with `from_ms`, `to_ms`, `limit`, and `after_seq` parameters.
- [x] **Tab active state styling** — Tabs now have a visible selected state using `[data-selected]` CSS attribute selectors in `frontend/src/index.css`.
- [x] **Delete meetings from UI** — Delete button with confirmation dialog on both `MeetingDetailView` and `MeetingsListView`, using the existing `DELETE /api/meetings/:id` endpoint.
- [x] **Rename meetings from UI** — Inline title editing in `MeetingDetailView` header, using the existing `PATCH /api/meetings/:id` endpoint.
- [x] **Pause/resume RTMS** — Transport controls now use real `pauseRTMS`/`resumeRTMS` Zoom SDK calls instead of stop/start workaround. Paused state lifted into `MeetingContext` (`rtmsPaused`).

---

## Near-term (v1.0 Polish)

### Auto-start RTMS events
`advanced` · Backend webhooks, frontend state management

Zoom supports automatic RTMS start at three levels: account-wide, group, and per-user. The app currently has a basic auto-start timer in `InMeetingView.js` (line 55), but it doesn't handle the full matrix of scenarios. This item covers: host-initiated auto-start via webhook, participant-triggered RTMS with optional host approval, and suppressing auto-restart when the user has explicitly stopped transcription. See also the related known issue below.

### AI-generated meeting title
`good-first-issue` · `backend/src/services/openrouter.js`, `backend/src/routes/ai.js`, `frontend/src/views/MeetingDetailView.js`

A sparkle icon next to the meeting title in `MeetingDetailView` calls `POST /api/ai/generate-title` to produce a concise, descriptive title from the transcript or cached summary. The generated title pre-fills the inline editor so the user can review and tweak before saving.

### Improve search experience
`intermediate` · `frontend/src/components/AppShell.js`, `backend/src/routes/search.js`

Search currently queries transcript text via Postgres full-text search. This item expands search to include meeting titles, speaker names, and AI-generated summaries. Consider adding a dedicated search results view instead of only showing results in the header dropdown.

### Send messages to Zoom meeting chat
`intermediate` · `frontend/src/views/InMeetingView.js`, Zoom Apps SDK

Use `zoomSdk.sendMessage()` to post status messages to the meeting chat visible to all participants — for example, "Arlo is now transcribing" when RTMS starts, or sharing a summary snippet when the meeting ends.

### Polish guest mode views
`intermediate` · `frontend/src/views/GuestInMeetingView.js`, `frontend/src/views/GuestNoMeetingView.js`

The current guest views are minimal CTAs. `GuestInMeetingView` should display the meeting summary and a read-only transcript when available. `GuestNoMeetingView` should include a feature overview explaining what Arlo does, not just a login button.

### Create Zoom app manifest
`good-first-issue` · New file: `manifest.json`

Create a `manifest.json` file for easier Zoom Marketplace installation. This file declares required scopes, event subscriptions, SDK capabilities, and URLs so that developers can import the app configuration instead of setting it up manually.

### Handle auto-started but not opened state
`advanced` · `backend/src/routes/rtms.js`, `backend/src/middleware/auth.js`

When RTMS auto-starts via webhook before the user opens the app, the backend creates the meeting under a "system" user. When the real user later opens Arlo in that meeting, the app needs to detect the orphaned meeting and reassign ownership so the user sees their transcript.

### README improvements
`good-first-issue`

See the Documentation TODOs section below for specific items.

---

## Medium-term (v1.1)

### AI-powered home dashboard
`intermediate` · `frontend/src/views/HomeView.js`, `backend/src/routes/home.js`

The home page currently shows basic highlights and reminders. This item adds an AI-generated weekly digest, smart reminders extracted from action items across meetings, and cross-meeting insights (recurring topics, follow-up tracking).

### Participant timeline view
`advanced` · New DB model, webhook handling, new UI component

A visual timeline showing when each participant joined and left the meeting. Requires a new database model for join/leave events, handling `meeting.participant_joined` and `meeting.participant_left` webhooks, and a timeline UI component (as a new tab in MeetingDetailView).

### Auto-open app in meetings
`intermediate` · Backend Zoom REST API integration, `frontend/src/views/SettingsView.js`

Use the Zoom REST API to configure Arlo to auto-open when a user's upcoming meetings start. This requires reading the user's meeting list and setting per-meeting app configuration. Include a toggle in Settings so users can opt in.

### Direct AI provider support
`intermediate` · `backend/src/services/openrouter.js`, `frontend/src/views/SettingsView.js`

Currently all AI features route through OpenRouter. This item adds support for calling Anthropic, OpenAI, or local LLM endpoints directly. Includes a Settings UI where users can enter their own API keys and select a preferred provider.

### Web-based OAuth redirect flow
`advanced` · New route in `backend/src/routes/auth.js`, new frontend entry point

Implement a standard OAuth redirect flow (outside the Zoom client) so users can install Arlo from a web browser. This is a prerequisite for building a post-meeting web dashboard where users can review transcripts and summaries without being in a Zoom meeting.

---

## Future / Exploratory

### Self-hosting guide
`good-first-issue` · New documentation

Write deployment guides for platforms like Railway, Render, Fly.io, and bare Docker Compose. Cover production Docker builds, required environment variables, SSL termination, database provisioning, and Zoom Marketplace configuration for custom domains.

### External transcription sources
`advanced` · Major architecture expansion

Accept audio from non-Zoom sources and route it to a transcription service (Whisper, Deepgram, AssemblyAI) for live transcription. This would let Arlo work with any audio input, not just Zoom RTMS. Requires a new audio ingestion pipeline and transcription service abstraction.

### Specialized UI modes
`advanced` · Frontend views, AI prompt engineering, new export formats

Create purpose-built views for specific use cases: **Healthcare** (HIPAA-aware transcript handling, clinical note generation), **Sales** (deal tracking, objection detection), **Compliance** (keyword monitoring, flag alerts), and **Webinar** (host tools, audience Q&A summaries). Each mode would customize AI prompts, highlight types, and export formats.

---

## Known Issues

- **RTMS restarts after user pauses/stops** — When auto-start is enabled, the 1.5-second auto-start timer in `InMeetingView.js` re-triggers RTMS even after the user explicitly stops transcription. The fix requires tracking explicit user intent (a "user stopped" flag) and suppressing the auto-start logic when the user has deliberately paused or stopped.

- **Participant webhook events need audit** — `meeting.participant_joined` and `meeting.participant_left` webhooks may be firing but aren't currently used. These events are only relevant when the app is running as the meeting host. Audit whether these create unnecessary processing or noise, and either use them (for the timeline view) or unsubscribe.

---

## Documentation TODOs

Improvements needed in the README and docs for developer onboarding.

### Setup and Configuration
- [ ] Document the exact SDK capabilities that need to be enabled in the Zoom Marketplace app configuration
- [ ] Explain RTMS scope requirements (transcript scope now, audio scope when external transcription is added)
- [ ] Note that Guest Mode and In-Client OAuth must both be enabled in the Marketplace app settings
- [ ] Document that `appssdk.zoom.us` must be added to the domain allowlist

### Architecture and Flow
- [ ] Explain how transcription starts, pauses, and stops during a meeting lifecycle
- [ ] Document the webhook event types (`meeting.rtms_started`, `meeting.rtms_stopped`) and how they differ from participant events
- [ ] Describe the pre-transcript state flow (what the user sees before RTMS data arrives)
- [ ] Add an error state for when the Zoom Apps SDK fails to load

### Developer Guide
- [ ] Walk through the full build and dev setup flow (could be a separate `CONTRIBUTING.md`)
- [ ] Explain `callZoomApi` usage — it's used for `startRTMS`/`stopRTMS`; document why and what it does
- [ ] Link to Zoom's guide on auto-opening apps when a meeting starts
