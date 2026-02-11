const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, devAuthBypass } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Apply auth middleware to all routes
// IMPORTANT: devAuthBypass must run BEFORE requireAuth so it can set req.user in dev mode
router.use(devAuthBypass); // Allow dev mode query param bypass
// NOTE: Not using requireAuth on GET routes to allow anonymous access to meetings

/**
 * GET /api/meetings
 * List meetings (all meetings if no auth, user's meetings if authenticated)
 */
router.get('/', async (req, res) => {
  try {
    const { from, to, limit = 50, cursor } = req.query;

    // Build where clause
    const where = {};

    // If user is authenticated, filter by their meetings
    // Otherwise show system user's meetings (for anonymous in-meeting access)
    if (req.user) {
      where.ownerId = req.user.id;
    } else {
      // Show system user's meetings for anonymous users
      const systemUser = await prisma.user.findFirst({
        where: { email: 'system@arlo.local' }
      });
      if (systemUser) {
        where.ownerId = systemUser.id;
      }
    }

    if (from) where.startTime = { ...where.startTime, gte: new Date(from) };
    if (to) where.startTime = { ...where.startTime, lte: new Date(to) };

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        speakers: {
          select: { id: true, displayName: true, label: true },
        },
        _count: {
          select: {
            segments: true,
            highlights: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
      take: parseInt(limit),
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });

    const total = await prisma.meeting.count({ where });

    res.json({
      meetings,
      total,
      cursor: meetings.length > 0 ? meetings[meetings.length - 1].id : null,
    });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

/**
 * GET /api/meetings/:id
 * Get meeting details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Build where clause
    const where = { id };

    // If user is authenticated, filter by their meetings
    if (req.user) {
      where.ownerId = req.user.id;
    }
    // Otherwise allow access to system user's meetings

    const meeting = await prisma.meeting.findFirst({
      where,
      include: {
        speakers: true,
        highlights: true,
        _count: {
          select: {
            segments: true,
          },
        },
      },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ meeting });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ error: 'Failed to fetch meeting' });
  }
});

/**
 * GET /api/meetings/:id/transcript
 * Get meeting transcript segments
 */
router.get('/:id/transcript', async (req, res) => {
  try {
    const { id } = req.params;
    const { from_ms, to_ms, limit = 100, after_seq } = req.query;

    // Build where clause
    const meetingWhere = { id };

    // If user is authenticated, filter by their meetings
    if (req.user) {
      meetingWhere.ownerId = req.user.id;
    }
    // Otherwise allow access to system user's meetings

    // Verify meeting exists
    const meeting = await prisma.meeting.findFirst({
      where: meetingWhere,
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const where = {
      meetingId: id,
      ...(from_ms && { tStartMs: { gte: parseInt(from_ms) } }),
      ...(to_ms && { tEndMs: { lte: parseInt(to_ms) } }),
      ...(after_seq && { seqNo: { gt: BigInt(after_seq) } }),
    };

    const segments = await prisma.transcriptSegment.findMany({
      where,
      include: {
        speaker: true,
      },
      orderBy: { seqNo: 'asc' },
      take: parseInt(limit),
    });

    // Convert BigInt to Number for JSON serialization
    const serializedSegments = segments.map(seg => ({
      ...seg,
      seqNo: seg.seqNo.toString(),
      tStartMs: Number(seg.tStartMs),
      tEndMs: Number(seg.tEndMs),
    }));

    res.json({
      segments: serializedSegments,
      cursor: segments.length > 0 ? segments[segments.length - 1].seqNo.toString() : null,
    });
  } catch (error) {
    console.error('Get transcript error:', error);
    res.status(500).json({ error: 'Failed to fetch transcript' });
  }
});

/**
 * PATCH /api/meetings/:id
 * Update meeting (rename, etc.)
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const meeting = await prisma.meeting.update({
      where: { id },
      data: { title: title.trim() },
    });

    res.json({ meeting });
  } catch (error) {
    console.error('Update meeting error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.status(500).json({ error: 'Failed to update meeting' });
  }
});

/**
 * GET /api/meetings/:id/vtt
 * Export meeting transcript as WebVTT file
 */
router.get('/:id/vtt', async (req, res) => {
  try {
    const { id } = req.params;

    // Get meeting with segments
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        segments: {
          orderBy: { seqNo: 'asc' },
          include: { speaker: true },
        },
      },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (meeting.segments.length === 0) {
      return res.status(400).json({ error: 'No transcript available' });
    }

    // Generate WebVTT content
    let vtt = 'WEBVTT\n\n';

    meeting.segments.forEach((segment, index) => {
      const startTime = formatVTTTime(Number(segment.tStartMs));
      const endTime = formatVTTTime(Number(segment.tEndMs) || Number(segment.tStartMs) + 5000);
      const speaker = segment.speaker?.displayName || segment.speaker?.label || 'Speaker';

      vtt += `${index + 1}\n`;
      vtt += `${startTime} --> ${endTime}\n`;
      vtt += `<v ${speaker}>${segment.text}\n\n`;
    });

    // Set headers for file download
    const filename = `${meeting.title.replace(/[^a-z0-9]/gi, '_')}_transcript.vtt`;
    res.setHeader('Content-Type', 'text/vtt');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(vtt);
  } catch (error) {
    console.error('VTT export error:', error);
    res.status(500).json({ error: 'Failed to export transcript' });
  }
});

/**
 * Helper: Format milliseconds to VTT timestamp (HH:MM:SS.mmm)
 */
function formatVTTTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

/**
 * GET /api/meetings/:id/export/markdown
 * Export meeting transcript as Markdown file
 */
router.get('/:id/export/markdown', async (req, res) => {
  try {
    const { id } = req.params;

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        speakers: true,
        highlights: true,
        segments: {
          orderBy: { seqNo: 'asc' },
          include: { speaker: true },
        },
      },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Build Markdown content
    let md = `# ${meeting.title}\n\n`;

    const dateStr = new Date(meeting.startTime).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const durationMs = meeting.duration ||
      (meeting.endTime ? new Date(meeting.endTime) - new Date(meeting.startTime) : null);
    const durationMin = durationMs ? Math.round(durationMs / 60000) : null;

    md += `**Date:** ${dateStr}`;
    if (durationMin) md += ` | **Duration:** ${durationMin} min`;
    md += '\n\n';

    // Participants
    if (meeting.speakers.length > 0) {
      md += `## Participants\n\n`;
      meeting.speakers.forEach((s) => {
        md += `- ${s.displayName || s.label}\n`;
      });
      md += '\n';
    }

    // Summary (cached)
    if (meeting.summary) {
      md += `## Summary\n\n`;
      if (meeting.summary.overview) {
        md += `${meeting.summary.overview}\n\n`;
      }
      if (meeting.summary.keyPoints?.length > 0) {
        md += `### Key Points\n\n`;
        meeting.summary.keyPoints.forEach((p) => { md += `- ${p}\n`; });
        md += '\n';
      }
    }

    // Highlights
    if (meeting.highlights.length > 0) {
      md += `## Highlights\n\n`;
      meeting.highlights.forEach((h) => {
        md += `- **${h.title}**`;
        if (h.notes) md += `: ${h.notes}`;
        md += '\n';
      });
      md += '\n';
    }

    // Transcript
    if (meeting.segments.length > 0) {
      md += `## Transcript\n\n`;
      meeting.segments.forEach((seg) => {
        const speaker = seg.speaker?.displayName || seg.speaker?.label || 'Speaker';
        const ms = Number(seg.tStartMs);
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        const ts = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        md += `**[${ts}] ${speaker}:** ${seg.text}\n\n`;
      });
    }

    const filename = `${meeting.title.replace(/[^a-z0-9]/gi, '_')}_transcript.md`;
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(md);
  } catch (error) {
    console.error('Markdown export error:', error);
    res.status(500).json({ error: 'Failed to export transcript' });
  }
});

/**
 * DELETE /api/meetings/:id
 * Delete a meeting
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership - always filter by authenticated user
    const where = {
      id,
      ownerId: req.user.id,
    };

    const meeting = await prisma.meeting.findFirst({ where });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Delete meeting (cascades to segments, speakers, etc.)
    await prisma.meeting.delete({
      where: { id },
    });

    res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
});

module.exports = router;
