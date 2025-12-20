const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/highlights
 * Get highlights for a meeting
 */
router.get('/', async (req, res) => {
  try {
    const { meetingId } = req.query;

    if (!meetingId) {
      return res.status(400).json({ error: 'meetingId is required' });
    }

    const highlights = await prisma.highlight.findMany({
      where: { meetingId },
      orderBy: { tStartMs: 'asc' },
    });

    res.json({ highlights });
  } catch (error) {
    console.error('Get highlights error:', error);
    res.status(500).json({ error: 'Failed to fetch highlights' });
  }
});

/**
 * POST /api/highlights
 * Create a new highlight
 */
router.post('/', async (req, res) => {
  try {
    const { meetingId, title, notes, tStartMs, tEndMs, tags } = req.body;

    if (!meetingId || !title) {
      return res.status(400).json({ error: 'meetingId and title are required' });
    }

    // Get or create a system user for dev mode
    let systemUser = await prisma.user.findFirst({
      where: { email: 'system@arlo.local' },
    });

    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          zoomUserId: 'system',
          email: 'system@arlo.local',
          displayName: 'System',
        },
      });
    }

    const highlight = await prisma.highlight.create({
      data: {
        meetingId,
        userId: systemUser.id,
        title,
        notes: notes || null,
        tStartMs: tStartMs || 0,
        tEndMs: tEndMs || tStartMs || 0,
        tags: tags || [],
      },
    });

    res.status(201).json({ highlight });
  } catch (error) {
    console.error('Create highlight error:', error);
    res.status(500).json({ error: 'Failed to create highlight' });
  }
});

/**
 * PATCH /api/highlights/:id
 * Update a highlight
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, notes, tags } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (notes !== undefined) updateData.notes = notes;
    if (tags !== undefined) updateData.tags = tags;

    const highlight = await prisma.highlight.update({
      where: { id },
      data: updateData,
    });

    res.json({ highlight });
  } catch (error) {
    console.error('Update highlight error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Highlight not found' });
    }
    res.status(500).json({ error: 'Failed to update highlight' });
  }
});

/**
 * DELETE /api/highlights/:id
 * Delete a highlight
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.highlight.delete({
      where: { id },
    });

    res.json({ message: 'Highlight deleted successfully' });
  } catch (error) {
    console.error('Delete highlight error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Highlight not found' });
    }
    res.status(500).json({ error: 'Failed to delete highlight' });
  }
});

module.exports = router;
