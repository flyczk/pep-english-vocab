// 用正确的详情页 URL 格式打开听力资源，抓音频文件 URL
const path = require('path');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const RES = process.argv[2] || '3e89e120-a4a8-cb23-731f-4a4b702a3623'; // Unit 1 Section B, 1b
const URL = 'https://basic.smartedu.cn/syncClassroom/detail?resourceId=' + RES + '&resourceType=listening';

(async () => {
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const audioUrls = [];
  const jsonUrls = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/\.(mp3|m4a|m3u8|aac)(\?|$)/i.test(u)) audioUrls.push(u.slice(0, 500));
    if (/\.json(\?|$)/i.test(u) && /ndr|resource|detail/i.test(u)) jsonUrls.push(u.slice(0, 400));
  });
  page.on('response', async (res) => {
    const ct = res.headers()['content-type'] || '';
    if (/audio\/|mpeg|mp3|m4a/i.test(ct)) audioUrls.push('RESP ' + res.url().slice(0, 500));
  });

  try { await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch (e) { console.log('note ' + e.message.slice(0, 80)); }
  await page.waitForTimeout(15000);

  // 尝试点播放按钮
  try {
    const btn = page.locator('button, [class*="play"], [class*="Play"], svg').first();
    await btn.click({ timeout: 6000 });
    console.log('clicked play-ish element');
    await page.waitForTimeout(10000);
  } catch (e) { console.log('no play button: ' + e.message.slice(0, 80)); }

  console.log('final url: ' + page.url());
  console.log('\n===== AUDIO (' + audioUrls.length + ') =====');
  [...new Set(audioUrls)].forEach((u) => console.log(u));
  console.log('\n===== JSON (' + jsonUrls.length + ') =====');
  [...new Set(jsonUrls)].slice(0, 20).forEach((u) => console.log(u));

  const t = await page.evaluate(() => document.body.innerText.slice(0, 700));
  console.log('\n===== PAGE TEXT =====\n' + t);
  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
