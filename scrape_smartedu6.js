// 滚动加载资源列表 → 点击目标资源 → 抓所有媒体相关请求
const path = require('path');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const URL = 'https://basic.smartedu.cn/syncClassroom?defaultTag=e7bbce2c-0590-11ed-9c79-92fc3b3249d5%2F44bec67a-54e6-11ed-9c34-850ba61fa9f4%2F6a7495dc-0772-11ed-ac74-092ab92074e6%2Fff8080814371757b01437c363a187b0a%2Fff8080814371757b014390f883db0453%2F5136342961';
const TARGET = process.argv[2] || 'Section B, 1b';

(async () => {
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();

  const all = [];
  const audioish = [];
  page.on('request', (req) => {
    const u = req.url();
    if (/\.(m3u8|mp3|m4a|aac|ts|mp4)(\?|$)/i.test(u) || /ndr|cdncs|media|audio|video/i.test(u)) {
      audioish.push(u.slice(0, 400));
    }
    if (/x-api\.ykt|eduyun\.cn\/proxy/i.test(u) && !/\.(js|css|png|svg|woff)/i.test(u)) {
      all.push(req.method() + ' ' + u.slice(0, 300));
    }
  });

  try { await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) {}
  await page.waitForTimeout(4000);

  // 滚动触发懒加载
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(3000);

  const found = await page.locator('text=' + TARGET).count();
  console.log('target occurrences: ' + found);

  if (found > 0) {
    try {
      await page.locator('text=' + TARGET).first().click({ timeout: 10000 });
      console.log('clicked ' + TARGET);
    } catch (e) { console.log('click err: ' + e.message.slice(0, 120)); }
    await page.waitForTimeout(15000);
  }

  console.log('\nfinal url: ' + page.url());
  console.log('\n===== AUDIOISH (' + audioish.length + ') =====');
  [...new Set(audioish)].slice(0, 25).forEach((u) => console.log(u));
  console.log('\n===== X-API (' + all.length + ') =====');
  [...new Set(all)].slice(0, 30).forEach((u) => console.log(u));

  const t = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log('\n===== PAGE TEXT =====\n' + t);

  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
