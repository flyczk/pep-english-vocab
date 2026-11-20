-- 句子分类精简（2026-10-25）
-- 1) 考点族归并：13 族 → 10 族（比较等级合并；感叹句+数量合并）
-- 2) category 收敛为两类：重点考点 / 常用句型（由 exam_point 派生）
-- 3) 低价值句降为 extended（选读，不进复习队列）
PRAGMA foreign_keys=ON;

-- 1) exam_point 归并（句子与挖空题必须同步，保持一致铁律）
UPDATE sentences SET exam_point='比较等级（比较级/最高级）' WHERE exam_point IN ('比较等级·比较级','比较等级·最高级');
UPDATE sentence_drills SET exam_point='比较等级（比较级/最高级）' WHERE exam_point IN ('比较等级·比较级','比较等级·最高级');
UPDATE sentences SET exam_point='感叹句与数量表达' WHERE exam_point IN ('感叹句 What/How','名词与数量表达');
UPDATE sentence_drills SET exam_point='感叹句与数量表达' WHERE exam_point IN ('感叹句 What/How','名词与数量表达');

-- 2) category 两类（exam_point 派生，固定搭配归常用句型展示）
UPDATE sentences SET category='常用句型'
 WHERE exam_point IN ('基础句型与其它','交际用语与提建议','固定搭配与动词短语');
UPDATE sentences SET category='重点考点'
 WHERE exam_point NOT IN ('基础句型与其它','交际用语与提建议','固定搭配与动词短语');

-- 3) 非语法考点句 → extended（选读；不删数据，不破坏学习记录）
UPDATE sentences SET tier='extended' WHERE exam_point IN ('基础句型与其它','交际用语与提建议');
