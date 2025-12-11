const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/search
 * Full-text search across transcripts
 */
router.get('/', async (req, res) => {
  try {
    const { userId, q, meeting_id, from, to, limit = 20 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!q) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    // Build where clause
    const where = {
      meeting: {
        ownerId: userId,
        ...(meeting_id && { id: meeting_id }),
        ...(from && { startTime: { gte: new Date(from) } }),
        ...(to && { startTime: { lte: new Date(to) } }),
      },
      text: {
        contains: q,
        mode: 'insensitive',
      },
    };

    const segments = await prisma.transcriptSegment.findMany({
      where,
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            startTime: true,
          },
        },
        speaker: {
          select: {
            label: true,
            displayName: true,
          },
        },
      },
      orderBy: [
        { meeting: { startTime: 'desc' } },
        { tStartMs: 'asc' },
      ],
      take: parseInt(limit),
    });

    // Format results with context snippets
    const results = segments.map((segment) => {
      // Get text snippet around match
      const matchIndex = segment.text.toLowerCase().indexOf(q.toLowerCase());
      const start = Math.max(0, matchIndex - 50);
      const end = Math.min(segment.text.length, matchIndex + q.length + 50);
      const snippet = (start > 0 ? '...' : '') + segment.text.substring(start, end) + (end < segment.text.length ? '...' : '');

      return {
        meetingId: segment.meeting.id,
        meetingTitle: segment.meeting.title,
        meetingDate: segment.meeting.startTime,
        segmentId: segment.id,
        speaker: segment.speaker?.displayName || segment.speaker?.label,
        tStartMs: segment.tStartMs,
        tEndMs: segment.tEndMs,
        text: segment.text,
        snippet,
      };
    });

    res.json({
      results,
      total: results.length,
      query: q,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
