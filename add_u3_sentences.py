#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""补充八上 Unit 3（lesson_id=84）的句子。

现有 13 句全部是「比较级」语法句，覆盖不到 Section B 的重点短语（hang out / because of /
thanks to / a sense of humour / give one's opinion …），而这些正是考试默写题的内容。
本脚本依据教材 Section B 1b 论坛原文（多源交叉核对）补 17 句，并生成配套挖空题。
"""
import re

BASE = '/Users/jeffchen/WorkBuddy/2026-10-19-02-58-58/'
LESSON_ID = 84
START_SORT = 14          # 接现有 13 句
SRC = '八上 U3 Section B 1b'

# (en, zh, pattern, grammar_point, category, exam_point)
ROWS = [
    ('I think a good friend is like a mirror.',
     '我认为好朋友就像一面镜子。',
     'I think ... is like ...', '经典句型 be like', '经典句型', '基础句型与其它'),

    ('You can understand people by knowing their friends.',
     '观其友，知其人。',
     'by doing', '介词 by + doing 表方式', '经典句型', '固定搭配与动词短语'),

    ('We often hang out together because we have similar hobbies and interests.',
     '我们经常一起出去玩，因为我们有相似的爱好和兴趣。',
     'hang out', '固定搭配 hang out；hobbies and interests（教材固定语序）', '常用搭配', '固定搭配与动词短语'),

    ('He plays badminton better than I do, so he always wins our matches.',
     '他打羽毛球比我好，所以比赛总是他赢。',
     '比较级 + than', '副词比较级；动词 + 比较级 + than', '重点考点', '比较等级·比较级'),

    ('Because of that, I try harder when I practise, and now I\'m getting better at badminton.',
     '正因为如此，我练习时更努力，现在羽毛球打得越来越好。',
     'because of; get better at', '固定搭配 because of；get better at', '常用搭配', '固定搭配与动词短语'),

    ('Stephen and I are similar in other ways.',
     '我和斯蒂芬在其他方面也很相似。',
     'be similar in other ways', '固定搭配 in other ways', '常用搭配', '固定搭配与动词短语'),

    ('When we aren\'t playing sports, we enjoy reading together.',
     '我们不运动时喜欢一起读书。',
     'enjoy doing', '固定搭配 enjoy doing', '常用搭配', '固定搭配与动词短语'),

    ('I read more history books than he does, and he reads a lot of novels.',
     '我读的历史书比他多，他读很多小说。',
     '比较级 + than', '比较级 more', '重点考点', '比较等级·比较级'),

    ('We often share interesting books with each other.',
     '我们经常互相分享有趣的书。',
     'share sth with each other', '固定搭配 share ... with each other', '常用搭配', '固定搭配与动词短语'),

    ('For me, friends who are different make me better.',
     '对我来说，不同的朋友让我变得更好。',
     'who 引导定语从句', '定语从句', '经典句型', '从句（宾语/定语/状语）'),

    ('I think we should respect each other\'s differences and learn from each other.',
     '我认为我们应该尊重彼此的差异，互相学习。',
     'respect ...; learn from ...', '固定搭配 respect；learn from', '常用搭配', '固定搭配与动词短语'),

    ('I am kind of shy, but my best friend, Yuan Lei, is outgoing.',
     '我有点害羞，但我最好的朋友袁蕾很外向。',
     'kind of + adj.', '固定搭配 kind of', '常用搭配', '固定搭配与动词短语'),

    ('She has a great sense of humour too.',
     '她也很有幽默感。',
     'have a sense of humour', '固定搭配 a sense of humour', '常用搭配', '固定搭配与动词短语'),

    ('Thanks to her, I am becoming more outgoing.',
     '多亏了她，我变得更外向了。',
     'Thanks to ...', '固定搭配 thanks to（归功于；由于）', '常用搭配', '固定搭配与动词短语'),

    ('He is not afraid to give his opinion, especially when he thinks I am making a mistake.',
     '他不怕发表看法，尤其当他觉得我在犯错时。',
     "give one's opinion; make a mistake", "固定搭配 give one's opinion；make a mistake", '常用搭配', '固定搭配与动词短语'),

    ('I am less straightforward than he is, but I am glad to have an honest friend.',
     '我不如他直率，但我很高兴有一个诚实的朋友。',
     'less + 原级 + than', '比较级 less ... than（不如……）', '重点考点', '比较等级·比较级'),

    ('Now I think meeting new people is really fun!',
     '现在我觉得认识新的人真的很有趣！',
     '动名词作主语', '动名词（短语）作主语', '经典句型', '基础句型与其它'),
]

# (句子下标, 挖空的词, 提示)
DRILLS = [
    (2, 'hang out', 'hang out 闲逛；常去某处'),
    (4, 'Because of', 'because of 因为；由于（后接名词/代词，不接句子）'),
    (5, 'in other ways', 'in other ways 在其他方面'),
    (8, 'with each other', 'share ... with each other 与……相互分享'),
    (10, 'learn from', 'learn from each other 互相学习'),
    (11, 'kind of', 'kind of 有点儿；稍微（后接形容词）'),
    (12, 'a great sense of humour', 'have a sense of humour 有幽默感'),
    (13, 'Thanks to', 'thanks to 归功于；由于；因为'),
    (14, 'give his opinion', "give one's opinion 发表看法；表达观点"),
]

HINT_MAIN = {
    'hang out': '固定搭配 hang out；hobbies and interests（教材固定语序）',
    'Because of': '固定搭配 because of；get better at',
    'in other ways': '固定搭配 in other ways',
    'with each other': '固定搭配 share ... with each other',
    'learn from': '固定搭配 respect；learn from',
    'kind of': '固定搭配 kind of',
    'a great sense of humour': '固定搭配 a sense of humour',
    'Thanks to': '固定搭配 thanks to（归功于；由于）',
    'give his opinion': "固定搭配 give one's opinion；make a mistake",
}


def esc(s: str) -> str:
    return s.replace("'", "''")


lines = []
lines.append("-- 补充八上 Unit 3（lesson_id=84）句子：依据教材 Section B 1b 原文")
for i, (en, zh, pat, gp, cat, ep) in enumerate(ROWS):
    lines.append(
        "INSERT INTO sentences (lesson_id, en, zh, pattern, grammar_point, source, sort_order, category, exam_point, is_review) "
        "VALUES (%d, '%s', '%s', '%s', '%s', '%s', %d, '%s', '%s', 0);"
        % (LESSON_ID, esc(en), esc(zh), esc(pat), esc(gp), SRC, START_SORT + i, esc(cat), esc(ep))
    )

lines.append("")
lines.append("-- 配套挖空题（按考点挖核心短语）")
for idx, word, hint in DRILLS:
    en = ROWS[idx][0]
    m = re.search(re.escape(word), en)
    if not m:
        print('!! 未命中，跳过:', word, '|', en)
        continue
    prompt = en[:m.start()] + '____' + en[m.end():]
    # 校验：空两侧不能紧贴字母（避免出现 I____ 这种畸形空）
    if re.search(r'[A-Za-z]____|____[A-Za-z]', prompt):
        print('!! 畸形空，跳过:', prompt)
        continue
    lines.append(
        "INSERT INTO sentence_drills (id, sentence_id, exam_point, kind, prompt, answer, hint, sort_order) "
        "VALUES ('dr_u3_%d', (SELECT id FROM sentences WHERE en = '%s' AND lesson_id = %d), '%s', 'cloze', '%s', '%s', '%s', %d);"
        % (idx, esc(en), LESSON_ID, esc(ROWS[idx][5]), esc(prompt), esc(word), esc(hint), idx + 100)
    )

out = BASE + 'add_u3_sentences.sql'
with open(out, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')
print('句子: %d  挖空题: %d' % (len(ROWS), len([d for d in DRILLS])))
print('written:', out)
