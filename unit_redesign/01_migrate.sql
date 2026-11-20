BEGIN;
ALTER TABLE sentences ADD COLUMN category TEXT DEFAULT '';
ALTER TABLE user_sentence_stats ADD COLUMN next_review_at TEXT;
-- 分类：重点考点 / 常用搭配 / 经典句型
UPDATE sentences SET category='重点考点' WHERE lesson_id=82 AND sort_order IN (1,2,3,4,5,6,7,8,9,10,14,17);
UPDATE sentences SET category='常用搭配' WHERE lesson_id=82 AND sort_order IN (13,15);
UPDATE sentences SET category='经典句型' WHERE lesson_id=82 AND sort_order IN (11,12,16,18);
COMMIT;
