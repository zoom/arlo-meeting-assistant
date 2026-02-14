const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/preferences — Return user preferences
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true },
    });

    res.json(user?.preferences || {});
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// PUT /api/preferences — Update user preferences (shallow merge at top level)
router.put('/', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true },
    });

    const existing = (user?.preferences && typeof user.preferences === 'object') ? user.preferences : {};
    const merged = { ...existing, ...req.body };

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { preferences: merged },
      select: { preferences: true },
    });

    res.json(updated.preferences);
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

module.exports = router;
