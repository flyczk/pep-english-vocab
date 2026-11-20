import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Target,
  CheckCircle2,
  XCircle,
  Volume2,
  Play,
  Loader2,
  Lightbulb,
  RotateCcw,
  MessagesSquare,
} from 'lucide-react';
import { dataService, type Sentence, type ExamPoint, type DrillItem } from '@/services/dataService';
import { playWordAudio } from '@/utils/audioPlayer';
import { toast } from 'sonner';

interface SentenceDrillPageProps {
  onGoBack: () => void;
  onGoUnit?: () => void;
}

type Stage = 'list' | 'drill' | 'summary';
type Mode = 'cloze' | 'full';

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// 词级正确率（与默写页一致：≥90% 判通过）
const wordAccuracy = (typed: string, target: string) => {
  const a = norm(typed).split(' ').filter(Boolean);
  const b = norm(target).split(' ').filter(Boolean);
  if (!b.length) return 0;
  const set = new Set(a);
  let hit = 0;
  b.forEach((w) => {
    if (set.has(w)) {
      hit += 1;
      set.delete(w);
    }
  });
  return hit / b.length;
};

export function SentenceDrillPage({ onGoBack, onGoUnit }: SentenceDrillPageProps) {
  const [stage, setStage] = useState<Stage>('list');
  const [points, setPoints] = useState<ExamPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [current, setCurrent] = useState<string>('');
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [drills, setDrills] = useState<Record<string, DrillItem[]>>({});
  const [mode, setMode] = useState<Mode>('cloze');

  const [cursor, setCursor] = useState(0);
  const [inputs, setInputs] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [passed, setPassed] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stat, setStat] = useState({ done: 0, correct: 0, startedAt: Date.now() });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await dataService.getExamPoints();
        if (alive) setPoints(list);
      } catch {
        toast.error('加载考点失败');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const openPoint = async (ep: string) => {
    setBusy(true);
    try {
      const { sentences: ss, drills: dd } = await dataService.getDrill(ep);
      if (!ss.length) {
        toast.error('这个考点还没有学过，先去单元里练几句');
        return;
      }
      setCurrent(ep);
      setSentences(ss);
      setDrills(dd);
      setMode('cloze');
      setCursor(0);
      setChecked(false);
      setShowAnswer(false);
      setStat({ done: 0, correct: 0, startedAt: Date.now() });
      setStage('drill');
      resetInputs(ss[0], dd, 'cloze');
    } catch {
      toast.error('加载练习失败');
    } finally {
      setBusy(false);
    }
  };

  const resetInputs = (s: Sentence | undefined, dd: Record<string, DrillItem[]>, m: Mode) => {
    if (!s) return setInputs([]);
    if (m === 'cloze') {
      const d = (dd[s.id] || [])[0];
      const n = d ? d.answer.split('|').length : 0;
      setInputs(n > 0 ? Array(n).fill('') : ['']);
    } else {
      setInputs(['']);
    }
  };

  const row = sentences[cursor];
  const drill: DrillItem | undefined = row ? (drills[row.id] || [])[0] : undefined;
  const answers = useMemo(() => (drill ? drill.answer.split('|') : []), [drill]);
  // 挖空题不可用时自动降级为整句默写，避免出现「空题」
  const effectiveMode: Mode = mode === 'cloze' && !drill ? 'full' : mode;

  const handleCheck = async () => {
    if (!row || busy) return;
    setBusy(true);
    let ok = false;
    if (effectiveMode === 'cloze') {
      ok = answers.every((a, i) => norm(inputs[i] || '') === norm(a));
    } else {
      ok = wordAccuracy(inputs[0] || '', row.en) >= 0.9;
    }
    setChecked(true);
    setPassed(ok);
    setStat((p) => ({ ...p, done: p.done + 1, correct: p.correct + (ok ? 1 : 0) }));
    try {
      await dataService.reviewSentence(row.id, ok, false);
    } catch {
      /* 记忆曲线写入失败不影响本轮练习 */
    } finally {
      setBusy(false);
    }
  };

  const handleNext = () => {
    if (cursor + 1 >= sentences.length) {
      setStage('summary');
      return;
    }
    const next = cursor + 1;
    setCursor(next);
    setChecked(false);
    setShowAnswer(false);
    resetInputs(sentences[next], drills, mode);
  };

  const handlePlay = async () => {
    if (!row) return;
    setPlaying(true);
    try {
      await playWordAudio(row.en, { speed: 0.95 });
    } finally {
      setPlaying(false);
    }
  };

  // ---------- 考点列表 ----------
  if (stage === 'list') {
    const totalLearned = points.reduce((s, p) => s + p.learned, 0);
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onGoBack} className="flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">考点专练</h1>
              <p className="text-xs text-gray-500">按语法考点集中强化，只练你已经学过的单元</p>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6 pb-32">
          {/* 概要卡：与句子列表页同一规格（紫） */}
          <Card className="mb-6 bg-gradient-to-r from-violet-500 to-purple-600 border-0 text-white">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold leading-7">考点专练</h2>
                  <p className="text-purple-100 text-sm">
                    {points.length} 个考点 · 已学 {totalLearned} 句
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中…
            </div>
          )}

          {!loading && (
            <div className="space-y-3">
              {points.map((p) => {
                const locked = p.learned === 0;
                const pct = p.learned ? (p.mastered / p.learned) * 100 : 0;
                return (
                  <Card
                    key={p.exam_point}
                    className={`transition-all ${locked ? 'opacity-70' : 'hover:shadow-md cursor-pointer'}`}
                    onClick={() => {
                      if (locked) {
                        toast.error('这个考点还没学过');
                        return;
                      }
                      void openPoint(p.exam_point);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            locked ? 'bg-gray-100' : 'bg-violet-100'
                          }`}
                        >
                          <Target
                            className={`w-4 h-4 ${locked ? 'text-gray-400' : 'text-violet-600'}`}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-bold text-gray-900">{p.exam_point}</h4>
                            {locked ? (
                              <Badge variant="secondary" className="text-xs">
                                未解锁
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                已掌握 {p.mastered}
                              </Badge>
                            )}
                            {p.drills > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                挖空题 {p.drills}
                              </Badge>
                            )}
                          </div>

                          <p className="text-sm text-gray-500 mt-1">
                            {p.units.join('、')} · 共 {p.total} 句 · 已学 {p.learned} 句
                          </p>

                          {!locked && (
                            <div className="h-1 rounded-full bg-gray-100 overflow-hidden mt-2">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {!loading && totalLearned === 0 && (
            <Card className="mt-4">
              <CardContent className="p-8 text-center space-y-3">
                <MessagesSquare className="w-10 h-10 mx-auto text-gray-300" />
                <p className="text-gray-700 font-medium">还没有学过的句子</p>
                <p className="text-sm text-gray-500">
                  先去单元里练几句，学过的句子会按考点回到这里集中强化
                </p>
                <Button variant="outline" onClick={() => onGoUnit?.()} className="mt-2">
                  去练句子
                </Button>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    );
  }

  // ---------- 总结 ----------
  if (stage === 'summary') {
    const seconds = Math.round((Date.now() - stat.startedAt) / 1000);
    const rate = stat.done ? Math.round((stat.correct / stat.done) * 100) : 0;
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onGoBack} className="flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">练习完成</h1>
              <p className="text-xs text-gray-500">{current}</p>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-6 pb-32">
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <CheckCircle2 className="w-14 h-14 mx-auto text-green-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.done} 题</p>
                <p className="text-sm text-gray-500 mt-1">
                  正确率 {rate}% · 用时 {seconds} 秒
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" className="flex-1 h-12" onClick={() => void openPoint(current)}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  再练一轮
                </Button>
                <Button
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setStage('list');
                    setCurrent('');
                  }}
                >
                  换一个考点
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ---------- 练习中 ----------
  if (!row) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Button variant="outline" onClick={() => setStage('list')}>
          返回考点列表
        </Button>
      </div>
    );
  }

  const clozeOk = effectiveMode === 'cloze';
  const parts = clozeOk ? (drill?.prompt || '').split('____') : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (stage === 'drill' ? setStage('list') : onGoBack())}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{current}</h1>
            <p className="text-xs text-gray-500">
              第 {cursor + 1} / {sentences.length} 题 · {row.lessonName || ''}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-32">
        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(v as Mode);
            setChecked(false);
            setShowAnswer(false);
            resetInputs(row, drills, v as Mode);
          }}
          className="mb-4"
        >
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="cloze">挖空巩固</TabsTrigger>
            <TabsTrigger value="full">整句默写</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <Badge variant="secondary" className="text-xs">
                {clozeOk ? '填入考点词' : '看中文写整句'}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`w-9 h-9 rounded-full ${playing ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
                onClick={() => void handlePlay()}
                title="朗读整句"
              >
                <Volume2 className={`w-5 h-5 ${playing ? 'animate-pulse' : ''}`} />
              </Button>
            </div>

            {clozeOk ? (
              <div className="text-lg font-bold text-gray-900 leading-8">
                {parts.map((seg, i) => (
                  <span key={i}>
                    {seg}
                    {i < parts.length - 1 && (
                      <span className="inline-block min-w-[84px] border-b-2 border-violet-400 mx-1 align-baseline" />
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-lg font-bold text-gray-900 leading-7">{row.zh}</p>
            )}

            {!clozeOk && (
              <p className="text-xs text-gray-400 mt-1">
                {row.pattern ? `句型：${row.pattern}` : row.grammarPoint || ''}
              </p>
            )}

            {clozeOk && drill?.hint && (
              <p className="text-xs text-violet-600 mt-2 flex items-start gap-1">
                <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                {drill.hint}
              </p>
            )}

            <div className="mt-4 space-y-2">
              {inputs.map((v, i) => (
                <input
                  key={i}
                  value={v}
                  onChange={(e) => {
                    const next = [...inputs];
                    next[i] = e.target.value;
                    setInputs(next);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (!checked) void handleCheck();
                      else handleNext();
                    }
                  }}
                  disabled={checked && passed}
                  placeholder={clozeOk ? `第 ${i + 1} 空` : 'Write the whole sentence…'}
                  className={`w-full h-12 px-3 rounded-lg border text-base outline-none transition-colors ${
                    checked
                      ? norm(v) === norm(answers[i] ?? '') || (!clozeOk && passed)
                        ? 'border-green-400 bg-green-50'
                        : 'border-red-400 bg-red-50'
                      : 'border-gray-300 focus:border-violet-500'
                  }`}
                />
              ))}
            </div>

            {checked && (
              <div
                className={`mt-3 rounded-lg p-3 text-sm ${
                  passed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  {passed ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {passed ? '正确' : '不正确'}
                </div>
                <div className="mt-1">
                  答案：<span className="font-semibold">{clozeOk ? answers.join(' / ') : row.en}</span>
                </div>
                <div className="mt-0.5 text-xs opacity-80">{row.zh}</div>
              </div>
            )}

            {checked && !passed && !showAnswer && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setShowAnswer(true)}
              >
                再看一遍原句
              </Button>
            )}
            {showAnswer && (
              <p className="mt-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{row.en}</p>
            )}
          </CardContent>
        </Card>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={() => {
              setShowAnswer(true);
            }}
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            看答案
          </Button>
          {!checked ? (
            <Button
              className="flex-1 h-12 bg-blue-600 hover:bg-blue-700"
              onClick={() => void handleCheck()}
              disabled={busy || inputs.every((v) => !v.trim())}
            >
              <Play className="w-4 h-4 mr-2" />
              检查
            </Button>
          ) : (
            <Button
              className="flex-1 h-12 bg-blue-600 hover:bg-blue-700"
              onClick={handleNext}
            >
              {cursor + 1 >= sentences.length ? '完成' : '下一题'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
