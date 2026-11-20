import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Volume2, Play, Loader2, MessagesSquare, CheckCircle2, LayoutGrid, Target, RotateCcw } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { dataService, type Sentence } from '@/services/dataService';
import { playWordAudio } from '@/utils/audioPlayer';
import { toast } from 'sonner';

interface SentenceListPageProps {
  onGoBack: () => void;
  onGoUnit?: () => void;
  onGoDrill?: () => void;
  onStartPractice: () => void;
}

const CATEGORY_ORDER = ['重点考点', '常用搭配', '经典句型'];

type GroupBy = 'category' | 'exam';

export function SentenceListPage({ onGoBack, onGoUnit, onGoDrill, onStartPractice }: SentenceListPageProps) {
  const { selectedTextbook, selectedLesson } = useApp();
  const [rows, setRows] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('全部');
  const [groupBy, setGroupBy] = useState<GroupBy>('category');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!selectedLesson) {
        setLoading(false);
        return;
      }
      try {
        const data = await dataService.getSentencesByLessonId(String(selectedLesson.id));
        if (alive) setRows(data);
      } catch (e: any) {
        toast.error(e?.message || '加载句子失败');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedLesson]);

  // 分组维度：按「用途分类」（重点考点/常用搭配/经典句型）或按「语法考点」
  const keyOf = (r: Sentence) =>
    groupBy === 'category' ? r.category || '常用语句' : r.examPoint || '其它';

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      const k = keyOf(r);
      m[k] = (m[k] || 0) + 1;
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, groupBy]);

  // 考点分组时按句子出现顺序（即教材单元顺序）取键
  const examKeys = useMemo(() => {
    const arr: string[] = [];
    rows.forEach((r) => {
      const k = r.examPoint || '其它';
      if (!arr.includes(k)) arr.push(k);
    });
    return arr;
  }, [rows]);

  const visibleRows = useMemo(
    () => rows.filter((r) => categoryFilter === '全部' || keyOf(r) === categoryFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, categoryFilter, groupBy],
  );

  const masteredCount = useMemo(() => visibleRows.filter((r) => r.masteredAt).length, [visibleRows]);
  const learningCount = useMemo(
    () => visibleRows.filter((r) => !r.masteredAt && (r.reviewCount || 0) > 0).length,
    [visibleRows],
  );
  const unmastered = visibleRows.length - masteredCount;
  const unpracticedCount = visibleRows.length - masteredCount - learningCount;
  const masteredPct = visibleRows.length ? (masteredCount / visibleRows.length) * 100 : 0;
  const learningPct = visibleRows.length ? (learningCount / visibleRows.length) * 100 : 0;

  const grouped = useMemo(() => {
    const map = new Map<string, Sentence[]>();
    visibleRows.forEach((r) => {
      const k = keyOf(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    });
    if (groupBy === 'exam') return Array.from(map.entries());
    return Array.from(map.entries()).sort(
      (a, b) =>
        (CATEGORY_ORDER.indexOf(a[0]) < 0 ? 99 : CATEGORY_ORDER.indexOf(a[0])) -
        (CATEGORY_ORDER.indexOf(b[0]) < 0 ? 99 : CATEGORY_ORDER.indexOf(b[0])),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRows, groupBy]);

  const handlePlay = async (s: Sentence) => {
    setPlayingId(s.id);
    try {
      await playWordAudio(s.en, { speed: 0.95 });
    } finally {
      setTimeout(() => setPlayingId((id) => (id === s.id ? null : id)), 600);
    }
  };

  const segments =
    groupBy === 'category'
      ? ['全部', ...CATEGORY_ORDER.filter((c) => counts[c])]
      : ['全部', ...examKeys];
  let seq = 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页头：与全站一致 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onGoBack} className="flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">
              {selectedLesson?.name || '常用语句'}
            </h1>
            <button
              type="button"
              onClick={() => onGoUnit?.()}
              className="text-xs text-gray-500 hover:text-blue-600"
            >
              {selectedTextbook?.name || ''} · <span className="underline underline-offset-2">单元总览</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-32">
        {/* 概要卡：规格与词表页完全一致（w-12 图标块 / text-lg 标题 / text-sm 副标题 / p-5），
            色相取第三色「紫」：教材册＝蓝→靛、单词＝绿→青，句子用紫与之成组且不撞色；
            卡内追加句子特有的「记忆曲线分段进度」 */}
        <Card className="mb-6 bg-gradient-to-r from-violet-500 to-purple-600 border-0 text-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessagesSquare className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-7">常用语句</h2>
                <p className="text-purple-100 text-sm">
                  共 {visibleRows.length} 句 · 已掌握 {masteredCount}
                </p>
              </div>
            </div>

            <div className="mt-4 h-1.5 rounded-full bg-white/25 overflow-hidden flex">
              <div className="h-full bg-white" style={{ width: `${masteredPct}%` }} />
              <div className="h-full bg-white/45" style={{ width: `${learningPct}%` }} />
            </div>

            <div className="mt-2.5 flex items-center gap-4 text-xs text-white/85">
              <span className="flex items-center gap-1.5">
                <i className="w-1.5 h-1.5 rounded-full bg-white" />
                已掌握 <span className="font-semibold text-white">{masteredCount}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <i className="w-1.5 h-1.5 rounded-full bg-white/45" />
                学习中 <span className="font-semibold text-white">{learningCount}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <i className="w-1.5 h-1.5 rounded-full bg-white/35" />
                未练 <span className="font-semibold text-white">{unpracticedCount}</span>
              </span>
            </div>

            {onGoDrill && (
              <button
                type="button"
                onClick={() => onGoDrill?.()}
                className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 py-2 text-sm font-medium text-white transition-colors"
              >
                <Target className="w-4 h-4" />
                考点专练 · 按语法考点集中强化
              </button>
            )}
          </CardContent>
        </Card>

        {/* 分组维度：与生字本同一 Tabs 组件 */}
        <Tabs
          value={groupBy}
          onValueChange={(v) => {
            setGroupBy(v as GroupBy);
            setCategoryFilter('全部');
          }}
          className="mb-2"
        >
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="category" className="text-xs">
              按分类
            </TabsTrigger>
            <TabsTrigger value="exam" className="text-xs">
              按考点
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* 筛选：随分组维度切换 */}
        <Tabs value={categoryFilter} onValueChange={setCategoryFilter} className="mb-2">
          <TabsList
            className="w-full grid"
            style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
          >
            {segments.map((c) => (
              <TabsTrigger key={c} value={c} className="text-xs">
                {c}
                <span className="ml-1 text-gray-400">{c === '全部' ? rows.length : counts[c] || 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中…
          </div>
        )}

        {!loading &&
          grouped.map(([category, items]) => (
            <section key={category}>
              <div className="flex items-baseline justify-between px-1 mt-5 mb-2 border-b border-gray-100 pb-1.5">
                <h3 className="text-sm font-medium text-gray-500">{category}</h3>
                <span className="text-xs text-gray-400">{items.length} 句</span>
              </div>

              <div className="space-y-3">
                {items.map((s) => {
                  seq += 1;
                  const isMastered = Boolean(s.masteredAt);
                  const isLearning = !isMastered && (s.reviewCount || 0) > 0;
                  const expanded = expandedId === s.id;
                  return (
                    <Card
                      key={s.id}
                      className={`transition-all hover:shadow-md cursor-pointer select-none ${
                        isMastered ? 'border-green-300 bg-green-50/50' : ''
                      }`}
                      onClick={() => setExpandedId(expanded ? null : s.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* 序号：与词表页同色（未掌握 bg-blue-100，已掌握转 bg-green-100） */}
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isMastered ? 'bg-green-100' : 'bg-blue-100'
                            }`}
                          >
                            <span
                              className={`text-sm font-semibold ${
                                isMastered ? 'text-green-700' : 'text-blue-600'
                              }`}
                            >
                              {seq}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-lg font-bold text-gray-900 leading-6 line-clamp-2">{s.en}</h4>
                              {isMastered && (
                                <Badge className="bg-green-100 text-green-700 border-0">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  已掌握
                                </Badge>
                              )}
                              {isLearning && (
                                <Badge variant="secondary" className="text-xs">
                                  学习中 S{Math.min(s.stage || 0, 8)}
                                </Badge>
                              )}
                              {!isMastered && s.isReview === 1 && (
                                <Badge variant="secondary" className="text-xs text-violet-700">
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  温故
                                </Badge>
                              )}
                            </div>

                            <p className="text-gray-700 mt-1">{s.zh}</p>

                            {expanded && (
                              <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-1">
                                <p className="text-xs text-gray-600">
                                  <span className="text-gray-900 font-medium">考点：</span>
                                  {s.grammarPoint || '—'}
                                </p>
                                <p className="text-xs text-gray-500">句型：{s.pattern || '—'}</p>
                                <p className="text-xs text-gray-400">出处：{s.source || '—'}</p>
                                {s.nextReviewAt && (
                                  <p className="text-xs text-gray-400">
                                    下次复习：{new Date(s.nextReviewAt).toLocaleString('zh-CN', { hour12: false })}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex-shrink-0 flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={`w-9 h-9 rounded-full flex items-center justify-center ${
                                playingId === s.id ? 'text-blue-600 bg-blue-50' : 'text-gray-400'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handlePlay(s);
                              }}
                              title="朗读"
                            >
                              <Volume2 className={`w-5 h-5 ${playingId === s.id ? 'animate-pulse' : ''}`} />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}

        {!loading && visibleRows.length === 0 && (
          <div className="text-center py-12">
            <MessagesSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">该单元暂无常用语句</p>
          </div>
        )}
      </main>

      {/* 底部操作栏：与全站一致，主操作回归全站主色 */}
      {visibleRows.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <Button variant="outline" className="flex-1 h-12" onClick={() => onGoUnit?.()}>
              <LayoutGrid className="w-4 h-4 mr-2" />
              单元总览
            </Button>
            <Button
              className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700"
              onClick={onStartPractice}
              disabled={unmastered === 0}
            >
              <Play className="w-4 h-4 mr-2" />
              {unmastered === 0 ? '全部已掌握' : '开始练习'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
