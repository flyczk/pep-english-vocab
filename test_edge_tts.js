// 测试 Microsoft Edge 在线 TTS（神经网络语音，音质远高于有道/百度）
const path = require('path');
const pw = require(path.join('/Users/jeffchen/.workbuddy/binaries/node/workspace/node_modules', 'playwright'));
const { chromium } = pw;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // 在页面上下文里测 WebSocket 连接与语音列表
  const result = await page.evaluate(async () => {
    const out = { wsOk: false, voices: [], error: '', audioBytes: 0 };
    const endpoint =
      'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1' +
      '?TrustedClientToken=6A5AA5D4EAFF4E9FB37E23D68461D653' +
      '&Sec-MS-GEC=A2EBE7D2E1F54A1B9C0F0A0A0A0A0A0A' +
      '&Sec-MS-GEC-Version=1-130.0.2849.68' +
      '&ConnectionId=a1b2c3d4e5f60718293a4b5c6d7e8f90';
    try {
      const ws = new WebSocket(endpoint);
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('ws timeout 8s')), 8000);
        ws.onopen = () => { clearTimeout(t); out.wsOk = true; resolve(); };
        ws.onerror = () => { clearTimeout(t); reject(new Error('ws error')); };
      });
      ws.close();
    } catch (e) {
      out.error = String(e && e.message ? e.message : e).slice(0, 150);
    }
    return out;
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((e) => { console.error('ERR ' + e.message); process.exit(1); });
