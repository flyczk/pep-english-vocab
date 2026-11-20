// 用已登录的 storageState 下载官方音频（经页面播放抓响应体，绕过 CORS）
const path = require('path');
const fs = require('fs');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const AUTH = process.argv[2] || '/tmp/se_auth.json';
const RES = process.argv[3] || '3e89e120-a4a8-cb23-731f-4a4b702a3623';
const OUT = process.argv[4] || '/tmp/u1_sectionB_1b.mp3';

(async () => {
  if (!fs.existsSync(AUTH)) { console.error('no auth state: ' + AUTH); process.exit(1); }
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // 先访问详情页，让页面逻辑解析出音频地址并加载
  const detail = 'https://basic.smartedu.cn/syncClassroom/detail?resourceId=' + RES + '&resourceType=listening';

  let audioUrl = '';
  const chunks = [];
  page.on('response', async (res) => {
    const u = res.url();
    if (/\.mp3(\?|$)/i.test(u) || /transcode\/audios\//.test(u)) {
      try {
        const b = await res.body();
        chunks.push({ u, b });
        console.log('[captured] ' + u.slice(0, 200) + ' -> ' + b.length + ' bytes');
      } catch (e) {}
    }
  });

  await page.goto(detail, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);

  // 找到 audio/video 元素并播放
  const played = await page.evaluate(async () => {
    const els = Array.from(document.querySelectorAll('audio, video'));
    for (const el of els) {
      if (el.src || el.currentSrc) {
        try { await el.play(); return (el.currentSrc || el.src).slice(0, 300); } catch (e) {}
      }
    }
    return 'no media element';
  });
  console.log('play attempt: ' + played);
  await page.waitForTimeout(12000);

  // 若没抓到，尝试直接构造 audio 元素播放（用页面里的地址）
  if (!chunks.length) {
    const urls = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('audio, video').forEach((el) => { if (el.src) out.push(el.src); });
      // 也从 React 状态里找（全局变量扫描代价高，先只查 DOM）
      return out;
    });
    console.log('dom media urls: ' + JSON.stringify(urls));
  }

  if (chunks.length) {
    // 取最大的一段（完整音频）
    chunks.sort((a, b) => b.b.length - a.b.length);
    fs.writeFileSync(OUT, chunks[0].b);
    console.log('[saved] ' + OUT + ' (' + chunks[0].b.length + ' bytes)');
  } else {
    console.log('[fail] 未捕获到音频响应');
  }

  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
