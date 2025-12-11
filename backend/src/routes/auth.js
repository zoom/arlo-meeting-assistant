const express = require('express');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { generatePKCE, generateState, encryptToken, decryptToken, generateToken } = require('../services/auth');
const config = require('../config');

const router = express.Router();
const prisma = new PrismaClient();

// Store PKCE challenges temporarily (in production, use Redis)
const pkceStore = new Map();

/**
 * GET /api/auth/authorize
 * Generate PKCE challenge for in-client OAuth
 */
router.get('/authorize', (req, res) => {
  try {
    const { codeVerifier, codeChallenge } = generatePKCE();
    const state = generateState();

    // Store code verifier with state as key (expires in 5 minutes)
    pkceStore.set(state, { codeVerifier, timestamp: Date.now() });

    // Clean up old entries
    setTimeout(() => pkceStore.delete(state), 5 * 60 * 1000);

    res.json({
      codeChallenge,
      state,
      clientId: config.zoomClientId,
    });
  } catch (error) {
    console.error('Error generating PKCE:', error);
    res.status(500).json({ error: 'Failed to generate auth challenge' });
  }
});

/**
 * POST /api/auth/callback
 * Exchange authorization code for access token
 */
router.post('/callback', async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    // Retrieve code verifier
    const pkceData = pkceStore.get(state);
    if (!pkceData) {
      return res.status(400).json({ error: 'Invalid or expired state' });
    }

    const { codeVerifier } = pkceData;
    pkceStore.delete(state);

    // Exchange code for token
    const tokenResponse = await axios.post(
      'https://zoom.us/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
      }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.zoomClientId}:${config.zoomClientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, expires_in, scope } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://api.zoom.us/v2/users/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const zoomUser = userResponse.data;

    // Create or update user
    const user = await prisma.user.upsert({
      where: { zoomUserId: zoomUser.id },
      create: {
        zoomUserId: zoomUser.id,
        email: zoomUser.email,
        displayName: `${zoomUser.first_name} ${zoomUser.last_name}`,
        avatarUrl: zoomUser.pic_url,
      },
      update: {
        email: zoomUser.email,
        displayName: `${zoomUser.first_name} ${zoomUser.last_name}`,
        avatarUrl: zoomUser.pic_url,
      },
    });

    // Store encrypted tokens
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    await prisma.userToken.create({
      data: {
        userId: user.id,
        accessToken: encryptToken(access_token),
        refreshToken: encryptToken(refresh_token),
        expiresAt,
        scopes: scope.split(' '),
      },
    });

    // Generate JWT for WebSocket auth
    const wsToken = generateToken({
      userId: user.id,
      zoomUserId: user.zoomUserId,
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({
      user: {
        id: user.id,
        zoomUserId: user.zoomUserId,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      wsToken,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('OAuth callback error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Authentication failed',
      message: error.response?.data?.message || error.message,
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', async (req, res) => {
  try {
    // TODO: Add session/JWT middleware
    const { userId } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        zoomUserId: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Get user token
    const userToken = await prisma.userToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!userToken) {
      return res.status(404).json({ error: 'No token found' });
    }

    // Check if token needs refresh (within 5 minutes of expiry)
    const needsRefresh = new Date(userToken.expiresAt).getTime() - Date.now() < 5 * 60 * 1000;

    if (!needsRefresh) {
      return res.json({ message: 'Token still valid', expiresAt: userToken.expiresAt });
    }

    // Decrypt refresh token
    const refreshToken = decryptToken(userToken.refreshToken);

    // Request new access token
    const tokenResponse = await axios.post(
      'https://zoom.us/oauth/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.zoomClientId}:${config.zoomClientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token: new_refresh_token, expires_in, scope } = tokenResponse.data;

    // Update token
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    await prisma.userToken.update({
      where: { id: userToken.id },
      data: {
        accessToken: encryptToken(access_token),
        refreshToken: encryptToken(new_refresh_token),
        expiresAt,
        scopes: scope.split(' '),
      },
    });

    res.json({
      message: 'Token refreshed',
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to refresh token',
      message: error.response?.data?.message || error.message,
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (revoke token)
 */
router.post('/logout', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Delete user tokens
    await prisma.userToken.deleteMany({
      where: { userId },
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

module.exports = router;
