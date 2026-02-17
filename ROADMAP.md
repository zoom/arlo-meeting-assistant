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
- [x] **Guest mode showcase** — Full guest mode implementation across 5 areas: (1) **Auto-detection** — `ZoomSdkContext` derives `isGuest` from `getUserContext().status`, `onMyUserContextChange` listener handles live elevation with SDK reconfiguration, `RootView` and `ProtectedRoute` auto-route guests to `/guest` or `/guest/:id`. (2) **GuestInMeetingView** (full rewrite) — live WebSocket-powered transcript streaming (anonymous connection, null token), chronological timeline merging segments + participant events, collapsible `<details>` summary card (overview, key decisions, action items), disabled AI chat teaser with `promptAuthorize` link, post-meeting CTA, dismissible sticky bottom CTA bar. (3) **GuestNoMeetingView** (full rewrite) — welcome page with "What is Arlo?" explainer, 3 feature cards (Mic, Sparkles, Bookmark), Guest vs Full Access comparison table, `promptAuthorize` CTA + "Continue as guest" button. (4) **Host invitation flow** — Invite dropdown in InMeetingView transport controls (`sendAppInvitationToAllParticipants` / `showAppInvitationDialog`), 3-second green check confirmation, toast notifications, conditionally shown when other participants present. (5) **Presence broadcast** — `broadcastPresence` in WebSocket server with userId deduplication, `meeting.presence` events, guest count in InMeetingView header, viewer count in GuestInMeetingView. Backend: `GET /api/meetings/by-zoom-id/:zoomMeetingId` endpoint with `optionalAuth`. Manifest: added 5 new SDK APIs (`onMyUserContextChange`, invitation APIs).

---

## Near-term (v1.0 Polish)

### README improvements
`good-first-issue`

See the Documentation TODOs section below for specific items.

---

## Medium-term (v1.1)

### Direct AI provider support
`intermediate` · `backend/src/services/openrouter.js`, `frontend/src/views/SettingsView.js`

Currently all AI features route through OpenRouter. This item adds support for calling Anthropic, OpenAI, or local LLM endpoints directly. Includes a Settings UI where users can enter their own API keys and select a preferred provider.

### Action item persistence and tracking
`intermediate` · `backend/prisma/schema.prisma`, `backend/src/services/openrouter.js`, `backend/src/routes/ai.js`, `frontend/src/views/MeetingDetailView.js`, `frontend/src/views/HomeView.js`

AI-extracted action items are currently ephemeral — every visit to the Tasks tab re-calls the LLM and produces inconsistent results. This feature persists action items to a new `ActionItem` database table, extracted during summary generation in a single consolidated LLM call (eliminating the current separate `extractActionItems` call).

**ActionItem model:** `id`, `meetingId`, `ownerId` (Arlo user), `task` (text), `assignee` (speaker name, free text — participants may not be Arlo users), `priority` (high/medium/low), `dueDate` (AI-extracted from phrases like "by Friday", or user-set), `status` (open/done/dismissed), `sourceTimestampMs` (transcript timestamp for "jump to source"), `createdAt`, `updatedAt`. Indexed on `[ownerId, status]` and `[meetingId]`.

**Editing:** Action items are AI-extracted only (users cannot create from scratch), but all fields are editable after extraction — text, assignee, priority, due date. Users can mark items done (checkbox) or dismiss irrelevant ones. New `routes/action-items.js` with `GET` (list with filters: meetingId, status, date range) and `PATCH` (edit any field).

**Key optimization:** Expand the `generateSummary()` prompt to extract action items, decisions, and topics in one LLM call instead of the current two separate calls (`generateSummary` + `extractActionItems`). This halves API usage on the free OpenRouter tier while extracting more structured data.

**Frontend:** Update MeetingDetailView Tasks tab to load persisted items from DB with inline editing UI (editable text, assignee, priority badge, due date, completion checkbox). Replace `mockActionItems` on HomeView with `GET /api/action-items?status=open&from={weekStart}`.

### Decision persistence
`intermediate` · `backend/prisma/schema.prisma`, `backend/src/services/openrouter.js`, `backend/src/routes/ai.js`

