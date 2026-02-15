const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { decryptToken, encryptToken } = require('./auth');
const config = require('../config');

const prisma = new PrismaClient();

/**
 * Get a valid access token for the user, refreshing if needed.
 */
async function getAccessToken(userId) {
  const userToken = await prisma.userToken.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (!userToken) {
    throw new Error('No token found for user');
  }

  // Refresh if within 5 minutes of expiry
  const needsRefresh = new Date(userToken.expiresAt).getTime() - Date.now() < 5 * 60 * 1000;

  if (!needsRefresh) {
    return decryptToken(userToken.accessToken);
  }

  // Refresh the token
  const refreshToken = decryptToken(userToken.refreshToken);
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

  const { access_token, refresh_token: newRefreshToken, expires_in, scope } = tokenResponse.data;
  const expiresAt = new Date(Date.now() + expires_in * 1000);

  await prisma.userToken.update({
    where: { id: userToken.id },
    data: {
      accessToken: encryptToken(access_token),
      refreshToken: encryptToken(newRefreshToken),
      expiresAt,
      scopes: scope.split(' '),
    },
  });

  return access_token;
}

/**
 * Authenticated GET to Zoom REST API. Retries once on 401.
 */
async function zoomGet(userId, path, params = {}) {
  async function attempt(token) {
    return axios.get(`https://api.zoom.us/v2${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
  }

  let token = await getAccessToken(userId);
  try {
    const res = await attempt(token);
    return res.data;
  } catch (err) {
    if (err.response?.status === 401) {
      // Force refresh and retry
      token = await getAccessToken(userId);
      const res = await attempt(token);
      return res.data;
    }
    throw err;
  }
}

/**
 * Authenticated POST to Zoom REST API. Retries once on 401.
 */
async function zoomPost(userId, path, data = {}) {
  async function attempt(token) {
    return axios.post(`https://api.zoom.us/v2${path}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  let token = await getAccessToken(userId);
  try {
    const res = await attempt(token);
    console.log(`[zoomApi] POST ${path} → ${res.status}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 401) {
      token = await getAccessToken(userId);
      const res = await attempt(token);
      console.log(`[zoomApi] POST ${path} → ${res.status} (retry)`);
      return res.data;
    }
    console.error(`[zoomApi] POST ${path} failed: ${err.response?.status || err.message}`);
    throw err;
  }
}

/**
 * Authenticated DELETE to Zoom REST API. Retries once on 401.
 */
async function zoomDelete(userId, path) {
  async function attempt(token) {
    return axios.delete(`https://api.zoom.us/v2${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  let token = await getAccessToken(userId);
  try {
    const res = await attempt(token);
    return res.data;
  } catch (err) {
    if (err.response?.status === 401) {
      token = await getAccessToken(userId);
      const res = await attempt(token);
      return res.data;
    }
    throw err;
  }
}

module.exports = { getAccessToken, zoomGet, zoomPost, zoomDelete };
