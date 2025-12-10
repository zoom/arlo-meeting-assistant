# Troubleshooting Guide

Common issues and solutions when running the Zoom Consent RTMS App.

---

## App Not Loading in Zoom Client

### Issue: Shows "Zoom App Home - OAuth will be implemented in Phase 6"

**Cause:** Old routing that returned text instead of serving the React app.

**Solution:**
1. Restart Docker services with the latest code:
   ```bash
   docker-compose down
   docker-compose up --build
   ```

2. Verify backend is proxying to frontend:
   ```bash
   docker-compose logs backend | grep "Proxying to frontend"
   ```

3. Check Home URL in Zoom Marketplace points to: `https://your-ngrok-url.ngrok-free.app/api/zoomapp/home`

### Issue: "403 Forbidden, domain or scheme is not allowed: http://frontend:3000"

**Cause:** Backend was redirecting to Docker internal address instead of proxying content.

**Why this happens:**
- `http://frontend:3000` is a Docker internal network address
- Zoom's embedded browser runs on your machine, not inside Docker
- It can only access public URLs (ngrok) or localhost
- Redirecting to Docker internal addresses violates CORS/OWASP requirements

**Solution:**
- The `/api/zoomapp/home` route now **proxies** content from frontend instead of redirecting
- The Zoom client only communicates with the backend via ngrok
- The backend fetches content from frontend internally and serves it back

**Fixed in:** `backend/src/routes/zoomapp.js` (no redirect, uses proxy middleware)

### Issue: "Invalid Host header" in Zoom App browser

**Cause:** Webpack dev server (frontend) rejects requests with ngrok Host header for security.

**Why this happens:**
- When backend proxies to frontend, the Host header is your ngrok domain (e.g., `mdh.ngrok.dev`)
- Webpack dev server only allows `localhost` by default
- This is a Create React App security feature to prevent DNS rebinding attacks

**Solution:**
- Added `DANGEROUSLY_DISABLE_HOST_CHECK=true` to frontend environment in `docker-compose.yml`
- This disables the host check for development (safe for local testing)
- In production, this won't apply since we serve built files, not webpack dev server

**How to verify the fix:**
```bash
docker-compose restart frontend
docker-compose logs frontend | grep "webpack"
```

**Fixed in:** `docker-compose.yml` (frontend environment variables)

### Issue: Blank screen when app loads

**Check:**
1. Frontend container is running:
   ```bash
   docker ps | grep frontend
   ```

2. Backend can reach frontend:
   ```bash
   docker exec -it zoom-consent-backend curl http://frontend:3000
   ```

3. Check browser console for errors (Right-click in Zoom → Inspect Element)

---

## WebSocket Not Connecting

### Issue: "Connecting to server..." never goes away

**Symptoms:**
- Yellow alert: "Connecting to server..."
- Console shows: `WebSocket connection error`

**Solutions:**

1. **Check backend is running:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Check CORS settings:**
   ```bash
   docker-compose logs backend | grep CORS
   ```

3. **Verify Socket.IO is initialized:**
   ```bash
   docker-compose logs backend | grep "WebSocket server"
   ```

4. **Restart services:**
   ```bash
   docker-compose restart backend
   ```

5. **Check ngrok is running:**
   ```bash
   curl https://your-ngrok-url.ngrok-free.app/health
   ```

---

## Redis Connection Failed

### Issue: Backend logs show "Failed to connect to Redis"

**Solutions:**

1. **Check Redis is running:**
   ```bash
   docker ps | grep redis
   ```

2. **Restart Redis:**
   ```bash
   docker-compose restart redis
   ```

3. **Check Redis logs:**
   ```bash
   docker-compose logs redis
   ```

4. **Test Redis connection:**
   ```bash
   docker exec -it zoom-consent-redis redis-cli ping
   # Should return: PONG
   ```

5. **If Redis container won't start:**
   ```bash
   docker-compose down -v  # Remove volumes
   docker-compose up --build redis
   ```

---

## Consent Not Saving

### Issue: Click "I Agree" but nothing happens

**Symptoms:**
- Button shows loading spinner
- No success confirmation
- Backend shows no logs

**Solutions:**

1. **Check browser console for errors:**
   - Right-click in Zoom app → Inspect Element
   - Look for red errors in Console tab

2. **Check network requests:**
   - In DevTools, go to Network tab
   - Click "I Agree" again
   - Look for `POST /api/consent/submit` request
   - Check if it's successful (200) or failed (4xx/5xx)

3. **Check backend is receiving request:**
   ```bash
   docker-compose logs backend | grep "CONSENT SUBMISSION"
   ```

