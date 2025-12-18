# Arlo Meeting Assistant - Project Status

**Last Updated:** 2024-12-10
**Project State:** 🚀 **Planning & Architecture Complete**
**Target:** Open-source starter kit for building meeting assistants as Zoom Apps (no bots!)

---

## 📋 Project Vision

### Goal
Create an open-source "Arlo Meeting Assistant Starter Kit" that demonstrates how to build intelligent meeting assistants **as Zoom Apps** using Real-Time Media Streams (RTMS) - **without requiring a meeting bot**.

### Target Audience
- Note-taking companies (Otter, Fireflies, etc.)
- Meeting intelligence developers
- Enterprise IT teams
- Developers exploring RTMS capabilities

### Key Message
> **"You don't need a bot. Build a meeting assistant AS A ZOOM APP."**

---

## 🎯 Version Roadmap

### Version 0.5 - MVP Demo (Target: 2-3 weeks)
**Goal:** Functional demo showing core RTMS + AI capabilities

**Features:**
- ✅ Live transcript display in Zoom App
- ✅ Basic meeting detail view
- ✅ Simple meetings list
- ✅ "Ask about transcript" Q&A
- ✅ In-meeting AI suggestions (button-triggered)

**Tech Stack:**
- Frontend: React + Zoom Apps SDK
- Backend: Node.js + Express + Postgres
- AI: OpenRouter (free models)

**Out of Scope for v0.5:**
- ❌ Advanced search
- ❌ VTT export
- ❌ Highlights/bookmarks
- ❌ Real-time auto-suggestions (50min trigger)

---

### Version 1.0 - Production Ready (Target: 4-6 weeks)
**Goal:** Self-hostable, production-quality starter kit

**New Features:**
- ✅ Full-text search across all transcripts
- ✅ WebVTT export
- ✅ Meeting highlights with timestamps
- ✅ Action items extraction with owners
- ✅ Auto-suggestions at 50min mark
- ✅ Chat with all transcripts (RAG)
- ✅ User-friendly deployment docs

**Improvements:**
- ✅ Polished UI/UX
- ✅ Error handling & reconnection logic
- ✅ Performance optimization (< 1s latency)
- ✅ Docker Compose setup
- ✅ Comprehensive documentation

---

### Version 2.0 - Advanced Features (Future)
**Goal:** Enterprise-ready with advanced intelligence

**Planned Features:**
- 📋 Background task extraction (post-meeting)
- 📋 Multi-language support
- 📋 Custom AI model integration
- 📋 Workspace/team features (shared meetings)
- 📋 Calendar integration (auto-start on scheduled meetings)
- 📋 Risk/compliance signals (for specific industries)

---

## 🏗️ Implementation Phases

### Phase 1: Foundation Setup ⏳ NOT STARTED
**Duration:** 3-5 days

**Backend:**
- [x] Project structure (monorepo with /backend, /frontend)
- [ ] Express server setup with TypeScript
- [ ] Postgres + Prisma schema
- [ ] Environment configuration (.env.example)
- [ ] Docker Compose (Postgres + Redis optional)
- [ ] Health check endpoints

**Frontend (Zoom App):**
- [ ] React app with Zoom Apps SDK
- [ ] SDK initialization & configuration
- [ ] OAuth flow (in-client PKCE)
- [ ] Basic UI shell with Tailwind + shadcn/ui

**Deliverables:**
- ✅ App loads in Zoom client
- ✅ Database migrations run
- ✅ Docker Compose starts all services
- ✅ OAuth flow completes successfully

---

### Phase 2: RTMS Integration ⏳ NOT STARTED
**Duration:** 4-6 days

**Features:**
- [ ] RTMS WebSocket client (connect to Zoom)
- [ ] Transcript event parsing & normalization
- [ ] Speaker identification & mapping
- [ ] Segment buffering & reordering
- [ ] Batch write to Postgres (50-100 segments)
- [ ] WebSocket server for broadcasting to clients
- [ ] Live transcript display in Zoom App
- [ ] "Follow Live" toggle
- [ ] Connection status indicators

**Testing:**
- [ ] Start RTMS via `zoomSdk.callZoomApi('startRTMS')`
- [ ] Verify transcript appears in UI within 1s
- [ ] Test reconnection after network drop
- [ ] Verify segments persist in database

**Deliverables:**
- ✅ Live captions display in meeting (< 1s P95 latency)
- ✅ Transcript segments stored in database
- ✅ WebSocket updates work reliably
- ✅ Start/stop RTMS controls functional

---

### Phase 3: Post-Meeting Web App ⏳ NOT STARTED
**Duration:** 3-4 days

