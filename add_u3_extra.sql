-- 补两句：覆盖卷子第 42 题 both，以及单元主题句（alike / different）
INSERT INTO sentences (lesson_id, en, zh, pattern, grammar_point, source, sort_order, category, exam_point, is_review)
VALUES (84, 'For example, we both love sports.', '例如，我们都热爱运动。', 'both + 动词',
        '固定搭配 both（两者都）', '八上 U3 Section B 1b', 31, '常用搭配', '固定搭配与动词短语', 0);

INSERT INTO sentences (lesson_id, en, zh, pattern, grammar_point, source, sort_order, category, exam_point, is_review)
VALUES (84, 'Some people think that friends should be alike, but some other people think that friends should be different.',
        '有人认为朋友应该相似，也有人认为朋友应该不同。', 'should be alike / different',
        '经典句型；alike 与 different 的反义对照', '八上 U3 Section B 1b', 32, '经典句型', '基础句型与其它', 0);

INSERT INTO sentence_drills (id, sentence_id, exam_point, kind, prompt, answer, hint, sort_order)
VALUES ('dr_u3_20', (SELECT id FROM sentences WHERE en = 'For example, we both love sports.' AND lesson_id = 84),
        '固定搭配与动词短语', 'cloze', 'For example, we ____ love sports.', 'both',
        'both 两者都；both ... and ... 既……又……', 120);