4. **Test API directly:**
   ```bash
   curl -X POST http://localhost:3000/api/consent/submit \
     -H "Content-Type: application/json" \
     -d '{
       "meetingId": "test-meeting",
       "participantId": "test-user-123",
       "participantName": "Test User",
       "consentStatus": "agreed"
     }'
   ```

---

## Participants Not Syncing

### Issue: Participant list is empty or not updating

**Solutions:**

1. **Check initial sync ran:**
   ```bash
   docker-compose logs backend | grep "INITIAL PARTICIPANT SYNC"
   ```

2. **Verify SDK has participant access:**
   - Check browser console for `getMeetingParticipants` errors
   - Verify SDK capability is enabled in Zoom Marketplace

3. **Check if you're in a meeting:**
   - App must be opened in an active Zoom meeting
   - Won't work in Zoom client outside of meeting

4. **Force refresh participant list:**
   - Close and reopen the app in the meeting

---

## New Participant Join Not Detected

### Issue: Join a meeting but app doesn't detect new participant

**Solutions:**

1. **Check participant tracking is running:**
   ```bash
   docker-compose logs backend | grep "PARTICIPANT JOINED"
   ```

2. **Verify onParticipantChange event listener:**
   - Check browser console for participant change logs

3. **Check if app is open for new participant:**
   - New participant must open the app
   - SDK events only fire when app is running

4. **Check webhook as backup (if configured):**
   ```bash
   docker-compose logs backend | grep "participant_joined"
   ```

---

## RTMS Not Starting

### Issue: All users consent but RTMS doesn't start

**Symptoms:**
- All participants show "Agreed"
- RTMS Status still shows "Stopped"
- No "Unanimous Consent" log in backend

**Solutions:**

1. **Check unanimous consent detection:**
   ```bash
   docker-compose logs backend | grep "UNANIMOUS CONSENT"
   ```

2. **Verify all participants are tracked:**
   - Check participant list in UI
   - Ensure no participants with "Pending" status

3. **Check Redis state:**
   ```bash
   docker exec -it zoom-consent-redis redis-cli
   > GET consent:[your-meeting-uuid]
   ```
   Verify `unanimousConsent: true`

4. **Note:** In Phase 2, RTMS is simulated. Backend logs will show:
   ```
   ✅ Would call startRTMS() here (Phase 4)
   ```
   This is expected! Actual RTMS will be implemented in Phase 4.

---

## Docker Issues

### Issue: Port already in use

**Error:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions:**

1. **Find process using port:**
   ```bash
   lsof -ti:3000
   ```

2. **Kill the process:**
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

3. **Or use different port:**
   Edit `.env`:
   ```bash
   PORT=3001
   ```

### Issue: Container won't start

**Solutions:**

1. **Check container logs:**
   ```bash
   docker-compose logs [service-name]
   ```

2. **Rebuild containers:**
   ```bash
   docker-compose down
   docker-compose up --build
   ```

3. **Remove all containers and volumes:**
   ```bash
   docker-compose down -v
   docker system prune -a
   docker-compose up --build
   ```

### Issue: Changes not reflecting

**Solutions:**

1. **For frontend changes:**
   - Hot reload should work automatically
   - If not, restart: `docker-compose restart frontend`

2. **For backend changes:**
   - Nodemon should auto-restart
   - If not, restart: `docker-compose restart backend`

3. **For package.json changes:**
   ```bash
   docker-compose down
   docker-compose up --build
   ```

---

## ngrok Issues

### Issue: App stops working after restarting ngrok

**Cause:** ngrok gives you a new URL each time it restarts (free tier).

**Solutions:**

1. **Get new ngrok URL:**
   ```bash
   ngrok http 3000
   ```
   Copy the new HTTPS URL

2. **Update `.env`:**
   ```bash
   PUBLIC_URL=https://new-ngrok-url.ngrok-free.app
   ZOOM_APP_REDIRECT_URI=https://new-ngrok-url.ngrok-free.app/api/zoomapp/auth
   ```

3. **Update Zoom Marketplace:**
   - Go to your app settings
   - Update **Home URL**: `https://new-ngrok-url.ngrok-free.app/api/zoomapp/home`
   - Update **Redirect URL**: `https://new-ngrok-url.ngrok-free.app/api/zoomapp/auth`

4. **Restart backend:**
   ```bash
   docker-compose restart backend
   ```

5. **Reinstall app in Zoom:**
   - Go to Zoom Marketplace
   - Remove app
   - Install again

### Issue: ngrok shows "ERR_NGROK_108"

**Solutions:**
- Free ngrok tunnels expire after 2 hours
- Restart ngrok: `ngrok http 3000`
- Update URLs as above

---

## Zoom SDK Issues

