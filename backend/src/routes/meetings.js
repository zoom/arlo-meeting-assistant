const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/meetings
 * List user's meetings
 */
router.get('/', async (req, res) => {
  try {
    const { userId, from, to, limit = 50, cursor } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const where = {
      ownerId: userId,
      ...(from && { startTime: { gte: new Date(from) } }),
      ...(to && { startTime: { lte: new Date(to) } }),
    };

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
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
    const { userId } = req.query;

    const meeting = await prisma.meeting.findFirst({
      where: {
        id,
        ownerId: userId,
      },
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
    const { userId, from_ms, to_ms, limit = 100, after_seq } = req.query;

    // Verify meeting ownership
    const meeting = await prisma.meeting.findFirst({
      where: { id, ownerId: userId },
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

    res.json({
      segments,
      cursor: segments.length > 0 ? segments[segments.length - 1].seqNo.toString() : null,
    });
  } catch (error) {
    console.error('Get transcript error:', error);
    res.status(500).json({ error: 'Failed to fetch transcript' });
  }
});

/**
 * DELETE /api/meetings/:id
 * Delete a meeting
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    // Verify ownership
    const meeting = await prisma.meeting.findFirst({
      where: { id, ownerId: userId },
    });

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
