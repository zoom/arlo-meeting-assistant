require('dotenv').config({ path: '../../.env' });
const express = require('express');
const rtmsModule = require('@zoom/rtms');
const rtms = rtmsModule.default; // ES module default export
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

// Enable verbose logging for RTMS SDK
rtms.configureLogger({
  level: rtms.LogLevel.TRACE,
  enabled: true
});

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(express.json());

// Store active RTMS sessions
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
  console.log(`📨 RTMS Webhook Received: ${event}`);
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
        console.log(`⚠️ Unhandled webhook event: ${event}`);
    }
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
  }
});

/**
 * Handle RTMS started event
 */
async function handleRTMSStarted(payload) {
  const {
    meeting_uuid,
    operator_id,
    rtms_stream_id,
    server_urls
  } = payload;

  console.log('🚀 Starting RTMS session...');
  console.log(`Meeting UUID: ${meeting_uuid}`);
  console.log(`Stream ID: ${rtms_stream_id}`);
  console.log(`Server URLs: ${server_urls}`);

  // Check if already connected to this meeting (prevent duplicate webhook handling)
  if (activeSessions.has(meeting_uuid)) {
    console.log('⚠️ Already connected to this meeting, ignoring duplicate webhook');
    return;
  }

  try {
    // Set up transcript data handler BEFORE joining
    // Callback signature: (buffer, size, timestamp, metadata)
    rtms.onTranscriptData((buffer, size, timestamp, metadata) => {
      try {
        // Convert buffer to string (UTF-8 encoding)
        const text = buffer.toString('utf8');
        console.log('📝 Raw transcript event:');
        console.log(`  Text: ${text}`);
        console.log(`  Size: ${size}`);
        console.log(`  Timestamp: ${timestamp}`);
        console.log(`  Metadata:`, JSON.stringify(metadata, null, 2));

        // Create transcript object for handleTranscript
        const transcriptData = {
          text,
          timestamp,
          size,
          ...metadata
        };

        handleTranscript(meeting_uuid, transcriptData).catch(err => {
          console.error('Error handling transcript:', err);
        });
      } catch (err) {
        console.error('Error processing transcript buffer:', err);
      }
    });

    // Set up join confirmation handler
    rtms.onJoinConfirm((reason) => {
      console.log('✅ Joined RTMS session, reason:', reason);
    });

    // Set up leave handler
    rtms.onLeave(() => {
      console.log('📡 RTMS Connection Closed');
      activeSessions.delete(meeting_uuid);
    });

    // Set up session update handler
    rtms.onSessionUpdate((event, uuid) => {
      console.log('📡 Session update:', event, uuid);
    });

    // Set up user update handler
    rtms.onUserUpdate((event, uuid, name) => {
      console.log('👤 User update:', event, uuid, name);
    });

    // Store session info BEFORE joining to prevent duplicate handling
    activeSessions.set(meeting_uuid, {
      streamId: rtms_stream_id,
      startTime: new Date(),
    });

    // Join the RTMS session with polling enabled
    const result = rtms.join({
      meeting_uuid: meeting_uuid,
      rtms_stream_id: rtms_stream_id,
      server_urls: server_urls,
      pollInterval: 100, // Poll every 100ms for data
    });

    console.log('✅ Join result:', result);

    // Notify backend that RTMS is active
    await notifyBackend(meeting_uuid, 'rtms_started');

  } catch (error) {
    console.error('❌ Failed to start RTMS:', error);
    console.error('Stack:', error.stack);
    // Remove from active sessions on failure
    activeSessions.delete(meeting_uuid);
  }
}

/**
 * Handle RTMS stopped event
 */
async function handleRTMSStopped(payload) {
  const { meeting_uuid } = payload;

  console.log(`🛑 Stopping RTMS for meeting: ${meeting_uuid}`);

  const session = activeSessions.get(meeting_uuid);
  if (session) {
    try {
      rtms.leave();
      activeSessions.delete(meeting_uuid);
      console.log('✅ RTMS session stopped');
    } catch (error) {
      console.error('❌ Error stopping RTMS:', error);
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
      console.log('✅ Meeting marked as completed');
    }
  } catch (error) {
    console.error('❌ Error updating meeting:', error);
  }

  // Notify backend
  await notifyBackend(meeting_uuid, 'rtms_stopped');
}

/**
 * Handle individual transcript segment
 */
async function handleTranscript(meetingId, transcript) {
  console.log('📝 Transcript:', transcript);

  const {
    participant_id,
    sequence,
    timestamp_start,
    timestamp_end,
    text,
    confidence,
    userName,
    userId,
  } = transcript;

  // FIRST: Broadcast immediately to frontend (don't wait for DB)
  const segment = {
    speakerId: participant_id || String(userId) || 'unknown',
    speakerLabel: userName || `Speaker ${userId || 'Unknown'}`,
    text: text || '',
    tStartMs: timestamp_start || transcript.timestamp || 0,
    tEndMs: timestamp_end || 0,
    seqNo: sequence || Date.now(),
  };

  // Broadcast to frontend immediately
  await broadcastSegment(meetingId, segment);
  console.log(`📤 Broadcast segment: "${(text || '').substring(0, 50)}..."`);

  // Save to database
  try {
    // Find or create meeting (without owner for now - RTMS doesn't have user context)
    let meeting = await prisma.meeting.findFirst({
      where: { zoomMeetingId: meetingId },
    });

    if (!meeting) {
      // For RTMS-created meetings, we need a system user or skip the owner requirement
      // First, try to find or create a system user
      let systemUser = await prisma.user.findFirst({
        where: { email: 'system@arlo.local' },
      });

      if (!systemUser) {
        systemUser = await prisma.user.create({
          data: {
            zoomUserId: 'system',
            email: 'system@arlo.local',
            displayName: 'System',
          },
        });
        console.log(`✅ Created system user: ${systemUser.id}`);
      }

      meeting = await prisma.meeting.create({
        data: {
          zoomMeetingId: meetingId,
          title: `Meeting ${new Date().toLocaleDateString()}`,
          startTime: new Date(),
          status: 'ongoing',
          ownerId: systemUser.id,
        },
      });
      console.log(`✅ Created meeting: ${meeting.id}`);
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
      console.log(`✅ Created speaker: ${speaker.id}`);
    }

    // Save transcript segment
    await prisma.transcriptSegment.create({
      data: {
        meetingId: meeting.id,
        speakerId: speaker.id,
        seqNo: BigInt(segment.seqNo),
        text: segment.text,
        tStartMs: BigInt(segment.tStartMs || 0),
        tEndMs: BigInt(segment.tEndMs || segment.tStartMs || 0),
      },
    });
    console.log(`✅ Saved segment to database`);

  } catch (dbError) {
    console.error('❌ Database save error:', dbError.message);
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
    console.log('✅ Sent to backend for broadcast');
  } catch (error) {
    // Non-critical, just log
    console.warn('⚠️ Failed to broadcast segment:', error.message);
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
    console.log(`✅ Notified backend: ${status}`);
  } catch (error) {
    console.warn('⚠️ Failed to notify backend:', error.message);
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
  console.log(`🎙️  Arlo Meeting Assistant RTMS Service`);
  console.log('='.repeat(60));
  console.log(`Port: ${PORT}`);
  console.log(`Webhook: http://localhost:${PORT}/webhook`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log('='.repeat(60));
  console.log('Waiting for RTMS webhooks from Zoom...');
  console.log('='.repeat(60));
});
