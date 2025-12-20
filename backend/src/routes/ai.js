const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const config = require('../config');
const {
  generateSummary,
  extractActionItems,
  chatWithTranscript,
} = require('../services/openrouter');

const prisma = new PrismaClient();

/**
 * Helper: Find meeting by database ID or Zoom meeting ID
 */
async function findMeeting(meetingId) {
  // First try by database ID (UUID format)
  let meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
  });

  // If not found, try by Zoom meeting ID
  if (!meeting) {
    meeting = await prisma.meeting.findFirst({
      where: { zoomMeetingId: meetingId },
    });
  }

  return meeting;
}

/**
 * Helper: Get transcript text for a meeting
 */
async function getTranscriptText(meetingId) {
  const segments = await prisma.transcriptSegment.findMany({
    where: { meetingId },
    orderBy: { seqNo: 'asc' },
    include: { speaker: true },
  });

  if (segments.length === 0) {
    return null;
  }

  // Format as readable transcript
  return segments
    .map((seg) => {
      const speaker = seg.speaker?.displayName || seg.speaker?.label || 'Speaker';
      return `[${speaker}]: ${seg.text}`;
    })
    .join('\n');
}

/**
 * POST /api/ai/summary
 * Generate meeting summary
 */
router.post('/summary', async (req, res) => {
  const { meetingId } = req.body;

  if (!config.aiEnabled) {
    return res.status(503).json({ error: 'AI features are disabled' });
  }

  if (!meetingId) {
    return res.status(400).json({ error: 'meetingId is required' });
  }

  try {
    // Get meeting details (supports both database ID and Zoom meeting ID)
    const meeting = await findMeeting(meetingId);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Get transcript text using the database ID
    const transcript = await getTranscriptText(meeting.id);

    if (!transcript) {
      return res.status(400).json({ error: 'No transcript available for this meeting' });
    }

    console.log(`🤖 Generating summary for meeting: ${meeting.title}`);

    // Generate summary
    const summary = await generateSummary(transcript, meeting.title);

    res.json({
      meetingId: meeting.id,
      title: meeting.title,
      summary,
    });
  } catch (error) {
    console.error('❌ Summary generation error:', error.message);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

/**
 * POST /api/ai/action-items
 * Extract action items from meeting
 */
router.post('/action-items', async (req, res) => {
  const { meetingId } = req.body;

  if (!config.aiEnabled) {
    return res.status(503).json({ error: 'AI features are disabled' });
  }

  if (!meetingId) {
    return res.status(400).json({ error: 'meetingId is required' });
  }

  try {
    // Get meeting details (supports both database ID and Zoom meeting ID)
    const meeting = await findMeeting(meetingId);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Get transcript text using the database ID
    const transcript = await getTranscriptText(meeting.id);

    if (!transcript) {
      return res.status(400).json({ error: 'No transcript available for this meeting' });
    }

    console.log(`🤖 Extracting action items for meeting: ${meeting.title}`);

    // Extract action items
    const actionItems = await extractActionItems(transcript);

    res.json({
      meetingId: meeting.id,
      title: meeting.title,
      actionItems,
    });
  } catch (error) {
    console.error('❌ Action items extraction error:', error.message);
    res.status(500).json({ error: 'Failed to extract action items' });
  }
});

/**
 * POST /api/ai/chat
 * Chat with transcripts (RAG-based Q&A)
 */
router.post('/chat', async (req, res) => {
  const { meetingId, question } = req.body;

  if (!config.aiEnabled) {
    return res.status(503).json({ error: 'AI features are disabled' });
  }

  if (!question) {
    return res.status(400).json({ error: 'question is required' });
  }

  try {
    let transcript = '';
    let meetingTitle = 'Meeting';

    if (meetingId) {
      // Chat about specific meeting (supports both database ID and Zoom meeting ID)
      const meeting = await findMeeting(meetingId);

      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }

      meetingTitle = meeting.title;
      transcript = await getTranscriptText(meeting.id);

      if (!transcript) {
        return res.status(400).json({ error: 'No transcript available for this meeting' });
      }
    } else {
      // Chat across all meetings - get recent transcripts
      const recentMeetings = await prisma.meeting.findMany({
        orderBy: { startTime: 'desc' },
        take: 5,
        include: {
          segments: {
            orderBy: { seqNo: 'asc' },
            include: { speaker: true },
          },
        },
      });

      if (recentMeetings.length === 0) {
        return res.status(400).json({ error: 'No meetings with transcripts found' });
      }

      // Combine transcripts from recent meetings
      transcript = recentMeetings
        .map((m) => {
          const text = m.segments
            .map((seg) => {
              const speaker = seg.speaker?.displayName || seg.speaker?.label || 'Speaker';
              return `[${speaker}]: ${seg.text}`;
            })
            .join('\n');
          return `--- Meeting: ${m.title} (${m.startTime.toLocaleDateString()}) ---\n${text}`;
        })
        .join('\n\n');

      meetingTitle = 'Recent Meetings';
    }

    console.log(`🤖 Chat question: "${question.substring(0, 50)}..."`);

    // Get AI response
    const answer = await chatWithTranscript(question, transcript, meetingTitle);

    res.json({
      meetingId: meetingId || null,
      question,
      answer,
    });
  } catch (error) {
    console.error('❌ Chat error:', error.message);
    res.status(500).json({ error: 'Failed to process question' });
  }
});

/**
 * POST /api/ai/suggest
 * Get real-time AI suggestions during meeting (for in-meeting use)
 */
router.post('/suggest', async (req, res) => {
  const { transcript, context } = req.body;

  if (!config.aiEnabled) {
    return res.status(503).json({ error: 'AI features are disabled' });
  }

  if (!transcript) {
    return res.status(400).json({ error: 'transcript is required' });
  }

  // For now, return a simple placeholder
  // This would be expanded for real-time suggestions
  res.json({
    suggestions: [
      {
        type: 'info',
        text: 'AI suggestions will appear here during the meeting',
      },
    ],
  });
});

/**
 * GET /api/ai/status
 * Check AI service status
 */
router.get('/status', (req, res) => {
  res.json({
    enabled: config.aiEnabled,
    hasApiKey: !!config.openrouterApiKey,
    defaultModel: config.defaultModel,
    fallbackModel: config.fallbackModel,
  });
});

module.exports = router;
