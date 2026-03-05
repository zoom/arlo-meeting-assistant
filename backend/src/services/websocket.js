const WebSocket = require('ws');
const url = require('url');
const { verifyToken } = require('./auth');
const prisma = require('../lib/prisma');

// Store active connections
const connections = new Map(); // meetingId -> Set of WebSocket connections
const userConnections = new Map(); // userId -> Set of WebSocket connections

/**
 * Initialize WebSocket server
 */
function initWebSocketServer(server) {
  const wss = new WebSocket.Server({
    server,
    path: '/ws',  // Only accept connections at /ws path
  });

  wss.on('connection', async (ws, req) => {
    const queryParams = url.parse(req.url, true).query;
    const { meeting_id, token } = queryParams;

    console.log('📡 New WebSocket connection attempt at', req.url);
    console.log('📡 Meeting ID from query:', meeting_id);

    // Verify token if provided, otherwise allow anonymous meeting subscription
    let userId = null;
    if (token) {
      try {
        const payload = await verifyToken(token);
        userId = payload.userId;
        console.log(`✅ WebSocket authenticated: User ${userId}`);
      } catch (error) {
        console.error('⚠️ WebSocket token verification failed:', error.message);
        // Allow connection but mark as anonymous
        console.log('📡 Allowing anonymous WebSocket connection for meeting streaming');
      }
    } else if (meeting_id) {
      // Allow token-less connections for in-meeting transcript streaming
      console.log(`📡 Anonymous WebSocket connection for meeting: ${meeting_id}`);
    } else {
      console.error('❌ WebSocket requires either token or meeting_id');
      ws.close(1008, 'Authentication required');
      return;
    }

    // Store connection
    ws.userId = userId;
    ws.meetingId = meeting_id;
    ws.isAlive = true;

    // Add to user connections
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId).add(ws);

    // Add to meeting connections if meeting_id provided
    if (meeting_id) {
      if (!connections.has(meeting_id)) {
        connections.set(meeting_id, new Set());
      }
      connections.get(meeting_id).add(ws);
      console.log(`📡 Subscribed to meeting: ${meeting_id}`);
    }

    // Heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        await handleWebSocketMessage(ws, data);
      } catch (error) {
        console.error('❌ WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: error.message,
        }));
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      console.log(`📡 WebSocket disconnected: User ${userId}`);

      // Remove from user connections
      if (userConnections.has(userId)) {
        userConnections.get(userId).delete(ws);
        if (userConnections.get(userId).size === 0) {
          userConnections.delete(userId);
        }
      }

      // Remove from meeting connections and broadcast updated presence
      const disconnectedMeetingId = ws.meetingId || meeting_id;
      if (disconnectedMeetingId && connections.has(disconnectedMeetingId)) {
        connections.get(disconnectedMeetingId).delete(ws);
        if (connections.get(disconnectedMeetingId).size === 0) {
          connections.delete(disconnectedMeetingId);
        } else {
          broadcastPresence(disconnectedMeetingId);
        }
      }

      // Also clean up cross-registered RTMS UUID connection (SDK/RTMS mismatch)
      if (ws.rtmsMeetingId && connections.has(ws.rtmsMeetingId)) {
        connections.get(ws.rtmsMeetingId).delete(ws);
        if (connections.get(ws.rtmsMeetingId).size === 0) {
          connections.delete(ws.rtmsMeetingId);
        }
      }
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      data: {
        userId,
        meetingId: meeting_id,
        timestamp: new Date().toISOString(),
      },
    }));
  });

  // Heartbeat interval (every 30 seconds)
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log('💀 Terminating inactive WebSocket connection');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  console.log('✅ WebSocket server initialized');

  return wss;
}

/**
 * Handle incoming WebSocket messages from clients
 */
