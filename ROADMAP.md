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

### Alternative transcription providers
`advanced` · `rtms/src/index.js`, `backend/src/services/`, `frontend/src/views/SettingsView.js`

Zoom's built-in transcription (RTMS captions) is the default and requires no additional setup. This feature adds an opt-in mode to receive raw audio from RTMS and route it to an external transcription service instead — useful for developers who need different languages, higher accuracy, or provider-specific features.

**How it works:** Switch the RTMS `startRTMS` call to request raw audio (`rawAudio: true`). RTMS then delivers PCM audio packets (`msg_type: 14`) — base64-encoded L16 at 16kHz mono — at configurable intervals (20ms default) instead of caption text. The RTMS service streams these packets over a persistent WebSocket to the provider's real-time transcription API.

**Supported providers:** Deepgram, AssemblyAI, AWS Transcribe, Azure Speech-to-Text, Whisper (local). See [`zoom/rtms-samples/audio`](https://github.com/zoom/rtms-samples/tree/main/audio) for working integration examples covering all of these.

**Speaker attribution:** Two approaches depending on the audio stream mode:
- **Per-participant streams** — each audio packet includes `user_id`, `user_name`, and `timestamp`, giving implicit speaker diarization through stream isolation.
- **Mixed stream** (`user_id: 0`) — use active speaker change events (`msg_type: 6`, `event_type: 2`) from the RTMS signaling channel to attribute speech segments.

**Mute detection:** RTMS stops sending audio packets when a participant mutes. Use timestamp gaps to insert silence markers or skip empty intervals.

**Implementation scope:**
- RTMS service: conditionally request raw audio and forward PCM packets to the selected provider's streaming API.
- Backend: transcription service abstraction layer to normalize external provider output into the existing `TranscriptSegment` format (speaker, text, timestamps).
- Settings UI: provider selection dropdown and API key entry, extending the existing AI provider config pattern in SettingsView.

### Voice commands from transcript
`advanced` · `frontend/src/views/InMeetingView.js`, `frontend/src/contexts/MeetingContext.js`, `backend/src/routes/ai.js`, `frontend/src/views/SettingsView.js`

Arlo listens for spoken commands during a live meeting and executes them — hands-free control of the app via the transcript stream. Users say **"Arlo, [command]"** and the app detects, classifies, and executes the intent in real time.

**Activation (two modes):**
- **Wake word (default)** — When voice mode is enabled, the frontend continuously scans incoming transcript segments for the "Arlo" trigger phrase. Detection runs client-side by matching the speaker's segments against the authenticated user's speaker name/ID, so only the Arlo session owner can issue commands (other participants saying "Arlo" are ignored).
- **Push-to-command button** — A floating action button (FAB) overlaying the transcript area in `InMeetingView`. Tap to activate listening mode for the next spoken phrase — no wake word needed. Useful in noisy meetings or when wake word detection is unreliable.

**Intent classification (AI-based):**
The phrase following "Arlo" is sent to the LLM via a new `POST /api/ai/command` endpoint. The AI classifies the intent into one of the supported command categories and extracts parameters (e.g., action item text, recipient). A confidence threshold filters out low-confidence matches — ambiguous phrases are silently ignored to avoid false triggers from casual conversation that happens to include "Arlo."

**Supported command categories:**

| Category | Example commands | Execution |
|---|---|---|
| **App controls** | "Arlo, pause transcription" · "Arlo, stop recording" | Calls existing `pauseRTMS`/`stopRTMS` via MeetingContext |
| **Data mutations** | "Arlo, create an action item for this" · "Arlo, bookmark this moment" · "Arlo, rename this meeting to Q1 Planning" · "Arlo, generate a summary" | Calls existing API endpoints (`POST /api/highlights`, `PATCH /api/meetings/:id`, `POST /api/ai/summary`) |
| **Chat actions** | "Arlo, send a summary to the chat" · "Arlo, share the action items" · "Arlo, invite everyone to use the app" | Uses existing chat notice system (`zoomSdk.sendMessageToChat` for content, `zoomSdk.sendAppInvitationToAllParticipants` for invites) |
| **Queries** | "Arlo, what were the action items so far?" · "Arlo, summarize the last 10 minutes" | Sends query to AI with transcript context, response appears as an **Arlo response bubble** in the transcript |

**UI feedback (inline transcript badge):**
When a command is detected, an inline badge/chip appears in the transcript at the point where the command was spoken. The badge shows a state progression with 4 states: `recognized → executing → done` (or `failed` with reason). This keeps a visible history of all commands issued during the meeting without interrupting the transcript flow. **Destructive commands** (stop transcription, delete) show a confirmation variant with inline Confirm/Cancel buttons and a timeout before auto-dismissing.

**Arlo response bubble (queries):**
Query commands produce an **assistant-style response** inline in the transcript — visually distinct from speaker segments (different background, Arlo owl icon, no speaker attribution). This is a new transcript element type that does not currently exist and needs to be designed as a new component.

**Chat responses (per-command):**
Commands that naturally produce output for other participants (send summary, share action items, invite users) post a confirmation to the Zoom chat. Pure app-control commands (pause, stop) only show the inline badge — no chat noise.

**Settings:**
- **Voice commands toggle** (on/off) in `SettingsView` under a new "Voice Commands" section. Defaults to OFF.
- **Wake word toggle** — enable/disable always-on transcript scanning (independent of the FAB button, which is always available when voice mode is on).
- **Privacy notice** explaining that transcript content is scanned for the wake word when enabled.

**Speaker matching:**
Only transcript segments attributed to the authenticated user's speaker name/ID are scanned for commands. This relies on the existing speaker identification from RTMS transcript data. Edge case: if speaker attribution is unavailable or ambiguous, fall back to processing all segments (with the confidence threshold providing a safety net).

**Implementation scope:**
- **Frontend:** Wake word scanner in `MeetingContext` (filters incoming WebSocket segments), FAB component in `InMeetingView`, inline command badge component, Arlo response bubble component, voice commands settings section, command execution dispatcher that calls existing context methods and API endpoints.
- **Backend:** `POST /api/ai/command` endpoint — accepts a phrase plus transcript context window, returns `{ intent, category, params, confidence }`. Uses a structured prompt with the command taxonomy for reliable classification. Separate rate limit from `ai/suggest` — short per-command cooldown (5 seconds) instead of per-meeting 5-minute window.
- **SDK additions:** Add `sendAppInvitationToAllParticipants` to the capabilities config and manifest (not currently declared).
- **No new database models** — commands are ephemeral (executed and shown inline). Could optionally log to `Highlight` model for persistence.

**Known constraints and edge cases:**

- **Pause paradox** — When RTMS is paused, no transcript segments arrive, so "Arlo, resume" cannot be heard. Resume must remain a manual button tap. The "resume" command is excluded from the supported command set. Similarly, voice commands only function while on `InMeetingView` (the WebSocket connects on mount).
- **No app window control** — The Zoom Apps SDK has no method to close, minimize, or reopen the app window. Commands like "close the app" or "open the app" are not implementable — removed from scope.
- **Speaker ID format mismatch** — RTMS transcript segments carry a participant ID (`user.userId` from RTMS events) while the authenticated user has a Zoom user ID (from OAuth JWT). These may use different ID formats. Implementation must verify ID parity or fall back to display name matching. If neither is reliable, consider a calibration step where the user says "Arlo, this is me" to link their speaker ID to their session.
- **Wake word splitting across segments** — Zoom RTMS delivers transcript at variable granularity. "Arlo" may split across two consecutive segments from the same speaker (e.g., `"Arlo"` + `"pause the transcription"`). The scanner needs a segment buffer that joins consecutive same-speaker segments within a short time window (~2 seconds) before checking for the trigger phrase.
- **Wake word transcription errors** — STT may transcribe "Arlo" as "Carlo", "Harlow", "R-Lo", etc., especially with accents. Consider fuzzy matching or a small set of phonetic variants, though this increases false positive risk.
- **People named Arlo** — If a meeting participant is named Arlo, the owner addressing them ("Arlo, can you share your screen?") would trigger false detection. Speaker matching mitigates most cases but not when the owner talks to someone named Arlo. The confidence threshold is the safety net here.
- **Context-dependent commands ("this")** — Commands like "create an action item for this" need surrounding transcript context. The AI endpoint should receive a configurable context window (default: last 60 seconds / 10 segments from the same meeting) alongside the command phrase so the LLM can extract the relevant content.
- **AI classification latency** — Free OpenRouter models take 1–5 seconds for inference. The badge must show an immediate "Recognized" state the moment the wake word is detected (before the AI call), then transition to "Executing" after classification returns, then "Done"/"Failed" after execution. Design must account for this multi-second gap.
- **Rapid sequential commands** — Multiple commands in quick succession ("Arlo, bookmark this. Arlo, create an action item.") or within the same segment need a serial command queue. The UI must handle multiple badges stacking in the transcript.
- **Historical segment replay** — When `InMeetingView` mounts, historical segments are loaded from the API. The wake word scanner must only process new real-time WebSocket segments, not replayed history, to avoid re-triggering old commands.
- **Segment accumulation lift** — Currently segments only accumulate in `InMeetingView` local state. For voice commands to work across tabs (Transcript vs Arlo Assist), segment processing must be lifted into `MeetingContext` at the provider level.

**FAB design states:**

| State | Visual | When |
|---|---|---|
| Hidden | Not rendered | Voice mode OFF in settings |
| Idle | Subtle mic icon, muted color | Voice mode ON, passively listening via wake word |
| Listening | Animated ring/glow on FAB | FAB tapped, actively listening for next phrase |
| Processing | Spinner replaces mic icon | AI classifying the detected command |
| Cooldown | Briefly disabled/dimmed | Just executed, 5-second cooldown |

**Inline command badge states:**

| State | Visual | Notes |
|---|---|---|
| Recognized | Light accent chip, command text | Immediate on wake word detection |
| Executing | Spinner + "Creating action item..." | After AI classification returns |
| Done | Green check + result text | Successful execution |
| Failed | Red x + error reason | Execution error |
| Confirm (destructive) | Chip with Confirm/Cancel buttons | Stop, delete — auto-dismiss after timeout |

### Specialized UI modes
`advanced` · Frontend views, AI prompt engineering, new export formats

Create purpose-built views for specific use cases: **Healthcare** (HIPAA-aware transcript handling, clinical note generation), **Sales** (deal tracking, objection detection), **Compliance** (keyword monitoring, flag alerts), and **Webinar** (host tools, audience Q&A summaries). Each mode would customize AI prompts, highlight types, and export formats.

---

## Known Issues

- **Participant event initial roster noise** — Zoom fires a batch of `participant_joined` events when RTMS connects (initial roster). These are now filtered using a `firstTranscriptReceived` flag, but edge cases may remain when meetings have many participants or unusual join patterns.
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
