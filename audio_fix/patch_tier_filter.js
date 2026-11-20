const fs = require('fs');
const p = '/var/www/words/server/server.js';
let s = fs.readFileSync(p, 'utf8');
let n = 0;

// 1) due 统计：extended 不计入待复习
const a_old = `SELECT COUNT(*) AS c FROM user_sentence_stats st
       WHERE st.user_id = ?
         AND (st.mastered_at IS NULL OR st.mastered_at = '')
         AND st.next_review_at IS NOT NULL
         AND st.next_review_at <= ?`;
const a_new = `SELECT COUNT(*) AS c FROM user_sentence_stats st
       JOIN sentences sx ON sx.id = st.sentence_id
       WHERE st.user_id = ?
         AND (st.mastered_at IS NULL OR st.mastered_at = '')
         AND st.next_review_at IS NOT NULL
         AND st.next_review_at <= ?
         AND COALESCE(sx.tier,'core') = 'core'`;
if (s.includes(a_old)) { s = s.replace(a_old, a_new); n++; }

// 2) due 列表：extended 不进复习队列
const b_old = `WHERE st.user_id = ?
       AND (st.mastered_at IS NULL OR st.mastered_at = '')
       AND st.next_review_at IS NOT NULL
       AND st.next_review_at <= ?
     ORDER BY st.next_review_at ASC, s.lesson_id, s.sort_order`;
const b_new = `WHERE st.user_id = ?
       AND (st.mastered_at IS NULL OR st.mastered_at = '')
       AND st.next_review_at IS NOT NULL
       AND st.next_review_at <= ?
       AND COALESCE(s.tier,'core') = 'core'
     ORDER BY st.next_review_at ASC, s.lesson_id, s.sort_order`;
if (s.includes(b_old)) { s = s.replace(b_old, b_new); n++; }

fs.writeFileSync(p, s);
console.log('patched ' + n + '/2 queries');
if (n !== 2) process.exit(1);
