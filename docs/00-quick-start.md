# Quick Start Guide

## Overview

This guide will help you set up and run a Zoom App from scratch in under 30 minutes. By the end, you'll have a working Zoom App running locally that can be tested in the Zoom client.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 14+** installed ([Download](https://nodejs.org/))
- **npm or yarn** package manager
- **Zoom account** ([Sign up](https://zoom.us/signup))
- **Zoom Desktop Client** installed ([Download](https://zoom.us/download))
- **ngrok** for local tunneling ([Download](https://ngrok.com/download))
- **Redis** (optional, for production; session store falls back to memory)
- **Git** for cloning repositories

## Step 1: Create a Zoom App in Marketplace

### 1.1 Access the Marketplace

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Click **Develop** → **Build App**
3. Select **General App** and click **Create**
4. Give your app a name (e.g., "My Zoom App")

### 1.2 Configure Basic Information

**App Credentials:**
- Note your **Client ID** and **Client Secret** (you'll need these)

**OAuth Information:**
- **OAuth Redirect URL:** `https://YOUR_NGROK_URL/api/zoomapp/auth`
  - You'll update this after starting ngrok
- **OAuth Allow List:** Add your ngrok URL (e.g., `https://abc123.ngrok-free.app`)

### 1.3 Add Features

**Navigate to Features → Surface:**

1. **Select Products:** Check "Meetings"
2. **Home URL:** `https://YOUR_NGROK_URL` (update after ngrok)
3. **Enable Zoom App SDK:**
   - Click **+ Add APIs**
   - Add these common APIs:
     - `getMeetingContext`
     - `getMeetingParticipants`
     - `getRunningContext`
     - `getSupportedJsApis`
     - `authorize`
     - `onAuthorized`
     - Add others as needed for your app

**Navigate to Scopes:**

Add these minimum scopes:
- `zoomapp:inmeeting` - To run in meetings
- `user:read:user` - To get user information

Add additional scopes based on your needs:
- `meeting:read:meeting` - To read meeting data
- `meeting:write:meeting` - To create/update meetings

### 1.4 Save Your App

Click **Save** - your app is now created but not published yet.

## Step 2: Set Up Your Project

### 2.1 Clone or Create Project

**Option A: Start from the Advanced Sample (Recommended)**

```bash
git clone https://github.com/zoom/zoomapps-advancedsample-react.git my-zoom-app
cd my-zoom-app
```

**Option B: Start from Scratch**

```bash
mkdir my-zoom-app
cd my-zoom-app
npm init -y
```

If starting from scratch, you'll need to set up the project structure:
```
my-zoom-app/
├── frontend/          # React app
├── backend/           # Express server
├── rtms/              # RTMS handlers (optional)
├── .env               # Environment variables
└── docker-compose.yml # Docker setup (optional)
```

### 2.2 Install Dependencies

**Frontend:**
```bash
cd frontend
npm install
```

**Backend:**
```bash
cd ../backend
npm install
```

**RTMS (if needed):**
```bash
cd ../rtms/sdk  # or rtms/websocket
npm install
```

## Step 3: Configure Environment Variables

### 3.1 Create `.env` File

In the project root, create a `.env` file:

```bash
# Copy from example
cp .env.example .env
```

### 3.2 Add Your Credentials

Edit `.env` with your values:

```bash
# Zoom App Credentials (from Marketplace)
ZOOM_APP_CLIENT_ID=your_client_id_here
ZOOM_APP_CLIENT_SECRET=your_client_secret_here

# Public URL (will be updated after starting ngrok)
PUBLIC_URL=https://abc123.ngrok-free.app

# OAuth Redirect URI
ZOOM_APP_REDIRECT_URI=https://abc123.ngrok-free.app/api/zoomapp/auth

# Session Secret (generate a random string)
SESSION_SECRET=your_random_session_secret_here

# Redis Encryption Key (32 characters)
REDIS_ENCRYPTION_KEY=your_32_character_encryption_key

# Redis URL (optional for local dev)
REDIS_URL=redis://localhost:6379

# Server Port
PORT=3000
```

**Generate secure secrets:**
```bash
# Session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encryption key (32 characters)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

## Step 4: Start ngrok

### 4.1 Run ngrok

In a new terminal window:

```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

### 4.2 Update Configuration

Copy the `https://` URL from ngrok.

**Update `.env`:**
```bash
PUBLIC_URL=https://abc123.ngrok-free.app
ZOOM_APP_REDIRECT_URI=https://abc123.ngrok-free.app/api/zoomapp/auth
```

**Update Zoom Marketplace:**
1. Go to your app in Marketplace
2. Navigate to **Basic Information**
3. Update **OAuth Redirect URL:** `https://abc123.ngrok-free.app/api/zoomapp/auth`
4. Add to **OAuth Allow List:** `https://abc123.ngrok-free.app`
5. Navigate to **Features → Surface**
6. Update **Home URL:** `https://abc123.ngrok-free.app`
7. Add to **Domain Allow List:** `https://abc123.ngrok-free.app`
8. Click **Save**

## Step 5: Start Your App

### 5.1 Using Docker (Recommended)

If you have Docker installed:

```bash
docker-compose up --build
```

This starts:
- Frontend (React): Port 3000 proxied through backend
- Backend (Express): Port 3000
- Redis: Port 6379

### 5.2 Manual Start (Without Docker)

**Terminal 1 - Start Redis (if using):**
```bash
redis-server
```

**Terminal 2 - Start Backend:**
```bash
cd backend
npm start
# or for development with auto-reload:
npm run dev
```

**Terminal 3 - Start Frontend:**
```bash
cd frontend
npm start
```

The backend serves the built frontend, so you only need to access `http://localhost:3000`.

### 5.3 Verify It's Running

Open your browser to `http://localhost:3000` - you should see your app's frontend.

Check ngrok URL: `https://your-ngrok-url.ngrok-free.app` - should show the same.

## Step 6: Test in Zoom Client

### 6.1 Enable Developer Tools (First Time Only)

**On macOS:**
```bash
defaults write ZoomChat webview.context.menu true
```

**On Windows:**
Add to `%appdata%/Zoom/data/zoom.us.ini`:
```ini
[ZoomChat]
webview.context.menu=true
```

**Restart Zoom Client**

### 6.2 Install Your App

1. In Zoom Marketplace, navigate to your app
2. Click **Local Test** (left sidebar)
3. Click **Add App Now**
4. You'll be redirected through OAuth flow
5. Authorize the app

### 6.3 Open Your App

**In a Meeting:**
1. Start or join a Zoom meeting
2. Click **Apps** button in meeting controls
3. Find your app in the list
4. Click to open

**In Main Client:**
1. Click **Apps** in the Zoom client sidebar
2. Find your app
3. Click to open

### 6.4 Verify It Works

Your app should:
- Load in the Zoom client
- Show the UI from your frontend
- Allow you to click buttons and test features
- Console logs visible in DevTools (right-click → Inspect)

## Step 7: Common First Steps

### 7.1 Enable DevTools

Right-click anywhere in your app → **Inspect Element**

This opens Chrome DevTools where you can:
- View console logs
- Inspect network requests
- Debug JavaScript
- View element structure

### 7.2 Test SDK Methods

Try calling a simple SDK method in your app:

```javascript
// In your React component
const testSDK = async () => {
  try {
    const context = await zoomSdk.getMeetingContext()
    console.log('Meeting context:', context)
  } catch (error) {
    console.error('Error:', error)
  }
}
```

### 7.3 Test OAuth Flow

Click any button that requires user data (like "Get User Info"):
- Should trigger OAuth authorization
- Backend exchanges code for token
- User data should display

## Troubleshooting Quick Start

### App Won't Load in Zoom

**Check:**
- ✅ ngrok is running and URL is correct
- ✅ Home URL in Marketplace matches ngrok URL
- ✅ OAuth Allow List includes ngrok URL
- ✅ Backend is running on port 3000
- ✅ OWASP headers are being sent (check backend logs)

**Solution:**
```bash
# Restart ngrok and update all URLs
# Restart backend server
# Clear Zoom cache: Zoom menu → Settings → Advanced → Restart
```

### OAuth Redirect Fails

**Check:**
- ✅ OAuth Redirect URI in `.env` matches Marketplace
- ✅ Client ID and Secret are correct
- ✅ Backend `/api/zoomapp/auth` route exists

### SDK Methods Not Working

**Check:**
- ✅ Methods are added in Marketplace → Features → Zoom App SDK
- ✅ Methods are in `capabilities` array in `zoomSdk.config()`
- ✅ Running context supports the method (e.g., some only work in meetings)

### Can't See Console Logs

**Check:**
- ✅ Developer tools enabled (see Step 6.1)
- ✅ Zoom client restarted after enabling
- ✅ Right-clicking in app shows "Inspect Element"

## Next Steps

Now that your app is running:

1. **Explore the SDK** - [SDK Setup Guide](./02-sdk-setup.md)
2. **Add Features** - [Frontend Implementation Guide](./03-frontend-guide.md)
3. **Make API Calls** - [REST API Integration Guide](./08-api-integration-guide.md)
4. **Add RTMS** - [RTMS Implementation Guide](./05-rtms-guide.md)
5. **Secure Your App** - [Security Best Practices](./07-security-guide.md)

## Useful Commands Reference

```bash
# Start ngrok
ngrok http 3000

# Generate random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Start with Docker
docker-compose up --build

# Start backend (development mode)
cd backend && npm run dev

# Start frontend (development mode)
cd frontend && npm start

# View backend logs
docker-compose logs -f backend

# Stop all services
docker-compose down

# Restart Zoom client cache
# Mac: ~/Library/Application Support/zoom.us/
# Windows: %appdata%/Zoom/
```

## Development Workflow

After initial setup, your typical workflow:

1. **Start ngrok** (if URL changed, update Marketplace)
2. **Start services** (Docker or manual)
3. **Open in Zoom client**
4. **Make changes** → **Refresh app** in Zoom
5. **Check DevTools** for errors
6. **Iterate**

For detailed development practices, see [Development Workflow Guide](./09-development-workflow.md).

## Getting Help

**Issues?**
- Check [Troubleshooting Guide](./README.md#troubleshooting)
- Review [Zoom Developer Forum](https://devforum.zoom.us/)
- Check browser DevTools console
- Check backend logs

**Resources:**
- [All Documentation Guides](./README.md)
- [Zoom Apps Official Docs](https://developers.zoom.us/docs/zoom-apps/)
- [Advanced Sample Repository](https://github.com/zoom/zoomapps-advancedsample-react)
