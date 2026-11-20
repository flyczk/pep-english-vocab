// 点击同步课堂里的具体资源，抓取真实音频 URL
const path = require('path');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const URL = 'https://basic.smartedu.cn/syncClassroom?defaultTag=e7bbce2c-0590-11ed-9c79-92fc3b3249d5%2F44bec67a-54e6-11ed-9c34-850ba61fa9f4%2F6a7495dc-0772-11ed-ac74-092ab92074e6%2Fff8080814371757b01437c363a187b0a%2Fff8080814371757b014390f883db0453%2F5136342961';

(async () => {
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const audioReqs = [];
  const apiReqs = [];
  page.on('request', (req) => {
    const u = req.url();
    if (/\.(mp3|m4a|aac|wav|ogg)(\?|$)/i.test(u)) audioReqs.push(u);
    if (/api\.ykt|cbern\.com\.cn/i.test(u) && !/\.(js|css|png|jpg|svg|woff|yml)/i.test(u)) {
      apiReqs.push(req.method() + ' ' + u);
    }
  });

  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) { console.log('goto note: ' + e.message.slice(0, 100)); }
  await page.waitForTimeout(4000);

  // 列出所有可点击的资源标题
  const items = await page.$$eval('a, [role="button"], li, div', (els) =>
    els
      .map((e) => (e.innerText || '').trim())
      .filter((t) => t && t.length < 60 && /Section|Unit|听力|课程包/i.test(t))
      .slice(0, 60)
  );
  console.log('===== CANDIDATE ITEMS =====');
  console.log(JSON.stringify([...new Set(items)], null, 0));

  // 点击第一个 "Section A, 1b" 资源
  try {
    const target = page.locator('text=Section A, 1b').first();
    await target.click({ timeout: 8000 });
    console.log('\nclicked "Section A, 1b"');
    await page.waitForTimeout(9000);
  } catch (e) {
    console.log('click failed: ' + e.message.slice(0, 150));
    // 尝试点任意含 1b 的元素
    try {
      await page.locator('text=/Section A, 1b/').first().click({ timeout: 5000 });
      await page.waitForTimeout(9000);
    } catch (e2) { console.log('retry failed: ' + e2.message.slice(0, 120)); }
  }

  console.log('\n===== AUDIO REQUESTS (' + audioReqs.length + ') =====');
  audioReqs.slice(0, 20).forEach((u) => console.log(u.slice(0, 400)));

  console.log('\n===== API REQUESTS (' + apiReqs.length + ') =====');
  apiReqs.slice(0, 40).forEach((u) => console.log(u.slice(0, 350)));

  // 当前页面文本（资源详情）
  const detail = await page.evaluate(() => document.body.innerText.slice(0, 1200));
  console.log('\n===== PAGE TEXT AFTER CLICK =====\n' + detail);
  console.log('\n===== CURRENT URL =====\n' + page.url());

  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
