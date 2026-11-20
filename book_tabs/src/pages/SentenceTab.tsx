import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessagesSquare, Play } from 'lucide-react';
import { dataService, type Sentence } from '@/services/dataService';

interface SentenceTabProps {
  onOpenSentences: () => void;
}

interface Group {
  category: string;
  items: Sentence[];
}

const CATEGORY_ORDER = ['重点考点', '常用搭配', '经典句型'];

function StageDots({ stage }: { stage: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i < Math.min(stage, 5) ? 'bg-emerald-500' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  );
}

export function SentenceTab({ onOpenSentences }: SentenceTabProps) {
  const [rows, setRows] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    dataService
      .getDueSentences(100)
      .then((list) => {
        if (alive) setRows(list);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Sentence[]>();
    rows.forEach((r) => {
      const key = r.category || '常用语句';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries())
      .sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a[0]);
        const ib = CATEGORY_ORDER.indexOf(b[0]);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      })
      .map(([category, items]) => ({ category, items }));
  }, [rows]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 flex items-center justify-center text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <MessagesSquare className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-gray-700 font-medium">还没有需要复习的句子</p>
            <p className="text-sm text-gray-500">
              去单元里练几句，练过的句子会按记忆曲线回到这里
            </p>
            <Button variant="outline" onClick={onOpenSentences} className="mt-2">
              去练句子
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-32 space-y-4">
      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessagesSquare className="w-5 h-5 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-900">{rows.length} 句到期待复习</p>
              <p className="text-xs text-amber-700">一次过才升档，修补通过只保档</p>
            </div>
          </div>
          <Button size="sm" onClick={onOpenSentences} className="bg-amber-600 hover:bg-amber-700">
            <Play className="w-4 h-4 mr-1" /> 开始
          </Button>
        </CardContent>
      </Card>

      {groups.map((g) => (
        <div key={g.category}>
          <p className="text-xs font-semibold text-gray-500 px-1 mb-2">
            {g.category} · {g.items.length} 句
          </p>
          <Card>
            <CardContent className="p-0 divide-y divide-gray-100">
              {g.items.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.en}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{s.zh}</p>
                  </div>
                  {s.pattern && (
                    <Badge variant="secondary" className="hidden sm:inline-flex text-[10px]">
                      {s.pattern}
                    </Badge>
                  )}
                  <StageDots stage={s.stage || 0} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
