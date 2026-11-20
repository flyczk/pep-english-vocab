// 在同步课堂页面点击「Unit 1 Section B, 1b」，抓取音频文件真实 URL（含新标签页处理）
const path = require('path');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const URL = 'https://basic.smartedu.cn/syncClassroom?defaultTag=e7bbce2c-0590-11ed-9c79-92fc3b3249d5%2F44bec67a-54e6-11ed-9c34-850ba61fa9f4%2F6a7495dc-0772-11ed-ac74-092ab92074e6%2Fff8080814371757b01437c363a187b0a%2Fff8080814371757b014390f883db0453%2F5136342961';
const TARGET = process.argv[2] || 'Section B, 1b';

(async () => {
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const audioReqs = [];
  const mediaPages = [];

  const watch = (p, tag) => {
    p.on('request', (req) => {
      const u = req.url();
      if (/\.(mp3|m4a|aac|wav|ogg|mp4)(\?|$)/i.test(u)) audioReqs.push('[' + tag + '] ' + u);
    });
    p.on('popup', (np) => watch(np, tag + '/popup'));
  };
  watch(page, 'main');
  ctx.on('page', (p) => { mediaPages.push(p.url()); watch(p, 'newtab'); });

  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {}
  await page.waitForTimeout(5000);

  // 用 JS 找到含目标文本的元素并点击（比 locator 更稳）
  const clicked = await page.evaluate((txt) => {
    const els = Array.from(document.querySelectorAll('a, li, div[role], span'));
    const hit = els.find((e) => (e.innerText || '').trim().startsWith(txt) && (e.innerText || '').length < 80);
    if (!hit) return 'not found';
    const r = hit.getBoundingClientRect();
    (hit.closest('a') || hit).click();
    return 'clicked at ' + Math.round(r.x) + ',' + Math.round(r.y) + ' text=' + (hit.innerText || '').slice(0, 40);
  }, TARGET);
  console.log('click result: ' + clicked);
  await page.waitForTimeout(12000);

  console.log('\nnew pages: ' + JSON.stringify(mediaPages));
  console.log('current url: ' + page.url());
  console.log('\n===== AUDIO/VIDEO REQUESTS (' + audioReqs.length + ') =====');
  audioReqs.slice(0, 15).forEach((u) => console.log(u.slice(0, 500)));

  // 若仍无音频，尝试点播放按钮
  if (!audioReqs.length) {
    try {
      const play = page.locator('[class*="play"], [class*="Play"], svg').first();
      await play.click({ timeout: 5000 });
      await page.waitForTimeout(8000);
      console.log('\n===== AFTER PLAY CLICK (' + audioReqs.length + ') =====');
      audioReqs.slice(0, 15).forEach((u) => console.log(u.slice(0, 500)));
    } catch (e) { console.log('play click failed: ' + e.message.slice(0, 100)); }
  }

  const t = await page.evaluate(() => document.body.innerText.slice(0, 600));
  console.log('\n===== PAGE TEXT =====\n' + t);

  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
