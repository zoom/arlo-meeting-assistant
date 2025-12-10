# Critical Setup Requirements

This document highlights **REQUIRED** configuration steps that must be completed before the app will work.

## Overview

Five critical requirements - three for development, two for production:

### Development Requirements (Must configure to run app):
1. ⚠️ **Domain Allowlist** - Without this, the Zoom Apps SDK won't load
2. ⚠️ **OAuth Redirect URL** - Without this, users can't install the app
3. ⚠️ **RTMS Scopes** - Without this, you can't access meeting media

### Production Blockers (Affect external participants):
4. 🚫 **Private App Limitation** - External participants cannot open private Zoom Apps
5. 🚫 **DLP Requirement** - Chat-based consent requires DLP integration (enterprise feature)

---

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

---

## 2. OAuth Redirect URL (REQUIRED BEFORE INSTALLATION)

**Why it's needed**: Even though full OAuth implementation is in Phase 6, Zoom requires the OAuth redirect URL to be configured before ANY user can install the app.

**How to configure**:
1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Navigate to your app
3. Go to **Basic Information** → **OAuth** section
4. Set **Redirect URL for OAuth**: `https://your-ngrok-url.ngrok-free.app/api/zoomapp/auth`
   - Replace `your-ngrok-url` with your actual ngrok URL
5. Set **OAuth Allow List**: `https://your-ngrok-url.ngrok-free.app`
6. Click **Save**

**What happens if you skip this**:
- Users cannot install the app
- Installation button is disabled or shows an error
- You'll see "OAuth configuration incomplete" errors

**Important notes**:
- You need to have your ngrok tunnel running BEFORE this step
- If your ngrok URL changes (e.g., after restarting ngrok), you must update this
- Free ngrok accounts get a new URL each time - consider ngrok static domains for development

**Example configuration**:
```
Redirect URL for OAuth:
https://abc123def456.ngrok-free.app/api/zoomapp/auth

OAuth Allow List:
https://abc123def456.ngrok-free.app
```

---

## 3. RTMS Scopes (Media Access Permissions)

**Why it's needed**: RTMS (Real-Time Media Streams) requires explicit scopes defining which media types your app can access (transcripts, audio, video).

**How to configure**:
1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Navigate to your app
3. Go to **Scopes** page
4. Enable the media formats your app needs:
   - ✅ **Transcripts** - For transcript-based consent demo
   - ☐ **Audio** - If you need audio streams
   - ☐ **Video** - If you need video streams
5. Click **Save**

**What happens if you skip this**:
- `startRTMS()` calls will fail
- Backend logs show permission errors
- No media streams will be available even if consent is granted

**For this consent app**:
- At minimum, enable **Transcripts** scope
- Audio and Video are optional depending on your use case

**Example configuration**:
```
✅ Transcripts    [Enabled]
☐ Audio          [Disabled - not needed for transcript-only demo]
☐ Video          [Disabled - not needed for transcript-only demo]
```

---

## Quick Checklist

Before testing your app, verify all three are configured:

- [ ] Domain allowlist includes `appssdk.zoom.us`
- [ ] OAuth Redirect URL is set to your ngrok URL + `/api/zoomapp/auth`
- [ ] RTMS Scopes include at least "Transcripts"

If any are missing, go back to Zoom Marketplace and configure them now.

---

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

---

## Troubleshooting

If you're still having issues after configuring all three:

1. **Reinstall the app** - Some settings require app reinstallation to take effect
2. **Clear browser cache** - Zoom client caches app data
3. **Check ngrok URL matches** - Ensure OAuth redirect URL matches your current ngrok tunnel
4. **Verify in browser DevTools**:
   - Network tab should show successful SDK script load from `appssdk.zoom.us`
   - Console should show "SDK Configuration Response" with no errors

---

## Development Workflow

When your ngrok URL changes (free tier), update in this order:

1. Update `.env` file with new `PUBLIC_URL`
2. Restart Docker containers: `docker-compose restart`
3. Update Zoom Marketplace:
   - Home URL: `https://new-ngrok-url/api/zoomapp/home`
   - OAuth Redirect URL: `https://new-ngrok-url/api/zoomapp/auth`
   - OAuth Allow List: `https://new-ngrok-url`
   - Webhook URL: `https://new-ngrok-url/api/webhooks/zoom`
4. Reinstall app in Zoom client
5. Reopen app in meeting