async function handleWebSocketMessage(ws, data) {
  const { type, payload } = data;

  console.log(`📨 WebSocket message: ${type}`, payload);

  switch (type) {
    case 'subscribe':
      // Subscribe to a meeting
      const { meetingId, participantName, isGuest } = payload || {};
      if (meetingId) {
        // Remove from previous meeting if subscribed
        if (ws.meetingId && ws.meetingId !== meetingId && connections.has(ws.meetingId)) {
          connections.get(ws.meetingId).delete(ws);
          if (connections.get(ws.meetingId).size === 0) {
            connections.delete(ws.meetingId);
          }
        }
        ws.meetingId = meetingId;
        ws.participantName = participantName || null;
        ws.isGuest = !!isGuest;
        if (!connections.has(meetingId)) {
          connections.set(meetingId, new Set());
        }
        connections.get(meetingId).add(ws);
        ws.send(JSON.stringify({
          type: 'subscribed',
          data: { meetingId },
        }));

        // Broadcast updated presence to all viewers in this meeting
        broadcastPresence(meetingId);

        // Check current meeting status and inform the subscriber
        console.log(`📡 WS subscribe: looking up meeting by zoomMeetingId="${meetingId}"`);
        prisma.meeting.findUnique({
          where: { zoomMeetingId: meetingId },
        }).then(meeting => {
          if (!meeting && ws.userId) {
            // Fallback: SDK UUID may differ from RTMS UUID — find user's ongoing meeting
            return prisma.meeting.findFirst({
              where: { ownerId: ws.userId, status: 'ongoing' },
              orderBy: { startTime: 'desc' },
            });
          }
          return meeting;
        }).then(meeting => {
          if (!meeting) {
            console.log(`📡 WS subscribe: no meeting found for zoomMeetingId="${meetingId}"`);
            return;
          }

          // If found via fallback (different UUID), cross-register under RTMS UUID
          // so transcript broadcasts (keyed by RTMS UUID) reach this client
          if (meeting.zoomMeetingId !== meetingId) {
            const rtmsUuid = meeting.zoomMeetingId;
            console.log(`📡 WS UUID fallback: SDK "${meetingId}" → RTMS "${rtmsUuid}"`);
            if (!connections.has(rtmsUuid)) {
              connections.set(rtmsUuid, new Set());
            }
            connections.get(rtmsUuid).add(ws);
            // Track the RTMS UUID on the socket for cleanup on disconnect
            ws.rtmsMeetingId = rtmsUuid;
          }

          console.log(`📡 WS subscribe: found meeting id=${meeting.id}, status="${meeting.status}" for zoomMeetingId="${meetingId}"`);
          if (ws.readyState !== WebSocket.OPEN) return;
          if (meeting.status === 'ongoing') {
            ws.send(JSON.stringify({
              type: 'meeting.status',
              data: { meetingId, status: 'rtms_started', timestamp: new Date().toISOString() },
            }));
          } else if (meeting.status === 'completed') {
            ws.send(JSON.stringify({
              type: 'meeting.status',
              data: { meetingId, status: 'rtms_stopped', timestamp: new Date().toISOString() },
            }));
          }
        }).catch(err => {
          console.warn(`⚠️ WS subscribe: failed to look up zoomMeetingId="${meetingId}":`, err.message);
        });
      }
      break;

    case 'unsubscribe':
      // Unsubscribe from a meeting
      if (ws.meetingId && connections.has(ws.meetingId)) {
        connections.get(ws.meetingId).delete(ws);
        ws.send(JSON.stringify({
          type: 'unsubscribed',
          data: { meetingId: ws.meetingId },
        }));
        ws.meetingId = null;
      }
      break;

    case 'ping':
      // Respond to ping
      ws.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date().toISOString(),
      }));
      break;

    default:
      console.warn(`⚠️ Unknown WebSocket message type: ${type}`);
  }
}

/**
 * Broadcast presence (viewer count + list) to all connections in a meeting.
 * Deduplicates by userId so a user with multiple WS connections counts once.
 */
