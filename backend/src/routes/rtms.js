const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();
const config = require('../config');
const { broadcastTranscriptSegment, broadcastMeetingStatus, getStats } = require('../services/websocket');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Cache for meeting IDs -> database meeting records
const meetingCache = new Map();

/**
 * POST /api/rtms/webhook
 * Receive RTMS webhooks from Zoom
 */
router.post('/webhook', async (req, res) => {
  console.log('🎯 HIT /api/rtms/webhook route!');
  console.log('🎯 Full URL:', req.originalUrl);
  console.log('🎯 Headers:', JSON.stringify(req.headers, null, 2));

  const { event, payload } = req.body;

  // Handle Zoom webhook validation (endpoint URL validation)
  if (event === 'endpoint.url_validation') {
    const { plainToken } = payload;
    console.log('📨 Webhook validation request received');

    // Hash the plainToken with client secret and client ID
    const hash = crypto
      .createHmac('sha256', config.zoomClientSecret)
      .update(plainToken)
      .digest('hex');

    console.log('✅ Webhook validation response sent');
    return res.status(200).json({
      plainToken,
      encryptedToken: hash,
    });
  }

  console.log(`📨 RTMS Webhook: ${event}`, JSON.stringify(payload, null, 2));

  // Forward webhook to RTMS service
  if (event === 'meeting.rtms_started' || event === 'meeting.rtms_stopped') {
    try {
      const rtmsServiceUrl = process.env.RTMS_SERVICE_URL || 'http://rtms:3002';
      await axios.post(`${rtmsServiceUrl}/webhook`, req.body, {
        timeout: 5000,
      });
      console.log(`✅ Forwarded ${event} to RTMS service`);
    } catch (error) {
      console.error(`❌ Failed to forward webhook to RTMS service:`, error.message);
      // Don't fail the webhook - Zoom expects 200 response
    }
  }

  // Acknowledge webhook immediately
  res.status(200).send('OK');
});

/**
 * POST /api/rtms/status
 * Receive RTMS status updates from RTMS service
 */
router.post('/status', async (req, res) => {
  const { meetingId, status, meetingTopic } = req.body;

  console.log(`📡 RTMS Status Update: ${status} for meeting ${meetingId}`);
  console.log(`📡 Request body:`, JSON.stringify(req.body, null, 2));

  try {
    if (status === 'rtms_started') {
      console.log('💾 Attempting to create/find meeting record...');
      // Create or find the meeting record
      let dbMeeting = await prisma.meeting.findFirst({
        where: { zoomMeetingId: meetingId },
      });

      if (!dbMeeting) {
        // Create a system user if needed (for meetings without authenticated user)
        let systemUser = await prisma.user.findFirst({
          where: { zoomUserId: 'system' },
        });

        if (!systemUser) {
          systemUser = await prisma.user.create({
            data: {
              zoomUserId: 'system',
              email: 'system@arlo-meeting-assistant.local',
              displayName: 'System',
            },
          });
          console.log('✅ Created system user for meeting storage');
        }

        dbMeeting = await prisma.meeting.create({
          data: {
            zoomMeetingId: meetingId,
            title: meetingTopic || `Meeting ${new Date().toLocaleDateString()}`,
            startTime: new Date(),
            status: 'ongoing',
            ownerId: systemUser.id,
          },
        });
        console.log(`✅ Created meeting record: ${dbMeeting.id}`);
      }

      // Cache the meeting ID mapping
      meetingCache.set(meetingId, dbMeeting.id);

    } else if (status === 'rtms_stopped') {
      // Mark meeting as completed
      const dbMeetingId = meetingCache.get(meetingId);
      if (dbMeetingId) {
        await prisma.meeting.update({
          where: { id: dbMeetingId },
          data: {
            status: 'completed',
            endTime: new Date(),
          },
        });
        console.log(`✅ Marked meeting ${dbMeetingId} as completed`);
        meetingCache.delete(meetingId);
      }
    }
  } catch (error) {
    console.error('❌ Database error in status update:', error.message);
    console.error('❌ Full error:', error);
    // Don't fail the request - we still want to broadcast
  }

  // Broadcast status change to WebSocket clients
  const sentCount = broadcastMeetingStatus(meetingId, status);
  console.log(`📡 Broadcast status to ${sentCount} clients`);

  res.status(200).json({ received: true, broadcast: sentCount });
});

