import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, BookOpen, MessagesSquare, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';

interface UnitPageProps {
  onGoBack: () => void;
  onOpenWords: () => void;
  onOpenSentences: () => void;
}

export function UnitPage({ onGoBack, onOpenWords, onOpenSentences }: UnitPageProps) {
  const { selectedTextbook, selectedLesson } = useApp();

  const wordCount = selectedLesson?.words?.length ?? 0;
  const sentenceCount = selectedLesson?.sentenceCount ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onGoBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">{selectedLesson?.name || '单元'}</h1>
            <p className="text-xs text-gray-500">{selectedTextbook?.name || ''}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <p className="text-sm text-gray-500 px-1">选一项开始。语句练输出，单词练拼写，两条线各自记进度。</p>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-amber-200"
          onClick={onOpenSentences}
        >
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <MessagesSquare className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">常用语句</h2>
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                  {sentenceCount > 0 ? `${sentenceCount} 句` : '暂无'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                按重点考点 / 常用搭配 / 经典句型分组，整句输出
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-shadow ${wordCount > 0 ? 'hover:shadow-md border-blue-200' : 'opacity-60'}`}
          onClick={() => {
            if (wordCount > 0) onOpenWords();
          }}
        >
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">单词背诵</h2>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {wordCount} 词
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">看词义拼写，按记忆曲线安排复习</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
