-- 八上 U3 修订脚本（依据独立复核报告 u3_复核报告.md）
-- 覆盖：2 道硬伤挖空题、6 道歧义题、7 条误导 hint、1 句教材查无此句、
--       6 处译文优化、3 处标注偏差、帖序重排、补 1 句 + 4 道题
PRAGMA foreign_keys=ON;

-- ============ A. 句子修订 ============

-- A1 [高] id47 教材查无此句（3b 中 Sam/Tom 搭配 smart，serious 搭配 your cousin）→ 换成教材 3b 第 3 题真句
UPDATE sentences SET
  en = 'I think Sam is as smart as Tom.',
  zh = '我认为萨姆和汤姆一样聪明。',
  source = '八上 U3 Section A 3b'
WHERE id = 47;

-- A2 [中] id120 中译成语化意译、漏译主语 → 回归字面译
UPDATE sentences SET zh = '你可以通过了解一个人的朋友来了解他。' WHERE id = 120;

-- A3 译文优化（低）
UPDATE sentences SET zh = '（今年）比去年更丰富多彩。' WHERE id = 37;
UPDATE sentences SET zh = '埃拉舞跳得比艾玛好，但艾玛唱歌声音比她大。' WHERE id = 39;
UPDATE sentences SET zh = '朱莉比你苗条吗？' WHERE id = 45;
UPDATE sentences SET zh = '不，她不是。她和我一样苗条。' WHERE id = 46;
UPDATE sentences SET zh = '我们不运动时，喜欢一起阅读。' WHERE id = 125;
UPDATE sentences SET zh = '现在我觉得结识新朋友真的很有意思！' WHERE id = 135;
UPDATE sentences SET zh = '他打羽毛球比我好，所以他总是赢我们的比赛。' WHERE id = 122;

-- A4 标注偏差修正（低）
UPDATE sentences SET pattern = 'both 作主语同位语（we both）' WHERE id = 136;
UPDATE sentences SET grammar_point = '固定搭配 learn from each other' WHERE id = 129;
UPDATE sentences SET grammar_point = 'because 引导原因状语从句' WHERE id = 121;
-- id41 无任何比较级形式（similar/different 均为原级）→ 归基础句型
UPDATE sentences SET exam_point = '基础句型与其它' WHERE id = 41;
-- id137 含 2 个 that 宾语从句 → 归从句
UPDATE sentences SET exam_point = '从句（宾语/定语/状语）' WHERE id = 137;

-- ============ B. 补录 1 句（Section B 1b Matt 帖第 9 句，单元内唯一 as ... as 原句） ============
INSERT INTO sentences (lesson_id, en, zh, pattern, grammar_point, source, sort_order, category, exam_point, is_review)
VALUES (84, 'He is as serious as me.', '他和我一样认真。', 'as + 原级 + as', '同级比较 as…as', '八上 U3 Section B 1b', 22, '重点考点', '比较等级·比较级', 0);

-- ============ C. 帖序重排（按教材 Tom 帖 → Matt 帖 → Diana 帖） ============
UPDATE sentences SET sort_order = 14 WHERE id = 137;
UPDATE sentences SET sort_order = 15 WHERE id = 119;
UPDATE sentences SET sort_order = 16 WHERE id = 120;
UPDATE sentences SET sort_order = 17 WHERE id = 121;
UPDATE sentences SET sort_order = 18 WHERE id = 136;
UPDATE sentences SET sort_order = 19 WHERE id = 122;
UPDATE sentences SET sort_order = 20 WHERE id = 123;
UPDATE sentences SET sort_order = 21 WHERE id = 124;
UPDATE sentences SET sort_order = 23 WHERE id = 125;
UPDATE sentences SET sort_order = 24 WHERE id = 126;
UPDATE sentences SET sort_order = 25 WHERE id = 127;
UPDATE sentences SET sort_order = 26 WHERE id = 128;
UPDATE sentences SET sort_order = 27 WHERE id = 129;
UPDATE sentences SET sort_order = 28 WHERE id = 130;
UPDATE sentences SET sort_order = 29 WHERE id = 131;
UPDATE sentences SET sort_order = 30 WHERE id = 132;
UPDATE sentences SET sort_order = 31 WHERE id = 135;
UPDATE sentences SET sort_order = 32 WHERE id = 133;
UPDATE sentences SET sort_order = 33 WHERE id = 134;

-- ============ D. 挖空题：消除歧义（改为挖介词/关键词，保证答案唯一） ============

-- D1 [高] kind of → 挖 of（原挖形容词前，a little/very/really 均可填）
UPDATE sentence_drills SET
  prompt = 'I am kind ____ shy, but my best friend, Yuan Lei, is outgoing.',
  answer = 'of',
  hint = 'kind of 有点儿、稍微（后接形容词）'
WHERE id = 'dr_u3_11';

-- D2 [高] funnier 语境不足 → 改挖 than 后的宾格代词
UPDATE sentence_drills SET
  prompt = 'Emma is funnier than ____.',
  answer = 'me',
  hint = 'than 后接人称代词宾格；教材原句用 me'
