const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();
const config = require('../config');

/**
 * POST /api/rtms/webhook
 * Receive RTMS webhooks from Zoom
 */
router.post('/webhook', async (req, res) => {
  const { event, payload } = req.body;

  // Handle Zoom webhook validation (endpoint URL validation)
  if (event === 'endpoint.url_validation') {
    const { plainToken } = payload;
    console.log('📨 Webhook validation request received');

    // Hash the plainToken with client secret and client ID
    const hash = crypto
      .createHmac('sha256', config.zoom.clientSecret)
      .update(plainToken)
      .digest('hex');

    console.log('✅ Webhook validation response sent');
    return res.status(200).json({
      plainToken,
      encryptedToken: hash,
    });
  }

  console.log(`📨 RTMS Webhook: ${event}`, JSON.stringify(payload, null, 2));

  // Forward webhook to RTMS service
  if (event === 'meeting.rtms_started' || event === 'meeting.rtms_stopped') {
    try {
      const rtmsServiceUrl = process.env.RTMS_SERVICE_URL || 'http://rtms:3002';
      await axios.post(`${rtmsServiceUrl}/webhook`, req.body, {
        timeout: 5000,
      });
      console.log(`✅ Forwarded ${event} to RTMS service`);
    } catch (error) {
      console.error(`❌ Failed to forward webhook to RTMS service:`, error.message);
      // Don't fail the webhook - Zoom expects 200 response
    }
  }

  // Acknowledge webhook immediately
  res.status(200).send('OK');
});

module.exports = router;
