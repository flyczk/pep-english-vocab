// 试不同 contentType 打开资源详情页，抓 audio 响应
const path = require('path');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const RES = '3e89e120-a4a8-cb23-731f-4a4b702a3623';
const TYPES = ['assets_audio', 'audio', 'resource', 'listening_resource', 'tResources'];

(async () => {
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });

  for (const t of TYPES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const audioUrls = [];
    page.on('response', async (res) => {
      const u = res.url();
      const ct = res.headers()['content-type'] || '';
      if (/audio|mpeg|mp3|m4a/i.test(ct) || /\.(mp3|m4a)(\?|$)/i.test(u)) audioUrls.push(u.slice(0, 400));
    });
    page.on('request', (r) => {
      const u = r.url();
      if (/\.(mp3|m4a|m3u8)(\?|$)/i.test(u)) audioUrls.push('REQ ' + u.slice(0, 400));
    });

    const url = 'https://basic.smartedu.cn/syncClassroom/detail?contentId=' + RES + '&contentType=' + t + '&catalogType=syncClassroom';
    let status = '';
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 }); } catch (e) {}
    await page.waitForTimeout(12000);
    const txt = await page.evaluate(() => {
      const b = document.body.innerText;
      const i = b.indexOf('课程');
      return (i >= 0 ? b.slice(Math.max(0, i - 100), i + 120) : b.slice(0, 300)).replace(/\n+/g, ' | ');
    });
    status = txt.slice(0, 200);
    console.log('[' + t + '] ' + status);
    if (audioUrls.length) {
      console.log('  >>> AUDIO:');
      audioUrls.forEach((u) => console.log('      ' + u));
    }
    await ctx.close();
  }

  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
