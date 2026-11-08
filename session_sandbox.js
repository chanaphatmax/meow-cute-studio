/**
 * Meow Cute (เหมียวน่ารัก) — Enterprise Multi-Tenant Session Isolation & Security Sandbox
 * 
 * 1. Multi-Tenant Ephemeral Isolation:
 *    - Each user/browser gets a strictly isolated workspace under `user_sessions/<sessionId>/`
 *    - User A can NEVER inspect, read, stream, or overwrite User B's files.
 * 2. Zero Data Retention & Auto-Cleanup:
 *    - Stale sessions are automatically purged after TTL (default: 2 hours of inactivity).
 * 3. Bulletproof Path Traversal & Injection Defense:
 *    - Strict regex check on sessionId [a-zA-Z0-9_-]{8,64}
 *    - path.resolve prefix verification preventing '../', null bytes, and root escapes.
 *    - Strict media file extension whitelisting (.mp4, .mov, .webm, .m4v).
 * 4. Production OWASP Security Headers.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = __dirname;
const SESSIONS_ROOT = path.join(ROOT_DIR, 'user_sessions');
const ALLOWED_MEDIA_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.wav', '.mp3']);
const SESSION_ID_REGEX = /^[a-zA-Z0-9_\-]{8,64}$/;
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// Ensure base user_sessions root directory exists
if (!fs.existsSync(SESSIONS_ROOT)) {
  fs.mkdirSync(SESSIONS_ROOT, { recursive: true });
}

/**
 * Validates and sanitizes a session ID.
 */
function isValidSessionId(sid) {
  return typeof sid === 'string' && SESSION_ID_REGEX.test(sid);
}

/**
 * Generate a cryptographically strong, URL-safe ephemeral session ID.
 */
function generateSessionId() {
  const ts = Date.now().toString(36);
  const rnd = crypto.randomBytes(8).toString('hex');
  return `ses_${ts}_${rnd}`;
}

/**
 * Parse cookies from request header.
 */
function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (!rc) return list;
  rc.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      list[parts.shift().trim()] = decodeURIComponent(parts.join('=').trim());
    }
  });
  return list;
}

/**
 * Extracts or generates a valid sessionId from incoming request.
 */
function getOrCreateSessionId(req, parsedUrl) {
  // 1. Header (Standard API client)
  let sid = req.headers['x-session-id'];
  
  // 2. Query param (for direct video stream/download links)
  if (!isValidSessionId(sid) && parsedUrl) {
    sid = parsedUrl.searchParams.get('sid') || parsedUrl.searchParams.get('session_id');
  }

  // 3. Cookie (for browser tab persistence)
  if (!isValidSessionId(sid)) {
    const cookies = parseCookies(req);
    sid = cookies['meow_session_id'];
  }

  // 4. Generate new if not provided or invalid
  if (!isValidSessionId(sid)) {
    sid = generateSessionId();
  }

  return sid;
}

/**
 * Sets session cookie on response if not already set.
 */
function attachSessionCookie(res, sessionId) {
  res.setHeader('Set-Cookie', `meow_session_id=${sessionId}; Path=/; SameSite=Lax; HttpOnly=false; Max-Age=86400`);
}

/**
 * Ensure per-session directories exist:
 * user_sessions/<sessionId>/source_videos/
 * user_sessions/<sessionId>/renders/
 * user_sessions/<sessionId>/temp/
 */
function ensureSessionDirs(sessionId) {
  if (!isValidSessionId(sessionId)) {
    throw new Error('Invalid session ID format');
  }

  const sessionDir = path.join(SESSIONS_ROOT, sessionId);
  const srcDir = path.join(sessionDir, 'source_videos');
  const renderDir = path.join(sessionDir, 'renders');
  const tempDir = path.join(sessionDir, 'temp');

  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
  if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
  if (!fs.existsSync(renderDir)) fs.mkdirSync(renderDir, { recursive: true });
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // Update activity timestamp in metadata
  const metaPath = path.join(sessionDir, 'session_meta.json');
  try {
    const now = Date.now();
    let meta = { createdAt: now, lastActive: now };
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch (e) {}
    }
    meta.lastActive = now;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  } catch (e) {}

  return {
    sessionDir,
    srcDir,
    renderDir,
    tempDir
  };
}

