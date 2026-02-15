const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const { zoomGet, zoomPost, zoomDelete } = require('../services/zoomApi');
const config = require('../config');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/zoom-meetings
 * List upcoming meetings from Zoom calendar, merged with auto-open preferences
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const data = await zoomGet(req.user.id, '/users/me/meetings', { type: 'upcoming' });

    // Get user's auto-open preferences
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true },
    });
    const prefs = (user?.preferences && typeof user.preferences === 'object') ? user.preferences : {};
    const autoOpenMeetings = prefs.autoOpenMeetings || [];

    const meetings = (data.meetings || []).map((m) => ({
      id: String(m.id),
      title: m.topic || 'Untitled Meeting',
      date: m.start_time,
      duration: m.duration || 0,
      isRecurring: m.type === 8 || m.type === 3,
      zoomMeetingId: String(m.id),
      autoOpenEnabled: autoOpenMeetings.includes(String(m.id)),
    }));

    res.json({ meetings });
  } catch (error) {
    console.error('Error fetching upcoming meetings:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch upcoming meetings',
      message: error.response?.data?.message || error.message,
    });
  }
});

/**
 * POST /api/zoom-meetings/:meetingId/auto-open
 * Register auto-open for a meeting
 */
router.post('/:meetingId/auto-open', requireAuth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    console.log(`[auto-open] POST meeting=${meetingId}`);

    // Try to register with Zoom's open_apps API
    try {
      await zoomPost(req.user.id, `/meetings/${meetingId}/open_apps`, { app_id: config.zoomAppId });
    } catch (zoomErr) {
      console.error(`[auto-open] Zoom API error: ${zoomErr.response?.status} ${zoomErr.response?.data?.message || zoomErr.message}`);

      // Zoom returns 422 when the 3-app limit is reached
      if (zoomErr.response?.status === 422) {
        return res.status(422).json({
          error: 'App limit reached',
          message: 'This meeting already has 3 auto-open apps (Zoom\'s limit). Remove another app first to add Arlo.',
        });
      }
    }

    // Save to user preferences
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true },
    });
    const prefs = (user?.preferences && typeof user.preferences === 'object') ? user.preferences : {};
    const autoOpenMeetings = prefs.autoOpenMeetings || [];

    if (!autoOpenMeetings.includes(meetingId)) {
      autoOpenMeetings.push(meetingId);
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { preferences: { ...prefs, autoOpenMeetings } },
    });

    console.log(`[auto-open] Enabled for meeting=${meetingId}`);
    res.json({ success: true, meetingId, autoOpenEnabled: true });
  } catch (error) {
    console.error(`[auto-open] Failed: ${error.message}`);
    res.status(500).json({
      error: 'Failed to enable auto-open',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/zoom-meetings/:meetingId/auto-open
 * Remove auto-open for a meeting
 */
router.delete('/:meetingId/auto-open', requireAuth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    console.log(`[auto-open] DELETE meeting=${meetingId}`);

    // Try to remove from Zoom's open_apps API
    try {
      await zoomDelete(req.user.id, `/meetings/${meetingId}/open_apps/${config.zoomAppId}`);
    } catch (zoomErr) {
      console.error(`[auto-open] Zoom DELETE error: ${zoomErr.response?.status} ${zoomErr.response?.data?.message || zoomErr.message}`);
    }

    // Remove from user preferences
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true },
    });
    const prefs = (user?.preferences && typeof user.preferences === 'object') ? user.preferences : {};
    const autoOpenMeetings = (prefs.autoOpenMeetings || []).filter((id) => id !== meetingId);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { preferences: { ...prefs, autoOpenMeetings } },
    });

    console.log(`[auto-open] Disabled for meeting=${meetingId}`);
    res.json({ success: true, meetingId, autoOpenEnabled: false });
  } catch (error) {
    console.error(`[auto-open] Failed: ${error.message}`);
    res.status(500).json({
      error: 'Failed to disable auto-open',
      message: error.message,
    });
  }
});

module.exports = router;
