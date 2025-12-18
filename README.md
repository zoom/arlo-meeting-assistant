# Arlo Meeting Assistant 📋

Arlo is a forkable, open-source **RTMS Meeting Assistant** that showcases how developers can build real-time, intelligent meeting experiences directly inside Zoom — **no meeting bot required!**

This project was originally created as the "Meeting Assistant Starter Kit" and has evolved into **Arlo**, a lightweight example of how to:
- Stream and display live meeting transcripts in real time
- Save transcripts to a database for meeting history
- Generate AI-powered summaries and action items
- Search across past meetings
- Extend functionality using Zoom's Real-Time Media Streams (RTMS) APIs

Arlo is designed to help developers quickly prototype and deploy their own meeting assistants as Zoom Apps.

---

## ✨ Features

- 📝 **Live Transcription** - Real-time captions via RTMS (< 1s latency)
- 🤖 **AI Insights** - Summaries, action items, next steps (OpenRouter with free models)
- 🔍 **Full-Text Search** - Search across all meeting transcripts
- 💬 **Chat with Transcripts** - RAG-based Q&A over your meetings
- 🎯 **Meeting Highlights** - Create bookmarks with timestamps
- 📤 **Export VTT** - Download WebVTT files for video players
- 🔐 **Secure** - Zoom OAuth, encrypted tokens, RLS data isolation

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **Docker** + Docker Compose ([Download](https://www.docker.com/))
- **ngrok** ([Download](https://ngrok.com/))
- **Zoom Account** with Marketplace access

### 1. Clone Repository

```bash
git clone https://github.com/your-org/arlo-meeting-assistant.git
cd arlo-meeting-assistant
```

### 2. Create Zoom App

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Click **Develop** → **Build App** → **General App**
3. Name your app (e.g., "Arlo Meeting Assistant")
4. Note your **Client ID** and **Client Secret**

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Generate secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"  # REDIS_ENCRYPTION_KEY

# Edit .env and add:
# - ZOOM_CLIENT_ID
# - ZOOM_CLIENT_SECRET
# - SESSION_SECRET (generated above)
# - REDIS_ENCRYPTION_KEY (generated above)
```

### 4. Start ngrok

```bash
ngrok http 3000
```

Copy the `https://` URL (e.g., `https://abc123.ngrok-free.app`)

### 5. Update Zoom App Configuration

In Zoom Marketplace → Your App:

**Basic Information:**
- OAuth Redirect URL: `https://your-ngrok-url.ngrok-free.app/api/auth/callback`
- OAuth Allow List: `https://your-ngrok-url.ngrok-free.app`

**Features → Zoom App SDK:**
- Add all required APIs (see [CLAUDE.md](./CLAUDE.md#required-capabilities))
- Enable RTMS → Transcripts

**Features → Surface:**
- Home URL: `https://your-ngrok-url.ngrok-free.app`
- Add to Domain Allow List: `https://your-ngrok-url.ngrok-free.app`

**Event Subscriptions:**
- Add endpoint: `https://your-ngrok-url.ngrok-free.app/rtms/webhook`
- Subscribe to: `meeting.rtms_started`, `meeting.rtms_stopped`

### 6. Update .env with ngrok URL

```bash
# Edit .env
PUBLIC_URL=https://your-ngrok-url.ngrok-free.app
```

### 7. Start Application

```bash
# Install root dependencies
npm install

# Start with Docker (recommended)
docker-compose up --build

# OR start manually
npm run setup     # Install all dependencies
npm run db:migrate  # Run database migrations
npm run dev       # Start all services
```

### 8. Test in Zoom

1. Start or join a Zoom meeting
2. Click **Apps** → Find your app
3. Click **Add App** (first time only)
4. Authorize the app
5. Click **"Start Arlo"**
6. See live transcription appear!

---

## 📚 Documentation

Comprehensive guides available in [`/docs/`](./docs/):

- **[CLAUDE.md](./CLAUDE.md)** - Quick reference for Claude Code
- **[Architecture](./docs/ARCHITECTURE.md)** - System design and data flow
- **[Project Status](./docs/PROJECT_STATUS.md)** - Roadmap and phases
- **[Quick Start](./docs/00-quick-start.md)** - Detailed setup (30 min)
- **[SDK Setup](./docs/02-sdk-setup.md)** - Zoom Apps SDK config
- **[RTMS Guide](./docs/05-rtms-guide.md)** - Real-time transcription
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Zoom Meeting                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Arlo Meeting Assistant (React + Zoom SDK)       │   │
│  └────────────────────┬─────────────────────────────┘   │
└─────────────────────────┼──────────────────────────────┘
                          │ HTTPS + WebSocket
         ┌────────────────▼────────────────┐
         │   Backend API (Express.js)      │
         │   - OAuth 2.0 (PKCE)            │
         │   - WebSocket Server            │
         │   - RTMS Ingestion              │
         └────┬───────────┬────────────────┘
              │           │
    ┌─────────▼───┐   ┌───▼──────────────┐
    │  Postgres   │   │  OpenRouter      │
    │  Database   │   │  (Free AI)       │
    └─────────────┘   └──────────────────┘
```

**Tech Stack:**
- Frontend: React 18, Zoom Apps SDK 0.16
- Backend: Node.js 20, Express, Prisma
- Database: PostgreSQL 15
- AI: OpenRouter (free models, no API key required)
- Real-time: WebSocket + RTMS SDK

---

## 🛠️ Development

### Project Structure

```
arlo-meeting-assistant/
├── backend/          # Express API server
│   ├── src/
│   │   ├── server.js       # Main server
│   │   ├── config.js       # Environment config
│   │   ├── routes/         # API routes
│   │   └── services/       # Business logic
│   └── prisma/
│       └── schema.prisma   # Database schema
│
├── frontend/         # React Zoom App
│   ├── public/
│   │   └── index.html      # Loads Zoom SDK
│   └── src/
│       ├── App.js          # SDK initialization
│       └── components/     # React components
│
├── rtms/             # RTMS transcript ingestion
│   └── src/
│       └── index.js        # Webhook handler + RTMS client
│
├── docs/             # 15 comprehensive guides
├── .env.example      # Environment variables template
├── docker-compose.yml
└── README.md
```

### Common Commands

```bash
# Start all services
docker-compose up

# View logs
docker-compose logs -f backend
docker-compose logs -f rtms

# Restart service
docker-compose restart backend

# Database operations
npm run db:migrate    # Run migrations
npm run db:studio     # Open Prisma Studio GUI
npm run db:reset      # Reset database (WARNING: deletes data)

# Clean restart
docker-compose down -v && docker-compose up --build
```

### Database Migrations

```bash
cd backend

# Create migration after schema changes
npx prisma migrate dev --name description_of_change

# Generate Prisma Client
npx prisma generate

# Reset database (development only)
npx prisma migrate reset
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] App loads in Zoom client
- [ ] OAuth flow completes
- [ ] "Start Arlo" button works
- [ ] Live transcript appears within 1s
- [ ] WebSocket connection stable
- [ ] Segments save to database
- [ ] Can scroll through transcript
- [ ] "Resume Live" button works
- [ ] Stop button ends RTMS

### Debugging

**Frontend (Zoom App):**
- Right-click in app → **Inspect Element**
- Check Console for errors
- Network tab shows API calls

**Backend:**
```bash
docker-compose logs -f backend | grep -i error
curl http://localhost:3000/health
```

**Database:**
```bash
npm run db:studio
# Opens GUI at http://localhost:5555
```

**RTMS:**
```bash
docker-compose logs -f rtms
curl http://localhost:3002/health
```

---

## 🤝 Contributing

This is an open-source starter kit designed to be forked and customized!

### How to Customize

1. **Fork this repository**
2. **Modify for your use case:**
   - Add your own AI prompts
   - Customize UI/styling
   - Add new features
   - Change AI provider
3. **Share your improvements** (optional PR)

### Feature Ideas

- Multi-language support
- Custom AI models (local LLMs)
- Team workspaces
- Calendar integration
- Video replay (like Fathom)
- Risk/compliance signals
- Background task extraction
- Public sharing links

---

## 📖 Learn More

- [Zoom Apps Documentation](https://developers.zoom.us/docs/zoom-apps/)
- [RTMS Documentation](https://developers.zoom.us/docs/rtms/)
- [Zoom Apps SDK Reference](https://appssdk.zoom.us/classes/ZoomSdk.ZoomSdk.html)
- [@zoom/rtms SDK](https://github.com/zoom/rtms)
- [OpenRouter API](https://openrouter.ai/docs)

---

## ⚖️ License

MIT License - See [LICENSE](./LICENSE) for details

---

## 💬 Support

- **Issues:** [GitHub Issues](https://github.com/your-org/arlo-meeting-assistant/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/arlo-meeting-assistant/discussions)
- **Zoom Developer Forum:** [devforum.zoom.us](https://devforum.zoom.us/)

---

## 🌟 Acknowledgments

Built with:
- [Zoom Apps SDK](https://developers.zoom.us/docs/zoom-apps/)
- [Zoom RTMS](https://developers.zoom.us/docs/rtms/)
- [React](https://react.dev/)
- [Express.js](https://expressjs.com/)
- [Prisma](https://www.prisma.io/)
- [OpenRouter](https://openrouter.ai/)

---

**Ready to build your own meeting assistant?** Star this repo ⭐ and get started!
