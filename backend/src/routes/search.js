const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, devAuthBypass } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Apply auth middleware to all routes
// IMPORTANT: devAuthBypass must run BEFORE requireAuth so it can set req.user in dev mode
router.use(devAuthBypass); // Allow dev mode query param bypass
router.use(requireAuth);

/**
 * GET /api/search
 * Full-text search across transcripts
 */
router.get('/', async (req, res) => {
  try {
    const { q, meeting_id, from, to, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Missing search query (q parameter)' });
    }

    console.log(`🔍 Searching for: "${q}"`);

    // Build meeting filter for authenticated user
    const meetingWhere = {
      ownerId: req.user.id,
      ...(meeting_id && { id: meeting_id }),
      ...(from && { startTime: { gte: new Date(from) } }),
      ...(to && { startTime: { lte: new Date(to) } }),
    };

    // Use PostgreSQL full-text search for better performance
    // This queries the GIN index created in the migration
    const segments = await prisma.$queryRaw`
      SELECT
        ts.id,
        ts.meeting_id as "meetingId",
        ts.speaker_id as "speakerId",
        ts.t_start_ms as "tStartMs",
        ts.t_end_ms as "tEndMs",
        ts.text,
        ts.confidence,
        m.id as "meeting.id",
        m.title as "meeting.title",
        m.start_time as "meeting.startTime",
        s.label as "speaker.label",
        s.display_name as "speaker.displayName",
        ts_rank(to_tsvector('english', ts.text), plainto_tsquery('english', ${q})) as rank
      FROM transcript_segments ts
      INNER JOIN meetings m ON ts.meeting_id = m.id
      LEFT JOIN speakers s ON ts.speaker_id = s.id
      WHERE
        to_tsvector('english', ts.text) @@ plainto_tsquery('english', ${q})
        AND m.owner_id = ${req.user.id}
        ${meeting_id ? prisma.Prisma.sql`AND m.id = ${meeting_id}` : prisma.Prisma.empty}
        ${from ? prisma.Prisma.sql`AND m.start_time >= ${new Date(from)}` : prisma.Prisma.empty}
        ${to ? prisma.Prisma.sql`AND m.start_time <= ${new Date(to)}` : prisma.Prisma.empty}
      ORDER BY rank DESC, m.start_time DESC, ts.t_start_ms ASC
      LIMIT ${parseInt(limit)}
    `;

    // Transform raw SQL results to match expected format
    const formattedSegments = segments.map(seg => ({
      id: seg.id,
      meetingId: seg.meetingId,
      speakerId: seg.speakerId,
      tStartMs: seg.tStartMs,
      tEndMs: seg.tEndMs,
      text: seg.text,
      confidence: seg.confidence,
      meeting: {
        id: seg['meeting.id'],
        title: seg['meeting.title'],
        startTime: seg['meeting.startTime'],
      },
      speaker: seg['speaker.label'] ? {
        label: seg['speaker.label'],
        displayName: seg['speaker.displayName'],
      } : null,
    }));

    // Fallback to basic search if full-text search fails
    // This handles cases where the database doesn't have the GIN index yet
    const finalSegments = segments.length > 0 ? formattedSegments : await prisma.transcriptSegment.findMany({
      where: {
        text: {
          contains: q,
          mode: 'insensitive',
        },
        meeting: meetingWhere,
      },
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
    const results = finalSegments.map((segment) => {
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
        tStartMs: segment.tStartMs.toString(),
        tEndMs: segment.tEndMs.toString(),
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