**Features:**
- [ ] Next.js app setup (separate from Zoom App)
- [ ] Landing page with "Sign in with Zoom"
- [ ] `/home` - Dashboard with recent meetings
- [ ] `/meetings` - List of past meetings (table view)
- [ ] `/meetings/[id]` - Meeting detail with transcript
- [ ] Transcript viewer (virtualized scrolling)
- [ ] Basic inline search
- [ ] VTT export endpoint

**UI Components:**
- [ ] MeetingsTable with search/sort/filter
- [ ] TranscriptViewer with timestamps
- [ ] SearchBar with debounce
- [ ] MeetingSummary panel

**Deliverables:**
- ✅ Users can browse past meetings
- ✅ Click meeting → see full transcript
- ✅ Download VTT file works
- ✅ Responsive design (desktop + tablet)

---

### Phase 4: AI Integration (OpenRouter) ⏳ NOT STARTED
**Duration:** 4-5 days

**Features:**
- [ ] OpenRouter integration (free models)
- [ ] RAG pipeline (full-text search → context window)
- [ ] Chat interface on `/home`
- [ ] "Suggest Next Steps" button in Zoom App
- [ ] Prompt templates (summary, action-items, decisions)
- [ ] SSE streaming for chat responses
- [ ] Citation extraction & display

**Prompt Engineering:**
```javascript
Templates:
- summary.prompt      → Meeting summary
- action-items.prompt → Extract tasks with owners
- next-steps.prompt   → Suggest follow-up actions
- decisions.prompt    → Identify key decisions
```

**Testing:**
- [ ] Ask "What did I commit to this week?" → Returns structured results
- [ ] Click citation → Jumps to transcript timestamp
- [ ] Free model works without API key
- [ ] Rate limiting prevents abuse

**Deliverables:**
- ✅ Chat with transcripts works (RAG)
- ✅ AI suggestions in-meeting functional
- ✅ Citations link to transcript timestamps
- ✅ Free tier works (10 requests/min)

---

### Phase 5: Real-Time AI Suggestions ⏳ NOT STARTED
**Duration:** 2-3 days

**Features:**
- [ ] "Suggest Next Steps" button (always visible)
- [ ] Auto-trigger at 50min mark (configurable)
- [ ] Non-intrusive notification UI
- [ ] Action items extraction during meeting
- [ ] Owner assignment suggestions
- [ ] Key decisions highlighting

**UX Flow:**
```javascript
// Button states
Initial: "Suggest Next Steps" (gray)
At 50min: Badge appears → "Ready" (blue pulse)
User clicks: Loading → Results display
Auto-trigger: Notification → "View Suggestions"
```

**Deliverables:**
- ✅ Button triggers AI analysis
- ✅ Auto-suggestion at 50min works
- ✅ Results display clearly in-meeting
- ✅ User can dismiss/save suggestions

---

### Phase 6: Highlights & Action Items ⏳ NOT STARTED
**Duration:** 3-4 days

**Features:**
- [ ] Create highlight during meeting
- [ ] Mark important moments with notes
- [ ] Highlights panel in meeting detail
- [ ] Action items table (Owner | Task | Due | Source)
- [ ] Click timestamp → Jump to transcript
- [ ] Edit/delete highlights

**Data Model:**
```javascript
Highlight: {
  tStartMs, tEndMs,
  title, notes, tags[],
  createdBy: userId
}

ActionItem: {
  description,
  owner: name,
  dueDate?,
  status: 'pending' | 'done',
  sourceMeetingId,
  sourceTStartMs
}
```

**Deliverables:**
- ✅ Users can create highlights in-meeting
- ✅ Highlights visible on meeting detail page
- ✅ Action items extracted from transcript
- ✅ Table view with clickable timestamps

---

### Phase 7: Search & Export ⏳ NOT STARTED
**Duration:** 2-3 days

**Features:**
- [ ] Full-text search across all meetings
- [ ] Search filters (date range, meeting, speaker)
- [ ] Search results with snippets + timestamps
- [ ] Jump to timestamp from search results
- [ ] Export VTT (WebVTT format)
- [ ] Export JSON (full meeting data)

**Search Implementation:**
```sql
-- Postgres full-text search
CREATE INDEX transcript_text_idx
ON transcript_segments
USING GIN (to_tsvector('english', text));

-- Query
SELECT * FROM transcript_segments
WHERE to_tsvector('english', text) @@ to_tsquery('action & items')
ORDER BY ts_rank(...) DESC
LIMIT 20;
```

**Deliverables:**
- ✅ Search finds keywords across meetings
- ✅ Results include context snippets
- ✅ VTT export validates in video players
- ✅ JSON export includes all metadata

---

### Phase 8: Polish & Documentation ⏳ NOT STARTED
**Duration:** 3-4 days

