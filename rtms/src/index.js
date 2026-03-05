require('dotenv').config({ path: '../../.env' });
const express = require('express');
const crypto = require('crypto');
const rtmsModule = require('@zoom/rtms');
const rtms = rtmsModule.default; // ES module default export
const axios = require('axios');

// Logging is now configured via ZM_RTMS_LOG_LEVEL env var (e.g. "debug")

const app = express();

/**
 * Verify Zoom webhook HMAC signature
 */
function verifyWebhookSignature(req) {
  const signature = req.headers['x-zm-signature'];
  const timestamp = req.headers['x-zm-request-timestamp'];
  const secret = process.env.ZOOM_CLIENT_SECRET || process.env.ZM_RTMS_SECRET;

  if (!secret) {
    console.warn('No webhook secret configured — skipping HMAC verification');
    return true; // Allow if not configured (dev mode)
  }

  if (!signature || !timestamp) {
    return false;
  }

  // Reject if timestamp is more than 5 minutes old (replay protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    console.warn('Webhook timestamp too old — possible replay attack');
    return false;
  }

  const message = `v0:${timestamp}:${JSON.stringify(req.body)}`;
  const expectedSignature = 'v0=' + crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Middleware
app.use(express.json());

// Store active RTMS sessions — each meeting gets its own Client instance
const activeSessions = new Map();

// =============================================================================
// RTMS WEBHOOK HANDLER
// =============================================================================

/**
 * POST /webhook
 * Receive RTMS webhooks from Zoom
 */