Decisions currently exist only as string arrays inside `Meeting.summary.decisions` — they can't be searched across meetings or linked to transcript timestamps. This feature extracts decisions to a new `Decision` table during summary generation (same consolidated LLM call as action items).

**Decision model:** `id`, `meetingId`, `ownerId`, `text`, `context` (surrounding discussion), `participants[]` (who was involved), `sourceTimestampMs`, `createdAt`. Indexed on `[ownerId, createdAt]`.

Decisions are displayed in MeetingDetailView Summary tab with participant attribution and included in search results (extend `/api/search` to query the Decision table as a fourth result type alongside titles, summaries, and transcripts).

### Topic extraction and recurring topic detection
`intermediate` · `backend/prisma/schema.prisma`, `backend/src/services/openrouter.js`, `backend/src/routes/home.js`, `frontend/src/views/HomeView.js`

Extract 3–5 normalized topic labels per meeting during summary generation and store in a new `MeetingTopic` table. Detect recurring topics with a SQL `GROUP BY` query where a topic appears in 2+ meetings within a time window — no additional AI calls needed.

**MeetingTopic model:** `id`, `meetingId`, `ownerId`, `topic` (normalized label like "Q3 Budget"), `weight` (topic prominence), `createdAt`. Unique on `[meetingId, topic]`.

Replaces the hardcoded `mockRecurringTopics` array in HomeView (line 28). New `GET /api/home/recurring-topics?from={date}&to={date}` endpoint returns topics ordered by cross-meeting frequency.

### Real weekly digest
`intermediate` · `backend/src/routes/home.js`, `frontend/src/views/HomeView.js` · depends on: Topic extraction

Replace the hardcoded `mockWeeklyDigest` (HomeView line 13) with a real `GET /api/home/weekly-digest` endpoint. Meeting count and total duration are computed from pure SQL. Top topics come from the `MeetingTopic` table. An optional single LLM call generates a 2-sentence weekly narrative from concatenated meeting summaries (cached per week to avoid repeated calls).

**Two modes:** (a) Stats-only (instant, no AI) — meeting count, total time, top 3 topics. (b) With narrative — adds a synthesized summary of the week's key themes and outcomes.

### ~~Web-based OAuth redirect flow~~ ✅
Implemented — `GET /api/auth/start`, `GET /api/auth/callback`, landing page, onboarding, and error views. See Known Issues for remaining gaps.

---

## Medium-term (v1.2) — Cross-Meeting Intelligence

### Cross-meeting decision log
`intermediate` · `backend/src/routes/decisions.js` (new), `frontend/src/views/` (new view or section)

A searchable, filterable list of all decisions across meetings. Users can answer "What did we decide about X?" without remembering which meeting it was in. Each decision links back to its source meeting and transcript timestamp.

New `routes/decisions.js` with paginated `GET /api/decisions` (filters: date range, search text, meeting ID). Extend `/api/search` to include decisions as a result type. Accessible from the home dashboard or app shell navigation.

### Meeting series and follow-up detection
`advanced` · `backend/prisma/schema.prisma`, `backend/src/routes/meetings.js`

Automatically detect related meetings (recurring series, follow-ups) by analyzing Zoom meeting number matches (same recurring meeting), title similarity, and participant overlap > 70%. Link meetings into threads so users can track conversation progression across sessions.

New optional `meetingSeriesId` field on the Meeting model. "Related meetings" section in MeetingDetailView. Detection uses heuristics first (no AI); optional AI enhancement compares summaries to confirm topical continuity.

### Commitment tracking and stale item detection
`intermediate` · `backend/src/routes/action-items.js`, `frontend/src/views/HomeView.js`

Surface overdue and stale action items on the home dashboard. An item is "stale" when it's been open longer than a configurable threshold (default: 7 days) or its `dueDate` has passed. A "Needs attention" section on the home shows stale items with meeting context and quick-action buttons (mark done, dismiss).

Optional enhancement: when generating a summary for a meeting with overlapping participants, include open action items from previous meetings in the prompt context and ask the LLM whether any were addressed.

