# Arlo Meeting Assistant — Project Status

**Last Updated:** 2026-02-12
**Version:** v1.0
**Spec:** See [`/SPEC.md`](../SPEC.md) for the authoritative feature specification and version milestones.

---

## Overview

Open-source Zoom Apps starter kit for building intelligent meeting assistants using RTMS (Real-Time Media Streams) — no meeting bot required.

**Current state:** The v1.0 UI overhaul is complete. The frontend has been decomposed from a monolithic component into a multi-view architecture with HashRouter, 9 views, 5 context providers, and a shared AppShell. In-client OAuth PKCE is working, OS dark mode detection is implemented, and new API endpoints support the home dashboard. See [SPEC.md](../SPEC.md) for the full feature inventory.

---

## Technology Decisions

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Runtime** | Node.js 20+ | Best ecosystem for Zoom SDK and RTMS |
| **Frontend** | React 18 + CRA 5 | Industry standard, Zoom App compatible |
| **UI Library** | `@base-ui/react` + plain CSS | Unstyled, accessible, CSS custom properties |
| **Routing** | `react-router-dom@6` (HashRouter) | Hash-based routing safe for Zoom iframe |
| **Icons** | `lucide-react` | Lightweight, tree-shakeable icon library |
| **Fonts** | Source Serif 4 + Inter (self-hosted) | Zoom WebView blocks Google CDN fonts |
| **Backend** | Express.js (JavaScript) | Simple, flexible, well-documented |
| **Database** | PostgreSQL 15+ | Full-text search (GIN index), JSON support |
| **ORM** | Prisma | Type-safe, great migrations, modern |
| **AI Provider** | OpenRouter | Free models (Gemini Flash), no API key required |
| **RTMS SDK** | `@zoom/rtms` v1.0.2 | Class-based Client API, multi-meeting support |
| **Auth** | Zoom OAuth (PKCE) | Native to platform, httpOnly session cookies |
| **Containerization** | Docker Compose | Easy local dev, portable |

### Open Questions

| Question | Options | Status |
|----------|---------|--------|
| Redis required? | Redis vs in-memory | Testing needed (currently in-memory) |
| File storage for VTT | Local disk vs S3 | Starting with local |
| Vector DB for RAG? | pgvector vs FTS only | Starting without (FTS works well) |
| Deployment target | Railway, Render, Fly.io | Document all options |

---

## Code Statistics

- **Backend:** ~2,850 lines (7 route files, 3 services, middleware) — JavaScript/Express
- **Frontend:** ~3,200 lines (9 views, 5 contexts, 1 hook, 6 UI primitives, 7 shared components) — React 18 + `@base-ui/react` + plain CSS
- **RTMS:** ~370 lines (ingestion worker) — @zoom/rtms v1.0.2
- **Documentation:** 15+ guides including reusable Zoom Apps skills
- **Total:** ~6,400+ lines of production-quality code

---

## Progress Summary

### Completed

- Project foundation (monorepo, Docker Compose, Prisma schema, env config)
- Zoom OAuth PKCE flow with encrypted token storage
- RTMS integration (webhook handlers, transcript ingestion, @zoom/rtms v1.0.2)
- Live transcript display with WebSocket broadcast (< 1s latency)
- AI features: summary, action items, chat Q&A (OpenRouter)
- Auto-suggestions at configurable meeting duration
- Meeting history, rename, delete
- Highlights CRUD with timestamps and tags
- Full-text search (PostgreSQL GIN index)
- WebVTT export
- Frontend UI migration to `@base-ui/react` (Feb 2026)
- README, ARCHITECTURE.md, TROUBLESHOOTING.md, CLAUDE.md
- **v1.0 multi-view architecture** — HashRouter, 9 views, 5 context providers, AppShell with shared header
- **In-client OAuth PKCE flow** — `useZoomAuth` hook, session restoration via `GET /api/auth/me`, JWT fallback
- **OS dark mode detection** with localStorage override and theme toggle
- **Self-hosted fonts** — Source Serif 4 + Inter WOFF2 files (Zoom WebView blocks Google CDN)
- **New API endpoints** — `/api/home/highlights`, `/api/home/reminders`, `/api/ai/summary`, `/api/meetings/:id/export/markdown`
- **UI primitives** — Button, Card, Badge, Input, Textarea, LoadingSpinner
- **LiveMeetingBanner** — "Return to live transcript" sticky banner
- **MeetingCard** — Reusable meeting card component with live badge support

### Not Yet Done

- Automated tests (manual testing only)
- CI pipeline
- Demo video
- Security audit
- GitHub issue templates
- End-to-end fresh install test
- Post-meeting standalone web app (v1.5 goal)

---

## Next Actions

1. [ ] End-to-end testing on fresh install
2. [ ] Add basic smoke tests
3. [ ] Add GitHub issue templates
4. [ ] Create demo video
5. [ ] Security audit (OWASP checklist)
6. [ ] Public launch

---

## Related Documentation

- [`/SPEC.md`](../SPEC.md) — Feature specification and version milestones
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System architecture details
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) — Common issues and fixes
- [`/CLAUDE.md`](../CLAUDE.md) — Claude Code quick reference
