// 抓 listening 资源详情 JSON 的响应体（含音频文件 URL）
const path = require('path');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const RES = process.argv[2] || '3e89e120-a4a8-cb23-731f-4a4b702a3623';
const URL = 'https://basic.smartedu.cn/syncClassroom/detail?resourceId=' + RES + '&resourceType=listening';

(async () => {
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const bodies = [];
  page.on('response', async (res) => {
    const u = res.url();
    if (/listening\/resources\/(details|3e89e120)/.test(u) || /relation_resource/.test(u)) {
      try {
        const b = await res.text();
        bodies.push({ u: u.slice(0, 250), b: b.slice(0, 6000) });
      } catch (e) {}
    }
  });

  try { await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) {}
  await page.waitForTimeout(10000);

  console.log('===== CAPTURED ' + bodies.length + ' JSON BODIES =====');
  bodies.forEach((x) => {
    console.log('\n########## ' + x.u);
    console.log(x.b);
  });

  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