/**
 * Returns safe absolute path inside a tenant's session workspace.
 * Throws on any directory traversal attempt (e.g., ../, root escapes).
 */
function safeSessionPath(sessionId, subPath) {
  if (!isValidSessionId(sessionId)) {
    throw new Error('Security Violation: Invalid session ID');
  }
  const sessionDir = path.resolve(SESSIONS_ROOT, sessionId);
  const target = path.resolve(sessionDir, subPath);

  // Must strictly stay inside sessionDir
  if (target !== sessionDir && !target.startsWith(sessionDir + path.sep)) {
    throw new Error('Security Violation: Access denied outside session boundary');
  }
  return target;
}

/**
 * Sanitize uploaded file name: whitelist alphanumeric, Thai chars, dash, underscore, dot.
 */
function sanitizeFileName(fileName) {
  const base = path.basename(fileName || 'clip.mp4');
  const clean = base.replace(/[^a-zA-Z0-9._\-\u0E00-\u0E7F]/g, '_');
  return clean || `clip_${Date.now()}.mp4`;
}

/**
 * Validates if the file extension is an authorized media format.
 */
function isAllowedMediaFile(fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  return ALLOWED_MEDIA_EXTS.has(ext);
}

/**
 * Instant Zero-Retention Wipe: immediately deletes all files and workspace of a session.
 */
function purgeSession(sessionId) {
  if (!isValidSessionId(sessionId)) return false;
  const sessionDir = path.resolve(SESSIONS_ROOT, sessionId);
  if (fs.existsSync(sessionDir)) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      return true;
    } catch (e) {
      console.warn('Purge session error:', e.message);
    }
  }
  return false;
}

/**
 * Purges raw source videos and temp analysis files once render is complete,
 * keeping only the finished output for download to protect user privacy.
 */
function purgeRawUploads(sessionId) {
  if (!isValidSessionId(sessionId)) return false;
  try {
    const sessionDir = path.resolve(SESSIONS_ROOT, sessionId);
    const srcDir = path.join(sessionDir, 'source_videos');
    const tempDir = path.join(sessionDir, 'temp');
    if (fs.existsSync(srcDir)) fs.rmSync(srcDir, { recursive: true, force: true });
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Auto-cleanup: deletes session folders inactive for > TTL.
 */
function cleanupStaleSessions(ttlMs = DEFAULT_TTL_MS) {
  try {
    if (!fs.existsSync(SESSIONS_ROOT)) return;
    const now = Date.now();
    const entries = fs.readdirSync(SESSIONS_ROOT);

    entries.forEach(entry => {
      const sDir = path.join(SESSIONS_ROOT, entry);
      try {
        const stat = fs.statSync(sDir);
        if (!stat.isDirectory()) return;

        let lastActive = stat.mtimeMs;
        const metaPath = path.join(sDir, 'session_meta.json');
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            if (meta.lastActive) lastActive = meta.lastActive;
          } catch (e) {}
        }

        if (now - lastActive > ttlMs) {
          fs.rmSync(sDir, { recursive: true, force: true });
        }
      } catch (e) {}
    });
  } catch (err) {
    console.warn('Session cleanup warning:', err.message);
  }
}

/**
 * Apply OWASP recommended enterprise security headers.
 */
function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

// Run periodic cleanup every 15 minutes
setInterval(() => {
  cleanupStaleSessions();
}, 15 * 60 * 1000);

// Run initial sweep on module load
cleanupStaleSessions();

module.exports = {
  SESSIONS_ROOT,
  isValidSessionId,
  generateSessionId,
  getOrCreateSessionId,
  attachSessionCookie,
  ensureSessionDirs,
  safeSessionPath,
  sanitizeFileName,
  isAllowedMediaFile,
  cleanupStaleSessions,
  applySecurityHeaders,
  purgeSession,
  purgeRawUploads
};
