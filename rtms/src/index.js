require('dotenv').config({ path: '../../.env' });
const express = require('express');
const rtmsModule = require('@zoom/rtms');
const rtms = rtmsModule.default; // ES module default export
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

// Logging is now configured via ZM_RTMS_LOG_LEVEL env var (e.g. "debug")

const app = express();
const prisma = new PrismaClient();

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
    server_urls
  } = payload;

  console.log('Starting RTMS session...');
  console.log(`Meeting UUID: ${meeting_uuid}`);
  console.log(`Stream ID: ${rtms_stream_id}`);
  console.log(`Server URLs: ${server_urls}`);

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
    });

    // Store session info BEFORE joining to prevent duplicate handling
    activeSessions.set(meeting_uuid, {
      client,
      streamId: rtms_stream_id,
      startTime: new Date(),
    });

    // Join the RTMS session — v1.0 no longer uses pollInterval
    const result = client.join({
      meeting_uuid,
      rtms_stream_id,
      server_urls,
    });

    console.log('Join result:', result);

    // Notify backend that RTMS is active
    await notifyBackend(meeting_uuid, 'rtms_started');

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
      // v1.0: call leave() on the per-meeting client instance
      session.client.leave();
      activeSessions.delete(meeting_uuid);
      console.log('RTMS session stopped');
    } catch (error) {
      console.error('Error stopping RTMS:', error);
    }
  }

  // Mark meeting as completed
  try {
    const meeting = await prisma.meeting.findFirst({
      where: { zoomMeetingId: meeting_uuid },
    });

    if (meeting) {
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: {
          status: 'completed',
          endTime: new Date(),
          duration: new Date() - new Date(meeting.startTime),
        },
      });
      console.log('Meeting marked as completed');
    }
  } catch (error) {
    console.error('Error updating meeting:', error);
  }

  // Notify backend
  await notifyBackend(meeting_uuid, 'rtms_stopped');
}

/**
 * Handle individual transcript segment
 */
async function handleTranscript(meetingId, transcript) {
  console.log('Transcript:', transcript);

  const { text, timestamp, userId, userName } = transcript;

  // FIRST: Broadcast immediately to frontend (don't wait for DB)
  const segment = {
    speakerId: userId ? String(userId) : 'unknown',
    speakerLabel: userName || (userId ? `Speaker ${userId}` : 'Speaker'),
    text: text || '',
    tStartMs: Date.now(),
    tEndMs: 0,
    seqNo: Date.now(),
  };

  // Broadcast to frontend immediately
  await broadcastSegment(meetingId, segment);
  console.log(`Broadcast segment: "${(text || '').substring(0, 50)}..."`);

  // Save to database
  try {
    // Find or create meeting (without owner for now - RTMS doesn't have user context)
    let meeting = await prisma.meeting.findFirst({
      where: { zoomMeetingId: meetingId },
    });

    if (!meeting) {
      // For RTMS-created meetings, we need a system user or skip the owner requirement
      // First, try to find or create a system user
      let systemUser = await prisma.user.upsert({
        where: { zoomUserId: 'system' },
        update: {},
        create: {
          zoomUserId: 'system',
          email: 'system@arlo.local',
          displayName: 'System',
        },
      });

      meeting = await prisma.meeting.create({
        data: {
          zoomMeetingId: meetingId,
          title: `Meeting ${new Date().toLocaleDateString()}`,
          startTime: new Date(),
          status: 'ongoing',
          ownerId: systemUser.id,
        },
      });
      console.log(`Created meeting: ${meeting.id}`);
    }

    // Find or create speaker using zoomParticipantId (correct schema field)
    const participantId = segment.speakerId || 'unknown';
    let speaker = await prisma.speaker.findFirst({
      where: {
        meetingId: meeting.id,
        zoomParticipantId: participantId,
      },
    });

    if (!speaker) {
      speaker = await prisma.speaker.create({
        data: {
          meetingId: meeting.id,
          zoomParticipantId: participantId,
          label: segment.speakerLabel || `Speaker`,
          displayName: segment.speakerLabel || userName || `Speaker`,
        },
      });
      console.log(`Created speaker: ${speaker.id}`);
    }

    // Save transcript segment
    // tStartMs is Date.now() (epoch milliseconds), store directly
    const tStartMs = segment.tStartMs || 0;
    const tEndMs = segment.tEndMs || tStartMs;

    // Use upsert to handle duplicates (both RTMS and backend may try to save)
    await prisma.transcriptSegment.upsert({
      where: {
        meetingId_seqNo: {
          meetingId: meeting.id,
          seqNo: BigInt(segment.seqNo),
        },
      },
      create: {
        meetingId: meeting.id,
        speakerId: speaker.id,
        seqNo: BigInt(segment.seqNo),
        text: segment.text,
        tStartMs: tStartMs,
        tEndMs: tEndMs,
      },
      update: {
        text: segment.text,
        tEndMs: tEndMs,
      },
    });
    console.log(`Saved segment to database (${tStartMs}ms - ${tEndMs}ms)`);

  } catch (dbError) {
    console.error('Database save error:', dbError.message);
    console.error('Stack:', dbError.stack);
  }
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
 * Notify backend of RTMS status change
 */
async function notifyBackend(meetingId, status) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    await axios.post(`${backendUrl}/api/rtms/status`, {
      meetingId,
      status,
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
