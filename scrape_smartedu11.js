// 打开详情页 → 点播放器海报 → 抓资源 CDN 全部请求
const path = require('path');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const RES = process.argv[2] || '3e89e120-a4a8-cb23-731f-4a4b702a3623';
const URL = 'https://basic.smartedu.cn/syncClassroom/detail?resourceId=' + RES + '&resourceType=listening';

(async () => {
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const cdn = [];
  const any = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/r[0-9]-ndr\.ykt\.cbern\.com\.cn|cdncs\.ykt|s-file-[0-9]\.ykt/i.test(u)) cdn.push(r.method() + ' ' + u.slice(0, 450));
    if (/audio|media|stream|\.ts(\?|$)|m3u8/i.test(u) && !/\.(js|css|png|svg)/i.test(u)) any.push(u.slice(0, 450));
  });
  page.on('response', (res) => {
    const ct = res.headers()['content-type'] || '';
    if (/audio|octet-stream|mpegurl/i.test(ct)) any.push('RESP ' + res.url().slice(0, 450));
  });

  try { await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch (e) {}
  await page.waitForTimeout(6000);

  console.log('--- 初始 CDN 请求 ---');
  [...new Set(cdn)].slice(0, 15).forEach((u) => console.log(u));

  // 点播放器海报 / 播放按钮
  for (const sel of ['.course-player-poster', '.course-detail-player', '.study-list-icon-play']) {
    try {
      await page.click(sel, { timeout: 5000 });
      console.log('clicked ' + sel);
      break;
    } catch (e) { console.log('miss ' + sel); }
  }
  await page.waitForTimeout(18000);

  console.log('\n===== CDN REQUESTS (' + cdn.length + ') =====');
  [...new Set(cdn)].forEach((u) => console.log(u));
  console.log('\n===== AUDIO/STREAM (' + any.length + ') =====');
  [...new Set(any)].forEach((u) => console.log(u));

  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