app.post('/webhook', async (req, res) => {
  const { event, payload } = req.body;

  // Skip HMAC verification for URL validation (uses its own mechanism)
  // Also skip for internally forwarded requests from the backend (already verified)
  const isInternal = req.headers['x-arlo-internal'] === 'true';
  if (event !== 'endpoint.url_validation' && !isInternal) {
    if (!verifyWebhookSignature(req)) {
      console.error('Webhook signature verification failed');
      return res.status(401).send('Unauthorized');
    }
  }

  console.log('='.repeat(60));
  console.log(`RTMS Webhook Received: ${event}`);
  console.log('='.repeat(60));
  console.log(JSON.stringify(payload, null, 2));

  // Acknowledge webhook immediately
  res.status(200).send('OK');

  try {
    switch (event) {
      case 'meeting.rtms_started':
        await handleRTMSStarted(payload);
        break;

      case 'meeting.rtms_stopped':
        await handleRTMSStopped(payload);
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
  }
});

/**
 * Handle RTMS started event — creates a new Client per meeting
 */
async function handleRTMSStarted(payload) {
  const {
    meeting_uuid,
    rtms_stream_id,
    server_urls,
    operator_id
  } = payload;

  console.log('Starting RTMS session...');
  console.log(`Meeting UUID: ${meeting_uuid}`);
  console.log(`Stream ID: ${rtms_stream_id}`);
  console.log(`Server URLs: ${server_urls}`);
  console.log(`Operator ID: ${operator_id || 'not provided'}`);

  // Check if already connected to this meeting (prevent duplicate webhook handling)
  if (activeSessions.has(meeting_uuid)) {
    console.log('Already connected to this meeting, ignoring duplicate webhook');
    return;
  }

  try {
    // Create a new Client instance for this meeting (v1.0 class-based API)
    const client = new rtms.Client();

    // Set up transcript data handler BEFORE joining
    // v1.0 callback signature: (data, timestamp, metadata, user)
    // user: { userId, userName }
    client.onTranscriptData((data, timestamp, metadata, user) => {
      try {
        const text = data.toString('utf-8');
        console.log('Raw transcript event:');
        console.log(`  Text: ${text}`);
        console.log(`  Timestamp: ${timestamp}`);
        console.log(`  User:`, user);

        // Mark first transcript received — boundary between initial roster and real joins
        const session = activeSessions.get(meeting_uuid);
        if (session && !session.firstTranscriptReceived) {
          session.firstTranscriptReceived = true;
          console.log('First transcript received — subsequent joins are real joins');
        }

        // Record participant name from transcript for leave event lookup
        if (user?.userId && user?.userName) {
          if (session) session.participantNames.set(String(user.userId), user.userName);
        }

        const transcriptData = {
          text,
          timestamp,
          userId: user?.userId,
          userName: user?.userName,
        };

        handleTranscript(meeting_uuid, transcriptData).catch(err => {
          console.error('Error handling transcript:', err);
        });
      } catch (err) {
        console.error('Error processing transcript buffer:', err);
      }
    });

    // Set up join confirmation handler
    client.onJoinConfirm((reason) => {
      console.log('Joined RTMS session, reason:', reason);
    });

    // Set up leave handler — v1.0 now receives a reason parameter
    client.onLeave((reason) => {
      console.log('RTMS Connection Closed, reason:', reason);
      activeSessions.delete(meeting_uuid);
    });

    // Set up session update handler — v1.0 receives (event, session) object
    client.onSessionUpdate((event, session) => {
      console.log('Session update:', event, session);
    });

    // Set up participant event handler — renamed from onUserUpdate in v1.0
    client.onParticipantEvent((event, timestamp, participants) => {
      console.log('Participant event:', event, timestamp, participants);

      const session = activeSessions.get(meeting_uuid);

      // Suppress leave events fired during RTMS shutdown — SDK teardown artifacts
      if (session?.stopping && (event === 'leave' || event === 'user_leave')) {
        console.log('Suppressing leave events during RTMS shutdown');
        return;
      }

      const isJoin = event === 'join' || event === 'user_join';

      // Always record participant names from join events for later lookup
      if (isJoin && session) {
        (participants || []).forEach(p => {
          const pid = p.participantId ? String(p.participantId) : (p.userId ? String(p.userId) : null);
          const name = p.userName || p.name;
          if (pid && name) session.participantNames.set(pid, name);
        });
      }

      // Classify join events: before first transcript = initial roster, after = real join.
      // The RTMS SDK always reports existing participants as "join" before transcript data flows.
      const events = (participants || []).map(p => {
        const pid = p.participantId ? String(p.participantId) : (p.userId ? String(p.userId) : null);
        // Look up display name: prefer SDK-provided name, fall back to stored name
        const name = p.userName || p.name || session?.participantNames.get(pid) || `Participant ${pid || 'unknown'}`;

        let eventType;
        if (isJoin) {
          eventType = (session && !session.firstTranscriptReceived) ? 'initial_roster' : 'joined';
        } else if (event === 'leave' || event === 'user_leave') {
          eventType = 'left';
        } else {
          eventType = event;
        }

        return {
          eventType,
          participantName: name,
          participantId: pid,
          timestamp: Date.now(),
        };
      });

      if (events.length > 0) {
        broadcastParticipantEvents(meeting_uuid, events).catch(err => {
          console.error('Error forwarding participant events:', err);
        });
      }
    });

    // Store session info BEFORE joining to prevent duplicate handling
    activeSessions.set(meeting_uuid, {
      client,
      stopping: false,
      firstTranscriptReceived: false, // Set true on first transcript — used to classify initial roster vs real joins
      participantNames: new Map(), // userId → displayName lookup
      streamId: rtms_stream_id,
      startTime: new Date(),
      operatorId: operator_id || null,
      seqCounter: 0, // Atomic counter for transcript sequence numbers
    });

    // Join the RTMS session — v1.0 no longer uses pollInterval
    const result = client.join({
      meeting_uuid,
      rtms_stream_id,
      server_urls,
    });

    console.log('Join result:', result);

    // Notify backend that RTMS is active
    await notifyBackend(meeting_uuid, 'rtms_started', operator_id);

  } catch (error) {
    console.error('Failed to start RTMS:', error);
    console.error('Stack:', error.stack);
    activeSessions.delete(meeting_uuid);
  }
}

/**
 * Handle RTMS stopped event
 */
async function handleRTMSStopped(payload) {
  const { meeting_uuid } = payload;

  console.log(`Stopping RTMS for meeting: ${meeting_uuid}`);

  const session = activeSessions.get(meeting_uuid);
  if (session) {
    try {
      // Set stopping flag to suppress false leave events during teardown
      session.stopping = true;
      session.client.leave();
      activeSessions.delete(meeting_uuid);
      console.log('RTMS session stopped');
    } catch (error) {
      console.error('Error stopping RTMS:', error);
    }
  }

  // Notify backend (backend handles marking meeting as completed)
  await notifyBackend(meeting_uuid, 'rtms_stopped');
}

/**
 * Handle individual transcript segment
 */
async function handleTranscript(meetingId, transcript) {
  const { text, timestamp, userId, userName } = transcript;

  const session = activeSessions.get(meetingId);
  const seqNo = session ? ++session.seqCounter : Date.now();
  const now = Date.now();

  const segment = {
    speakerId: userId ? String(userId) : 'unknown',
    speakerLabel: userName || (userId ? `Speaker ${userId}` : 'Speaker'),
    text: text || '',
    tStartMs: now,
    tEndMs: now,
    seqNo: seqNo,
  };

  await broadcastSegment(meetingId, segment);
  console.log(`Broadcast segment: "${(text || '').substring(0, 50)}..."`);
}

/**
 * Broadcast segment to WebSocket clients via backend
 */
async function broadcastSegment(meetingId, segment) {
  try {
    // Use Docker service name for inter-container communication
    const backendUrl = process.env.BACKEND_URL || 'http://backend:3000';
    await axios.post(`${backendUrl}/api/rtms/broadcast`, {
      meetingId,
      segment,
    });
    console.log('Sent to backend for broadcast');
  } catch (error) {
    // Non-critical, just log
    console.warn('Failed to broadcast segment:', error.message);
  }
}

/**
 * Broadcast participant events to frontend via backend
 */
async function broadcastParticipantEvents(meetingId, events) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://backend:3000';
    await axios.post(`${backendUrl}/api/rtms/participant-event`, {
      meetingId,
      events,
    });
    console.log(`Sent ${events.length} participant events to backend for broadcast`);
  } catch (error) {
    console.warn('Failed to broadcast participant events:', error.message);
  }
}

/**
 * Notify backend of RTMS status change
 */
async function notifyBackend(meetingId, status, operatorId) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://backend:3000';
    await axios.post(`${backendUrl}/api/rtms/status`, {
      meetingId,
      status,
      ...(operatorId && { operatorId }),
    });
    console.log(`Notified backend: ${status}`);
  } catch (error) {
    console.warn('Failed to notify backend:', error.message);
  }
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: activeSessions.size,
    sessions: Array.from(activeSessions.keys()),
  });
});

// =============================================================================
// START SERVER
// =============================================================================

const PORT = process.env.RTMS_PORT || 3002;

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('Arlo Meeting Assistant RTMS Service');
  console.log('='.repeat(60));
  console.log(`Port: ${PORT}`);
  console.log(`Webhook: http://localhost:${PORT}/webhook`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log('='.repeat(60));
  console.log('Waiting for RTMS webhooks from Zoom...');
  console.log('='.repeat(60));
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`${signal} received. Closing RTMS sessions...`);
  for (const [meetingId, session] of activeSessions) {
    try {
      session.stopping = true;
      session.client.leave();
      console.log(`Closed RTMS session for meeting: ${meetingId}`);
    } catch (err) {
      console.error(`Error closing session ${meetingId}:`, err.message);
    }
  }
  activeSessions.clear();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
