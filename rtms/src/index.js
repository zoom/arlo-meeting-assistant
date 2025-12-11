require('dotenv').config({ path: '../../.env' });
const express = require('express');
const rtmsModule = require('@zoom/rtms');
const rtms = rtmsModule.default; // ES module default export
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

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

  try {
    // Set up transcript data handler
    rtms.onTranscriptData((data) => {
      console.log('📝 Raw transcript event:', JSON.stringify(data, null, 2));
      handleTranscript(meeting_uuid, data).catch(err => {
        console.error('Error handling transcript:', err);
      });
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

    // Join the RTMS session
    const result = rtms.join({
      uuid: meeting_uuid,
      stream_id: rtms_stream_id,
      gateway: server_urls,
    });

    console.log('✅ Join result:', result);

    // Store session info
    activeSessions.set(meeting_uuid, {
      streamId: rtms_stream_id,
      startTime: new Date(),
    });

    // Notify backend that RTMS is active
    await notifyBackend(meeting_uuid, 'rtms_started');

  } catch (error) {
    console.error('❌ Failed to start RTMS:', error);
    console.error('Stack:', error.stack);
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

  try {
    const {
      participant_id,
      sequence,
      timestamp_start,
      timestamp_end,
      text,
      confidence,
    } = transcript;

    // Get or create meeting
    let meeting = await prisma.meeting.findFirst({
      where: { zoomMeetingId: meetingId },
    });

    if (!meeting) {
      // Create meeting if it doesn't exist
      // Note: In production, this should be done when RTMS starts
      // and should include proper owner/title info
      meeting = await prisma.meeting.create({
        data: {
          zoomMeetingId: meetingId,
          title: `Meeting ${meetingId}`,
          startTime: new Date(),
          status: 'ongoing',
          ownerId: 'system', // Placeholder - should be actual user ID
        },
      });
      console.log('✅ Created new meeting:', meeting.id);
    }

    // Get or create speaker
    let speaker = await prisma.speaker.findFirst({
      where: {
        meetingId: meeting.id,
        zoomParticipantId: participant_id,
      },
    });

    if (!speaker) {
      const speakerCount = await prisma.speaker.count({
        where: { meetingId: meeting.id },
      });

      speaker = await prisma.speaker.create({
        data: {
          meetingId: meeting.id,
          zoomParticipantId: participant_id,
          label: `Speaker ${speakerCount + 1}`,
        },
      });
      console.log('✅ Created new speaker:', speaker.id);
    }

    // Create transcript segment (with idempotency check)
    const existing = await prisma.transcriptSegment.findFirst({
      where: {
        meetingId: meeting.id,
        seqNo: BigInt(sequence),
      },
    });

    if (!existing) {
      await prisma.transcriptSegment.create({
        data: {
          meetingId: meeting.id,
          speakerId: speaker.id,
          tStartMs: timestamp_start || 0,
          tEndMs: timestamp_end || 0,
          seqNo: BigInt(sequence),
          text: text,
          confidence: confidence || null,
        },
      });

      console.log(`✅ Saved segment #${sequence}: "${text.substring(0, 50)}..."`);

      // Broadcast to WebSocket clients
      await broadcastSegment(meeting.id, {
        speakerId: speaker.id,
        speakerLabel: speaker.label,
        text,
        tStartMs: timestamp_start,
        tEndMs: timestamp_end,
        seqNo: sequence,
      });
    }

  } catch (error) {
    console.error('❌ Error handling transcript:', error);
  }
}

/**
 * Broadcast segment to WebSocket clients via backend
 */
async function broadcastSegment(meetingId, segment) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    await axios.post(`${backendUrl}/api/rtms/broadcast`, {
      meetingId,
      segment,
    });
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
  console.log(`🎙️  Meeting Assistant RTMS Service`);
  console.log('='.repeat(60));
  console.log(`Port: ${PORT}`);
  console.log(`Webhook: http://localhost:${PORT}/webhook`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log('='.repeat(60));
  console.log('Waiting for RTMS webhooks from Zoom...');
  console.log('='.repeat(60));
});
