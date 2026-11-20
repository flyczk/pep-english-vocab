// 有头浏览器：等用户在窗口里登录，成功后保存 storageState
const path = require('path');
const fs = require('fs');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));

const OUT = process.argv[2] || '/tmp/se_auth.json';
const WAIT_MS = Number(process.argv[3] || 300000); // 默认等 5 分钟

(async () => {
  console.log('[launch] headless=false ...');
  const browser = await pw.chromium.launch({ headless: false, args: ['--no-sandbox', '--window-size=1280,900'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  await page.goto('https://auth.smartedu.cn/uias/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.bringToFront();
  console.log('[ready] 登录页已打开并置顶，请在窗口里完成登录');
  console.log('[ready] 账号密码 / 扫码 / 短信验证均可，登录成功后我会自动检测到并继续');

  const start = Date.now();
  let ok = false;
  while (Date.now() - start < WAIT_MS) {
    await page.waitForTimeout(3000);
    try {
      const state = await page.evaluate(() => {
        const body = document.body.innerText || '';
        const hasLoginBtn = /(^|\n)\s*登录\s*(\n|$)/.test(body);
        const hasLogout = /退出登录|个人中心|我的空间/.test(body);
        const ls = Object.keys(localStorage).filter((k) => /token|session|auth|user/i.test(k) && !/STAT/i.test(k));
        return { hasLoginBtn, hasLogout, ls: ls.slice(0, 5), url: location.href.slice(0, 120) };
      });
      const isLoginPage = /auth\.smartedu\.cn|uias\/login|sso\.basic/.test(state.url);
      if ((state.hasLogout || (!state.hasLoginBtn && state.ls.length)) && !isLoginPage) {
        console.log('[login detected] ' + JSON.stringify(state));
        ok = true;
        break;
      }
      if (Math.round((Date.now() - start) / 1000) % 20 === 0) {
        console.log('[waiting] ' + Math.round((Date.now() - start) / 1000) + 's | ' + JSON.stringify(state));
      }
    } catch (e) { /* page navigating */ }
  }

  if (ok) {
    await ctx.storageState({ path: OUT });
    console.log('[saved] ' + OUT);
  } else {
    console.log('[timeout] 未检测到登录');
  }
  await browser.close();
  process.exit(ok ? 0 : 2);
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
