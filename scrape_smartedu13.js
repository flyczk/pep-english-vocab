// 测试：页面上下文内请求音频 URL，看是否已带鉴权
const path = require('path');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const RES = '3e89e120-a4a8-cb23-731f-4a4b702a3623';
const AUDIO =
  'https://r1-ndr-private.ykt.cbern.com.cn/edu_product/esp/listening/' + RES +
  '.t/zh-CN/1788011324143/transcode/audios/' + RES + '.mp3';
const DETAIL = 'https://basic.smartedu.cn/syncClassroom/detail?resourceId=' + RES + '&resourceType=listening';

(async () => {
  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  try { await page.goto(DETAIL, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch (e) {}
  await page.waitForTimeout(8000);

  // 1) 页面内 fetch
  const r1 = await page.evaluate(async (u) => {
    try {
      const r = await fetch(u, { credentials: 'include' });
      const buf = await r.arrayBuffer();
      return { status: r.status, len: buf.byteLength, ct: r.headers.get('content-type') };
    } catch (e) { return { err: String(e).slice(0, 200) }; }
  }, AUDIO);
  console.log('page fetch:', JSON.stringify(r1));

  // 2) Playwright request（带浏览器 cookie）
  try {
    const resp = await ctx.request.get(AUDIO, { headers: { Referer: 'https://basic.smartedu.cn/' } });
    const body = await resp.body();
    console.log('ctx.request:', resp.status(), body.length + ' bytes');
  } catch (e) { console.log('ctx.request err:', String(e).slice(0, 150)); }

  // 3) 打印当前 cookie 概况
  const cookies = await ctx.cookies();
  console.log('cookies:', cookies.map((c) => c.name).join(', ') || '(none)');

  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