WHERE id = 'dr_43';

-- D3 [中] hang out → 挖 out
UPDATE sentence_drills SET
  prompt = 'We often hang ____ together because we have similar hobbies and interests.',
  answer = 'out',
  hint = 'hang out 闲逛、常去某处；hang out together 一起出去玩'
WHERE id = 'dr_u3_2';

-- D4 [中] Because of（与 Thanks to 同源歧义）→ 挖 of
UPDATE sentence_drills SET
  prompt = 'Because ____ that, I try harder when I practise, and now I''m getting better at badminton.',
  answer = 'of',
  hint = 'because of 因为、由于（后接名词/代词，不接句子）'
WHERE id = 'dr_u3_4';

-- D5 [中] in other ways → 挖 other
UPDATE sentence_drills SET
  prompt = 'Stephen and I are similar in ____ ways.',
  answer = 'other',
  hint = 'in other ways 在其他方面'
WHERE id = 'dr_u3_5';

-- D6 [中] with each other → 挖 each
UPDATE sentence_drills SET
  prompt = 'We often share interesting books with ____ other.',
  answer = 'each',
  hint = 'share ... with each other 与……相互分享'
WHERE id = 'dr_u3_8';

-- D7 [中] learn from → 挖 from
UPDATE sentence_drills SET
  prompt = 'I think we should respect each other''s differences and learn ____ each other.',
  answer = 'from',
  hint = 'learn from each other 互相学习'
WHERE id = 'dr_u3_10';

-- D8 [中] a great sense of humour → 挖 humour（兼考英式拼写）
UPDATE sentence_drills SET
  prompt = 'She has a great sense of ____ too.',
  answer = 'humour',
  hint = 'have a sense of humour 有幽默感（教材词汇表用英式拼写 humour）'
WHERE id = 'dr_u3_12';

-- D9 [中] Thanks to → 挖 to
UPDATE sentence_drills SET
  prompt = 'Thanks ____ her, I am becoming more outgoing.',
  answer = 'to',
  hint = 'thanks to 归功于、由于、因为'
WHERE id = 'dr_u3_13';

-- D10 [中] give his opinion → 挖 his
UPDATE sentence_drills SET
  prompt = 'He is not afraid to give ____ opinion, especially when he thinks I am making a mistake.',
  answer = 'his',
  hint = 'give one''s opinion 发表看法；主语是 he，物主代词用 his'
WHERE id = 'dr_u3_14';

-- D11 [中] both（really/certainly 均可填）→ 改考 both of us，顺带区分 all
UPDATE sentence_drills SET
  prompt = 'For example, ____ of us love sports.',
  answer = 'Both',
  hint = 'both 两者都；句首首字母大写，注意与 all（三者及以上）区分'
WHERE id = 'dr_u3_20';

-- D12 [中] more 缺比较对象 → 题干补 than last year
UPDATE sentence_drills SET
  prompt = 'There are ____ activities this year than last year.',
  answer = 'more',
  hint = '两者比较用「比较级 + than」；many/much 的比较级是 more'
WHERE id = 'dr_36';

-- ============ E. 比较级题 hint 逐题定制（原共用一条，含「多音节加 more」误导） ============
UPDATE sentence_drills SET hint = 'colourful 是多音节形容词，比较级前加 more' WHERE id = 'dr_37';
UPDATE sentence_drills SET hint = '两者比较用「比较级 + than」；tall 是单音节词，直接加 -er' WHERE id = 'dr_38';
UPDATE sentence_drills SET hint = 'well 的比较级是不规则变化 better，修饰动词 dance' WHERE id = 'dr_39';
UPDATE sentence_drills SET hint = 'early 以「辅音字母 + y」结尾，变 y 为 i 再加 -er' WHERE id = 'dr_40';
UPDATE sentence_drills SET hint = '两者比较用「比较级 + than」；many 的比较级是 more' WHERE id = 'dr_42';

-- ============ F. 补 4 道题（覆盖比较级/从句重点句缺口） ============
INSERT INTO sentence_drills (id, sentence_id, exam_point, kind, prompt, answer, hint, sort_order) VALUES
 ('dr_u3_17', 122, '比较等级·比较级', 'cloze',
  'He plays badminton ____ than I do, so he always wins our matches.', 'better',
  '两者比较用「比较级 + than」；well 的比较级是不规则变化 better', 1),
 ('dr_u3_18', 126, '比较等级·比较级', 'cloze',
  'I read ____ history books than he does, and he reads a lot of novels.', 'more',
  '两者比较用「比较级 + than」；many 的比较级是 more', 1),
 ('dr_u3_19', 134, '比较等级·比较级', 'cloze',
  'I am ____ straightforward than he is, but I am glad to have an honest friend.', 'less',
  '「不如……」用 less + 原级 + than（与 more 相反）', 1),
 ('dr_u3_21', 128, '从句（宾语/定语/状语）', 'cloze',
  'For me, friends ____ are different make me better.', 'who',
  '定语从句修饰 friends（指人），关系词用 who', 1);
