import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessagesSquare, Play, Target } from 'lucide-react';
import { dataService, type Sentence } from '@/services/dataService';

interface SentenceTabProps {
  onOpenSentences: () => void;
}

const CATEGORY_ORDER = ['重点考点', '常用搭配', '经典句型'];

const categoryStyle: Record<string, string> = {
  重点考点: 'bg-rose-50 text-rose-600 border-rose-100',
  常用搭配: 'bg-amber-50 text-amber-600 border-amber-100',
  经典句型: 'bg-indigo-50 text-indigo-600 border-indigo-100',
};

function StageDots({ stage }: { stage: number }) {
  return (
    <div className="flex items-center gap-1">
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

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      const k = r.category || '常用语句';
      m[k] = (m[k] || 0) + 1;
    });
    return m;
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
      <div className="max-w-5xl mx-auto px-4 py-6 pb-32">
        <Card className="border-gray-200">
          <CardContent className="p-10 text-center space-y-3">
            <MessagesSquare className="w-12 h-12 mx-auto text-gray-300" />
            <p className="text-gray-700 font-medium">还没有需要复习的句子</p>
            <p className="text-sm text-gray-500">去单元里练几句，练过的句子会按记忆曲线回到这里</p>
            <Button variant="outline" onClick={onOpenSentences} className="mt-2 border-amber-300 text-amber-700">
              去练句子
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-32">
      {/* 概览卡：与单词 tab 的统计区同一视觉重量 */}
      <Card className="mb-6 bg-gradient-to-r from-amber-500 to-orange-600 border-0 text-white">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <MessagesSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{rows.length} 句到期待复习</h2>
                <p className="text-amber-100 text-sm">一次过才升档，修补通过只保档</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={onOpenSentences}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              <Play className="w-4 h-4 mr-1" /> 开始
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {CATEGORY_ORDER.map((c) => (
              <div key={c} className="rounded-lg bg-white/15 px-3 py-2">
                <p className="text-[11px] text-amber-50">{c}</p>
                <p className="text-lg font-semibold">{counts[c] || 0}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {grouped.map(([category, items]) => (
        <section key={category} className="mb-5">
          <div className="flex items-center gap-2 px-1 mb-2">
            <Target className="w-3.5 h-3.5 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">{category}</h3>
            <span className="text-xs text-gray-400">{items.length} 句</span>
          </div>

          <div className="space-y-3">
            {items.map((s, index) => (
              <Card key={s.id} className="transition-all hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100">
                      <span className="text-sm font-semibold text-amber-600">{index + 1}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-gray-900 leading-6">{s.en}</p>
                      <p className="text-sm text-gray-600 mt-1">{s.zh}</p>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[11px] border ${categoryStyle[category] || 'bg-gray-50 text-gray-500 border-gray-100'}`}
                        >
                          {category}
                        </Badge>
                        {s.pattern && <span className="text-[11px] text-gray-400">句型：{s.pattern}</span>}
                        {s.stage ? (
                          <span className="text-[11px] text-gray-400">S{Math.min(s.stage, 8)}</span>
                        ) : (
                          <span className="text-[11px] text-amber-600">未练</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2">
                      <StageDots stage={s.stage || 0} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
