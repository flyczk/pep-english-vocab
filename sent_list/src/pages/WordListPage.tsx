import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Volume2,
  Play,
  BookOpen,
  CheckCircle2,
  Settings2,
  Flag,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import { playWordAudio, type SpeechEngineMode } from '@/utils/audioPlayer';
import { dataService } from '@/services/dataService';
import type { Word } from '@/types';

interface WordListPageProps {
  onGoBack: () => void;
  onStartStudy: (words?: Word[], speed?: number, wrongDelay?: number) => void;
  onGoUnit?: () => void;
}

export function WordListPage({ onGoBack, onStartStudy, onGoUnit }: WordListPageProps) {
  const { selectedTextbook, selectedLesson, vocabularyItems } = useApp();
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);
  const [revealedMeaningMap, setRevealedMeaningMap] = useState<Record<string, boolean>>({});

  // 报错相关：已报错的单词 ID 集合 + 正在提交中的 ID
  const [reportedWordIds, setReportedWordIds] = useState<Set<string>>(new Set());
  const [reportingWordId, setReportingWordId] = useState<string | null>(null);

  // 练习设置弹窗状态
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [practiceRange, setPracticeRange] = useState<string>('all');
  const [startMode, setStartMode] = useState<string>('unpracticed');
  const [practiceSpeed, setPracticeSpeed] = useState<string>('1.0');
  // 答错时的额外停留时间（毫秒）
  const [wrongDelay, setWrongDelay] = useState<string>('1500');
  const [dialogLang, setDialogLang] = useState<'en' | 'zh'>('en');

  useEffect(() => {
    setRevealedMeaningMap({});
  }, [selectedLesson?.id]);

  if (!selectedTextbook || !selectedLesson) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">请先选择课程</p>
          <Button onClick={onGoBack} className="mt-4">
            返回
          </Button>
        </div>
      </div>
    );
  }

  const words = selectedLesson.words;

  // 播放单词发音
  const playAudio = async (word: Word) => {
    if (playingWordId) return;
    setRevealedMeaningMap((prev) => ({ ...prev, [word.id]: true }));

    setPlayingWordId(word.id);
    try {
      const selectedEngine = String(word.ttsEngine || 'auto') as SpeechEngineMode;
      if (selectedEngine !== 'auto') {
        await playWordAudio(word.word, { engine: selectedEngine, strictEngine: true });
      } else {
        await playWordAudio(word.word);
      }
    } catch {
      toast.error('播放失败');
    } finally {
      setPlayingWordId(null);
    }
  };

  const handleWordCardClick = (word: Word) => {
    const isRevealed = !!revealedMeaningMap[word.id];
    if (isRevealed) {
      setRevealedMeaningMap((prev) => ({ ...prev, [word.id]: false }));
      return;
    }
    void playAudio(word);
  };

  // 一键报错：上报单词原始拼写/释义有误，无需弹窗
  const handleReportError = async (word: Word) => {
    if (reportingWordId) return;
    if (reportedWordIds.has(word.id)) return;
    setReportingWordId(word.id);
    try {
      await dataService.reportWordError(String(word.id), {
        userInput: '',
        expectedAnswer: word.word,
        reason: '',
        isCorrect: false,
      });
      setReportedWordIds((prev) => new Set(prev).add(word.id));
      toast.success('已提交报错，管理员会尽快处理', { style: { marginTop: '70px' }, duration: 2000 });
    } catch (e: any) {
      toast.error(e?.message || '提交报错失败');
    } finally {
      setReportingWordId(null);
    }
  };

  // 检查单词是否已掌握（从 vocabularyItems 中查找）
  const getWordStatus = (wordId: string) => {
    return vocabularyItems.find(v => v.wordId === wordId);
  };

  const isWordPracticed = (wordId: string) => {
    const status = getWordStatus(wordId);
    if (!status) return false;
    // Consider practiced if status is 'learning', 'mastered', or if it has been reviewed > 0 times
    return status.status !== 'new' as any || (status.reviewCount && status.reviewCount > 0);
  };

  const handleOpenSettings = () => {
    const unpracticedCount = words.filter(w => !isWordPracticed(w.id)).length;
    if (unpracticedCount === 0 && words.length > 0) {
      setStartMode('beginning'); // 全练过就默认从头开始
    } else {
      setStartMode('unpracticed');
    }
    setSettingsOpen(true);
  };

  const handleConfirmStart = () => {
    setSettingsOpen(false);

    let targetWords: Word[] = [];

    // 辅助函数：根据单词拼字去重并取前 N 个拼字的原始记录
    const getUniqueWordsCount = (ws: Word[]) => new Set(ws.map(w => (w.word || '').trim().toLowerCase())).size;
    const takeUniqueWords = (ws: Word[], limit: number) => {
      const spellings = new Set<string>();
      for (const w of ws) {
        if (spellings.size < limit) spellings.add((w.word || '').trim().toLowerCase());
      }
      return ws.filter(w => spellings.has((w.word || '').trim().toLowerCase()));
    };

    // 处理起始位置
    if (startMode === 'unpracticed') {
      // 过滤出所有未练习的单词
      targetWords = words.filter(w => !isWordPracticed(w.id));
    } else {
      // 从头开始
      targetWords = [...words];
    }

    // 处理数量 和 fallback
    if (practiceRange !== 'all') {
      const limit = parseInt(practiceRange, 10);
      if (!isNaN(limit) && limit > 0) {
        if (startMode === 'unpracticed') {
          const unpracticedUnique = getUniqueWordsCount(targetWords);
          // 如果仅仅取未练习的独立单词不够 limit 个数，就需要从已练习里借来凑数
          if (unpracticedUnique < limit && getUniqueWordsCount(words) >= limit) {
            const practicedWords = words.filter(w => isWordPracticed(w.id));
            const existingSpellings = new Set(targetWords.map(w => (w.word || '').trim().toLowerCase()));
            const candidatePracticed = practicedWords.filter(w => !existingSpellings.has((w.word || '').trim().toLowerCase()));

            const paddingWords = takeUniqueWords(candidatePracticed, limit - unpracticedUnique);
            targetWords = [...targetWords, ...paddingWords];
          } else {
            targetWords = takeUniqueWords(targetWords, limit);
          }
        } else {
          targetWords = takeUniqueWords(targetWords, limit);
        }
      }
    }

    const speed = parseFloat(practiceSpeed);
    const delay = parseInt(wrongDelay, 10);
    onStartStudy(targetWords, isNaN(speed) ? 1.0 : speed, isNaN(delay) ? 1500 : delay);
  };

  const t = {
    title: dialogLang === 'en' ? 'Practice Settings' : '练习设置',
    range: dialogLang === 'en' ? 'Practice Range' : '练习范围',
    rangeAll: dialogLang === 'en' ? `Whole Unit (${words.length} words)` : `整个 Unit (${words.length}词)`,
    range20: dialogLang === 'en' ? '20 words' : '20 个单词',
    range40: dialogLang === 'en' ? '40 words' : '40 个单词',
    range60: dialogLang === 'en' ? '60 words' : '60 个单词',
    startPos: dialogLang === 'en' ? 'Start Position' : '起始位置',
    posUnpracticed: dialogLang === 'en' ? 'Unpracticed words' : '没练过的单词',
    posBeginning: dialogLang === 'en' ? 'From beginning' : '从头开始',
    speed: dialogLang === 'en' ? 'Transition Speed' : '切换速度',
    speedNormal: dialogLang === 'en' ? 'Normal' : '正常速度',
    speedFast: dialogLang === 'en' ? 'Fast (1.3x)' : '快速 (1.3x)',
    speedSlow: dialogLang === 'en' ? 'Slow (0.7x)' : '慢速 (0.7x)',
    wrongDelay: dialogLang === 'en' ? 'Wrong Answer Pause' : '答错停留',
    wrongDelayShort: dialogLang === 'en' ? 'Short (0.5s)' : '短 (0.5秒)',
    wrongDelayNormal: dialogLang === 'en' ? 'Normal (1.5s)' : '常规 (1.5秒)',
    wrongDelayLong: dialogLang === 'en' ? 'Long (3s)' : '长 (3秒)',
    wrongDelayManual: dialogLang === 'en' ? 'Manual (no auto)' : '手动 (不自动)',
    cancel: dialogLang === 'en' ? 'Cancel' : '取消',
    start: dialogLang === 'en' ? "Let's Go!" : '开始练习',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onGoBack}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">
              {selectedLesson.name}
            </h1>
            <button
              type="button"
              onClick={() => onGoUnit?.()}
              className="text-xs text-gray-500 hover:text-blue-600"
            >
              {selectedTextbook.name} · <span className="underline underline-offset-2">单元总览</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-32">
        {/* 课程信息 */}
        <Card className="mb-6 bg-gradient-to-r from-green-500 to-teal-600 border-0 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">{selectedLesson.name}</h2>
                  <p className="text-green-100 text-sm">
                    共 {words.length} 个单词
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 单词列表 */}
        <div className="space-y-3">
          {words.map((word, index) => {
            const vocabStatus = getWordStatus(word.id);
            const isMastered = vocabStatus?.status === 'mastered';
            const revealedMeaning = !!revealedMeaningMap[word.id];

            return (
              <Card
                key={word.id}
                className={`transition-all hover:shadow-md cursor-pointer select-none ${isMastered ? 'border-green-300 bg-green-50/50' : ''
                  }`}
                onClick={() => handleWordCardClick(word)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* 序号 */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isMastered ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                      <span className={`text-sm font-semibold ${isMastered ? 'text-green-600' : 'text-blue-600'
                        }`}>
                        {index + 1}
                      </span>
                    </div>

                    {/* 单词信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-lg font-bold text-gray-900">
                          {word.word}
                        </h4>
                        {word.phonetic && (
                          <span className="text-gray-500 text-sm">
                            {word.phonetic}
                          </span>
                        )}
                        {isMastered && (
                          <Badge className="bg-green-100 text-green-700 border-0">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            已掌握
                          </Badge>
                        )}
                      </div>

                      {revealedMeaning ? (
                        <div className="mt-1 space-y-0.5">
                          {word.entries && word.entries.length > 1 ? (
                            word.entries.map((entry, i) => (
                              <div key={`${i}-${entry.partOfSpeech}-${entry.meaning}`} className="flex items-center gap-2">
                                {entry.partOfSpeech && (
                                  <Badge variant="secondary" className="text-xs">
                                    {entry.partOfSpeech}
                                  </Badge>
                                )}
                                <span className="text-gray-700">{entry.meaning}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex items-center gap-2">
                              {word.partOfSpeech && (
                                <Badge variant="secondary" className="text-xs">
                                  {word.partOfSpeech}
                                </Badge>
                              )}
                              <span className="text-gray-700">
                                {word.meaning}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">
                          点击朗读后显示中文释义
                        </p>
                      )}
                    </div>

                    {/* 播放图标 + 报错按钮 */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={`w-9 h-9 rounded-full flex items-center justify-center ${playingWordId === word.id
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-gray-400 hover:text-gray-600'
                          }`}
                        disabled={reportedWordIds.has(word.id) || reportingWordId === word.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleReportError(word);
                        }}
                        title={reportedWordIds.has(word.id) ? '已报错' : '报错'}
                      >
                        {reportingWordId === word.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Flag className={`w-4 h-4 ${reportedWordIds.has(word.id) ? 'text-red-600' : ''}`} />
                        )}
                      </Button>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${playingWordId === word.id
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-400'
                        }`}>
                        <Volume2 className={`w-5 h-5 ${playingWordId === word.id ? 'animate-pulse' : ''}`} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {words.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">该课程暂无单词</p>
          </div>
        )}
      </main>

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={onGoBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go back
          </Button>
          <Button
            className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700"
            onClick={handleOpenSettings}
            disabled={words.length === 0}
          >
            <Play className="w-4 h-4 mr-2" />
            Start
          </Button>
        </div>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center">
              <DialogTitle className="flex items-center gap-2 w-[180px] text-left">
                <Settings2 className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">{t.title}</span>
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs font-semibold text-gray-500 hover:text-gray-900 border-gray-200"
                onClick={() => setDialogLang(dialogLang === 'en' ? 'zh' : 'en')}
              >
                {dialogLang === 'en' ? '中' : 'EN'}
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{t.range}</label>
              <Select value={practiceRange} onValueChange={setPracticeRange}>
                <SelectTrigger>
                  <SelectValue placeholder={t.range} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.rangeAll}</SelectItem>
                  <SelectItem value="20">{t.range20}</SelectItem>
                  <SelectItem value="40">{t.range40}</SelectItem>
                  <SelectItem value="60">{t.range60}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{t.startPos}</label>
              <Select value={startMode} onValueChange={setStartMode}>
                <SelectTrigger>
                  <SelectValue placeholder={t.startPos} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpracticed">{t.posUnpracticed}</SelectItem>
                  <SelectItem value="beginning">{t.posBeginning}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{t.speed}</label>
              <Select value={practiceSpeed} onValueChange={setPracticeSpeed}>
                <SelectTrigger>
                  <SelectValue placeholder={t.speed} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1.0">{t.speedNormal}</SelectItem>
                  <SelectItem value="1.3">{t.speedFast}</SelectItem>
                  <SelectItem value="0.7">{t.speedSlow}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{t.wrongDelay}</label>
              <Select value={wrongDelay} onValueChange={setWrongDelay}>
                <SelectTrigger>
                  <SelectValue placeholder={t.wrongDelay} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="500">{t.wrongDelayShort}</SelectItem>
                  <SelectItem value="1500">{t.wrongDelayNormal}</SelectItem>
                  <SelectItem value="3000">{t.wrongDelayLong}</SelectItem>
                  <SelectItem value="0">{t.wrongDelayManual}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleConfirmStart} className="bg-blue-600 hover:bg-blue-700">
              {t.start}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
