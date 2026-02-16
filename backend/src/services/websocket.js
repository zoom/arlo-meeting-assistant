const WebSocket = require('ws');
const url = require('url');
const { verifyToken } = require('./auth');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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

      // Remove from meeting connections
      if (meeting_id && connections.has(meeting_id)) {
        connections.get(meeting_id).delete(ws);
        if (connections.get(meeting_id).size === 0) {
          connections.delete(meeting_id);
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
      const { meetingId } = payload;
      if (meetingId) {
        ws.meetingId = meetingId;
        if (!connections.has(meetingId)) {
          connections.set(meetingId, new Set());
        }
        connections.get(meetingId).add(ws);
        ws.send(JSON.stringify({
          type: 'subscribed',
          data: { meetingId },
        }));

        // Check current meeting status and inform the subscriber
        prisma.meeting.findFirst({
          where: { zoomMeetingId: meetingId },
          orderBy: { createdAt: 'desc' },
        }).then(meeting => {
          if (meeting && ws.readyState === WebSocket.OPEN) {
            if (meeting.status === 'ongoing') {
              ws.send(JSON.stringify({
                type: 'meeting.status',
                data: { meetingId, status: 'rtms_started', timestamp: new Date().toISOString() },
              }));
              console.log(`📡 Sent current meeting status (ongoing) to new subscriber for ${meetingId}`);
            } else if (meeting.status === 'completed') {
              ws.send(JSON.stringify({
                type: 'meeting.status',
                data: { meetingId, status: 'rtms_stopped', timestamp: new Date().toISOString() },
              }));
              console.log(`📡 Sent current meeting status (completed) to new subscriber for ${meetingId}`);
            }
          }
        }).catch(err => {
          console.warn('⚠️ Failed to check meeting status on subscribe:', err.message);
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
      ws.send(messageStr);
      sentCount++;
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
  broadcastTranscriptSegment,
  broadcastParticipantEvent,
  broadcastAiSuggestion,
  broadcastMeetingStatus,
  getStats,
};