**Technical Polish:**
- [ ] Error handling & user-friendly messages
- [ ] Loading states & skeleton screens
- [ ] Reconnection logic (WebSocket + RTMS)
- [ ] Rate limiting with clear feedback
- [ ] Performance optimization
- [ ] Security audit (OWASP checklist)

**Documentation:**
- [ ] README.md with quick start
- [ ] SETUP.md (step-by-step installation)
- [ ] DEPLOYMENT.md (self-hosting guide)
- [ ] SDK_SETUP.md (Zoom Marketplace config)
- [ ] RTMS_GUIDE.md (transcript ingestion details)
- [ ] AI_INTEGRATION.md (OpenRouter setup)
- [ ] TROUBLESHOOTING.md (common issues)
- [ ] API_REFERENCE.md (REST + WebSocket)

**Developer Experience:**
- [ ] Docker Compose one-command setup
- [ ] Environment variable documentation
- [ ] Sample .env.example with all options
- [ ] Seed script with sample meetings
- [ ] Development workflow guide

**Deliverables:**
- ✅ Complete documentation set
- ✅ One-command local setup
- ✅ Production deployment guide
- ✅ Troubleshooting covers 90% of issues

---

### Phase 9: Testing & QA ⏳ NOT STARTED
**Duration:** 2-3 days

**Test Coverage:**
- [ ] Unit tests (key business logic)
- [ ] Integration tests (API endpoints)
- [ ] E2E tests (Playwright/Cypress)
- [ ] Load test (100 concurrent meetings)
- [ ] Security tests (auth, XSS, SQL injection)

**Test Scenarios:**
```javascript
// Critical paths
✅ User signs in with Zoom
✅ User starts meeting → RTMS auto-starts
✅ Live transcript displays < 1s
✅ User asks AI question → Gets answer with citations
✅ User creates highlight → Persists to DB
✅ User searches meetings → Finds correct results
✅ User exports VTT → File downloads correctly
✅ Connection drops → Reconnects gracefully
```

**Deliverables:**
- ✅ 80%+ test coverage
- ✅ All critical paths tested
- ✅ Performance meets targets
- ✅ No security vulnerabilities

---

### Phase 10: Demo & Marketing ⏳ NOT STARTED
**Duration:** 2-3 days

**Demo Assets:**
- [ ] Demo video (3-5 minutes)
- [ ] Screenshots for README
- [ ] Architecture diagrams
- [ ] Sample meeting transcripts

**Marketing:**
- [ ] Blog post announcement
- [ ] Developer Forum post
- [ ] Social media posts
- [ ] Product Hunt launch (optional)

**Deliverables:**
- ✅ Professional demo video
- ✅ GitHub repo ready for public release
- ✅ Marketing materials ready
- ✅ Launch plan documented

---

## 🎯 Success Criteria

### Technical Metrics

| Metric | Target | Status |
|--------|--------|--------|
| End-to-end latency (RTMS → UI) | < 1s P95 | ⏳ Not tested |
| AI suggestion generation | < 5s P90 | ⏳ Not tested |
| Search query response | < 400ms P95 | ⏳ Not tested |
| WebSocket connections supported | 500+ per instance | ⏳ Not tested |
| Concurrent meetings supported | 100+ | ⏳ Not tested |
| Database query performance | < 100ms P95 | ⏳ Not tested |

### Feature Checklist (v1.0)

**Core Features:**
- [ ] Live transcript display in Zoom App
- [ ] Post-meeting transcript viewing
- [ ] Meetings list with search
- [ ] Full-text search across transcripts
- [ ] VTT export
- [ ] Meeting highlights
- [ ] Action items extraction

**AI Features:**
- [ ] Chat with transcripts (RAG)
- [ ] In-meeting AI suggestions
- [ ] Auto-suggestions at 50min
- [ ] Citations with timestamps
- [ ] Free model tier (works without API key)

**Developer Experience:**
- [ ] One-command Docker setup
- [ ] Complete documentation
- [ ] Self-hosting guide
- [ ] Troubleshooting guide
- [ ] Clear architecture docs

---

## 🛠️ Technology Decisions

### Confirmed Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Runtime** | Node.js 20+ | Best ecosystem for Zoom SDK & RTMS |
| **Frontend Framework** | React 18 + Next.js 14 | Industry standard, great DX |
| **Backend Framework** | Express.js | Simple, flexible, well-documented |
| **Database** | PostgreSQL 15+ | Full-text search, JSON support, mature |
| **ORM** | Prisma | Type-safe, great migrations, modern |
| **UI Library** | Tailwind + shadcn/ui | Fast development, customizable |
| **WebSocket** | ws + Redis pub/sub | Scalable, battle-tested |
| **AI Provider** | OpenRouter | Free models, multiple providers, easy switch |
| **Default LLM** | Gemini Flash (free) | No API key needed, good quality |
| **Auth** | Zoom OAuth (PKCE) | Native to platform, secure |
| **Containerization** | Docker Compose | Easy local dev, portable |

