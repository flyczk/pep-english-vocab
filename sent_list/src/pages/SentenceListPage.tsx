import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  MessagesSquare,
  Volume2,
  Play,
  CheckCircle2,
  Loader2,
  Lightbulb,
  Target,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { dataService, type Sentence } from '@/services/dataService';
import { playWordAudio } from '@/utils/audioPlayer';
import { toast } from 'sonner';

interface SentenceListPageProps {
  onGoBack: () => void;
  onGoUnit?: () => void;
  onStartPractice: () => void;
}

const CATEGORY_ORDER = ['重点考点', '常用搭配', '经典句型'];

const categoryStyle: Record<string, string> = {
  重点考点: 'bg-rose-50 text-rose-600 border-rose-100',
  常用搭配: 'bg-amber-50 text-amber-600 border-amber-100',
  经典句型: 'bg-indigo-50 text-indigo-600 border-indigo-100',
};

export function SentenceListPage({ onGoBack, onGoUnit, onStartPractice }: SentenceListPageProps) {
  const { selectedTextbook, selectedLesson } = useApp();
  const [rows, setRows] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const masteredCount = useMemo(() => rows.filter((r) => r.masteredAt).length, [rows]);
  const unmastered = rows.length - masteredCount;

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      const k = r.category || '常用语句';
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, Sentence[]>();
    rows.forEach((r) => {
      const k = r.category || '常用语句';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    });
    return Array.from(map.entries()).sort(
      (a, b) =>
        (CATEGORY_ORDER.indexOf(a[0]) < 0 ? 99 : CATEGORY_ORDER.indexOf(a[0])) -
        (CATEGORY_ORDER.indexOf(b[0]) < 0 ? 99 : CATEGORY_ORDER.indexOf(b[0])),
    );
  }, [rows]);

  const handlePlay = async (s: Sentence) => {
    setPlayingId(s.id);
    try {
      await playWordAudio(s.en, { speed: 0.95 });
    } finally {
      setTimeout(() => setPlayingId((id) => (id === s.id ? null : id)), 600);
    }
  };

  let seq = 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onGoBack} className="flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{selectedLesson?.name || '常用语句'}</h1>
            <button
              type="button"
              onClick={() => onGoUnit?.()}
              className="text-xs text-gray-500 hover:text-amber-600"
            >
              {selectedTextbook?.name || ''} · <span className="underline underline-offset-2">单元总览</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-32">
        {/* 单元信息 */}
        <Card className="mb-6 bg-gradient-to-r from-amber-500 to-orange-600 border-0 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <MessagesSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">{selectedLesson?.name || '常用语句'}</h2>
                  <p className="text-amber-100 text-sm">
                    共 {rows.length} 句 · 已掌握 {masteredCount} 句
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-1">
                {CATEGORY_ORDER.filter((c) => counts[c]).map((c) => (
                  <span key={c} className="text-xs text-amber-100">
                    {c} {counts[c]}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中…
          </div>
        )}

        {!loading &&
          grouped.map(([category, items]) => (
            <section key={category} className="mb-5">
              <div className="flex items-center gap-2 px-1 mb-2">
                <Target className="w-3.5 h-3.5 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">{category}</h3>
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
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isMastered ? 'bg-green-100' : 'bg-amber-100'
                            }`}
                          >
                            <span
                              className={`text-sm font-semibold ${
                                isMastered ? 'text-green-600' : 'text-amber-600'
                              }`}
                            >
                              {seq}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[15px] font-semibold text-gray-900 leading-6">{s.en}</p>
                            </div>

                            <p className="text-sm text-gray-600 mt-1">{s.zh}</p>

                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {s.category && (
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] border ${categoryStyle[s.category] || 'bg-gray-50 text-gray-500 border-gray-100'}`}
                                >
                                  {s.category}
                                </Badge>
                              )}
                              {s.pattern && (
                                <span className="text-[11px] text-gray-400">句型：{s.pattern}</span>
                              )}
                              {isMastered && (
                                <Badge className="bg-green-100 text-green-700 border-0 text-[11px]">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  已掌握
                                </Badge>
                              )}
                              {isLearning && (
                                <Badge variant="secondary" className="text-[11px]">
                                  学习中 S{Math.min(s.stage || 0, 8)}
                                </Badge>
                              )}
                            </div>

                            {expanded && (
                              <div className="mt-3 rounded-lg bg-amber-50/70 border border-amber-100 p-3 space-y-1">
                                <p className="text-xs text-gray-600">
                                  <span className="text-amber-700 font-medium">考点：</span>
                                  {s.grammarPoint || '—'}
                                </p>
                                <p className="text-xs text-gray-500">出处：{s.source || '—'}</p>
                                {s.nextReviewAt && (
                                  <p className="text-xs text-gray-500">
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
                              className="w-9 h-9 rounded-full text-gray-400 hover:text-amber-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handlePlay(s);
                              }}
                              title="朗读"
                            >
                              <Volume2 className={`w-5 h-5 ${playingId === s.id ? 'animate-pulse text-amber-600' : ''}`} />
                            </Button>
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center ${
                                expanded ? 'text-amber-600 bg-amber-50' : 'text-gray-300'
                              }`}
                            >
                              <Lightbulb className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}

        {!loading && rows.length === 0 && (
          <div className="text-center py-12">
            <MessagesSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">该单元暂无常用语句</p>
          </div>
        )}
      </main>

      {/* 底部操作栏 */}
      {rows.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <div className="flex-1 text-xs text-gray-500">
              未掌握 <span className="font-semibold text-amber-600">{unmastered}</span> 句
              <span className="mx-1">·</span>
              已掌握 {masteredCount} 句
            </div>
            <Button
              className="h-12 px-6 bg-amber-600 hover:bg-amber-700"
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
