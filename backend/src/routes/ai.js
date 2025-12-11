const express = require('express');
const router = express.Router();

/**
 * POST /api/ai/chat
 * Chat with transcripts (placeholder - will implement OpenRouter integration)
 */
router.post('/chat', async (req, res) => {
  // TODO: Implement RAG pipeline with OpenRouter
  res.status(501).json({
    message: 'AI chat endpoint - coming in Phase 4',
    note: 'Will integrate OpenRouter for RAG-based chat',
  });
});

/**
 * POST /api/ai/suggest
 * Get AI suggestions for meeting
 */
router.post('/suggest', async (req, res) => {
  // TODO: Implement AI suggestions
  res.status(501).json({
    message: 'AI suggestions endpoint - coming in Phase 5',
  });
});

module.exports = router;
