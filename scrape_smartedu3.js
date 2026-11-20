// 抓资源列表/详情接口的响应体，找到音频文件 URL 模式
const path = require('path');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const URL = 'https://basic.smartedu.cn/syncClassroom?defaultTag=e7bbce2c-0590-11ed-9c79-92fc3b3249d5%2F44bec67a-54e6-11ed-9c34-850ba61fa9f4%2F6a7495dc-0772-11ed-ac74-092ab92074e6%2Fff8080814371757b01437c363a187b0a%2Fff8080814371757b014390f883db0453%2F5136342961';

(async () => {
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const saved = [];
  const audioReqs = [];
  const newPages = [];

  ctx.on('page', (p) => { newPages.push(p); });

  page.on('response', async (res) => {
    const u = res.url();
    if (/\.(mp3|m4a|aac|wav|ogg)(\?|$)/i.test(u)) audioReqs.push(u);
    if (/x-api\.ykt\.eduyun\.cn/i.test(u)) {
      try {
        const ct = res.headers()['content-type'] || '';
        if (/json/i.test(ct)) {
          const body = await res.text();
          if (body.length > 50) saved.push({ url: u.slice(0, 250), len: body.length, body: body.slice(0, 2500) });
        }
      } catch (e) {}
    }
  });

  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {}
  await page.waitForTimeout(5000);

  console.log('===== X-API RESPONSES (' + saved.length + ') =====');
  saved.forEach((s, i) => {
    console.log('\n--- [' + i + '] ' + s.url + ' (' + s.len + ' bytes)');
    console.log(s.body);
  });

  console.log('\n===== AUDIO URLS (' + audioReqs.length + ') =====');
  audioReqs.forEach((u) => console.log(u.slice(0, 400)));

  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
