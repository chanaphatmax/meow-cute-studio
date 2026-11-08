/**
 * เหมียวน่ารัก — ตัวเปิดระบบออนไลน์ 1-คลิก (100% ฟรี • ไม่ต้องมี GitHub • ไม่ต้องสมัครสมาชิก)
 */

const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = __dirname;
const CLOUDFLARED = path.join(ROOT, 'cloudflared.exe');

function copyToClipboard(text) {
  try {
    const proc = spawn('clip', [], { stdio: ['pipe', 'ignore', 'ignore'] });
    proc.stdin.write(text);
    proc.stdin.end();
  } catch (e) {}
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' });
    } else {
      spawn('open', [url], { detached: true, stdio: 'ignore' });
    }
  } catch (e) {}
}

function checkLocalServer(callback) {
  let done = false;
  const req = http.get('http://localhost:3350/api/session/init', (res) => {
    if (!done) {
      done = true;
      callback(true);
    }
  });
  req.on('error', () => {
    if (!done) {
      done = true;
      callback(false);
    }
  });
  req.setTimeout(1500, () => {
    req.destroy();
    if (!done) {
      done = true;
      callback(false);
    }
  });
}

function startOnlineTunnel() {
  console.log('\n🐱 กำลังเชื่อมต่อเครือข่ายความเร็วสูง Cloudflare Global Tunnel (ฟรี 100%)...\n');
  
  const cf = spawn(CLOUDFLARED, ['tunnel', '--url', 'http://localhost:3350'], { cwd: ROOT });
  let urlFound = false;

  const handleOutput = (data) => {
    const text = data.toString('utf-8');
    const match = text.match(/https:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com/);
    if (match && !urlFound) {
      urlFound = true;
      const liveUrl = match[0];
      copyToClipboard(liveUrl);

      console.log('======================================================================');
      console.log('  🐱 เหมียวน่ารัก — เปิดออนไลน์สำเร็จแล้ว! (100% ฟรี • ไร้ GitHub)');
      console.log('======================================================================\n');
      console.log('  🌐 ลิงก์สำหรับส่งให้เพื่อนใช้งาน:');
      console.log(`     \x1b[32m\x1b[1m${liveUrl}\x1b[0m\n`);
      console.log('  📋 คัดลอกลิงก์ลง Clipboard เรียบร้อยแล้ว (กด Ctrl + V ส่งให้เพื่อนได้ทันที)');
      console.log('  🔒 ข้อมูลใครข้อมูลมัน 100% (ทุกคนที่เข้าลิงก์จะแยกห้องทำงาน ไม่เห็นคลิปกัน)');
      console.log('  🧹 Zero Data Retention: ระบบลบไฟล์ทิ้งทันทีเมื่อตัดเสร็จหรือปิดแท็บ');
      console.log('\n======================================================================');
      console.log('  (เปิดหน้าต่างนี้ไว้เพื่อให้เพื่อนใช้งานได้ / เมื่อต้องการปิดระบบให้ปิดหน้าต่างนี้)\n');

      openBrowser(liveUrl);
    }
  };

  cf.stdout.on('data', handleOutput);
  cf.stderr.on('data', handleOutput);

  cf.on('close', (code) => {
    console.log('\nปิดระบบออนไลน์เรียบร้อยแล้ว');
  });
}

// 1. Ensure server.js is running
checkLocalServer((isRunning) => {
  if (isRunning) {
    startOnlineTunnel();
  } else {
    console.log('กำลังเริ่มต้นเซิร์ฟเวอร์ภายในเครื่อง (server.js)...');
    const srv = spawn('node', [path.join(ROOT, 'server.js')], { cwd: ROOT, stdio: 'inherit' });
    setTimeout(() => {
      startOnlineTunnel();
    }, 2000);
  }
});
