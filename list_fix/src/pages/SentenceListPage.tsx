import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Volume2, Play, Loader2, MessagesSquare } from 'lucide-react';
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

const CATEGORY_COLOR: Record<string, string> = {
  重点考点: 'bg-rose-400',
  常用搭配: 'bg-amber-400',
  经典句型: 'bg-indigo-400',
};

export function SentenceListPage({ onGoBack, onGoUnit, onStartPractice }: SentenceListPageProps) {
  const { selectedTextbook, selectedLesson } = useApp();
  const [rows, setRows] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('全部');

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

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      const k = r.category || '常用语句';
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [rows]);

  const visibleRows = useMemo(
    () => rows.filter((r) => categoryFilter === '全部' || (r.category || '常用语句') === categoryFilter),
    [rows, categoryFilter],
  );

  const masteredCount = useMemo(() => visibleRows.filter((r) => r.masteredAt).length, [visibleRows]);
  const learningCount = useMemo(
    () => visibleRows.filter((r) => !r.masteredAt && (r.reviewCount || 0) > 0).length,
    [visibleRows],
  );
  const newCount = visibleRows.length - masteredCount - learningCount;
  const unmastered = visibleRows.length - masteredCount;

  const grouped = useMemo(() => {
    const map = new Map<string, Sentence[]>();
    visibleRows.forEach((r) => {
      const k = r.category || '常用语句';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    });
    return Array.from(map.entries()).sort(
      (a, b) =>
        (CATEGORY_ORDER.indexOf(a[0]) < 0 ? 99 : CATEGORY_ORDER.indexOf(a[0])) -
        (CATEGORY_ORDER.indexOf(b[0]) < 0 ? 99 : CATEGORY_ORDER.indexOf(b[0])),
    );
  }, [visibleRows]);

  const handlePlay = async (s: Sentence) => {
    setPlayingId(s.id);
    try {
      await playWordAudio(s.en, { speed: 0.95 });
    } finally {
      setTimeout(() => setPlayingId((id) => (id === s.id ? null : id)), 600);
    }
  };

  const segments = ['全部', ...CATEGORY_ORDER.filter((c) => counts[c])];
  let seq = 0;

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      {/* 页头 */}
      <header className="bg-white/90 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onGoBack} className="flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-semibold text-gray-900 truncate tracking-tight">
              {selectedLesson?.name || '常用语句'}
            </h1>
            <button
              type="button"
              onClick={() => onGoUnit?.()}
              className="text-xs text-gray-400 hover:text-amber-600"
            >
              {selectedTextbook?.name || ''} · <span className="underline underline-offset-2">单元总览</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-32">
        {/* 进度条 */}
        <div className="pt-5">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[13px] text-gray-600">
              已掌握 <span className="font-semibold text-gray-900">{masteredCount}</span>
              <span className="text-gray-400"> / {visibleRows.length} 句</span>
            </p>
            <p className="text-xs text-gray-400">
              学习中 {learningCount} · 未练 {newCount}
            </p>
          </div>
          <div className="h-1 rounded-full bg-gray-200 flex overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${(masteredCount / Math.max(visibleRows.length, 1)) * 100}%` }}
            />
            <div
              className="h-full bg-amber-400"
              style={{ width: `${(learningCount / Math.max(visibleRows.length, 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* 分类筛选 */}
        <div className="flex gap-0.5 bg-gray-100 rounded-xl p-0.5 mt-4">
          {segments.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`flex-1 rounded-[10px] py-[7px] text-xs transition-colors ${
                categoryFilter === c
                  ? 'bg-white text-gray-900 font-semibold shadow-sm'
                  : 'text-gray-500 font-medium'
              }`}
            >
              {c}
              <span className="ml-1 font-normal text-gray-400">
                {c === '全部' ? rows.length : counts[c] || 0}
              </span>
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中…
          </div>
        )}

        {!loading &&
          grouped.map(([category, items]) => (
            <section key={category}>
              <div className="flex items-center gap-2 mt-5 mb-1">
                <i className={`w-[3px] h-3 rounded-sm ${CATEGORY_COLOR[category] || 'bg-gray-300'}`} />
                <h2 className="text-[12.5px] font-semibold text-gray-600 tracking-wide">{category}</h2>
                <span className="text-[11px] text-gray-300 ml-auto">{items.length} 句</span>
              </div>

              <ul>
                {items.map((s) => {
                  seq += 1;
                  const isMastered = Boolean(s.masteredAt);
                  const isLearning = !isMastered && (s.reviewCount || 0) > 0;
                  const expanded = expandedId === s.id;
                  return (
                    <li
                      key={s.id}
                      className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-b-0 cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : s.id)}
                    >
                      <span
                        className={`w-6 flex-shrink-0 text-xs tabular-nums pt-[3px] ${
                          isMastered ? 'text-emerald-600' : isLearning ? 'text-amber-500' : 'text-gray-300'
                        }`}
                      >
                        {String(seq).padStart(2, '0')}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-[15px] font-medium leading-[1.5] tracking-tight line-clamp-2 ${
                            isMastered ? 'text-emerald-700' : 'text-gray-900'
                          }`}
                        >
                          {s.en}
                        </p>
                        <p className="text-[13px] text-gray-500 mt-0.5">{s.zh}</p>

                        {expanded && (
                          <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 space-y-1">
                            <p className="text-[11px] text-gray-600">
                              <span className="text-amber-700 font-medium">考点</span>
                              {s.grammarPoint || '—'}
                            </p>
                            <p className="text-[11px] text-gray-500">句型：{s.pattern || '—'}</p>
                            <p className="text-[11px] text-gray-400">出处：{s.source || '—'}</p>
                            {s.nextReviewAt && (
                              <p className="text-[11px] text-gray-400">
                                下次复习：{new Date(s.nextReviewAt).toLocaleString('zh-CN', { hour12: false })}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 rounded-full flex-shrink-0 text-gray-400 hover:text-amber-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handlePlay(s);
                        }}
                        title="朗读"
                      >
                        <Volume2 className={`w-4 h-4 ${playingId === s.id ? 'animate-pulse text-amber-600' : ''}`} />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

        {!loading && visibleRows.length === 0 && (
          <div className="py-16 text-center">
            <MessagesSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">该单元暂无常用语句</p>
          </div>
        )}
      </main>

      {/* 底部操作栏 */}
      {visibleRows.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-gray-100">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1 text-xs text-gray-400">
              未掌握 <span className="font-semibold text-gray-900">{unmastered}</span> 句 · 已掌握 {masteredCount} 句
            </div>
            <Button
              className="bg-gray-900 hover:bg-gray-800 h-10 px-5 text-[13px] font-semibold rounded-[10px]"
              onClick={onStartPractice}
              disabled={unmastered === 0}
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              {unmastered === 0 ? '全部已掌握' : '开始练习'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
