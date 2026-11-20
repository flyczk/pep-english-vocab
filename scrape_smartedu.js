// 抓取国家中小学智慧教育平台同步课堂页面的音频资源请求
const path = require('path');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const URL = process.argv[2] || 'https://basic.smartedu.cn/syncClassroom?defaultTag=e7bbce2c-0590-11ed-9c79-92fc3b3249d5%2F44bec67a-54e6-11ed-9c34-850ba61fa9f4%2F6a7495dc-0772-11ed-ac74-092ab92074e6%2Fff8080814371757b01437c363a187b0a%2Fff8080814371757b014390f883db0453%2F5136342961';

(async () => {
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const audioReqs = [];
  const apiReqs = [];
  page.on('request', (req) => {
    const u = req.url();
    if (/\.(mp3|m4a|aac|wav|ogg)(\?|$)/i.test(u)) audioReqs.push(u);
    if (/api\.ykt\.cbern|cbern\.com\.cn/i.test(u) && !/\.(js|css|png|jpg|svg|woff)/i.test(u)) {
      apiReqs.push(req.method() + ' ' + u);
    }
  });

  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {
    console.log('goto note: ' + e.message.slice(0, 120));
  }
  await page.waitForTimeout(6000);

  // 尝试点击可能展开资源列表的元素
  try {
    const texts = await page.$$eval('text=/Unit|单元|课文|音频|朗读/', (els) => els.length);
    console.log('candidate clickable texts: ' + texts);
  } catch (e) {}

  console.log('\n===== AUDIO REQUESTS (' + audioReqs.length + ') =====');
  audioReqs.slice(0, 40).forEach((u) => console.log(u.slice(0, 300)));

  console.log('\n===== API REQUESTS (' + apiReqs.length + ') =====');
  apiReqs.slice(0, 60).forEach((u) => console.log(u.slice(0, 300)));

  // 页面可见文本摘要
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  console.log('\n===== PAGE TEXT =====\n' + bodyText);

  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
