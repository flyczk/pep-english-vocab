import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Volume2, Loader2, CheckCircle2, RotateCcw, Lightbulb, Headphones, Languages } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { dataService, type Sentence } from '@/services/dataService';
import { playWordAudio } from '@/utils/audioPlayer';
import { toast } from 'sonner';

interface SentencePageProps {
  onGoBack: () => void;
}

type Mode = 'zh2en' | 'dictation';
type Phase = 'typing' | 'fixing' | 'summary';

interface Slot {
  word: string;
  value: string;
  wrong: boolean;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const tokensOf = (s: string) => s.trim().split(/\s+/).filter(Boolean);

export function SentencePage({ onGoBack }: SentencePageProps) {
  const { selectedLesson } = useApp();
  const [rows, setRows] = useState<Sentence[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('zh2en');
  const [phase, setPhase] = useState<Phase>('typing');
  const [cursor, setCursor] = useState(0);
  const [typed, setTyped] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const playedRef = useRef<string>('');
  const skipsRef = useRef<Record<string, number>>({});
  const [stats, setStats] = useState({ done: 0, firstTry: 0, startedAt: Date.now() });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const slotRefs = useRef<Array<HTMLInputElement | null>>([]);

  const masteredCount = useMemo(() => rows.filter((r) => r.masteredAt).length, [rows]);
  const current = useMemo(() => rows.find((r) => r.id === order[cursor]), [rows, order, cursor]);

  const load = useCallback(async () => {
    if (!selectedLesson) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await dataService.getSentencesByLessonId(String(selectedLesson.id));
      setRows(data);
      const unmastered = data.filter((r) => !r.masteredAt).map((r) => r.id);
      setOrder(unmastered);
      setCursor(0);
      setPhase(unmastered.length ? 'typing' : 'summary');
    } catch (e: any) {
      toast.error(e?.message || '加载句子失败');
    } finally {
      setLoading(false);
    }
  }, [selectedLesson]);

  useEffect(() => {
    load();
  }, [load]);

  const play = useCallback(async () => {
    if (!current) return;
    try {
      await playWordAudio(current.en, { speed: 0.95 });
    } catch {
      /* ignore */
    }
  }, [current]);

  useEffect(() => {
    if (!current || phase !== 'typing') return;
    setTyped('');
    setSlots([]);
    setShowHint(false);
    setRevealed(false);
    // 同一句只自动播报一次，避免重复触发造成"读两遍"
    if (playedRef.current !== current.id) {
      playedRef.current = current.id;
      play().catch(() => undefined);
    }
    setTimeout(() => textareaRef.current?.focus(), 120);
  }, [current?.id, phase, play]);

  const focusSlot = (idx: number) => {
    const el = slotRefs.current[idx];
    if (el) {
      el.focus();
      el.select();
    }
  };

  const firstWrongIndex = (list: Slot[]) => list.findIndex((s) => s.wrong);

  // 初次提交：逐词比对，错的词清空进入"修补"
  const submitTyping = () => {
    if (!current || busy) return;
    const expected = tokensOf(current.en);
    const actual = tokensOf(typed);
    const list: Slot[] = expected.map((word, i) => {
      const value = actual[i] ?? '';
      return { word, value, wrong: normalize(value) !== normalize(word) };
    });
    const allOk = list.every((s) => !s.wrong);
    if (allOk) {
      pass(false);
      return;
    }
    setSlots(list);
    setPhase('fixing');
    const idx = firstWrongIndex(list);
    setTimeout(() => focusSlot(idx), 60);
  };

  // 修补阶段：只允许改错词
  const validateFix = () => {
    const remaining = slots.map((s) => ({ ...s, wrong: normalize(s.value) !== normalize(s.word) }));
    setSlots(remaining);
    const ok = remaining.every((s) => !s.wrong);
    if (ok) {
      pass(true);
    } else {
      const idx = firstWrongIndex(remaining);
      setTimeout(() => focusSlot(idx), 60);
    }
  };

  const pass = async (fixed: boolean) => {
    if (!current) return;
    setBusy(true);
    try {
      await dataService.reviewSentence(current.id, true, fixed);
    } catch {
      /* 统计失败不阻塞 */
    }
    setRows((prev) =>
      prev.map((r) => (r.id === current.id ? { ...r, masteredAt: new Date().toISOString(), stage: 3 } : r)),
    );
    setStats((s) => ({ ...s, done: s.done + 1, firstTry: s.firstTry + (fixed ? 0 : 1) }));
    setBusy(false);

    const nextCursor = cursor + 1;
    if (nextCursor >= order.length) {
      setPhase('summary');
    } else {
      setCursor(nextCursor);
      setPhase('typing');
    }
  };

  const handleSlotKeyDown = (e: KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === ' ' || e.key === 'Tab') {
      e.preventDefault();
      const next = slots.findIndex((s, i) => i > idx && s.wrong);
      if (next >= 0) focusSlot(next);
      else validateFix();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      validateFix();
      return;
    }
    if (e.key === 'Backspace' && !slots[idx]?.value) {
      const prev = [...slots.keys()].reverse().find((i) => i < idx && slots[i].wrong);
      if (prev !== undefined) {
        e.preventDefault();
        focusSlot(prev);
      }
    }
  };

