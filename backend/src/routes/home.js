const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(optionalAuth);

/**
 * GET /api/home/highlights
 * Get this week's meeting highlights for the home page
 */
router.get('/highlights', async (req, res) => {
  try {
    // Calculate start of week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    // Build where clause — require authenticated user or return empty
    if (!req.user) {
      return res.json({ highlights: [] });
    }

    const where = {
      startTime: { gte: weekStart },
      ownerId: req.user.id,
    };

    const meetings = await prisma.meeting.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: 5,
      include: {
        _count: { select: { segments: true } },
      },
    });

    const highlights = meetings
      .filter((m) => m._count.segments > 0)
      .map((m) => ({
        meetingId: m.id,
        title: m.title,
        snippet: m.summary?.overview
          ? m.summary.overview.substring(0, 120) + '...'
          : `${m._count.segments} transcript segments`,
        date: m.startTime,
      }));

    res.json({ highlights });
  } catch (error) {
    console.error('Home highlights error:', error);
    res.status(500).json({ error: 'Failed to fetch highlights' });
  }
});

/**
 * GET /api/home/reminders
 * Get action items from yesterday's meetings as reminders
 */
router.get('/reminders', async (req, res) => {
  try {
    const now = new Date();
    const yesterdayStart = new Date(now);
    yesterdayStart.setDate(now.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // Require authenticated user or return empty
    if (!req.user) {
      return res.json({ reminders: [] });
    }

    const where = {
      startTime: { gte: yesterdayStart, lte: yesterdayEnd },
      ownerId: req.user.id,
    };

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        highlights: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    // Collect highlights as reminders
    const reminders = [];
    for (const meeting of meetings) {
      for (const h of meeting.highlights) {
        reminders.push({
          task: h.title,
          notes: h.notes,
          meetingTitle: meeting.title,
          meetingId: meeting.id,
        });
      }
    }

    res.json({ reminders: reminders.slice(0, 5) });
  } catch (error) {
    console.error('Home reminders error:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

module.exports = router;