function broadcastPresence(meetingId) {
  if (!connections.has(meetingId)) return;

  const clients = connections.get(meetingId);
  const viewers = [];
  const seenUserIds = new Set();
  let guestCount = 0;

  clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;

    // Deduplicate authenticated users by userId
    if (client.userId) {
      if (seenUserIds.has(client.userId)) return;
      seenUserIds.add(client.userId);
    }

    if (client.isGuest) {
      guestCount++;
    }
    viewers.push({
      name: client.participantName || (client.isGuest ? 'Guest' : 'User'),
      isGuest: client.isGuest,
    });
  });

  const message = JSON.stringify({
    type: 'meeting.presence',
    data: {
      meetingId,
      viewerCount: viewers.length,
      guestCount,
      viewers,
      timestamp: new Date().toISOString(),
    },
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Broadcast message to all connections in a meeting
 */
function broadcastToMeeting(meetingId, message) {
  if (!connections.has(meetingId)) {
    console.log(`📡 No active connections for meeting ${meetingId}`);
    return 0;
  }

  const clients = connections.get(meetingId);
  const messageStr = JSON.stringify(message);
  let sentCount = 0;

  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(messageStr);
        sentCount++;
      } catch (err) {
        console.error('WebSocket send error:', err.message);
      }
    }
  });

  console.log(`📡 Broadcast to ${sentCount} clients in meeting ${meetingId}`);
  return sentCount;
}

/**
 * Broadcast message to all connections for a user
 */
function broadcastToUser(userId, message) {
  if (!userConnections.has(userId)) {
    console.log(`📡 No active connections for user ${userId}`);
    return 0;
  }

  const clients = userConnections.get(userId);
  const messageStr = JSON.stringify(message);
  let sentCount = 0;

  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
      sentCount++;
    }
  });

  console.log(`📡 Broadcast to ${sentCount} clients for user ${userId}`);
  return sentCount;
}

/**
 * Broadcast new transcript segment
 */
function broadcastTranscriptSegment(meetingId, segment) {
  return broadcastToMeeting(meetingId, {
    type: 'transcript.segment',
    data: {
      meetingId,
      segment,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Broadcast participant event (join/leave)
 */
function broadcastParticipantEvent(meetingId, event) {
  return broadcastToMeeting(meetingId, {
    type: 'participant.event',
    data: {
      meetingId,
      event,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Broadcast AI suggestion
 */
function broadcastAiSuggestion(meetingId, suggestion) {
  return broadcastToMeeting(meetingId, {
    type: 'ai.suggestion',
    data: {
      meetingId,
      suggestion,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Broadcast meeting status change
 */
function broadcastMeetingStatus(meetingId, status) {
  return broadcastToMeeting(meetingId, {
    type: 'meeting.status',
    data: {
      meetingId,
      status,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Cross-register a user's existing WS connections under an RTMS meeting UUID.
 * Called when a new RTMS session starts — the user's WS is subscribed under the
 * SDK UUID, but transcripts are broadcast under the RTMS UUID.
 */
function crossRegisterUser(userId, rtmsMeetingId) {
  if (!userConnections.has(userId)) return 0;

  const clients = userConnections.get(userId);
  if (!connections.has(rtmsMeetingId)) {
    connections.set(rtmsMeetingId, new Set());
  }

  let count = 0;
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      connections.get(rtmsMeetingId).add(ws);
      // Clean up old cross-registration if present
      if (ws.rtmsMeetingId && ws.rtmsMeetingId !== rtmsMeetingId && connections.has(ws.rtmsMeetingId)) {
        connections.get(ws.rtmsMeetingId).delete(ws);
        if (connections.get(ws.rtmsMeetingId).size === 0) {
          connections.delete(ws.rtmsMeetingId);
        }
      }
      ws.rtmsMeetingId = rtmsMeetingId;
      count++;
    }
  });

  if (count > 0) {
    console.log(`📡 Cross-registered ${count} WS connection(s) for user ${userId} under RTMS UUID "${rtmsMeetingId}"`);
  }
  return count;
}

/**
 * Get connection statistics
 */
function getStats() {
  return {
    totalConnections: Array.from(connections.values()).reduce((sum, set) => sum + set.size, 0),
    activeMeetings: connections.size,
    activeUsers: userConnections.size,
    meetingIds: Array.from(connections.keys()),
  };
}

module.exports = {
  initWebSocketServer,
  broadcastToMeeting,
  broadcastToUser,
  broadcastPresence,
  broadcastTranscriptSegment,
  broadcastParticipantEvent,
  broadcastAiSuggestion,
  broadcastMeetingStatus,
  crossRegisterUser,
  getStats,
};
