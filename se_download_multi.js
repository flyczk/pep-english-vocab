// 批量下载多个官方音频（用 storageState，抓播放响应体）
const path = require('path');
const fs = require('fs');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const AUTH = '/tmp/se_auth.json';
const OUTDIR = '/tmp/u1_secA';
const JOBS = [
  { name: 'u1_a_1b', id: 'a73cb075-1868-a559-c629-73ec20caf9e9', title: 'Unit 1 Section A, 1b' },
  { name: 'u1_a_1c', id: '1a2786b8-efaf-b505-f950-205f33a1ccb3', title: 'Unit 1 Section A, 1c' },
  { name: 'u1_a_2a', id: 'ead7898f-4b2d-2d3a-0b53-83bd46b43da6', title: 'Unit 1 Section A, 2a' },
  { name: 'u1_a_2d', id: '865c1cb2-0a81-b659-ef9e-304522265f70', title: 'Unit 1 Section A, 2d' },
];

(async () => {
  if (!fs.existsSync(AUTH)) { console.error('NO AUTH'); process.exit(1); }
  fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1280, height: 900 } });

  for (const job of JOBS) {
    const out = path.join(OUTDIR, job.name + '.mp3');
    if (fs.existsSync(out) && fs.statSync(out).size > 500000) { console.log('[skip] ' + job.name); continue; }
    const page = await ctx.newPage();
    let best = null;
    page.on('response', async (res) => {
      const u = res.url();
      if (/\.mp3(\?|$)|transcode\/audios\//.test(u) && !/ai-assistant/.test(u)) {
        try { const b = await res.body(); if (b.length > 300000 && (!best || b.length > best.b.length)) best = { u, b }; } catch (e) {}
      }
    });
    try {
      await page.goto('https://basic.smartedu.cn/syncClassroom/detail?resourceId=' + job.id + '&resourceType=listening', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(6000);
      await page.evaluate(() => {
        document.querySelectorAll('audio, video').forEach(el => { try { el.play(); } catch (e) {} });
      });
      await page.waitForTimeout(10000);
    } catch (e) { console.log('[err] ' + job.name + ': ' + e.message.slice(0, 100)); }
    if (best && best.b.length > 300000) {
      fs.writeFileSync(out, best.b);
      console.log('[OK] ' + job.name + ' <- ' + best.u.slice(0, 120) + ' (' + Math.round(best.b.length / 1024) + 'KB)');
    } else {
      console.log('[FAIL] ' + job.name + ' — 未抓到音频（登录态可能过期）');
    }
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error('ERR ' + e.message); process.exit(1); });
