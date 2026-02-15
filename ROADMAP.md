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
- [x] **AI-generated meeting title** — Sparkle icon in `MeetingDetailView` calls the backend to generate a concise title from the transcript/summary. Generated title pre-fills the inline editor for review.
- [x] **AI-powered home dashboard** — Home page features an AI-generated weekly digest, smart reminders extracted from action items across meetings, and cross-meeting insights (recurring topics, follow-up tracking).
- [x] **Multi-source search** — Search now queries meeting titles, AI summaries (JSONB fields), and transcripts in parallel. Results are prioritized by source (titles first, summaries second, transcripts third) with section labels when multiple categories match. AppShell dropdown shows type badges and limits to 5 results.
- [x] **Chat notices** — Automatic Zoom chat messages when transcription starts, pauses, resumes, stops, or restarts. Each event has an independent toggle and customizable message template with `[meeting-id]` placeholder support. Settings UI with progressive disclosure (master toggle, per-event toggles, editable templates, live preview). Preferences persisted via `/api/preferences` endpoint (`User.preferences` JSON field) with localStorage for zero-latency access during meetings.
- [x] **Functional auto-start transcription** — The "Start transcription when you open this app" toggle in Settings is now functional. Preference is persisted to localStorage and the `/api/preferences` API (`autoStartRTMS` key). Auto-start logic lives in `MeetingContext` (provider level) so RTMS starts as soon as the user is authenticated and in a meeting, regardless of which view is active. User lands on HomeView with a `LiveMeetingBanner` linking to the live transcript. Defaults to ON for backward compatibility.
- [x] **Upcoming meetings & auto-open** — Users can view their upcoming Zoom meetings inside Arlo and toggle auto-open so the app launches automatically when a meeting starts. Includes a reusable `services/zoomApi.js` helper (token auto-refresh, 401 retry), `routes/zoom-meetings.js` with GET/POST/DELETE endpoints for the Zoom `open_apps` API, a dedicated `UpcomingMeetingsView` with per-meeting auto-open toggles and info/warning banners, a top-3 upcoming section on the HomeView, and auto-open controls in SettingsView. Requires `meeting:read` and `meeting:write:open_app` OAuth scopes and the Zoom Apps Quick Launch setting.

---

## Near-term (v1.0 Polish)

### Move dark mode toggle to Settings
`good-first-issue` · `frontend/src/views/SettingsView.js`, `frontend/src/components/AppShell.js`

The dark mode toggle currently lives in the AppShell header. Move it to `SettingsView` under a new "Appearance" section so the header stays clean. Remove the toggle from AppShell and add a light/dark/system selector in Settings (using the existing `ThemeContext`).

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

### Participant timeline view
`advanced` · New DB model, webhook handling, new UI component

A visual timeline showing when each participant joined and left the meeting. Requires a new database model for join/leave events, handling `meeting.participant_joined` and `meeting.participant_left` webhooks, and a timeline UI component (as a new tab in MeetingDetailView).

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

- **Participant webhook events need audit** — `meeting.participant_joined` and `meeting.participant_left` webhooks may be firing but aren't currently used. These events are only relevant when the app is running as the meeting host. Audit whether these create unnecessary processing or noise, and either use them (for the timeline view) or unsubscribe.
- **"Live meeting in progress" persists after meeting ends** — The `LiveMeetingBanner` and `InMeetingView` remain active after a meeting ends and the user is no longer in the meeting context. `MeetingContext` does not clear the active meeting state when the Zoom meeting ends.

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
