// 访问资源详情页，抓音频文件 URL
const path = require('path');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const RES_ID = 'a73cb075-1868-a559-c629-73ec20caf9e9'; // Unit 1 Section A, 1b
const CANDIDATES = [
  'https://basic.smartedu.cn/tResource/' + RES_ID,
  'https://basic.smartedu.cn/syncClassroom/detail?contentId=' + RES_ID + '&contentType=listening&catalogType=syncClassroom',
];

(async () => {
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const audioReqs = [];
  const interesting = [];

  page.on('request', (req) => {
    const u = req.url();
    if (/\.(mp3|m4a|aac|wav|ogg)(\?|$)/i.test(u)) audioReqs.push(u);
    if (/ndr|cdncs|file\.ykt|resource.*(url|file|audio|media)/i.test(u) && !/\.(js|css|png|jpg|svg)/i.test(u)) {
      interesting.push(u.slice(0, 400));
    }
  });

  for (const url of CANDIDATES) {
    console.log('\n########## TRYING: ' + url);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    } catch (e) { console.log('goto note: ' + e.message.slice(0, 100)); }
    await page.waitForTimeout(8000);
    console.log('final url: ' + page.url());
    const t = await page.evaluate(() => document.body.innerText.slice(0, 700));
    console.log('--- page text ---\n' + t);
    if (audioReqs.length) break;
  }

  console.log('\n===== AUDIO REQUESTS (' + audioReqs.length + ') =====');
  audioReqs.slice(0, 10).forEach((u) => console.log(u));
  console.log('\n===== INTERESTING (' + interesting.length + ') =====');
  [...new Set(interesting)].slice(0, 20).forEach((u) => console.log(u));

  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
