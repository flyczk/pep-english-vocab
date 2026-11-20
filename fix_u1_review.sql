-- U1 Section B 1b 复核修订（依据 u1_复核报告.md，证据含课本扫描原图目验）
PRAGMA foreign_keys=ON;

-- [高] id157 教材无此句 → 换成课本原文 It was fantastic!，并降为 extended
UPDATE sentences SET
  en = 'It was fantastic!',
  zh = '那里真是太棒了！',
  pattern = '评价句',
  grammar_point = 'It was + 形容词 + 感叹号（评价某地）',
  category = '经典句型',
  exam_point = '基础句型与其它',
  tier = 'extended'
WHERE id = 157;

-- [低] id140 fine 后无逗号
UPDATE sentences SET en = 'The weather was fine and everyone felt excited to visit some famous places in Russia.' WHERE id = 140;

-- [低] id144 补引号 + 中译量级修正
UPDATE sentences SET
  en = 'In one hall, I saw an artwork with thousands of glass "tears" falling down.',
  zh = '在一个展厅里，我看到一件艺术品——成千上万颗玻璃"眼泪"从上方纷纷落下。'
WHERE id = 144;

-- [低] id149 But 后补逗号
UPDATE sentences SET en = 'But, during dinner, I didn''t feel like eating because I felt sick.' WHERE id = 149;

-- [低] id158 中译 met 是"结识/见面"而非"偶遇"
UPDATE sentences SET zh = '下午，我们来到一所学校，结识了一群俄罗斯学生。' WHERE id = 158;

-- [可选] id146 should 句信息量低 → 降 extended（复核建议）
UPDATE sentences SET tier = 'extended' WHERE id = 146;