  const revealAnswer = async () => {
    if (!current) return;
    setRevealed(true);
    try {
      await dataService.reviewSentence(current.id, false, true);
    } catch {
      /* 统计失败不阻塞 */
    }
  };

  const advanceAfterReveal = () => {
    if (!current) return;
    const id = current.id;
    const count = (skipsRef.current[id] || 0) + 1;
    skipsRef.current[id] = count;
    // 第一次跳过：排到队尾再练一次；第二次仍跳过：本次放过
    const requeue = count === 1;
    const newOrder = requeue ? [...order, id] : order;
    if (requeue) setOrder(newOrder);
    const next = cursor + 1;
    if (next >= newOrder.length) {
      setPhase('summary');
    } else {
      setCursor(next);
      setPhase('typing');
    }
  };

  const restart = () => {
    playedRef.current = '';
    skipsRef.current = {};
    setStats({ done: 0, firstTry: 0, startedAt: Date.now() });
    setOrder(rows.map((r) => r.id));
    setCursor(0);
    setPhase(rows.length ? 'typing' : 'summary');
  };

  const elapsedMin = Math.max(1, Math.round((Date.now() - stats.startedAt) / 60000));
  const accuracy = stats.done ? Math.round((stats.firstTry / stats.done) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onGoBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">常用语句</h1>
            <p className="text-xs text-gray-500">
              {selectedLesson?.name || '未选择单元'} · 已掌握 {masteredCount}/{rows.length}
            </p>
          </div>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              className={`px-2.5 py-1 text-xs flex items-center gap-1 ${mode === 'zh2en' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600'}`}
              onClick={() => setMode('zh2en')}
            >
              <Languages className="w-3.5 h-3.5" /> 中译英
            </button>
            <button
              className={`px-2.5 py-1 text-xs flex items-center gap-1 ${mode === 'dictation' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600'}`}
              onClick={() => setMode('dictation')}
            >
              <Headphones className="w-3.5 h-3.5" /> 听写
            </button>
          </div>
        </div>
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-amber-500 transition-all"
            style={{ width: `${order.length ? Math.round((cursor / order.length) * 100) : 100}%` }}
          />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中…
          </div>
        )}

        {!loading && !rows.length && (
          <Card>
            <CardContent className="p-10 text-center text-gray-500">
              本单元还没有常用语句。目前只录入了八上 Unit 1。
            </CardContent>
          </Card>
        )}

        {phase === 'summary' && !!rows.length && (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
              <h2 className="text-xl font-bold">本单元已全部掌握</h2>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">完成句数</p>
                  <p className="text-lg font-semibold">{stats.done || rows.length}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">一次过</p>
                  <p className="text-lg font-semibold">{accuracy}%</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">用时</p>
                  <p className="text-lg font-semibold">{elapsedMin} 分</p>
                </div>
              </div>
              <div className="flex gap-3 justify-center pt-2">
                <Button variant="outline" onClick={restart}>
                  <RotateCcw className="w-4 h-4 mr-1" /> 再过一遍
                </Button>
                <Button onClick={onGoBack}>返回</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {phase !== 'summary' && current && (
          <>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{current.source || '教材原句'}</Badge>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowHint((v) => !v)}>
                      <Lightbulb className="w-4 h-4 mr-1" /> 提示
                    </Button>
                    <Button variant="outline" size="sm" onClick={play}>
                      <Volume2 className="w-4 h-4 mr-1" /> 听
                    </Button>
                  </div>
                </div>

                {mode === 'zh2en' ? (
                  <p className="text-lg text-gray-800">{current.zh}</p>
                ) : (
                  <p className="text-lg text-gray-400">听录音，写出整句英文</p>
                )}

                {showHint && (
                  <p className="text-xs text-gray-500 bg-amber-50 rounded p-2">
                    句型：{current.pattern || '—'}
                    {current.grammarPoint ? ` · 语法点：${current.grammarPoint}` : ''}
                  </p>
                )}

                {phase === 'typing' ? (
                  <>
                    <textarea
                      ref={textareaRef}
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          submitTyping();
                        }
                      }}
                      rows={2}
                      placeholder="输入整句英文，回车检查…"
                      className="w-full rounded-lg border border-gray-200 p-3 text-base outline-none focus:border-amber-400"
                    />
                    <Button className="w-full" onClick={submitTyping} disabled={!typed.trim() || busy}>
                      检查
                    </Button>
                    {!revealed && (
                      <button
                        type="button"
                        className="w-full text-xs text-gray-400 hover:text-amber-600 py-1"
                        onClick={revealAnswer}
                      >
                        实在不会，看答案
                      </button>
                    )}
                    {revealed && (
                      <div className="rounded-lg bg-red-50 border border-red-100 p-3 space-y-2">
                        <p className="text-xs text-gray-500">正确句子</p>
                        <p className="text-gray-900">{current.en}</p>
                        <Button className="w-full" onClick={advanceAfterReveal}>
                          下一句
                        </Button>
                        <p className="text-[11px] text-gray-400 text-center">
                          这句稍后会再出现一次，仍不会就跳过
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 leading-9 rounded-lg bg-gray-50 p-3">
                      {slots.map((slot, i) => {
                        if (!slot.wrong) {
                          return (
                            <span key={i} className="text-gray-800">
                              {slot.word}
                            </span>
                          );
                        }
                        return (
                          <input
                            key={i}
                            ref={(el) => {
                              slotRefs.current[i] = el;
                            }}
                            value={slot.value}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, value: v } : s)));
                            }}
                            onKeyDown={(e) => handleSlotKeyDown(e, i)}
                            spellCheck={false}
                            autoCapitalize="off"
                            autoCorrect="off"
                            className="w-auto min-w-[3.5rem] max-w-[12rem] rounded border-b-2 border-red-400 bg-white px-1 text-center text-base outline-none focus:border-amber-500"
                            style={{ width: `${Math.max(3.5, slot.word.length + 1)}ch` }}
                          />
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500">
                      只改错词：空格跳到下一个错词，退格回上一个，回车检查
                    </p>
                    <Button className="w-full" onClick={validateFix} disabled={busy}>
                      检查
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <p className="text-center text-xs text-gray-400">
              {mode === 'zh2en' ? '看中文写英文' : '听音写句'} · 答错的词只需单独修补，整句掌握后自动跳过
            </p>
          </>
        )}
      </main>
    </div>
  );
}
