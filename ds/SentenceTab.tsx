import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  Volume2,
  Loader2,
  MessagesSquare,
  Target,
} from 'lucide-react';
import { dataService, type Sentence } from '@/services/dataService';
import { playWordAudio } from '@/utils/audioPlayer';

interface SentenceTabProps {
  onOpenSentences: () => void;
  onOpenDrill?: () => void;
}

interface Stats {
  total: number;
  mastered: number;
  learning: number;
  due: number;
  untouched: number;
}

interface Row extends Sentence {
  lessonName?: string;
  textbookName?: string;
}

interface Group {
  key: string;
  lessonName: string;
  textbookName: string;
  lessonId: string;
  items: Row[];
}

// 统计卡：与 VocabularyPage 的单词统计卡完全同构（同色同字号）
function StatCard({
  tint,
  icon,
  label,
  value,
}: {
  tint: string;
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className={tint}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function SentenceTab({ onOpenSentences, onOpenDrill }: SentenceTabProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [list, st] = await Promise.all([
          dataService.getDueSentences(100),
          dataService.getSentenceStats(),
        ]);
        if (!alive) return;
        setRows(list as Row[]);
        setStats(st);
      } catch {
        /* 忽略：展示空态 */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    rows.forEach((r) => {
      const key = r.lessonId;
      if (!map.has(key)) {
        map.set(key, {
          key,
          lessonId: r.lessonId,
          lessonName: (r as any).lessonName || `单元 ${r.lessonId}`,
          textbookName: (r as any).textbookName || '',
          items: [],
        });
      }
      map.get(key)!.items.push(r);
    });
    return Array.from(map.values());
  }, [rows]);

  const handlePlay = async (s: Row) => {
    setPlayingId(s.id);
    try {
      await playWordAudio(s.en, { speed: 0.95 });
    } finally {
      setTimeout(() => setPlayingId((id) => (id === s.id ? null : id)), 600);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 flex items-center justify-center text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中…
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 pb-32">
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <MessagesSquare className="w-12 h-12 mx-auto text-gray-300" />
            <p className="text-gray-700 font-medium">还没有常用语句</p>
            <p className="text-sm text-gray-500">去单元里练几句，练过的句子会按记忆曲线回到这里</p>
            <Button variant="outline" onClick={onOpenSentences} className="mt-2 border-blue-300 text-blue-700">
              去练句子
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-32">
      {/* 统计卡四联：与单词 tab 同色同字号 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          tint="bg-blue-50 border-blue-200"
          value={stats.total}
          label="总句子"
          icon={<BookOpen className="w-4 h-4 text-blue-600" />}
        />
        <StatCard
          tint="bg-green-50 border-green-200"
          value={stats.mastered}
          label="已掌握"
          icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
        />
        <StatCard
          tint="bg-yellow-50 border-yellow-200"
          value={stats.learning}
          label="学习中"
          icon={<Clock className="w-4 h-4 text-yellow-600" />}
        />
        <StatCard
          tint="bg-red-50 border-red-200"
          value={stats.due}
          label="待复习"
          icon={<AlertCircle className="w-4 h-4 text-red-600" />}
        />
      </div>

      {/* 考点专练入口：与提醒卡同一规格，用句子模块的紫色 */}
      {onOpenDrill && (
        <Card
          className="mb-6 border-violet-200 bg-violet-50 cursor-pointer hover:shadow-md transition-all"
          onClick={() => onOpenDrill?.()}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-violet-900">考点专练</h3>
                  <p className="text-sm text-violet-700 mt-0.5">
                    按语法考点集中强化，只练已学过的单元
                  </p>
                </div>
              </div>
              <Button size="sm" className="bg-violet-600 hover:bg-violet-700">
                去练习
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 提醒卡：与单词 tab 同一规格 */}
      {stats.due > 0 && (
        <Card className="mb-6 border-red-300 bg-red-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-900">有 {stats.due} 句需要复习</h3>
                  <p className="text-sm text-red-700 mt-0.5">
                    同一条记忆曲线，一次过才升档，修补通过只保档
                  </p>
                </div>
              </div>
              <Button onClick={onOpenSentences} className="bg-red-600 hover:bg-red-700">
                <Play className="w-4 h-4 mr-2" /> 开始复习
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stats.due === 0 && (
        <Card className="mb-6">
          <CardContent className="p-12 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-300" />
            <p className="text-gray-700 font-medium">暂时没有到期的句子</p>
            <p className="text-sm text-gray-500">
              已掌握 {stats.mastered} 句，剩下的会在记忆曲线上安排好的时间回来
            </p>
          </CardContent>
        </Card>
      )}

      {/* 到期列表：与单词列表行完全同构 */}
      {groups.map((g) => (
        <section key={g.key} className="mb-6">
          <div className="flex items-baseline justify-between px-1 mb-2">
            <h3 className="text-sm font-medium text-gray-500">{g.lessonName}</h3>
            <span className="text-xs text-gray-400">
              {g.textbookName} · {g.items.length} 句
            </span>
          </div>
          <div className="space-y-3">
            {g.items.map((s, index) => {
              const isMastered = Boolean(s.masteredAt);
              const isLearning = !isMastered && (s.reviewCount || 0) > 0;
              return (
                <Card
                  key={s.id}
                  className={`transition-all hover:shadow-md ${isMastered ? 'border-green-300 bg-green-50/50' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
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
                          {index + 1}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-lg font-bold text-gray-900 leading-6 line-clamp-2">{s.en}</h4>
                          {isMastered && (
                            <Badge className="bg-green-100 text-green-700 border-0">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> 已掌握
                            </Badge>
                          )}
                          {isLearning && (
                            <Badge variant="secondary" className="text-xs">
                              学习中 S{Math.min(s.stage || 0, 8)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-700 mt-1">{s.zh}</p>
                      </div>

                      <div className="flex-shrink-0 flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={`w-9 h-9 rounded-full flex items-center justify-center ${
                            playingId === s.id ? 'text-blue-600 bg-blue-50' : 'text-gray-400'
                          }`}
                          onClick={() => void handlePlay(s)}
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
    </div>
  );
}
