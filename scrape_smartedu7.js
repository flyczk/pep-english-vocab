// 直接导航到听力资源详情页，抓全部网络请求（不过滤）
const path = require('path');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const RES = '3e89e120-a4a8-cb23-731f-4a4b702a3623'; // Unit 1 Section B, 1b
const urls = [
  'https://basic.smartedu.cn/syncClassroom/detail?contentId=' + RES + '&contentType=listening&catalogType=syncClassroom',
];

(async () => {
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();

  const reqs = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/\.(js|css|png|jpg|jpeg|svg|woff2?|ico|gif)(\?|$)/i.test(u)) return;
    if (/^data:|^blob:/i.test(u)) return;
    reqs.push(r.method() + ' ' + u.slice(0, 350));
  });

  for (const u of urls) {
    console.log('#### ' + u);
    try { await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch (e) { console.log('note ' + e.message.slice(0, 80)); }
    await page.waitForTimeout(20000);
    console.log('final: ' + page.url());
  }

  console.log('\n===== ALL REQUESTS (' + reqs.length + ') =====');
  [...new Set(reqs)].forEach((u) => console.log(u));

  const t = await page.evaluate(() => document.body.innerText.slice(0, 800));
  console.log('\n===== PAGE TEXT =====\n' + t);
  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