### Open Questions

| Question | Options | Status |
|----------|---------|--------|
| Redis required? | Redis vs in-memory | ⏳ Testing needed |
| File storage for VTT | Local disk vs S3 | ⏳ Start with local |
| Vector DB for RAG? | pgvector vs none | ⏳ Start without (FTS only) |
| Deployment target | Railway, Render, Fly.io | ⏳ Document all options |

---

## 📅 Timeline Estimate

### Optimistic (Full-time work)
- **Phase 1-2 (Foundation + RTMS):** 1 week
- **Phase 3-4 (Web App + AI):** 1 week
- **Phase 5-7 (Features + Polish):** 1 week
- **Phase 8-10 (Docs + Testing + Demo):** 1 week
- **Total:** ~4 weeks

### Realistic (Part-time, production quality)
- **Phase 1-4:** 3-4 weeks
- **Phase 5-7:** 2-3 weeks
- **Phase 8-10:** 1-2 weeks
- **Total:** **6-9 weeks**

### Current Status
- **Start Date:** TBD
- **Target v0.5:** TBD
- **Target v1.0:** TBD

---

## 👥 Team & Responsibilities

### Confirmed Team
- **Jen Brissman** - PM, requirements, UI decisions, demo video, marketing
- **Michael Harrington** - UI design, requirements, oversight
- **Lars Rosenquist** - Architecture, development
- **Chun Siong Tan (陈俊雄)** - Architecture, development

### TBD
- Backend lead?
- Frontend lead?
- Design support (Kevin Oh / Austin)?

---

## 🚧 Current Blockers

### None (Planning Phase)
- ✅ Architecture documented
- ✅ Requirements clarified
- ✅ Tech stack decided
- ✅ Roadmap defined

### Ready to Start
- ⏳ Awaiting: Team assignments
- ⏳ Awaiting: Kickoff date
- ⏳ Awaiting: Repository setup

---

## 📝 Notes & Decisions

### Key Design Decisions

**1. No Meeting Bots**
- Zoom Apps run embedded in Zoom client
- No external bot joining meetings
- Better UX, less intrusive

**2. Personal-Only (v1)**
- Each user sees only their meetings
- No team/workspace features initially
- Simplifies permissions & privacy

**3. Free AI by Default**
- OpenRouter free models work without API key
- Optional premium models for better quality
- 10 requests/min on free tier (sufficient for demos)

**4. Self-Hosted First**
- Open-source, forkable repo
- Users deploy their own instance
- Clear documentation for hosting options

**5. Real-Time Focus**
- In-meeting assistance is key differentiator
- Not just post-meeting analysis
- "Make me look smarter in real-time"

### Deferred Features (v2+)
- Team/workspace features
- Custom AI model integration
- Multi-language support
- Calendar integration (auto-start)
- Background extraction jobs
- Risk/compliance signals
- Public sharing links
- Mobile app support

---

## 🔗 Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture details
- [Arlo Meeting Assistant Starter Kit.md](../Arlo%20Meeting%20Assistant%20Starter%20Kit.md) - Original requirements doc

**Once development starts, create:**
- [ ] README.md - Quick start guide
- [ ] SETUP.md - Installation instructions
- [ ] SDK_SETUP.md - Zoom Marketplace configuration
- [ ] RTMS_GUIDE.md - Transcript ingestion details
- [ ] AI_INTEGRATION.md - OpenRouter setup
- [ ] DEPLOYMENT.md - Self-hosting guide
- [ ] TROUBLESHOOTING.md - Common issues
- [ ] API_REFERENCE.md - REST & WebSocket API docs

---

## 📊 Progress Tracking

### Overall Progress: 5% Complete
- [x] Requirements gathering
- [x] Architecture design
- [x] Tech stack selection
- [x] Roadmap definition
- [ ] Development kickoff
- [ ] Phase 1: Foundation (0%)
- [ ] Phase 2: RTMS (0%)
- [ ] Phase 3: Web App (0%)
- [ ] Phase 4: AI Integration (0%)
- [ ] Phase 5: Real-time AI (0%)
- [ ] Phase 6: Highlights (0%)
- [ ] Phase 7: Search & Export (0%)
- [ ] Phase 8: Polish & Docs (0%)
- [ ] Phase 9: Testing (0%)
- [ ] Phase 10: Demo & Launch (0%)

---

**Next Action:**
1. ✅ Finalize team assignments
2. ✅ Set kickoff date
3. ✅ Create GitHub repository
4. ✅ Begin Phase 1 (Foundation Setup)

**Questions or updates?** Update this document as the project progresses.
