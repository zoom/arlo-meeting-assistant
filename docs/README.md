# Arlo Meeting Assistant - Project Documentation

This directory contains **project-specific documentation** for the Arlo Meeting Assistant Zoom App.

## Zoom Apps Development Guidance

For **general Zoom Apps development guidance**, including SDK setup, OAuth, RTMS, and REST API patterns, see the reusable skill documentation:

**Location:** `.claude/skills/zoom-apps/`

The skill includes:
- [Getting Started](../.claude/skills/zoom-apps/01-getting-started.md) - Marketplace setup, ngrok configuration
- [SDK Setup](../.claude/skills/zoom-apps/02-sdk-setup.md) - SDK initialization and capabilities
- [Frontend Patterns](../.claude/skills/zoom-apps/03-frontend-patterns.md) - React + SDK usage patterns
- [Backend OAuth](../.claude/skills/zoom-apps/04-backend-oauth.md) - OAuth flows, token management
- [RTMS Integration](../.claude/skills/zoom-apps/05-rtms-integration.md) - Real-time media streams
- [REST API Guide](../.claude/skills/zoom-apps/06-rest-api.md) - Making Zoom API calls
- [Security Best Practices](../.claude/skills/zoom-apps/07-security.md) - OAuth security, encryption
- [SDK Reference](../.claude/skills/zoom-apps/08-sdk-reference.md) - Complete SDK API reference

## Project-Specific Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arlo Meeting Assistant system design and architecture |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | Development roadmap and current phase status |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Arlo-specific debugging and issue resolution |

## Quick Links

- **Main Project:** See [CLAUDE.md](../CLAUDE.md) for project overview and development commands
- **Zoom Apps Skill:** See [zoom-apps.md](../.claude/skills/zoom-apps/zoom-apps.md) for the main skill entry point

## Key Differences

**This `/docs/` directory** contains documentation specific to the Arlo Meeting Assistant project - its architecture, roadmap, and project-specific troubleshooting.

**The `/skills/zoom-apps/` directory** contains reusable documentation for building any Zoom App - patterns, code templates, and best practices that apply to all Zoom Apps development.
