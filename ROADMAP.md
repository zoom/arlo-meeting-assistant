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
- [x] **Move dark mode toggle to Settings** — Dark mode toggle moved from the AppShell header to the SettingsView page header (Sun/Moon icon button right-aligned next to the title). Keeps the AppShell header clean with only search and settings icons.
- [x] **Zoom App Manifest (beta)** — Added `zoom-app-manifest.json` with pre-configured OAuth scopes, all 16 SDK capabilities, event subscriptions (`meeting.rtms_started`/`meeting.rtms_stopped`), in-client OAuth, guest mode, and domain allow list. Developers in the manifest beta can upload this file to configure their Zoom App instead of setting each option manually.
- [x] **Web OAuth redirect flow** — Browser-based OAuth for Marketplace installs. `GET /api/auth/start` redirects to Zoom OAuth, `GET /api/auth/callback` handles the redirect. Three new views: `LandingPageView` (marketing page with feature cards, onboarding steps, FAQ), `OnboardingView` (post-install success with next steps), `OAuthErrorView` (error state with retry and diagnostics).
- [x] **AI-generated meeting titles** — Sparkle icon in `MeetingDetailView` calls `POST /api/meetings/:id/generate-title` to generate a concise title from transcript/summary. Generated title pre-fills the inline editor for review before saving.
- [x] **Participant event tracking and timeline** — `ParticipantEvent` database model tracks join/leave events with millisecond timestamps. `ParticipantTimeline` component renders swimlane visualization with colored bars per participant. Inline participant events (joined/left, transcription lifecycle) shown in `InMeetingView` transcript. Initial roster vs. real join detection via `firstTranscriptReceived` flag to filter noise from Zoom's initial participant dump.
- [x] **Meeting attribution via RTMS operator ID** — When RTMS auto-starts before the user opens the app, the meeting is created under a system user. When the real user later opens Arlo, the backend detects the orphaned meeting via the RTMS operator ID and reassigns ownership so the user sees their transcript.

---

## Near-term (v1.0 Polish)

### Polish guest mode views
`intermediate` · `frontend/src/views/GuestInMeetingView.js`, `frontend/src/views/GuestNoMeetingView.js`

The current guest views are minimal CTAs. `GuestInMeetingView` should display the meeting summary and a read-only transcript when available. `GuestNoMeetingView` should include a feature overview explaining what Arlo does, not just a login button.

### Handle auto-started but not opened state
`intermediate` · `backend/src/routes/rtms.js`, `backend/src/routes/meetings.js`

Meeting attribution via RTMS operator ID is implemented — orphaned meetings are reassigned when the real user opens Arlo. Remaining work: ensure the frontend detects the reassigned meeting and navigates to InMeetingView automatically, and handle edge cases where the operator ID is unavailable.

### README improvements
`good-first-issue`

See the Documentation TODOs section below for specific items.

---

## Medium-term (v1.1)

### Direct AI provider support
`intermediate` · `backend/src/services/openrouter.js`, `frontend/src/views/SettingsView.js`

Currently all AI features route through OpenRouter. This item adds support for calling Anthropic, OpenAI, or local LLM endpoints directly. Includes a Settings UI where users can enter their own API keys and select a preferred provider.

### ~~Web-based OAuth redirect flow~~ ✅
Implemented — `GET /api/auth/start`, `GET /api/auth/callback`, landing page, onboarding, and error views. See Known Issues for remaining gaps.

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

- **Participant event initial roster noise** — Zoom fires a batch of `participant_joined` events when RTMS connects (initial roster). These are now filtered using a `firstTranscriptReceived` flag, but edge cases may remain when meetings have many participants or unusual join patterns.
- **"Live meeting in progress" persists after meeting ends** — The `LiveMeetingBanner` and `InMeetingView` remain active after a meeting ends and the user is no longer in the meeting context. `MeetingContext` does not clear the active meeting state when the Zoom meeting ends.
- **Browser `/auth` route shows SDK error** — When a browser user visits the root URL (`/`), `RootView` detects no Zoom SDK and should show the landing page. However, if the user somehow navigates to `/#/auth` (e.g. via `ProtectedRoute` redirect), `AuthView` attempts to call `zoomSdk.authorize()` which fails outside the Zoom client. The "Connect with Zoom" button on `AuthView` should detect browser context and redirect to the Marketplace install URL (`/api/auth/start`) instead of calling SDK methods.
- **`/welcome` onboarding could show upcoming meetings** — After a successful Marketplace install, the `/welcome` screen currently shows static "Next Steps" instructions. It should fetch the user's upcoming Zoom meetings (via `GET /api/zoom-meetings`) and display them with auto-open toggles, prompting the user to enable auto-open so Arlo launches automatically in their next meetings. This would make the post-install experience more actionable.
- **HomeView doesn't know RTMS status until WebSocket connects** — When RTMS auto-starts before the app is opened, HomeView shows a generic "Meeting in Progress / View Meeting" card because `rtmsActive` is false (the WebSocket only connects when InMeetingView mounts). The user must tap "View Meeting" to navigate to InMeetingView, where the WebSocket connects, detects the ongoing session, and loads historical segments. A future improvement could connect the WebSocket at the MeetingContext level (not just InMeetingView) so HomeView can detect RTMS status and auto-navigate.

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
