const express = require('express');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { generatePKCE, generateState, encryptToken, decryptToken, generateToken } = require('../services/auth');
const config = require('../config');

const router = express.Router();
const prisma = new PrismaClient();

// Store PKCE challenges temporarily (in production, use Redis)
const pkceStore = new Map();

// Store web OAuth state params (for CSRF protection)
const webOAuthStore = new Map();

/**
 * GET /api/auth/start
 * Initiate web-based OAuth by redirecting to Zoom's authorization page.
 * Used when installing from Marketplace or clicking "Install" on the landing page.
 */
router.get('/start', (req, res) => {
  try {
    const state = generateState();

    // Store state for CSRF validation (expires in 5 minutes)
    webOAuthStore.set(state, { timestamp: Date.now() });
    setTimeout(() => webOAuthStore.delete(state), 5 * 60 * 1000);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.zoomClientId,
      redirect_uri: config.redirectUri,
      state,
    });

    res.redirect(`https://zoom.us/oauth/authorize?${params.toString()}`);
  } catch (error) {
    console.error('Error starting web OAuth:', error);
    res.redirect(`${config.publicUrl}/#/auth-error?error=server_error&message=${encodeURIComponent('Failed to start authentication')}`);
  }
});

/**
 * GET /api/auth/callback
 * Handle browser redirect from Zoom after OAuth consent (Marketplace install flow).
 * Exchanges code for tokens (no PKCE — server-side with client_secret),
 * creates/upserts user, sets session cookie, redirects to frontend.
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Handle OAuth denial or error from Zoom
    if (oauthError) {
      console.log('OAuth denied by user:', oauthError);
      return res.redirect(`${config.publicUrl}/#/auth-error?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code) {
      return res.redirect(`${config.publicUrl}/#/auth-error?error=missing_code&message=${encodeURIComponent('No authorization code received')}`);
    }

    // Validate state if present (Marketplace installs may not include state)
    if (state) {
      const storedState = webOAuthStore.get(state);
      if (!storedState) {
        console.warn('Web OAuth state mismatch — may be a Marketplace install (no state)');
      } else {
        webOAuthStore.delete(state);
      }
    }

    // Exchange code for tokens (no PKCE — server-side flow)
    const tokenResponse = await axios.post(
      'https://zoom.us/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.zoomClientId}:${config.zoomClientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, expires_in, scope } = tokenResponse.data;

    // Get user info — try API first, fall back to JWT decoding
    let zoomUser;
    try {
      const userResponse = await axios.get('https://api.zoom.us/v2/users/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      zoomUser = userResponse.data;
    } catch (apiError) {
      const tokenPayload = JSON.parse(Buffer.from(access_token.split('.')[1], 'base64').toString());
      console.log('Falling back to JWT token payload for user info:', tokenPayload);
      zoomUser = {
        id: tokenPayload.uid,
        email: tokenPayload.email || `${tokenPayload.uid}@zoom.user`,
        first_name: tokenPayload.first_name || 'Zoom',
        last_name: tokenPayload.last_name || 'User',
        pic_url: null,
      };
    }

    // Check if user already exists (for first-install detection)
    const existingUser = await prisma.user.findUnique({
      where: { zoomUserId: zoomUser.id },
    });
    const isFirstInstall = !existingUser;

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

    // Generate session JWT (24 hours)
    const sessionToken = generateToken({
      userId: user.id,
      zoomUserId: user.zoomUserId,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    });

    // Set session cookie (sameSite: lax required for cross-origin OAuth redirect)
    res.cookie('sessionToken', sessionToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    // Redirect to frontend onboarding page
    const redirectUrl = isFirstInstall
      ? `${config.publicUrl}/#/welcome?first=true`
      : `${config.publicUrl}/#/welcome`;
    console.log(`Web OAuth success — redirecting to ${redirectUrl} (first install: ${isFirstInstall})`);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Web OAuth callback error:', error.response?.data || error.message);
    const message = error.response?.data?.message || error.message || 'Authentication failed';
    res.redirect(`${config.publicUrl}/#/auth-error?error=token_exchange_failed&message=${encodeURIComponent(message)}`);
  }
});

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

    // Get user info — try API first, fall back to JWT decoding if scope is missing
    let zoomUser;
    try {
      const userResponse = await axios.get('https://api.zoom.us/v2/users/me', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
      zoomUser = userResponse.data;
    } catch (apiError) {
      // Decode the JWT access token to extract user ID when user:read scope is missing
      const tokenPayload = JSON.parse(Buffer.from(access_token.split('.')[1], 'base64').toString());
      console.log('Falling back to JWT token payload for user info:', tokenPayload);
      zoomUser = {
        id: tokenPayload.uid,
        email: tokenPayload.email || `${tokenPayload.uid}@zoom.user`,
        first_name: tokenPayload.first_name || 'Zoom',
        last_name: tokenPayload.last_name || 'User',
        pic_url: null,
      };
    }

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

    // Generate JWT for session (24 hours)
    const sessionToken = generateToken({
      userId: user.id,
      zoomUserId: user.zoomUserId,
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    // Generate JWT for WebSocket auth (same token, but also returned for WS connections)
    const wsToken = sessionToken;

    // Set httpOnly cookie for session management
    res.cookie('sessionToken', sessionToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production', // HTTPS only in production
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({
      user: {
        id: user.id,
        zoomUserId: user.zoomUserId,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      wsToken, // Still return for WebSocket connections
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
    const { requireAuth, devAuthBypass } = require('../middleware/auth');

    // Apply auth middleware
    await new Promise((resolve, reject) => {
      requireAuth(req, res, (err) => {
        if (err) return reject(err);
        devAuthBypass(req, res, resolve);
      });
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
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
    const { requireAuth, devAuthBypass } = require('../middleware/auth');

    // Apply auth middleware
    await new Promise((resolve, reject) => {
      requireAuth(req, res, (err) => {
        if (err) return reject(err);
        devAuthBypass(req, res, resolve);
      });
    });

    // Delete user tokens from database
    await prisma.userToken.deleteMany({
      where: { userId: req.user.id },
    });

    // Clear session cookie
    res.clearCookie('sessionToken', {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.status(500).json({ error: 'Failed to logout' });
  }
});

module.exports = router;
