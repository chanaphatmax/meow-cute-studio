/**
 * Meow Cute (เหมียวน่ารัก) — Enterprise Video Editor Studio Server
 * 
 * Features:
 * - High-speed Local & Server Deployment (3350, 3300)
 * - Multi-Tenant Ephemeral Session Isolation (Zero Data Retention)
 * - Anti-Path Traversal & Command Injection Defense
 * - HTTP 206 Partial-Content Video/Audio Streaming
 * - AI Director & High-Precision 3:4 Render Pipeline Integration
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const sessionSandbox = require('./session_sandbox');

const PORTS = process.env.PORT ? [parseInt(process.env.PORT, 10)] : [3350, 3300];
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function sendJson(res, status, data) {
  sessionSandbox.applySecurityHeaders(res);
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const str = Buffer.concat(chunks).toString('utf-8');
        resolve(str ? JSON.parse(str) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function handleRequest(req, res) {
  // Global CORS and Preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, X-File-Name, X-Subtitle-Mode, X-Session-ID');

  if (req.method === 'OPTIONS') {
    sessionSandbox.applySecurityHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // Extract or generate tenant session ID
  const sessionId = sessionSandbox.getOrCreateSessionId(req, parsedUrl);
  sessionSandbox.attachSessionCookie(res, sessionId);

  // 1. GET /api/session/init -> Tenant handshake
  if (req.method === 'GET' && pathname === '/api/session/init') {
    const dirs = sessionSandbox.ensureSessionDirs(sessionId);
    return sendJson(res, 200, {
      ok: true,
      sessionId,
      status: 'active'
    });
  }

  // 2. GET /api/init-data -> Starts 100% clean with zero pre-loaded demo videos
  if (req.method === 'GET' && pathname === '/api/init-data') {
    return sendJson(res, 200, {
      ok: true,
      projects: {},
      audioAnalysis: {}
    });
  }

  // 2B. POST/GET /api/session/purge -> Instant Zero-Retention session wipe
  if ((req.method === 'POST' || req.method === 'GET') && pathname === '/api/session/purge') {
    const success = sessionSandbox.purgeSession(sessionId);
    return sendJson(res, 200, { ok: true, purged: success, message: 'All session data purged successfully' });
  }

  // 2C. POST /api/session/purge-raw -> Purges raw source videos keeping only renders
  if (req.method === 'POST' && pathname === '/api/session/purge-raw') {
    const success = sessionSandbox.purgeRawUploads(sessionId);
    return sendJson(res, 200, { ok: true, purged: success, message: 'Raw uploads purged' });
  }

  // 3. POST /api/upload -> Isolated single-clip upload & Human-Like AI Director Analysis
  if (req.method === 'POST' && pathname === '/api/upload') {
    try {
      const { srcDir } = sessionSandbox.ensureSessionDirs(sessionId);
      const rawName = decodeURIComponent(req.headers['x-file-name'] || `upload_${Date.now()}.mp4`);
      const safeName = sessionSandbox.sanitizeFileName(rawName);

      if (!sessionSandbox.isAllowedMediaFile(safeName)) {
        return sendJson(res, 400, { ok: false, error: 'รองรับเฉพาะไฟล์วิดีโอ MP4, MOV, WebM, M4V เท่านั้น' });
      }

      const subMode = (req.headers['x-subtitle-mode'] === 'full') ? 'full' : 'keywords';
      const uploadPath = path.join(srcDir, `raw_${Date.now()}_${safeName}`);
      const finalName = `custom_${Date.now()}.mp4`;
      const finalPath = path.join(srcDir, finalName);

      const ws = fs.createWriteStream(uploadPath);
      req.pipe(ws);
      ws.on('finish', () => {
        const pyNormalize = `
import subprocess, os, json, cv2, imageio_ffmpeg, shutil
import ai_director_engine
if hasattr(os.sys.stdout, 'reconfigure'): os.sys.stdout.reconfigure(encoding='utf-8')
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
in_p = r'''${uploadPath}'''
final_p = r'''${finalPath}'''
ext = os.path.splitext(in_p)[1].lower()
cap = cv2.VideoCapture(in_p)
readable = cap.isOpened() and (cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0) > 0
cap.release()
if ext == '.mp4' and readable:
    try: os.replace(in_p, final_p)
    except Exception: shutil.copy2(in_p, final_p)
else:
    subprocess.run([ffmpeg, '-y', '-i', in_p, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', final_p], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try: os.remove(in_p)
    except Exception: pass
cap = cv2.VideoCapture(final_p)
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
dur = round(frames / fps, 2) if fps > 0 else 5.0
cap.release()
plan = ai_director_engine.analyze_custom_video_human_like(final_p, mode='${subMode}')
rel_path = 'user_sessions/${sessionId}/source_videos/${finalName}'
print(json.dumps({'ok': True, 'sourcePath': rel_path, 'duration': dur, 'fileName': '${safeName}', 'plan': plan}, ensure_ascii=False))
`;
        const proc = spawn('python', ['-c', pyNormalize], { cwd: ROOT });
        let out = '';
        proc.stdout.on('data', d => { out += d.toString('utf-8'); });
        proc.stderr.on('data', d => { console.error('Upload py err:', d.toString('utf-8')); });
        proc.on('close', () => {
          try {
            const lines = out.trim().split('\n');
            sendJson(res, 200, JSON.parse(lines[lines.length - 1]));
          } catch (e) {
            sendJson(res, 500, { ok: false, error: 'Video analysis failed', raw: out });
          }
        });
      });
      ws.on('error', err => sendJson(res, 500, { ok: false, error: String(err) }));
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: String(err.message || err) });
    }
    return;
  }

  // 4. POST /api/upload-raw -> Instant upload & fast OpenCV probe for Multi-Clip Merger
  if (req.method === 'POST' && pathname === '/api/upload-raw') {
    try {
      const { srcDir } = sessionSandbox.ensureSessionDirs(sessionId);
      const rawName = decodeURIComponent(req.headers['x-file-name'] || `subclip_${Date.now()}.mp4`);
      const safeName = sessionSandbox.sanitizeFileName(rawName);

      if (!sessionSandbox.isAllowedMediaFile(safeName)) {
        return sendJson(res, 400, { ok: false, error: 'รองรับเฉพาะไฟล์วิดีโอ MP4, MOV, WebM, M4V เท่านั้น' });
      }

      const uid = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const finalName = `sub_${uid}_${safeName}`;
      const finalPath = path.join(srcDir, finalName);

      const ws = fs.createWriteStream(finalPath);
      req.pipe(ws);
      ws.on('finish', () => {
        const pyFastProbe = `
import os, json, cv2
if hasattr(os.sys.stdout, 'reconfigure'): os.sys.stdout.reconfigure(encoding='utf-8')
in_p = r'''${finalPath}'''
cap = cv2.VideoCapture(in_p)
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 720
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 960
dur = round(frames / fps, 2) if (fps > 0 and frames > 0) else 5.0
cap.release()
rel_p = 'user_sessions/${sessionId}/source_videos/' + os.path.basename(in_p)
print(json.dumps({'ok': True, 'sourcePath': rel_p, 'duration': max(0.2, dur), 'width': w, 'height': h, 'fileName': '${safeName}'}, ensure_ascii=False))
`;
        const proc = spawn('python', ['-c', pyFastProbe], { cwd: ROOT });
        let out = '';
        proc.stdout.on('data', d => { out += d.toString('utf-8'); });
        proc.on('close', () => {
          try {
            const lines = out.trim().split('\n');
            sendJson(res, 200, JSON.parse(lines[lines.length - 1]));
          } catch (e) {
            sendJson(res, 500, { ok: false, error: String(e) });
          }
        });
      });
      ws.on('error', err => sendJson(res, 500, { ok: false, error: String(err) }));
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: String(err.message || err) });
    }
    return;
  }

  // 5. POST /api/merge-clips -> Multi-clip merger executed strictly inside tenant workspace
  if (req.method === 'POST' && pathname === '/api/merge-clips') {
    readJsonBody(req).then(mergeCfg => {
      try {
        const { srcDir, tempDir } = sessionSandbox.ensureSessionDirs(sessionId);
        const ts = Date.now();
        const cfgFile = path.join(tempDir, `merge_cfg_${ts}.json`);
        const outName = `merged_${ts}.mp4`;
        const outPath = path.join(srcDir, outName);

        // Security check: verify all clip paths belong to this session or are valid
        if (Array.isArray(mergeCfg.clips)) {
          mergeCfg.clips.forEach(c => {
            if (c.sourcePath && c.sourcePath.includes('user_sessions/')) {
              // Ensure it belongs strictly to this sessionId
              const expectedPrefix = `user_sessions/${sessionId}/`;
              if (!c.sourcePath.replace(/\\/g, '/').includes(expectedPrefix)) {
                throw new Error('Security Violation: Cannot access clips from another session');
              }
            }
          });
        }

        fs.writeFileSync(cfgFile, JSON.stringify(mergeCfg, null, 2), 'utf-8');
        const proc = spawn('python', [path.join(ROOT, 'ai_director_engine.py'), '--merge', cfgFile, outPath], { cwd: ROOT });
        let out = '';
        proc.stdout.on('data', d => { out += d.toString('utf-8'); });
        proc.stderr.on('data', d => { console.error('Merge py err:', d.toString('utf-8')); });
        proc.on('close', () => {
          try { if (fs.existsSync(cfgFile)) fs.unlinkSync(cfgFile); } catch (e) {}
          try {
            const lines = out.trim().split('\n');
            const parsed = JSON.parse(lines[lines.length - 1]);
            // Ensure sourcePath returned points to session path
            if (parsed && parsed.ok && parsed.sourcePath) {
              parsed.sourcePath = `user_sessions/${sessionId}/source_videos/${outName}`;
            }
            sendJson(res, 200, parsed);
          } catch (e) {
            sendJson(res, 500, { ok: false, error: 'Merge clips parse error', raw: out });
          }
        });
      } catch (err) {
        sendJson(res, 403, { ok: false, error: String(err.message || err) });
      }
    }).catch(err => sendJson(res, 400, { ok: false, error: String(err) }));
    return;
  }

  // 6. POST /api/ai-auto-edit & POST /api/transcribe -> AI Director on tenant video
  if (req.method === 'POST' && (pathname === '/api/ai-auto-edit' || pathname === '/api/transcribe')) {
    readJsonBody(req).then(body => {
      try {
        const rawSource = body.sourcePath || '';
        let targetAbsPath = '';

        if (rawSource.startsWith('user_sessions/')) {
          // Verify session isolation
          const cleanRel = rawSource.replace(/^user_sessions\/[^/]+\//, '');
          targetAbsPath = sessionSandbox.safeSessionPath(sessionId, cleanRel);
        } else if (rawSource.startsWith('source_videos/')) {
          targetAbsPath = path.join(ROOT, rawSource);
        } else {
          targetAbsPath = sessionSandbox.safeSessionPath(sessionId, path.join('source_videos', rawSource));
        }

        if (!fs.existsSync(targetAbsPath)) {
          return sendJson(res, 404, { ok: false, error: 'ไม่พบไฟล์วิดีโอที่ต้องการวิเคราะห์' });
        }

        const subMode = body.subtitleMode || 'keywords';
        const proc = spawn('python', [path.join(ROOT, 'ai_director_engine.py'), '--analyze', targetAbsPath, subMode], { cwd: ROOT });
        let out = '';
        proc.stdout.on('data', d => { out += d.toString('utf-8'); });
        proc.stderr.on('data', d => { console.error('AI Director py err:', d.toString('utf-8')); });
        proc.on('close', () => {
          try {
            const lines = out.trim().split('\n');
            const parsed = JSON.parse(lines[lines.length - 1]);
            if (parsed && parsed.ok && parsed.plan) {
              sendJson(res, 200, {
                ok: true,
                plan: parsed.plan,
                subtitles: parsed.plan.subtitles || []
              });
            } else {
              sendJson(res, 200, { ok: false, error: 'AI Director returned empty plan', raw: out });
            }
          } catch (e) {
            sendJson(res, 200, { ok: false, error: 'AI Director parse error', raw: out });
          }
        });
      } catch (err) {
        sendJson(res, 403, { ok: false, error: String(err.message || err) });
      }
    }).catch(err => sendJson(res, 400, { ok: false, error: String(err) }));
    return;
  }

  // 7. POST /api/render -> Render 3:4 High-Res MP4 into tenant's renders/ directory
  if (req.method === 'POST' && pathname === '/api/render') {
    readJsonBody(req).then(projectCfg => {
      try {
        const { renderDir, tempDir } = sessionSandbox.ensureSessionDirs(sessionId);
        const ts = Date.now();
        const cfgFile = path.join(tempDir, `render_cfg_${ts}.json`);
        const safeBaseName = sessionSandbox.sanitizeFileName(projectCfg.outputFile || `ผลงานตัดต่อ_${ts}_3x4.mp4`);
        const outName = safeBaseName.endsWith('.mp4') ? safeBaseName : `${safeBaseName}.mp4`;
        const outPath = path.join(renderDir, outName);

        // Security check on sourcePath
        if (projectCfg.sourcePath && projectCfg.sourcePath.includes('user_sessions/')) {
          const expected = `user_sessions/${sessionId}/`;
          if (!projectCfg.sourcePath.replace(/\\/g, '/').includes(expected)) {
            throw new Error('Security Violation: Cannot render video belonging to another session');
          }
        }

        fs.writeFileSync(cfgFile, JSON.stringify(projectCfg, null, 2), 'utf-8');
        const proc = spawn('python', [path.join(ROOT, 'render_engine_v3.py'), '--config', cfgFile, outPath], { cwd: ROOT });
        let logOut = '';
        proc.stdout.on('data', d => { logOut += d.toString('utf-8'); });
        proc.stderr.on('data', d => { logOut += d.toString('utf-8'); });
        proc.on('close', code => {
          try { if (fs.existsSync(cfgFile)) fs.unlinkSync(cfgFile); } catch (e) {}
          if (code === 0 && fs.existsSync(outPath)) {
            const relDownload = `/user_sessions/${sessionId}/renders/${encodeURIComponent(outName)}?sid=${sessionId}&t=${Date.now()}`;
            sendJson(res, 200, {
              ok: true,
              fileName: outName,
              downloadUrl: relDownload,
              size: fs.statSync(outPath).size
            });
          } else {
            sendJson(res, 500, { ok: false, error: 'Render failed', log: logOut });
          }
        });
      } catch (err) {
        sendJson(res, 403, { ok: false, error: String(err.message || err) });
      }
    }).catch(err => sendJson(res, 400, { ok: false, error: String(err) }));
    return;
  }

  // 8. Static Files & Multi-Tenant Video Range Streaming
  let filePath = '';
  
  // Check if requesting an isolated tenant session file: /user_sessions/<targetSid>/...
  if (pathname.startsWith('/user_sessions/')) {
    const parts = pathname.replace(/^\/user_sessions\//, '').split('/');
    const targetSid = parts[0];
    const subPath = parts.slice(1).join('/');

    // ENFORCE SESSION TENANT ISOLATION:
    // User can ONLY stream or download their own session's files!
    if (targetSid !== sessionId) {
      sessionSandbox.applySecurityHeaders(res);
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden: Tenant Session Isolation Active');
      return;
    }

    try {
      filePath = sessionSandbox.safeSessionPath(targetSid, subPath);
    } catch (err) {
      sessionSandbox.applySecurityHeaders(res);
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden: Traversal Denied');
      return;
    }
  } else {
    // Global static asset (index.html, styles.css, app.js, fonts, sfx)
    const relPath = pathname === '/' || pathname === '' ? '/index.html' : pathname;

    // Strict Whitelist for Root Public Assets (Blocks direct exposure of server.js, python scripts, json, etc.)
    const ALLOWED_ROOT_FILES = new Set([
      '/index.html',
      '/styles.css',
      '/app.js',
      '/favicon.ico',
      '/favicon-32x32.png',
      '/favicon-16x16.png',
      '/apple-touch-icon.png',
      '/apple-touch-icon-precomposed.png',
      '/icon-192.png',
      '/icon-512.png',
      '/site.webmanifest'
    ]);
    const isPublicDirectory = relPath.startsWith('/fonts/') || relPath.startsWith('/sfx/') || relPath.startsWith('/stickers/');
    if (!ALLOWED_ROOT_FILES.has(relPath) && !isPublicDirectory) {
      sessionSandbox.applySecurityHeaders(res);
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden: System File Protected');
      return;
    }

    filePath = path.resolve(ROOT, '.' + relPath);

    // Root directory traversal protection
    if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
      sessionSandbox.applySecurityHeaders(res);
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
      return;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      sessionSandbox.applySecurityHeaders(res);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const range = req.headers.range;

    sessionSandbox.applySecurityHeaders(res);

    // HTTP 206 Partial Content for smooth streaming of MP4/MOV/WAV
    if (range && (contentType.startsWith('video/') || contentType.startsWith('audio/'))) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunkSize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': (contentType.startsWith('text/') || ext === '.js') 
          ? 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' 
          : 'public, max-age=86400'
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      // If client requested ephemeral download with immediate zero-retention wipe
      if (parsedUrl.searchParams.get('cleanup') === '1') {
        res.on('finish', () => {
          setTimeout(() => {
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
          }, 3000);
        });
      }
    }
  });
}

PORTS.forEach(port => {
  const srv = http.createServer(handleRequest);
  srv.on('error', err => {
    console.warn(`Port ${port} notice:`, err.message);
  });
  srv.listen(port, () => {
    console.log(`🐱 เหมียวน่ารัก Multi-Tenant Server running at: http://localhost:${port}`);
  });
});
