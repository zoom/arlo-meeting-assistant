# Getting Started with Zoom Apps

## Overview

This guide will help you set up and run a Zoom App from scratch. By the end, you'll have a working Zoom App running locally that can be tested in the Zoom client.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 14+** installed
- **npm or yarn** package manager
- **Zoom account** with developer access
- **Zoom Desktop Client** installed
- **ngrok** for local tunneling
- **Git** for cloning repositories

## Step 1: Create a Zoom App in Marketplace

### 1.1 Access the Marketplace

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Click **Develop** → **Build App**
3. Select **General App** and click **Create**
4. Give your app a name

### 1.2 Configure Basic Information

**App Credentials:**
- Note your **Client ID** and **Client Secret** (you'll need these)

**OAuth Information:**
- **OAuth Redirect URL:** `https://YOUR_NGROK_URL/api/zoomapp/auth`
- **OAuth Allow List:** Add your ngrok URL

### 1.3 Add Features

**Navigate to Features → Surface:**

1. **Select Products:** Check "Meetings"
2. **Home URL:** `https://YOUR_NGROK_URL`
3. **Enable Zoom App SDK:**
   - Click **+ Add APIs**
   - Add these common APIs:
     - `getMeetingContext`
     - `getMeetingParticipants`
     - `getRunningContext`
     - `getSupportedJsApis`
     - `authorize`
     - `onAuthorized`

**Navigate to Scopes:**

Add these minimum scopes:
- `zoomapp:inmeeting` - To run in meetings
- `user:read:user` - To get user information

## Step 2: Set Up Your Project

### 2.1 Project Structure

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
cd backend
npm install
```

## Step 3: Configure Environment Variables

### 3.1 Create `.env` File

```bash
cp .env.example .env
```

### 3.2 Add Your Credentials

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
2. Update **OAuth Redirect URL**
3. Add to **OAuth Allow List**
4. Update **Home URL**
5. Add to **Domain Allow List**
6. Click **Save**

## Step 5: Start Your App

### 5.1 Using Docker (Recommended)

```bash
docker-compose up --build
```

### 5.2 Manual Start

**Terminal 1 - Start Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Start Frontend:**
```bash
cd frontend
npm start
```

## Step 6: Test in Zoom Client

### 6.1 Enable Developer Tools

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
2. Click **Local Test**
3. Click **Add App Now**
4. Authorize the app

### 6.3 Open Your App

**In a Meeting:**
1. Start or join a Zoom meeting
2. Click **Apps** button in meeting controls
3. Find your app and click to open

---

# Critical Setup Requirements

This section highlights **REQUIRED** configuration steps that must be completed before the app will work.

## 1. Domain Allowlist (CRITICAL)

**Why it's needed**: The Zoom Apps SDK JavaScript library must be loaded from `appssdk.zoom.us`. Zoom requires you to explicitly allow this domain.

**How to configure**:
1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Navigate to your app
3. Go to **Features** → **Zoom App SDK**
4. Find the **Domain Allowlist** section
5. Add: `appssdk.zoom.us`
   - ⚠️ **DO NOT** include `https://` - just the domain name
   - ⚠️ **DO NOT** add a trailing slash

**What happens if you skip this**:
- The SDK script fails to load
- Browser console shows CORS errors
- App shows blank screen or "SDK not initialized" errors

**Example configuration**:
```
✅ CORRECT:   appssdk.zoom.us
❌ WRONG:     https://appssdk.zoom.us
❌ WRONG:     appssdk.zoom.us/
```

## 2. OAuth Redirect URL (REQUIRED)

**Why it's needed**: Zoom requires the OAuth redirect URL to be configured before ANY user can install the app.

**How to configure**:
1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Navigate to your app
3. Go to **Basic Information** → **OAuth** section
4. Set **Redirect URL for OAuth**: `https://your-ngrok-url.ngrok-free.app/api/zoomapp/auth`
5. Set **OAuth Allow List**: `https://your-ngrok-url.ngrok-free.app`
6. Click **Save**

**What happens if you skip this**:
- Users cannot install the app
- Installation button is disabled or shows an error

## 3. RTMS Scopes (Media Access)

**Why it's needed**: RTMS (Real-Time Media Streams) requires explicit scopes defining which media types your app can access.

**How to configure**:
1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Navigate to your app
3. Go to **Scopes** page
4. Enable the media formats your app needs:
   - ✅ **Transcripts** - For transcript access
   - ☐ **Audio** - If you need audio streams
   - ☐ **Video** - If you need video streams
5. Click **Save**

**What happens if you skip this**:
- `startRTMS()` calls will fail
- Backend logs show permission errors

## Quick Checklist

Before testing your app, verify all three are configured:

- [ ] Domain allowlist includes `appssdk.zoom.us`
- [ ] OAuth Redirect URL is set to your ngrok URL + `/api/zoomapp/auth`
- [ ] RTMS Scopes include at least "Transcripts" (if using RTMS)

## Common Errors and Solutions

### Error: "SDK not initialized" or blank screen
**Cause**: Domain allowlist missing `appssdk.zoom.us`
**Solution**: Add `appssdk.zoom.us` to domain allowlist (no https://)

### Error: Cannot install app
**Cause**: OAuth redirect URL not configured
**Solution**: Set OAuth redirect URL in app settings before installation

### Error: `startRTMS()` fails with permission error
**Cause**: RTMS scopes not configured
**Solution**: Enable required media scopes (at minimum: Transcripts)

### Error: "Invalid redirect URI"
**Cause**: OAuth redirect URL doesn't match your ngrok URL
**Solution**: Update OAuth settings with current ngrok URL

## Development Workflow

When your ngrok URL changes, update in this order:

1. Update `.env` file with new `PUBLIC_URL`
2. Restart your services
3. Update Zoom Marketplace:
   - Home URL
   - OAuth Redirect URL
   - OAuth Allow List
   - Webhook URL (if using)
4. Reinstall app in Zoom client

**Pro tip**: Consider [ngrok static domains](https://ngrok.com/docs/network-edge/domains-and-tcp-addresses/) to avoid this repetition.

## Troubleshooting

### App Won't Load in Zoom

**Check:**
- ✅ ngrok is running and URL is correct
- ✅ Home URL in Marketplace matches ngrok URL
- ✅ OAuth Allow List includes ngrok URL
- ✅ Backend is running on port 3000
- ✅ Security headers are being sent

### OAuth Redirect Fails

**Check:**
- ✅ OAuth Redirect URI in `.env` matches Marketplace
- ✅ Client ID and Secret are correct
- ✅ Backend `/api/zoomapp/auth` route exists

### SDK Methods Not Working

**Check:**
- ✅ Methods are added in Marketplace → Features → Zoom App SDK
- ✅ Methods are in `capabilities` array in `zoomSdk.config()`
- ✅ Running context supports the method

## Next Steps

- [SDK Setup Guide](./02-sdk-setup.md) - Configure the SDK
- [Frontend Patterns](./03-frontend-patterns.md) - Build UI components
- [Backend OAuth](./04-backend-oauth.md) - Implement authentication
- [RTMS Integration](./05-rtms-integration.md) - Access real-time media