/**
 * POST /api/rtms/broadcast
 * Receive transcript segments from RTMS service to broadcast to clients
 */
router.post('/broadcast', async (req, res) => {
  const { meetingId, segment } = req.body;
  const stats = getStats();

  console.log(`📝 Transcript segment for meeting ${meetingId}:`, segment?.text?.substring(0, 50));

  // Broadcast transcript segment to all WebSocket clients immediately
  const sentCount = broadcastTranscriptSegment(meetingId, segment);
  console.log(`📡 Broadcast transcript to ${sentCount} clients`);

  // Save to database in the background (don't block the response)
  console.log('💾 Starting background save of transcript segment...');
  saveTranscriptSegment(meetingId, segment).catch(err => {
    console.error('❌ Failed to save transcript segment:', err.message);
    console.error('❌ Full error:', err);
  });

  res.status(200).json({ received: true, broadcast: sentCount });
});

/**
 * Save transcript segment to database
 */
async function saveTranscriptSegment(zoomMeetingId, segment) {
  // Get the database meeting ID from cache
  let dbMeetingId = meetingCache.get(zoomMeetingId);

  // If not in cache, try to find it in the database
  if (!dbMeetingId) {
    const dbMeeting = await prisma.meeting.findFirst({
      where: { zoomMeetingId: zoomMeetingId },
    });
    if (dbMeeting) {
      dbMeetingId = dbMeeting.id;
      meetingCache.set(zoomMeetingId, dbMeetingId);
    } else {
      console.log('⚠️ No meeting record found for segment, skipping save');
      return;
    }
  }

  // Find or create speaker
  let speaker = null;
  if (segment.speakerId && segment.speakerId !== 'unknown') {
    speaker = await prisma.speaker.findFirst({
      where: {
        meetingId: dbMeetingId,
        zoomParticipantId: segment.speakerId,
      },
    });

    if (!speaker) {
      speaker = await prisma.speaker.create({
        data: {
          meetingId: dbMeetingId,
          label: segment.speakerLabel || `Speaker`,
          zoomParticipantId: segment.speakerId,
          displayName: segment.speakerLabel,
        },
      });
    }
  }

  // RTMS sends timestamps in microseconds, convert to milliseconds
  const tStartMs = Math.floor((segment.tStartMs || 0) / 1000);
  const tEndMs = Math.floor((segment.tEndMs || 0) / 1000);

  // Save transcript segment (upsert to handle duplicates)
  await prisma.transcriptSegment.upsert({
    where: {
      meetingId_seqNo: {
        meetingId: dbMeetingId,
        seqNo: BigInt(segment.seqNo || Date.now()),
      },
    },
    create: {
      meetingId: dbMeetingId,
      speakerId: speaker?.id,
      tStartMs: tStartMs, // Converted to milliseconds
      tEndMs: tEndMs,     // Converted to milliseconds
      seqNo: BigInt(segment.seqNo || Date.now()),
      text: segment.text || '',
      confidence: segment.confidence,
    },
    update: {
      text: segment.text || '',
      tEndMs: tEndMs, // Converted to milliseconds
    },
  });

  console.log(`💾 Saved transcript segment to database (${tStartMs}ms - ${tEndMs}ms)`);
}

/**
 * GET /api/rtms/debug
 * Debug endpoint to check WebSocket connections
 */
router.get('/debug', (req, res) => {
  const stats = getStats();
  console.log('🔍 WebSocket Debug Stats:', stats);
  res.json(stats);
});

/**
 * POST /api/rtms/debug-meeting
 * Debug endpoint to log what meeting ID the frontend is trying to connect with
 */
router.post('/debug-meeting', (req, res) => {
  const { meetingId, source, fullContext } = req.body;
  console.log(`🔍 DEBUG: Meeting ID from ${source || 'unknown'}: "${meetingId}"`);
  console.log(`🔍 DEBUG: Full meeting context:`, JSON.stringify(fullContext, null, 2));
  if (fullContext) {
    console.log(`🔍 DEBUG: Context keys:`, Object.keys(fullContext));
  }
  res.json({ received: meetingId, contextKeys: fullContext ? Object.keys(fullContext) : [] });
});

module.exports = router;