### Topic trends over time
`intermediate` · `backend/src/routes/home.js`, `frontend/src/views/HomeView.js`

Extend recurring topics from a single-week snapshot to a multi-week time series. Show which topics are trending up, stable, or fading. New `GET /api/home/topic-trends?weeks=4` endpoint queries `MeetingTopic` grouped by week and topic. Frontend renders lightweight CSS-based bars or sparklines per topic — no heavy charting library. Pure SQL computation, no AI calls.

### Pre-meeting context briefing
`advanced` · `backend/src/routes/ai.js`, `frontend/src/views/InMeetingView.js`

When a user opens Arlo in a meeting, automatically surface relevant context from previous meetings with overlapping participants: open action items assigned to attendees, recent decisions, and shared topics. Displayed as a collapsible "Context" card in InMeetingView before transcript starts flowing.

New `GET /api/meetings/:id/context` endpoint queries ActionItem, Decision, and MeetingTopic tables filtered by participant overlap. Mostly DB queries; optional single LLM call to synthesize a 3-sentence briefing. Participant matching via `Speaker.displayName` against the current Zoom SDK participant list.

### Smart reminders
`intermediate` · `backend/src/routes/home.js`, `frontend/src/views/HomeView.js`

Replace the current reminders system (which returns yesterday's Highlight bookmarks via `GET /api/home/reminders`) with AI-aware reminders: overdue action items, approaching deadlines, and stale commitments. Priority ordering: overdue first, then approaching deadline, then stale. Frontend updates with priority indicators and quick-action buttons (mark done, snooze).

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

### Automatic post-meeting extraction
`intermediate` · `backend/src/services/`, `rtms/src/index.js`

Automatically trigger summary + action item + decision + topic extraction when a meeting ends (`meeting.rtms_stopped` webhook) instead of waiting for the user to view the Summary tab. This ensures the home dashboard has fresh data immediately. Includes a minimum transcript threshold (skip extraction for meetings with < 5 segments) and rate limiting for simultaneous meeting endings.

### AI-powered cross-meeting search
`advanced` · `backend/src/routes/search.js`, `backend/src/services/openrouter.js`, `frontend/src/views/SearchResultsView.js`

Extend search to support natural language questions across all meetings. Instead of keyword matching, users ask "What did we decide about the mobile app timeline?" and get an AI-synthesized answer with citations to specific meetings and transcript timestamps. New `POST /api/search/ask` endpoint. Toggle between keyword and "Ask" modes in SearchResultsView. Rate-limited (one AI call per query).

### Participant insights and analytics
`intermediate` · `backend/src/routes/meetings.js`, `frontend/src/views/MeetingDetailView.js`

Per-meeting and cross-meeting participant analytics: speaking time distribution (from `TranscriptSegment` durations), action item ownership count (from `ActionItem.assignee`), and meeting attendance patterns. Computable from existing data with no AI calls. Enhance the MeetingDetailView Participants tab with speaking time bars and action item counts.

### Summary templates and styles
`good-first-issue` · `backend/src/services/openrouter.js`, `frontend/src/views/SettingsView.js`

Allow users to choose summary styles: "Executive brief" (2–3 sentences), "Detailed notes" (full structure), "Action-focused" (decisions and items only), "Technical" (architecture emphasis). Each style modifies the system prompt in `generateSummary()`. Preference stored via `/api/preferences`, with per-meeting override in MeetingDetailView.

### Specialized UI modes
`advanced` · Frontend views, AI prompt engineering, new export formats

Create purpose-built views for specific use cases: **Healthcare** (HIPAA-aware transcript handling, clinical note generation), **Sales** (deal tracking, objection detection), **Compliance** (keyword monitoring, flag alerts), and **Webinar** (host tools, audience Q&A summaries). Each mode would customize AI prompts, highlight types, and export formats.

---

## Known Issues

- **Participant event initial roster noise** — Zoom fires a batch of `participant_joined` events when RTMS connects (initial roster). These are now filtered using a `firstTranscriptReceived` flag, but edge cases may remain when meetings have many participants or unusual join patterns.
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