**Pro tip**: Consider [ngrok static domains](https://ngrok.com/docs/network-edge/domains-and-tcp-addresses/) to avoid this repetition.

---

## 4. Private App Limitation ⚠️ PRODUCTION BLOCKER

**Why it matters**: Private (unpublished) Zoom Apps can ONLY be used by users within your Zoom account. External participants cannot open private apps.

**The Problem**:
```
Internal User (same org):  ✅ Can open app and consent
External User (different org): ❌ Cannot open app at all
```

**Impact on this app**:
- Unanimous consent workflow breaks with external participants
- External users receive app invitation but see nothing
- RTMS cannot start without unanimous consent
- **Blocks production deployment for mixed meetings**

**Who is affected**:
- Meetings with clients from other organizations
- Meetings with partners/vendors
- Public webinars or events
- Any meeting with participants outside your Zoom account

**Solutions**:

1. **Publish to Zoom Marketplace** (Recommended long-term)
   - Makes app available to all Zoom users
   - External participants can open app
   - Requires Zoom review process (weeks)
   - Requires privacy policy, terms of service, etc.

2. **Chat-Based Consent** (Interim solution)
   - External participants type "I consent" in meeting chat
   - **BLOCKED:** Requires DLP integration (see next section)
   - Backend parses chat messages and updates consent
   - Works for all participants

3. **Manual Consent Tracking** (Quick workaround)
   - Host manually marks participants as consented
   - Host sees chat messages, clicks button
   - No Zoom prerequisites required
   - Implementation time: ~2 hours

4. **Internal-Only Model** (Not recommended)
   - Only require internal participants to consent
   - External participants ignored in consent logic
   - Legal/compliance implications

**Current Status**:
- Phase 11 (Chat-Based Consent) implemented but BLOCKED by DLP requirement
- Manual consent tracking recommended as interim solution

**See**: PROJECT_STATUS.md → Known Issues #1

---

## 5. DLP Requirement for Chat Messages ⚠️ PRODUCTION BLOCKER

**Why it matters**: The `meeting.chat_message_sent` webhook (used for chat-based consent) requires DLP to be enabled at the Zoom account level.

**The Problem**:
- Phase 11 implements chat-based consent to handle external participants
- Backend listens for `meeting.chat_message_sent` webhooks
- Zoom ONLY sends these webhooks if DLP integration is enabled
- DLP is typically an enterprise/business feature

**Technical Details**:
- **Webhook**: `meeting.chat_message_sent`
- **Prerequisite**: "Enable in-meeting chat DLP (Data Loss Prevention) integration"
- **Location**: Zoom Admin Portal → Account Management → Account Settings → Meeting → In Meeting (Advanced)
- **Access Required**: Account owner/admin permissions

**What happens if DLP is not enabled**:
- Event subscription can be added in Marketplace ✅
- Webhook appears configured correctly ✅
- Chat messages sent in meeting ✅
- **Webhook is NEVER sent by Zoom** ❌
- Backend never receives chat message events ❌
- Chat-based consent doesn't work ❌

**Testing Results** (2024-11-24):
```
✅ Added meeting.chat_message_sent to Event Subscriptions
✅ Reinstalled app
✅ Sent chat messages in meeting
✅ Backend received: meeting.participant_joined, meeting.rtms_started, etc.
❌ Backend received: meeting.chat_message_sent (NEVER sent without DLP)
❌ Zoom Marketplace webhook logs: No chat_message_sent events
```

**How to check if you have DLP**:
1. Log into Zoom Admin Portal (not Marketplace)
2. Go to Account Management → Account Settings
3. Navigate to Meeting → In Meeting (Advanced)
4. Look for "Enable in-meeting chat DLP (Data Loss Prevention) integration"
5. If you don't see this setting, you don't have DLP

**Solutions if DLP not available**:

1. **Enable DLP** (if you have enterprise account)
   - Contact Zoom account administrator
   - Request DLP integration be enabled
   - May require Zoom support assistance
   - Webhook will work immediately once enabled

2. **Manual Consent Tracking** (Recommended short-term)
   - Add host button to mark participants as consented
   - Host sees chat, manually updates consent status
   - Works today, no prerequisites
   - Implementation: ~2 hours

3. **External Web Form**
   - Send link via chat, consent via browser
   - More complex, requires authentication
   - Implementation: ~4-6 hours

4. **Publish App** (Long-term)
   - External participants can use app directly
   - No chat workaround needed
   - Weeks-long review process

**Current Status**:
- Chat consent implementation: 90% complete
- BLOCKED by DLP prerequisite
- Alternative (manual tracking) recommended

**See**:
- PROJECT_STATUS.md → Known Issues #8
- docs-from-claude/10-chat-consent-setup.md

---

## Production Considerations

For production deployment:

- Replace ngrok with a permanent domain (your company domain)
- Update all URLs to use your production domain
- Keep domain allowlist as `appssdk.zoom.us` (same for all environments)
- Configure proper SSL certificates for your domain
- Set up webhook signature verification with `ZOOM_SECRET_TOKEN`

See `PROJECT_STATUS.md` for production readiness checklist.