### Issue: "zoomSdk is not defined"

**Solutions:**

1. **Check SDK script is loaded:**
   - View page source in Zoom app
   - Look for: `<script src="https://appssdk.zoom.us/sdk.min.js"></script>`

2. **Verify app is running in Zoom client:**
   - SDK only works inside Zoom
   - Won't work in regular browser

3. **Check User-Agent:**
   ```javascript
   console.log(navigator.userAgent);
   // Should contain "ZoomApps"
   ```

### Issue: SDK API not supported / Permission error

**Error:** `API not supported` or `Method not supported in current context`

**Enhanced Debugging (NEW):**

The app now includes detailed logging to show exactly which APIs are failing:

1. **Check browser console for API support logs:**
   - Look for `📋 Supported APIs:` - shows all available APIs
   - Look for `⚠️ UNSUPPORTED APIs` - shows which requested APIs are not available
   - Look for `❌ [API name] failed:` - shows exactly which API call failed

2. **Example console output:**
   ```
   ✅ SDK Configuration Response: {...}
   📋 Supported APIs: {apis: ["getMeetingContext", "getUserContext", ...]}
   ⚠️ UNSUPPORTED APIs: ["startRTMS", "stopRTMS"]
   ❌ getMeetingParticipants failed: API not supported
      Make sure "getMeetingParticipants" is enabled in Zoom Marketplace > Features > Zoom Apps SDK
   ```

3. **Enable the missing API in Zoom Marketplace:**
   - Go to Zoom Marketplace → Your App → Features
   - Click "Add APIs"
   - Search for the missing API name (shown in error logs)
   - Enable it and save changes
   - Reinstall the app in Zoom

**Common Missing APIs:**
- `getMeetingParticipants` - Required for participant list
- `onParticipantChange` - Required for real-time participant tracking
- `getMeetingContext` - Required for meeting info
- `startRTMS` / `stopRTMS` - Required for RTMS control (Phase 4)

**Solutions:**

1. **Check capability is enabled:**
   - Go to Zoom Marketplace → Your App → Features
   - Verify ALL SDK APIs from the console warning are in the list
   - The app requests these APIs:
     - getMeetingContext, getMeetingUUID, getMeetingParticipants
     - getUserContext, getRunningContext
     - onParticipantChange
     - startRTMS, stopRTMS (for Phase 4)
     - connect, postMessage, onMessage
     - showNotification

2. **Check running context:**
   ```javascript
   const { context } = await zoomSdk.getRunningContext();
   console.log('Running context:', context);
   ```
   Some methods only work `inMeeting`

3. **Check SDK version:**
   ```javascript
   // In App.js
   version: '0.16.0'  // Make sure this matches
   ```

4. **Use getSupportedJsApis() to debug:**
   The app automatically calls this and logs results. Check console for:
   - `📋 Supported APIs:` to see what's available
   - `⚠️ UNSUPPORTED APIs` to see what's missing

---

## Common Error Messages

### "Meeting context not available"

**Cause:** App opened before SDK initialized

**Solution:** Wait for SDK to initialize, or refresh app

### "Failed to submit consent"

**Causes:**
- Backend not running
- Network issue
- Invalid meeting ID

**Solution:** Check backend logs and network connection

### "Invalid participant UUID"

**Cause:** Participant tracking not initialized

**Solution:** Restart app, check initial sync logs

---

## Debugging Commands Reference

```bash
# Health checks
curl http://localhost:3000/health

# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f redis

# Check containers
docker ps

# Restart service
docker-compose restart backend

# Rebuild everything
docker-compose down
docker-compose up --build

# Check Redis
docker exec -it zoom-consent-redis redis-cli
> KEYS *
> GET consent:[meeting-uuid]
> MONITOR

# Check ports
lsof -ti:3000

# Backend API tests
curl http://localhost:3000/health
curl "http://localhost:3000/api/consent/status?meetingId=test"
```

---

## Still Having Issues?

1. **Check all prerequisites:**
   - Docker running
   - ngrok running with correct URL
   - Redis container healthy
   - All environment variables set

2. **Fresh start:**
   ```bash
   # Stop everything
   docker-compose down -v

   # Rebuild
   docker-compose up --build

   # Check logs
   docker-compose logs -f
   ```

3. **Enable debug logging:**
   Edit `.env`:
   ```bash
   LOG_LEVEL=debug
   DEBUG=true
   ```

4. **Check documentation:**
   - [README.md](../README.md) - Quick start
   - [SETUP.md](./SETUP.md) - Detailed setup
   - [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture

---

**If you find a bug, please note:**
- Exact error message
- Steps to reproduce
- Browser console logs
- Backend logs: `docker-compose logs backend`
