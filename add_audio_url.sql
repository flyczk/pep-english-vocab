-- 句子表加官方音频字段（2026-10-24）
ALTER TABLE sentences ADD COLUMN audio_url TEXT DEFAULT '';

-- U1 Section B 1b 24 句：官方教材朗读音频（来自国家中小学智慧教育平台，已按句切分）
-- 命名规则：/audio/u1_b1b_<sort_order>.mp3
UPDATE sentences SET audio_url = '/audio/u1_b1b_' || sort_order || '.mp3'
WHERE lesson_id = 82 AND source LIKE '%Section B%';
