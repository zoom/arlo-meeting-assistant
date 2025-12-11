const crypto = require('crypto');
const config = require('../config');

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE() {
  // Generate random code verifier (43-128 characters)
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));

  // Generate code challenge (SHA256 hash of verifier)
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = base64URLEncode(hash);

  return { codeVerifier, codeChallenge };
}

/**
 * Base64 URL encode (RFC 7636)
 */
function base64URLEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate random state parameter
 */
function generateState() {
  return base64URLEncode(crypto.randomBytes(32));
}

/**
 * Encrypt access token for storage
 */
function encryptToken(token) {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(config.encryptionKey, 'hex');
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Return iv + encrypted token
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt access token from storage
 */
function decryptToken(encryptedToken) {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(config.encryptionKey, 'hex');

  const [ivHex, encrypted] = encryptedToken.split(':');
  const iv = Buffer.from(ivHex, 'hex');

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate simple JWT for WebSocket authentication
 * Note: For production, use a proper JWT library
 */
function generateToken(payload) {
  const header = base64URLEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64URLEncode(Buffer.from(JSON.stringify(payload)));
  const signature = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${header}.${body}.${signature}`;
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    const [header, body, signature] = token.split('.');

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', config.sessionSecret)
      .update(`${header}.${body}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    if (signature !== expectedSignature) {
      throw new Error('Invalid signature');
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(body, 'base64').toString('utf8'));

    // Check expiration
    if (payload.exp && Date.now() > payload.exp) {
      throw new Error('Token expired');
    }

    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

module.exports = {
  generatePKCE,
  generateState,
  encryptToken,
  decryptToken,
  generateToken,
  verifyToken,
  base64URLEncode,
};
