-- 2026-10-24 句子表结构化字段（覆盖度 Review 后新增）
-- genre: 体裁 / section_code: 教材板块代码 / tier: core 必背(进记忆曲线) | extended 选读(只点读)
PRAGMA foreign_keys=ON;

ALTER TABLE sentences ADD COLUMN genre TEXT DEFAULT '';
ALTER TABLE sentences ADD COLUMN section_code TEXT DEFAULT '';
ALTER TABLE sentences ADD COLUMN tier TEXT DEFAULT 'core';

-- 存量 136 句按 source 回填 genre + section_code
UPDATE sentences SET genre = 'grammar', section_code = 'GF-3a' WHERE source LIKE '%Grammar Focus%';
UPDATE sentences SET genre = 'grammar', section_code = 'GF-3b' WHERE source LIKE '%Grammar 3b%' OR source LIKE '%Section A 3b%';
UPDATE sentences SET genre = 'dialogue', section_code = 'A-2a' WHERE source LIKE '%2a%';
UPDATE sentences SET genre = 'dialogue', section_code = 'A-2f' WHERE source LIKE '%2f%';
UPDATE sentences SET genre = 'pronunciation', section_code = 'A-Pron' WHERE source LIKE '%Pronunciation%';
UPDATE sentences SET genre = 'post', section_code = 'B-1b' WHERE source LIKE '%Section B%';

-- 存量全部按 core 处理（它们原本就在复习队列里，改 tier 会改变现有行为）
UPDATE sentences SET tier = 'core' WHERE tier IS NULL OR tier = '';
