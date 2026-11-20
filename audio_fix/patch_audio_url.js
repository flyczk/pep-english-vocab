const fs = require('fs');
const p = '/var/www/words/server/server.js';
let s = fs.readFileSync(p, 'utf8');
const needle = "s.genre, s.section_code, COALESCE(s.tier,'core') AS tier,";
const repl = "s.genre, s.section_code, COALESCE(s.tier,'core') AS tier, s.audio_url,";
const n = s.split(needle).length - 1;
if (n !== 3) { console.error('unexpected count: ' + n + ' (expected 3)'); process.exit(1); }
s = s.split(needle).join(repl);
fs.writeFileSync(p, s);
console.log('patched ' + n + ' sentence SELECTs with audio_url');
