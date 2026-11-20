// 在已打开的详情页上下文里 fetch 资源详情 JSON，提取音频 URL
const path = require('path');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const RES = process.argv[2] || '3e89e120-a4a8-cb23-731f-4a4b702a3623';
const URL = 'https://basic.smartedu.cn/syncClassroom/detail?resourceId=' + RES + '&resourceType=listening';

(async () => {
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const audioUrls = [];
  page.on('request', (r) => {
    if (/\.(mp3|m4a|m3u8)(\?|$)/i.test(r.url())) audioUrls.push(r.url().slice(0, 500));
  });

  try { await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch (e) {}
  await page.waitForTimeout(8000);

  const jsonUrls = [
    'https://s-file-1.ykt.cbern.com.cn/zxx/ndrv2/listening/resources/details/' + RES + '.json',
    'https://s-file-1.ykt.cbern.com.cn/zxx/ndrs/listening/resources/' + RES + '/relation_resource.json',
  ];

  for (const ju of jsonUrls) {
    const data = await page.evaluate(async (u) => {
      try {
        const r = await fetch(u, { credentials: 'include' });
        if (!r.ok) return 'HTTP ' + r.status;
        return await r.text();
      } catch (e) { return 'ERR ' + String(e).slice(0, 120); }
    }, ju);
    console.log('\n########## ' + ju.split('/').slice(-3).join('/'));
    console.log(String(data).slice(0, 3500));
  }

  // 页面里找 audio/video 元素与播放按钮
  const media = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('audio, video').forEach((el) => out.push(el.tagName + ' src=' + (el.currentSrc || el.src || '').slice(0, 300)));
    document.querySelectorAll('[class*="play"],[class*="Play"]').forEach((el) => out.push('BTN ' + (el.className || '').toString().slice(0, 80)));
    return out;
  });
  console.log('\n===== MEDIA ELEMENTS =====');
  media.forEach((m) => console.log(m));

  // 点播放按钮
  try {
    const btns = await page.locator('[class*="play"],[class*="Play"],button').all();
    for (const b of btns.slice(0, 8)) {
      try { await b.click({ timeout: 3000 }); await page.waitForTimeout(3000); if (audioUrls.length) break; } catch (e) {}
    }
  } catch (e) {}

  console.log('\n===== AUDIO REQUESTS (' + audioUrls.length + ') =====');
  [...new Set(audioUrls)].forEach((u) => console.log(u));

  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
