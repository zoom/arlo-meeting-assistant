/**
 * OpenRouter AI Service
 * Handles all AI-related API calls using OpenRouter's free models
 */

const config = require('../config');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Call OpenRouter API
 * @param {string} prompt - The user prompt
 * @param {string} systemPrompt - System instructions
 * @param {object} options - Additional options (model, maxTokens, etc.)
 * @returns {Promise<string>} The AI response text
 */
async function callOpenRouter(prompt, systemPrompt = '', options = {}) {
  const model = options.model || config.defaultModel;
  const maxTokens = options.maxTokens || 2048;

  const headers = {
    'Content-Type': 'application/json',
    'HTTP-Referer': config.publicUrl,
    'X-Title': 'Arlo Meeting Assistant',
  };

  // Add API key if available (enables higher rate limits)
  if (config.openrouterApiKey) {
    headers['Authorization'] = `Bearer ${config.openrouterApiKey}`;
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenRouter API error:', response.status, errorText);

      // Try fallback model if primary fails
      if (model !== config.fallbackModel) {
        console.log('🔄 Trying fallback model:', config.fallbackModel);
        return callOpenRouter(prompt, systemPrompt, {
          ...options,
          model: config.fallbackModel,
        });
      }

      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('❌ OpenRouter call failed:', error.message);
    throw error;
  }
}

/**
 * Generate meeting summary
 * @param {string} transcript - Full transcript text
 * @param {string} meetingTitle - Meeting title for context
 * @returns {Promise<object>} Summary object with sections
 */
async function generateSummary(transcript, meetingTitle = 'Meeting') {
  const systemPrompt = `You are an expert meeting assistant. Your job is to create clear, concise meeting summaries.
Focus on the key points, decisions made, and important discussions.
Format your response as JSON with the following structure:
{
  "overview": "2-3 sentence high-level summary",
  "keyPoints": ["point 1", "point 2", ...],
  "decisions": ["decision 1", "decision 2", ...],
  "nextSteps": ["next step 1", "next step 2", ...]
}
Only output valid JSON, no markdown or explanation.`;

  const prompt = `Please summarize this meeting transcript from "${meetingTitle}":

${transcript}`;

  try {
    const response = await callOpenRouter(prompt, systemPrompt, { maxTokens: 1024 });

    // Strip markdown code fences if present (e.g., ```json ... ```)
    const cleaned = response.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(cleaned);
      return parsed;
    } catch {
      // If JSON parsing fails, return structured response
      return {
        overview: cleaned,
        keyPoints: [],
        decisions: [],
        nextSteps: [],
      };
    }
  } catch (error) {
    console.error('❌ Summary generation failed:', error.message);
    throw error;
  }
}

/**
 * Extract action items from transcript
 * @param {string} transcript - Full transcript text
 * @returns {Promise<array>} Array of action items
 */
async function extractActionItems(transcript) {
  const systemPrompt = `You are an expert at identifying action items from meeting transcripts.
Extract specific, actionable tasks that were mentioned or assigned during the meeting.
For each action item, identify who it was assigned to if mentioned.

Format your response as a JSON array:
[
  {"task": "description of task", "owner": "person name or null", "priority": "high|medium|low"},
  ...
]
Only output valid JSON array, no markdown or explanation.`;

  const prompt = `Extract all action items from this meeting transcript:

${transcript}`;

  try {
    const response = await callOpenRouter(prompt, systemPrompt, { maxTokens: 1024 });

    // Strip markdown code fences if present (e.g., ```json ... ```)
    const cleaned = response.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // If JSON parsing fails, return empty array
      console.warn('⚠️ Could not parse action items JSON');
      return [];
    }
  } catch (error) {
    console.error('❌ Action items extraction failed:', error.message);
    throw error;
  }
}

/**
 * Chat with transcript (RAG-style Q&A)
 * @param {string} question - User's question
 * @param {string} transcript - Relevant transcript context
 * @param {string} meetingTitle - Meeting title for context
 * @returns {Promise<string>} AI response
 */
async function chatWithTranscript(question, transcript, meetingTitle = 'Meeting') {
  const systemPrompt = `You are a helpful meeting assistant. Answer questions about the meeting based on the transcript provided.
Be specific and cite relevant parts of the conversation when possible.
If the answer is not in the transcript, say so clearly.
Keep answers concise but informative.`;

  const prompt = `Meeting: "${meetingTitle}"

Transcript:
${transcript}

Question: ${question}`;

  try {
    return await callOpenRouter(prompt, systemPrompt, { maxTokens: 512 });
  } catch (error) {
    console.error('❌ Chat failed:', error.message);
    throw error;
  }
}

/**
 * Generate real-time meeting suggestions
 * @param {string} recentTranscript - Last few minutes of transcript
 * @returns {Promise<array>} Array of suggestion objects
 */
async function generateSuggestions(recentTranscript) {
  const systemPrompt = `You are a real-time meeting assistant. Based on the recent transcript, generate 1-2 brief, actionable suggestions or observations.
Examples: "Clarify the timeline for the feature release", "Assign an owner for the database migration task"
Format as JSON array: [{"type": "suggestion", "text": "brief text"}]
Only output valid JSON array.`;

  const prompt = `Recent transcript:\n\n${recentTranscript}`;

  try {
    const response = await callOpenRouter(prompt, systemPrompt, { maxTokens: 256 });
    const cleaned = response.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  } catch (error) {
    console.error('Suggestions generation failed:', error.message);
    return [];
  }
}

module.exports = {
  callOpenRouter,
  generateSummary,
  extractActionItems,
  chatWithTranscript,
  generateSuggestions,
};
