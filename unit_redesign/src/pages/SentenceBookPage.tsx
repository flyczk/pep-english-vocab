import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Play, MessagesSquare } from 'lucide-react';
import { dataService, type Sentence } from '@/services/dataService';
import { toast } from 'sonner';

interface SentenceBookPageProps {
  onGoBack: () => void;
  onOpenLessonSentences: (lessonId: string) => void;
}

interface Group {
  lessonId: string;
  lessonName: string;
  textbookName: string;
  items: Sentence[];
}

export function SentenceBookPage({ onGoBack, onOpenLessonSentences }: SentenceBookPageProps) {
  const [rows, setRows] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await dataService.getDueSentences(100);
        if (alive) setRows(data);
      } catch (e: any) {
        toast.error(e?.message || '加载待复习句子失败');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const groups: Group[] = [];
  rows.forEach((r) => {
    let g = groups.find((x) => x.lessonId === r.lessonId);
    if (!g) {
      g = {
        lessonId: r.lessonId,
        lessonName: (r as any).lessonName || `Lesson ${r.lessonId}`,
        textbookName: (r as any).textbookName || '',
        items: [],
      };
      groups.push(g);
    }
    g.items.push(r);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onGoBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">生句本</h1>
            <p className="text-xs text-gray-500">到期需要复习的句子 · {rows.length} 句</p>
          </div>
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
            <CardContent className="p-10 text-center text-gray-500 space-y-2">
              <MessagesSquare className="w-8 h-8 mx-auto text-gray-300" />
              <p>暂时没有到期的句子</p>
              <p className="text-xs">练过的句子会按记忆曲线回到这里</p>
            </CardContent>
          </Card>
        )}

        {groups.map((g) => (
          <Card key={g.lessonId}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{g.lessonName}</p>
                  <p className="text-xs text-gray-500">{g.textbookName}</p>
                </div>
                <Button size="sm" onClick={() => onOpenLessonSentences(g.lessonId)}>
                  <Play className="w-4 h-4 mr-1" /> 复习 {g.items.length} 句
                </Button>
              </div>
              <div className="space-y-2">
                {g.items.slice(0, 3).map((s) => (
                  <div key={s.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      {s.category && <Badge variant="secondary" className="text-[10px]">{s.category}</Badge>}
                      <span className="text-gray-800 truncate">{s.en}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{s.zh}</p>
                  </div>
                ))}
                {g.items.length > 3 && (
                  <p className="text-xs text-gray-400">还有 {g.items.length - 3} 句…</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
