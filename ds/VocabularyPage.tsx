import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Volume2,
  Play,
  BookOpen,
  CheckCircle2,
  Clock,
  Brain,
  TrendingUp,
  AlertCircle,
  RotateCcw,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  LineChart,
  Search,
  X,
  Eye,
  EyeOff,
  Flag,
  Filter,
  Undo2,
  Loader2,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import { playWordAudio, type SpeechEngineMode } from '@/utils/audioPlayer';
import { dataService } from '@/services/dataService';
import { SentenceTab } from '@/pages/SentenceTab';
import { EBINGHAUS_STAGES, getStageColor, type VocabularyItem, type Word, type WordMemoryProgress } from '@/types';

interface VocabularyPageProps {
  onGoBack: () => void;
  onStartReview: (batches: Word[][]) => void;
  onOpenSentenceBook?: () => void;
}

// 按记忆曲线(艾宾浩斯阶段)分批复习的上限，防止单一阶段单词过多导致整批过大
const REVIEW_BATCH_UPPER_LIMIT = 80;

// 返回逾期时长的易读文本，如 "2 天 3 小时"、"45 分钟"
function formatOverdueDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes <= 0) return '刚刚';
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${mins} 分`;
  return `${minutes} 分钟`;
}

// 返回"本应复习的准确时间"（含时分）
function formatReviewAtLabel(date: Date): string {
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const pad = (n: number) => String(n).padStart(2, '0');
  const monthDay = `${date.getMonth() + 1}月${date.getDate()}日`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return sameYear ? `${monthDay} ${time}` : `${date.getFullYear()}年${monthDay} ${time}`;
}

type MemoryPoint = {
  stage: number;
  time: number;
  label: string;
  eventLabel: string;
  mastered: boolean;
  result: string | null;
};

const mergeMemoryPoints = (points: MemoryPoint[]): MemoryPoint[] => {
  if (points.length <= 1) return points;
  const merged: MemoryPoint[] = [];
  points.forEach((point) => {
    const last = merged[merged.length - 1];
    if (
      last
      && Math.abs(last.time - point.time) <= 1000
      && last.stage === point.stage
    ) {
      const nextLabel = [last.eventLabel, point.eventLabel].filter(Boolean).join(' / ');
      last.eventLabel = nextLabel;
      last.mastered = last.mastered || point.mastered;
      last.result = point.result || last.result;
      return;
    }
    merged.push({ ...point });
  });
  return merged;
};

const formatShortTime = (value: Date) => `${value.getMonth() + 1}/${value.getDate()} ${value.getHours()}:${String(value.getMinutes()).padStart(2, '0')}`;

const normalizeStageIndex = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return 0;
  return Math.max(0, Math.min(parsed, EBINGHAUS_STAGES.length - 1));
};

const toDisplayStage = (stageIndex: number): number => normalizeStageIndex(stageIndex) + 1;

const eventTypeLabelMap: Record<string, string> = {
  review: '复习',
  wrong: '答错',
  seen: '学习',
  mastered: '掌握',
  reset: '重置',
};

const stageBriefByIndex: string[] = [
  '即刻强化，抓住遗忘曲线最陡处',
  '同场巩固，避免即时遗忘',
  '睡眠巩固，最关键的记忆转化节点',
  '短期验证，巩固初步印象',
  '一周检验，测试短期记忆',
  '两周巩固，强化记忆提取',
  '一个月回顾，进入长期记忆',
  '两个月深度巩固，接近牢固掌握',
  '三个月终极检验，达成永久记忆',
];

const TOTAL_STAGE_HINT_VISIBLE_STORAGE_KEY = 'vocabulary_stage_hint_visible_v1';

const normalizeVocabularySearchText = (value: string) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const buildVocabularySearchText = (item: VocabularyItem) => {
  const entryText = (item.word.entries || [])
    .flatMap((entry) => [entry.partOfSpeech, entry.meaning])
    .filter(Boolean)
    .join(' ');
  return normalizeVocabularySearchText([
    item.word.word,
    item.word.phonetic,
    item.word.partOfSpeech,
    item.word.meaning,
    entryText,
  ].filter(Boolean).join(' '));
};

const getVocabularyMatchRank = (item: VocabularyItem, query: string): number => {
  const normalizedQuery = normalizeVocabularySearchText(query);
  if (!normalizedQuery) return 0;

  const wordText = normalizeVocabularySearchText(item.word.word);
  const phoneticText = normalizeVocabularySearchText(item.word.phonetic || '');
  const meaningText = normalizeVocabularySearchText(
    [
      item.word.meaning,
      ...(item.word.entries || []).flatMap((entry) => [entry.meaning, entry.partOfSpeech]),
    ].filter(Boolean).join(' '),
  );
  const fullText = buildVocabularySearchText(item);

  if (wordText === normalizedQuery) return 0;
  if (wordText.startsWith(normalizedQuery)) return 1;
  if (wordText.includes(normalizedQuery)) return 2;
  if (phoneticText.includes(normalizedQuery)) return 3;
  if (meaningText.includes(normalizedQuery)) return 4;
  if (fullText.includes(normalizedQuery)) return 5;
  return Number.POSITIVE_INFINITY;
};

const vocabularyStatusMeta: Record<VocabularyItem['status'], { label: string; className: string }> = {
  review: {
    label: '待复习',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
  learning: {
    label: '学习中',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  mastered: {
    label: '已掌握',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
};

const buildMemoryPoints = (
  progress: WordMemoryProgress | null,
  fallbackItem: VocabularyItem | null,
): MemoryPoint[] => {
  if (!progress) return [];

  const pointsFromEvents = (progress.events || [])
    .map((event) => {
      const rawTime = new Date(event.createdAt || '').getTime();
      if (!Number.isFinite(rawTime)) return null;
      const stage = normalizeStageIndex(event.toStage ?? event.fromStage ?? progress.stage);
      return {
        stage,
        time: rawTime,
        label: formatShortTime(new Date(rawTime)),
        eventLabel: eventTypeLabelMap[event.eventType] || event.eventType || '记录',
        mastered:
          String(event.eventType || '').toLowerCase() === 'mastered'
          || String(event.result || '').toLowerCase() === 'mastered'
          || String(event.result || '').toLowerCase() === 'manual',
        result: event.result || null,
      };
    })
    .filter((item): item is MemoryPoint => !!item)
    .sort((a, b) => a.time - b.time);

  if (pointsFromEvents.length > 0) {
    return mergeMemoryPoints(pointsFromEvents);
  }

  const fallback: MemoryPoint[] = [];
  const createdAt = new Date(progress.createdAt || fallbackItem?.createdAt || '').getTime();
  if (Number.isFinite(createdAt)) {
    fallback.push({
      stage: 0,
      time: createdAt,
      label: formatShortTime(new Date(createdAt)),
      eventLabel: '加入',
      mastered: false,
      result: null,
    });
  }

  const lastReviewedAt = new Date(progress.lastReviewedAt || fallbackItem?.lastReviewedAt || '').getTime();
  if (Number.isFinite(lastReviewedAt)) {
    fallback.push({
      stage: normalizeStageIndex(progress.stage),
      time: lastReviewedAt,
      label: formatShortTime(new Date(lastReviewedAt)),
      eventLabel: '最近复习',
      mastered: false,
      result: null,
    });
  }

  const masteredAt = new Date(progress.masteredAt || fallbackItem?.masteredAt || '').getTime();
  if (Number.isFinite(masteredAt)) {
    const masteredStage = normalizeStageIndex(progress.masteredStage ?? fallbackItem?.masteredStage ?? progress.stage);
    fallback.push({
      stage: masteredStage,
      time: masteredAt,
      label: formatShortTime(new Date(masteredAt)),
      eventLabel: '已掌握',
      mastered: true,
      result: null,
    });
  }

  if (fallback.length === 0) {
    const now = Date.now();
    fallback.push({
      stage: normalizeStageIndex(progress.stage),
      time: now,
      label: formatShortTime(new Date(now)),
      eventLabel: '当前',
      mastered: progress.status === 'mastered',
      result: null,
    });
  }

  fallback.sort((a, b) => a.time - b.time);
  return mergeMemoryPoints(fallback);
};

const buildChartPath = (points: Array<{ x: number; y: number }>): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
};

export function VocabularyPage({ onGoBack, onStartReview, onOpenSentenceBook }: VocabularyPageProps) {
  const { vocabularyItems, reviewItems, vocabStats, refreshVocabulary } = useApp();

  // 待复习列表的逾期统计：已逾期数量 + 最长逾期时长，用于顶部总览提醒
  const overdueInfo = useMemo(() => {
    const now = Date.now();
    let overdueCount = 0;
    let maxOverdue = 0;
    for (const item of reviewItems) {
      const at = item.nextReviewAt ? new Date(item.nextReviewAt).getTime() : 0;
      if (at && at <= now) {
        overdueCount += 1;
        const diff = now - at;
        if (diff > maxOverdue) maxOverdue = diff;
      }
    }
    return { overdueCount, maxOverdue, total: reviewItems.length };
  }, [reviewItems]);
  const [activeTab, setActiveTab] = useState('review');
  const [sentenceDue, setSentenceDue] = useState<number>(0);
  const [bookView, setBookView] = useState<'words' | 'sentences'>('words');
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);
  const [revealedMeaningMap, setRevealedMeaningMap] = useState<Record<string, boolean>>({});
  const [showExtendedLists, setShowExtendedLists] = useState(false);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState('');
  const [memoryProgress, setMemoryProgress] = useState<WordMemoryProgress | null>(null);
  const [memoryFallbackItem, setMemoryFallbackItem] = useState<VocabularyItem | null>(null);
  const [showTotalStageHint, setShowTotalStageHint] = useState(() => {
    try {
      return localStorage.getItem(TOTAL_STAGE_HINT_VISIBLE_STORAGE_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const [totalSearchQuery, setTotalSearchQuery] = useState('');
  const [resettingWordId, setResettingWordId] = useState<string | null>(null);
  // 报错相关：已报错的单词 ID 集合 + 正在提交中的 ID
  const [reportedWordIds, setReportedWordIds] = useState<Set<string>>(new Set());
  const [reportingWordId, setReportingWordId] = useState<string | null>(null);
  // 已掌握列表筛选：搜索关键词 + 课本/Unit 过滤 + 放回生字本中
  const [masteredSearchQuery, setMasteredSearchQuery] = useState('');
  const [masteredTextbookFilter, setMasteredTextbookFilter] = useState('all');
  const [masteredLessonFilter, setMasteredLessonFilter] = useState('all');
  const [puttingBackWordId, setPuttingBackWordId] = useState<string | null>(null);

  // 一键报错：上报单词原始拼写/释义有误，无需弹窗
  const handleReportError = async (item: VocabularyItem) => {
    if (reportingWordId) return;
    if (reportedWordIds.has(item.word.id)) return;
    setReportingWordId(item.word.id);
    try {
      await dataService.reportWordError(String(item.word.id), {
        userInput: '',
        expectedAnswer: item.word.word,
        reason: '',
        isCorrect: false,
      });
      setReportedWordIds((prev) => new Set(prev).add(item.word.id));
      toast.success('已提交报错，管理员会尽快处理', { style: { marginTop: '70px' }, duration: 2000 });
    } catch (e: any) {
      toast.error(e?.message || '提交报错失败');
    } finally {
      setReportingWordId(null);
    }
  };

  const refreshPrimaryTabs = (tabValue: string) => {
    if (tabValue === 'review' || tabValue === 'all') {
      void refreshVocabulary();
    }
  };

  // 进入页面时刷新数据
  useEffect(() => {
    dataService.getDueSentences(100).then((list) => setSentenceDue(list.length)).catch(() => undefined);
  }, []);

  useEffect(() => {
    void refreshVocabulary();
  }, [refreshVocabulary]);

  useEffect(() => {
    setRevealedMeaningMap({});
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(
        TOTAL_STAGE_HINT_VISIBLE_STORAGE_KEY,
        showTotalStageHint ? '1' : '0',
      );
    } catch {
      // ignore storage write failures
    }
  }, [showTotalStageHint]);

  useEffect(() => {
    if (showExtendedLists) return;
    if (activeTab === 'mastered' || activeTab === 'total') {
      setActiveTab('review');
    }
  }, [activeTab, showExtendedLists]);

  const learningItems = useMemo(
    () => vocabularyItems.filter((item) => item.status !== 'mastered'),
    [vocabularyItems],
  );
  // 已掌握列表：按加入（标记掌握）的时间从最近到最远排序
  const masteredItems = useMemo(
    () => vocabularyItems.filter((item) => item.status === 'mastered').sort((a, b) => {
      const aTime = new Date(a.masteredAt || a.createdAt || '').getTime();
      const bTime = new Date(b.masteredAt || b.createdAt || '').getTime();
      if (Number.isFinite(aTime) && Number.isFinite(bTime) && bTime !== aTime) {
        return bTime - aTime;
      }
      return Number(b.wordId) - Number(a.wordId);
    }),
    [vocabularyItems],
  );
  // 已掌握列表：可选课本/Unit 过滤选项，以及搜索过滤结果
  const masteredTextbookOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    masteredItems.forEach((item) => {
      const id = item.textbookId || 'unknown';
      const name = item.textbookName || item.word.lessonId || '未命名';
      if (!map.has(id)) map.set(id, { id, name });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [masteredItems]);

  const masteredLessonsForFilter = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    masteredItems.forEach((item) => {
      if (masteredTextbookFilter !== 'all' && item.textbookId !== masteredTextbookFilter) return;
      const id = item.lessonId || 'unknown';
      const name = item.lessonName || item.word.lessonId || '未命名';
      if (!map.has(id)) map.set(id, { id, name });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [masteredItems, masteredTextbookFilter]);

  const normalizedMasteredSearchQuery = useMemo(
    () => normalizeVocabularySearchText(masteredSearchQuery),
    [masteredSearchQuery],
  );
  const masteredFilteredItems = useMemo(() => {
    let list = masteredItems;
    if (masteredTextbookFilter !== 'all') {
      list = list.filter((item) => item.textbookId === masteredTextbookFilter);
    }
    if (masteredLessonFilter !== 'all') {
      list = list.filter((item) => item.lessonId === masteredLessonFilter);
    }
    if (normalizedMasteredSearchQuery) {
      const query = normalizedMasteredSearchQuery;
      list = list
        .map((item, index) => ({ item, index, rank: getVocabularyMatchRank(item, query) }))
        .filter((entry) => Number.isFinite(entry.rank))
        .sort((a, b) => {
          if (a.rank !== b.rank) return a.rank - b.rank;
          return a.index - b.index;
        })
        .map((entry) => entry.item);
    }
    return list;
  }, [masteredItems, masteredTextbookFilter, masteredLessonFilter, normalizedMasteredSearchQuery]);
  const totalItems = useMemo(
    () => [...vocabularyItems].sort((a, b) => {
      const aTime = new Date(a.lastReviewedAt || a.createdAt || '').getTime();
      const bTime = new Date(b.lastReviewedAt || b.createdAt || '').getTime();
      if (Number.isFinite(aTime) && Number.isFinite(bTime) && bTime !== aTime) {
        return bTime - aTime;
      }
      return Number(a.wordId) - Number(b.wordId);
    }),
    [vocabularyItems],
  );
  const normalizedTotalSearchQuery = useMemo(
    () => normalizeVocabularySearchText(totalSearchQuery),
    [totalSearchQuery],
  );
  const totalFilteredItems = useMemo(() => {
    if (!normalizedTotalSearchQuery) {
      return totalItems;
    }

    return totalItems
      .map((item, index) => ({
        item,
        index,
        rank: getVocabularyMatchRank(item, normalizedTotalSearchQuery),
      }))
      .filter((entry) => Number.isFinite(entry.rank))
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.index - b.index;
      })
      .map((entry) => entry.item);
  }, [normalizedTotalSearchQuery, totalItems]);
  const totalQueryFocusItem = useMemo(
    () => (normalizedTotalSearchQuery ? totalFilteredItems[0] || null : null),
    [normalizedTotalSearchQuery, totalFilteredItems],
  );

  const wordsByStage = useMemo(() => {
    return learningItems.reduce((acc, item) => {
      const stage = toDisplayStage(item.stage);
      if (!acc[stage]) acc[stage] = [];
      acc[stage].push(item);
      return acc;
    }, {} as Record<number, VocabularyItem[]>);
  }, [learningItems]);

  const memoryPoints = useMemo(
    () => buildMemoryPoints(memoryProgress, memoryFallbackItem),
    [memoryProgress, memoryFallbackItem],
  );

  const openMemoryDialog = async (item: VocabularyItem) => {
    setMemoryDialogOpen(true);
    setMemoryLoading(true);
    setMemoryError('');
    setMemoryFallbackItem(item);
    try {
      const progress = await dataService.getWordMemoryProgress(item.wordId);
      setMemoryProgress(progress);
    } catch (error) {
      setMemoryProgress(null);
      setMemoryError(error instanceof Error ? error.message : '加载记忆轨迹失败');
    } finally {
      setMemoryLoading(false);
    }
  };

  // 播放单词发音
  const playAudio = async (word: VocabularyItem['word']) => {
    if (playingWordId) return;

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

  const handleWordCardClick = (word: VocabularyItem['word']) => {
    const isRevealed = !!revealedMeaningMap[word.id];
    if (isRevealed) {
      setRevealedMeaningMap((prev) => ({ ...prev, [word.id]: false }));
      return;
    }
    setRevealedMeaningMap((prev) => ({ ...prev, [word.id]: true }));
    void playAudio(word);
  };

  // 统计信息 — 使用后端接口的准确数据
  const { total: totalCount, mastered: masteredCount, learning: learningCount, review: reviewCount } = vocabStats;

  // 按记忆曲线(艾宾浩斯阶段)分批：同一阶段的单词归为一批，同阶段内按下次复习时间排序
  const buildReviewBatches = (items: VocabularyItem[]): Word[][] => {
    if (items.length <= REVIEW_BATCH_UPPER_LIMIT) {
      return [items.map((item) => item.word)];
    }
    // 按艾宾浩斯阶段分组，记忆曲线相同阶段一起复习
    const byStage = new Map<number, VocabularyItem[]>();
    for (const item of items) {
      const key = item.stage ?? 0;
      if (!byStage.has(key)) byStage.set(key, []);
      byStage.get(key)!.push(item);
    }
    // 每阶段内按下次复习时间升序（最急的在前），阶段内过多的再按上限切分
    const batches: VocabularyItem[][] = [];
    const stageKeys = Array.from(byStage.keys()).sort((a, b) => a - b);
    for (const key of stageKeys) {
      const list = byStage.get(key)!;
      list.sort(
        (a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime(),
      );
      for (let i = 0; i < list.length; i += REVIEW_BATCH_UPPER_LIMIT) {
        batches.push(list.slice(i, i + REVIEW_BATCH_UPPER_LIMIT));
      }
    }
    return batches.map((batch) => batch.map((item) => item.word));
  };

  // 开始复习
  const handleStartReview = () => {
    if (reviewItems.length === 0) {
      toast.info('暂无可复习的单词');
      return;
    }
    onStartReview(buildReviewBatches(reviewItems));
  };

  // 复习全部学习中单词
  const handleReviewAll = () => {
    if (learningItems.length === 0) {
      toast.info('没有需要复习的单词');
      return;
    }
    onStartReview(buildReviewBatches(learningItems));
  };

  const handleResetWordToNew = async (item: VocabularyItem) => {
    if (resettingWordId) return;
    const confirmed = window.confirm(`确认把 "${item.word.word}" 重新标记为新单词吗？该词会回到 5 分钟即刻强化阶段，并立即进入待复习。`);
    if (!confirmed) return;

    setResettingWordId(item.wordId);
    try {
      await dataService.resetWordToNew(item.wordId);
      setRevealedMeaningMap((prev) => {
        if (!prev[item.word.id]) return prev;
        const next = { ...prev };
        delete next[item.word.id];
        return next;
      });
      if ((memoryProgress?.wordId || memoryFallbackItem?.word.id) === item.wordId) {
        setMemoryDialogOpen(false);
      }
      await refreshVocabulary();
      toast.success(`已将 ${item.word.word} 调整到 5 分钟即刻强化阶段`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '重置失败');
    } finally {
      setResettingWordId(null);
    }
  };

  // 放回生字本：已掌握但发现遗忘的单词重新进入学习（保留记忆轨迹）
  const handlePutBack = async (item: VocabularyItem) => {
    if (puttingBackWordId) return;
    const confirmed = window.confirm(`确认把 "${item.word.word}" 放回生字本吗？该词将回到学习中，需重新完成阶段复习。`);
    if (!confirmed) return;

    setPuttingBackWordId(item.wordId);
    try {
      await dataService.putWordBack(item.wordId);
      setRevealedMeaningMap((prev) => {
        if (!prev[item.word.id]) return prev;
        const next = { ...prev };
        delete next[item.word.id];
        return next;
      });
      if ((memoryProgress?.wordId || memoryFallbackItem?.word.id) === item.wordId) {
        setMemoryDialogOpen(false);
      }
      await refreshVocabulary();
      toast.success(`已将 ${item.word.word} 放回生字本`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '放回失败');
    } finally {
      setPuttingBackWordId(null);
    }
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
            <h1 className="text-lg font-bold text-gray-900">我的生字本</h1>
            <p className="text-xs text-gray-500">科学间隔复习 · 9阶段记忆巩固系统</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setBookView('words')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              bookView === 'words' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            单词 <span className="text-xs font-normal text-gray-400">{totalCount}</span>
          </button>
          <button
            onClick={() => setBookView('sentences')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              bookView === 'sentences' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            句子 <span className="text-xs font-normal text-gray-400">{sentenceDue}</span>
          </button>
        </div>
      </div>

      {bookView === 'sentences' ? (
        <SentenceTab onOpenSentences={onOpenSentenceBook ?? onGoBack} />
      ) : (
      <main className="max-w-5xl mx-auto px-4 py-6 pb-32">
        {totalCount === 0 && (
          <Card className="mb-4">
            <CardContent className="p-8 text-center space-y-2">
              <BookOpen className="w-9 h-9 mx-auto text-gray-300" />
              <p className="text-gray-700 font-medium">生字本还是空的</p>
              <p className="text-sm text-gray-500">去单元里练几个单词，答错的会自动收进来</p>
            </CardContent>
          </Card>
        )}

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card
            className="bg-blue-50 border-blue-200 cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => {
              setShowExtendedLists(true);
              setActiveTab('total');
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-700">总单词</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">{totalCount}</div>
              <p className="mt-1 text-[11px] text-blue-600">点击查看列表</p>
            </CardContent>
          </Card>

          <Card
            className="bg-green-50 border-green-200 cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => {
              setShowExtendedLists(true);
              setActiveTab('mastered');
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700">已掌握</span>
              </div>
              <div className="text-2xl font-bold text-green-900">{masteredCount}</div>
              <p className="mt-1 text-[11px] text-green-600">点击查看列表</p>
            </CardContent>
          </Card>

          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-700">学习中</span>
              </div>
              <div className="text-2xl font-bold text-yellow-900">{learningCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-700">待复习</span>
              </div>
              <div className="text-2xl font-bold text-red-900">{reviewCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* 待复习提醒 */}
        {reviewCount > 0 && (
          <Card className="mb-6 border-red-300 bg-red-50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-900">
                      有 {reviewCount} 个单词需要复习
                    </h3>
                    <p className="text-sm text-red-700 mt-0.5">
                      基于 艾宾浩斯遗忘曲线 和 SM-2 记忆算法，当前处于最佳复习窗口
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleStartReview}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  开始复习
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 标签页 */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            refreshPrimaryTabs(value);
          }}
          className="w-full"
        >
          <TabsList className={`grid w-full ${showExtendedLists ? 'grid-cols-4' : 'grid-cols-2'} mb-2`}>
            <TabsTrigger
              value="review"
              className="flex items-center gap-2"
              onClick={() => {
                if (activeTab === 'review') refreshPrimaryTabs('review');
              }}
            >
              <RotateCcw className="w-4 h-4" />
              待复习
              {reviewCount > 0 && (
                <Badge variant="destructive" className="ml-1">{reviewCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="flex items-center gap-2"
              onClick={() => {
                if (activeTab === 'all') refreshPrimaryTabs('all');
              }}
            >
              <GraduationCap className="w-4 h-4" />
              学习中
            </TabsTrigger>
            {showExtendedLists && (
              <>
                <TabsTrigger value="total" className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  总单词
                </TabsTrigger>
                <TabsTrigger value="mastered" className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  已掌握
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <div className="mb-6 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600"
              onClick={() => setShowExtendedLists((prev) => !prev)}
            >
              {showExtendedLists ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" /> 收起扩展列表
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" /> 展开总单词/已掌握
                </>
              )}
            </Button>
          </div>

          <TabsContent value="review">
            {reviewItems.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-green-300 mx-auto mb-3" />
                <p className="text-gray-500">太棒了！暂时没有需要复习的单词</p>
                {learningCount > 0 && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={handleReviewAll}
                  >
                    复习所有学习中单词
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {overdueInfo.overdueCount > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="w-4 h-4" />
                      有 {overdueInfo.overdueCount} 个单词已错过复习时间
                    </div>
                    <p className="mt-1 text-xs text-amber-700">
                      最久已逾期 {formatOverdueDuration(overdueInfo.maxOverdue)}。建议尽快开始复习，避免遗忘曲线被拉长。
                    </p>
                    <Button
                      variant="default"
                      size="sm"
                      className="mt-2 h-7 bg-amber-600 hover:bg-amber-700 text-xs"
                      onClick={handleStartReview}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      立即开始复习
                    </Button>
                  </div>
                )}
                {reviewItems.map((item) => (
                  <VocabularyWordCard
                    key={item.id}
                    item={item}
                    playingWordId={playingWordId}
                    onWordClick={handleWordCardClick}
                    onOpenMemory={openMemoryDialog}
                    revealedMeaning={!!revealedMeaningMap[item.word.id]}
                    reportedWordIds={reportedWordIds}
                    reportingWordId={reportingWordId}
                    onReportError={handleReportError}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all">
            {learningItems.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">生字本还是空的</p>
                <p className="text-sm text-gray-400 mt-1">
                  在学习过程中，不会的单词会自动加入这里
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 按阶段显示 */}
                {EBINGHAUS_STAGES.map((stage) => {
                  const stageWords = wordsByStage[stage.stage] || [];
                  if (stageWords.length === 0) return null;

                  return (
                    <div key={stage.stage}>
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <h3 className="font-medium text-gray-900">
                          阶段 {stage.stage} - {stage.label}
                        </h3>
                        <Badge variant="secondary">{stageWords.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {stageWords.map((item) => (
                          <VocabularyWordCard
                            key={item.id}
                            item={item}
                            playingWordId={playingWordId}
                            onWordClick={handleWordCardClick}
                            onOpenMemory={openMemoryDialog}
                            revealedMeaning={!!revealedMeaningMap[item.word.id]}
                            compact
                            reportedWordIds={reportedWordIds}
                            reportingWordId={reportingWordId}
                            onReportError={handleReportError}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="total">
            {totalItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">暂无总单词数据</div>
            ) : (
              <div className="space-y-3">
                <Card className="mx-auto w-full max-w-4xl border-blue-200 bg-blue-50/70">
                  <CardContent className="p-2.5">
                    <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <div className="shrink-0 text-sm font-semibold text-blue-900">查询单词</div>
                        <div className="relative w-full sm:w-56">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
                          <Input
                            value={totalSearchQuery}
                            onChange={(event) => setTotalSearchQuery(event.target.value)}
                            placeholder="英文 / 音标 / 中文"
                            className="h-8 bg-white pl-9 pr-10 text-sm"
                          />
                          {totalSearchQuery.trim() && (
                            <button
                              type="button"
                              aria-label="清空查询"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                              onClick={() => setTotalSearchQuery('')}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="min-h-8 flex-1 xl:max-w-[31rem]">
                        {!normalizedTotalSearchQuery ? (
                          <div className="flex h-full items-center justify-end text-[11px] text-blue-700">
                            输入后在这里直接显示查询单词详情
                          </div>
                        ) : totalQueryFocusItem ? (
                          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-[11px] text-blue-900 shadow-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-blue-950">{totalQueryFocusItem.word.word}</span>
                              {totalQueryFocusItem.word.phonetic && (
                                <span className="text-blue-600">{totalQueryFocusItem.word.phonetic}</span>
                              )}
                              <Badge className={vocabularyStatusMeta[totalQueryFocusItem.status].className}>
                                {vocabularyStatusMeta[totalQueryFocusItem.status].label}
                              </Badge>
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] text-blue-700">
                                当前阶段 S{toDisplayStage(totalQueryFocusItem.stage)} · {EBINGHAUS_STAGES[normalizeStageIndex(totalQueryFocusItem.stage)]?.label || '--'}
                              </span>
                              {totalFilteredItems.length > 1 && (
                                <span className="text-blue-500">共 {totalFilteredItems.length} 个匹配，当前显示最佳匹配</span>
                              )}
                            </div>

                            <div className="mt-2 space-y-1.5">
                              {totalQueryFocusItem.word.entries && totalQueryFocusItem.word.entries.length > 1 ? (
                                totalQueryFocusItem.word.entries.map((entry, index) => (
                                  <div key={`query-focus-entry-${index}-${entry.partOfSpeech}-${entry.meaning}`} className="flex items-start gap-2">
                                    {entry.partOfSpeech && (
                                      <Badge variant="secondary" className="mt-0.5 text-[10px]">
                                        {entry.partOfSpeech}
                                      </Badge>
                                    )}
                                    <span className="text-gray-700">{entry.meaning}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="flex items-start gap-2">
                                  {totalQueryFocusItem.word.partOfSpeech && (
                                    <Badge variant="secondary" className="mt-0.5 text-[10px]">
                                      {totalQueryFocusItem.word.partOfSpeech}
                                    </Badge>
                                  )}
                                  <span className="text-gray-700">{totalQueryFocusItem.word.meaning}</span>
                                </div>
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                disabled={playingWordId === totalQueryFocusItem.word.id}
                                onClick={() => {
                                  void playAudio(totalQueryFocusItem.word);
                                }}
                              >
                                <Volume2 className="mr-1 h-3.5 w-3.5" />
                                朗读
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => {
                                  void openMemoryDialog(totalQueryFocusItem);
                                }}
                              >
                                <LineChart className="mr-1 h-3.5 w-3.5" />
                                记忆成果图
                              </Button>
                              {totalQueryFocusItem.status === 'mastered' && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 border-orange-200 px-2 text-[11px] text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                                  disabled={resettingWordId === totalQueryFocusItem.wordId}
                                  onClick={() => {
                                    void handleResetWordToNew(totalQueryFocusItem);
                                  }}
                                >
                                  {resettingWordId === totalQueryFocusItem.wordId ? '重置中...' : '重新标记为新单词'}
                                </Button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-end text-[11px] text-orange-700">
                            未找到匹配单词
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <MasteredStageHint
                  collapsible
                  collapsed={!showTotalStageHint}
                  onToggle={() => setShowTotalStageHint((prev) => !prev)}
                />

                {totalFilteredItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center text-gray-500">
                    未找到匹配的单词。可尝试输入英文、音标或中文释义关键词。
                  </div>
                ) : totalFilteredItems.map((item) => (
                  <VocabularyWordCard
                    key={`total-${item.id}`}
                    item={item}
                    playingWordId={playingWordId}
                    onWordClick={handleWordCardClick}
                    onOpenMemory={openMemoryDialog}
                    revealedMeaning={!!revealedMeaningMap[item.word.id]}
                    compact
                    showMasteredStageSup
                    showStatusBadge
                    showResetToNewAction={!!normalizedTotalSearchQuery && item.status === 'mastered'}
                    resettingWordId={resettingWordId}
                    onResetToNew={handleResetWordToNew}
                    reportedWordIds={reportedWordIds}
                    reportingWordId={reportingWordId}
                    onReportError={handleReportError}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mastered">
            {masteredItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">暂无已掌握单词</div>
            ) : (
              <div className="space-y-2">
                <Card className="w-full border border-green-200 bg-green-50/70 overflow-hidden">
                  <CardContent className="p-2.5">
                    {/* 顶部概览：筛选工具 + 图标图例 */}
                    <div className="flex flex-col gap-1.5">
                      {/* 筛选工具行 */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <div className="relative w-full sm:w-64">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
                          <Input
                            value={masteredSearchQuery}
                            onChange={(event) => setMasteredSearchQuery(event.target.value)}
                            placeholder="英文 / 音标 / 中文 搜索"
                            className="h-8 bg-white pl-9 pr-8 text-sm"
                          />
                          {masteredSearchQuery.trim() && (
                            <button
                              type="button"
                              aria-label="清空搜索"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                              onClick={() => setMasteredSearchQuery('')}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <Select
                          value={masteredTextbookFilter}
                          onValueChange={(value) => {
                            setMasteredTextbookFilter(value);
                            setMasteredLessonFilter('all');
                          }}
                        >
                          <SelectTrigger className="h-8 w-full sm:w-44 bg-white text-sm">
                            <Filter className="mr-1 h-3.5 w-3.5 text-green-500" />
                            <SelectValue placeholder="全部课本" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部课本</SelectItem>
                            {masteredTextbookOptions.map((option) => (
                              <SelectItem key={`tb-${option.id}`} value={option.id}>
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={masteredLessonFilter}
                          onValueChange={setMasteredLessonFilter}
                        >
                          <SelectTrigger className="h-8 w-full sm:w-44 bg-white text-sm">
                            <BookOpen className="mr-1 h-3.5 w-3.5 text-green-500" />
                            <SelectValue placeholder="全部 Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">全部 Unit</SelectItem>
                            {masteredLessonsForFilter.map((option) => (
                              <SelectItem key={`ls-${option.id}`} value={option.id}>
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="text-[11px] text-green-700 whitespace-nowrap">
                          共 <span className="font-semibold">{masteredItems.length}</span> 个已掌握
                          {masteredFilteredItems.length !== masteredItems.length && (
                            <> · 筛选后 <span className="font-semibold">{masteredFilteredItems.length}</span> 个</>
                          )}
                        </div>
                      </div>

                      {/* 图标图例：并排一行，解释放回生字本与标记错误 */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-green-200/70 pt-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                          <span className="inline-flex w-5 h-5 rounded-full bg-blue-50 items-center justify-center">
                            <Undo2 className="w-3 h-3 text-blue-600" />
                          </span>
                          <span>放回生字本：已掌握但又有遗忘，可放回重新学习</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                          <span className="inline-flex w-5 h-5 rounded-full bg-red-50 items-center justify-center">
                            <Flag className="w-3 h-3 text-red-500" />
                          </span>
                          <span>标记错误：单词转录/释义有误，点击反馈修正</span>
                        </div>
                      </div>
                    </div>

                    {/* 阶段说明（可折叠） */}
                    <div className="mt-1.5 border-t border-green-200/70 pt-1.5">
                      <MasteredStageHint
                        embedded
                        collapsible
                        collapsed={!showTotalStageHint}
                        onToggle={() => setShowTotalStageHint((prev) => !prev)}
                      />
                    </div>
                  </CardContent>
                </Card>
                {masteredFilteredItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center text-gray-500">
                    未找到匹配的已掌握单词，可尝试清除筛选条件。
                  </div>
                ) : masteredFilteredItems.map((item) => (
                  <VocabularyWordCard
                    key={`mastered-${item.id}`}
                    item={item}
                    playingWordId={playingWordId}
                    onWordClick={handleWordCardClick}
                    onOpenMemory={openMemoryDialog}
                    revealedMeaning={!!revealedMeaningMap[item.word.id]}
                    compact
                    showMasteredStageSup
                    showPutBackAction
                    puttingBackWordId={puttingBackWordId}
                    onPutBack={handlePutBack}
                    reportedWordIds={reportedWordIds}
                    reportingWordId={reportingWordId}
                    onReportError={handleReportError}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      )}

      {/* 底部操作栏 */}
      {(reviewItems.length > 0 || learningCount > 0) && (
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
              onClick={reviewItems.length > 0 ? handleStartReview : handleReviewAll}
            >
              <Play className="w-4 h-4 mr-2" />
              Start
            </Button>
          </div>
        </div>
      )}

      <Dialog open={memoryDialogOpen} onOpenChange={setMemoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LineChart className="w-5 h-5" />
              记忆成果图 {memoryProgress?.word.word || memoryFallbackItem?.word.word || ''}
            </DialogTitle>
          </DialogHeader>

          {memoryLoading ? (
            <div className="py-8 text-center text-gray-500">正在加载记忆轨迹...</div>
          ) : memoryError ? (
            <div className="py-8 text-center text-red-600">{memoryError}</div>
          ) : memoryProgress ? (
            <MemoryProgressChart points={memoryPoints} progress={memoryProgress} />
          ) : (
            <div className="py-8 text-center text-gray-500">暂无记忆轨迹</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MasteredStageHintProps {
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  // 嵌入式：不渲染自带的外边框/背景（用于整合进统一头部卡片）
  embedded?: boolean;
}

function MasteredStageHint({
  collapsible = false,
  collapsed = false,
  onToggle,
  embedded = false,
}: MasteredStageHintProps) {
  const phases = [
    { title: '\u{1F9E0} \u827E\u5BBE\u6D69\u65AF\u5373\u65F6\u5F3A\u5316', subtitle: 'S1-S2 \u00B7 \u5B66\u4E60\u5F53\u5929', stages: EBINGHAUS_STAGES.slice(0, 2), offset: 0 },
    { title: '\u{1F4D6} \u77ED\u671F\u5DE9\u56FA\u9A8C\u8BC1', subtitle: 'S3-S5 \u00B7 1\u5929\u81F31\u5468', stages: EBINGHAUS_STAGES.slice(2, 5), offset: 2 },
    { title: '\u{1F3C6} SM-2 \u957F\u671F\u8BB0\u5FC6', subtitle: 'S6-S9 \u00B7 2\u5468\u81F33\u4E2A\u6708', stages: EBINGHAUS_STAGES.slice(5, 9), offset: 5 },
  ];

  return (
    <div className={embedded ? '' : 'rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 px-4 py-3 shadow-sm'}>
      <div className={`${embedded ? '' : 'mb-3 '}flex items-start justify-between gap-3`}>
        <p className="text-xs text-emerald-800">
          {"上标 "}<span className="font-semibold">Sx</span>{" 表示该词被标记为\u201C已掌握\u201D时所处阶段。当前共 "}
          <span className="font-semibold">{EBINGHAUS_STAGES.length}</span>
          {" 个阶段，答对推进、答错重置，通过全部阶段即为永久掌握。"}
        </p>
        {collapsible && onToggle && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
            onClick={onToggle}
          >
            {collapsed ? (
              <>
                <Eye className="mr-1 h-3.5 w-3.5" />
                显示
              </>
            ) : (
              <>
                <EyeOff className="mr-1 h-3.5 w-3.5" />
                隐藏
              </>
            )}
          </Button>
        )}
      </div>

      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11px] text-emerald-900">
          {phases.map((phase) => (
            <div key={phase.title}>
              <p className="font-semibold text-emerald-800 mb-0.5 text-xs">{phase.title}</p>
              <p className="text-[10px] text-emerald-600 mb-1.5 border-b border-emerald-200 pb-1">{phase.subtitle}</p>
              <div className="flex flex-col gap-y-1.5">
                {phase.stages.map((stage, index) => {
                  const actualIndex = phase.offset + index;
                  return (
                    <p key={`stage-hint-${stage.stage}`} className="flex items-start gap-1.5">
                      <span
                        className="inline-flex w-5 h-5 rounded-full text-white text-[10px] font-bold flex-shrink-0 items-center justify-center"
                        style={{ backgroundColor: stage.color }}
                      >
                        {actualIndex + 1}
                      </span>
                      <span>
                        <span className="font-medium">{stage.label}</span>
                        {"\u00A0"}<span className="text-emerald-600">{stageBriefByIndex[actualIndex] || ''}</span>
                      </span>
                    </p>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {collapsed && (
        <div className="text-[11px] text-emerald-700">
          已收起掌握阶段说明，需要时可展开查看 9 阶段记忆巩固规则。
        </div>
      )}
    </div>
  );
}

interface MemoryProgressChartProps {
  points: MemoryPoint[];
  progress: WordMemoryProgress;
}

function MemoryProgressChart({ points, progress }: MemoryProgressChartProps) {
  const maxStageIndex = Math.max(1, EBINGHAUS_STAGES.length - 1);
  const width = 680;
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 50, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const plotted = points.map((point, index) => {
    const x = points.length <= 1
      ? padding.left + chartWidth / 2
      : padding.left + (index / (points.length - 1)) * chartWidth;
    const y = padding.top + (1 - normalizeStageIndex(point.stage) / maxStageIndex) * chartHeight;
    return { ...point, x, y };
  });

  const pathD = buildChartPath(plotted);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-3 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[520px] h-[260px]">
          {/* Y axis */}
          {Array.from({ length: 5 }, (_, i) => {
            const ratio = i / 4;
            const y = padding.top + ratio * chartHeight;
            const stageIndex = Math.round((1 - ratio) * maxStageIndex);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-gray-500"
                  fontSize="11"
                >
                  S{toDisplayStage(stageIndex)}
                </text>
              </g>
            );
          })}

          {/* X axis */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#9ca3af"
            strokeWidth="1"
          />

          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {plotted.map((point, index) => (
            <g key={`${point.time}-${index}`}>
              <circle cx={point.x} cy={point.y} r="4.5" fill="#2563eb" />
              {point.mastered && (
                <g>
                  <rect
                    x={point.x - 14}
                    y={point.y - 30}
                    width={28}
                    height={14}
                    rx={7}
                    fill="#16a34a"
                    opacity="0.95"
                  />
                  <text
                    x={point.x}
                    y={point.y - 20}
                    textAnchor="middle"
                    className="fill-white"
                    fontSize="9"
                    fontWeight="700"
                  >
                    YES
                  </text>
                </g>
              )}
              {point.result === 'wrong' && (
                <text x={point.x + 8} y={point.y + 4} fontSize="11" fill="#ef4444">❌</text>
              )}
              {point.result === 'correct' && !point.mastered && (
                <text x={point.x + 8} y={point.y + 4} fontSize="11" fill="#22c55e">✅</text>
              )}
              <text
                x={point.x}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                className="fill-gray-500"
                fontSize="10"
              >
                {point.label}
              </text>
              {!point.mastered && (
                <text
                  x={point.x}
                  y={Math.max(padding.top + 10, point.y - 10)}
                  textAnchor="middle"
                  className="fill-gray-700"
                  fontSize="10"
                >
                  {point.eventLabel}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-gray-500">当前阶段</p>
          <p className="font-semibold text-gray-900">S{toDisplayStage(progress.stage)}</p>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-gray-500">复习次数</p>
          <p className="font-semibold text-gray-900">{progress.reviewCount}</p>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-gray-500">下次复习</p>
          <p className="font-semibold text-gray-900">
            {progress.nextReviewAt ? formatShortTime(new Date(progress.nextReviewAt)) : '--'}
          </p>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-gray-500">掌握阶段</p>
          <p className="font-semibold text-gray-900">
            {progress.masteredStage === null || progress.masteredStage === undefined
              ? '--'
              : `S${toDisplayStage(progress.masteredStage)}`}
          </p>
        </div>
      </div>
    </div>
  );
}

// 单词卡片组件
interface VocabularyWordCardProps {
  item: VocabularyItem;
  playingWordId: string | null;
  onWordClick: (word: VocabularyItem['word']) => void;
  onOpenMemory: (item: VocabularyItem) => void;
  revealedMeaning: boolean;
  compact?: boolean;
  showMasteredStageSup?: boolean;
  showStatusBadge?: boolean;
  showResetToNewAction?: boolean;
  resettingWordId?: string | null;
  onResetToNew?: (item: VocabularyItem) => void;
  // 放回生字本
  showPutBackAction?: boolean;
  puttingBackWordId?: string | null;
  onPutBack?: (item: VocabularyItem) => void;
  // 报错相关
  reportedWordIds?: Set<string>;
  reportingWordId?: string | null;
  onReportError?: (item: VocabularyItem) => void;
}

function VocabularyWordCard({
  item,
  playingWordId,
  onWordClick,
  onOpenMemory,
  revealedMeaning,
  compact,
  showMasteredStageSup,
  showStatusBadge,
  showResetToNewAction,
  resettingWordId,
  onResetToNew,
  showPutBackAction,
  puttingBackWordId,
  onPutBack,
  reportedWordIds,
  reportingWordId,
  onReportError,
}: VocabularyWordCardProps) {
  const stageDisplay = toDisplayStage(item.stage);
  const stageColor = getStageColor(stageDisplay);
  const isPlaying = playingWordId === item.word.id;
  const isPuttingBack = puttingBackWordId === item.wordId;

  const nextReviewDate = item.nextReviewAt ? new Date(item.nextReviewAt) : null;
  const isOverdue = nextReviewDate ? nextReviewDate.getTime() <= Date.now() : false;

  const masteredStageIndex = item.masteredStage ?? item.stage;
  const masteredStageLabel = `S${toDisplayStage(masteredStageIndex)}`;
  const statusMeta = vocabularyStatusMeta[item.status];
  const isResettingToNew = resettingWordId === item.wordId;

  return (
    <Card className={`transition-all hover:shadow-md cursor-pointer select-none ${compact ? '' : 'border-l-4'}`}
      style={compact ? {} : { borderLeftColor: stageColor }}
      onClick={() => onWordClick(item.word)}
    >
      <CardContent className={`${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-center gap-3">
          {/* 阶段指示器 */}
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: stageColor }}
          />

          {/* 单词信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className={`font-bold text-gray-900 hover:text-blue-700 ${compact ? 'text-base' : 'text-lg'}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenMemory(item);
                }}
              >
                {item.word.word}
              </button>
              {showMasteredStageSup && item.status === 'mastered' && (
                <sup className="text-[10px] font-semibold text-emerald-700">{masteredStageLabel}</sup>
              )}
              {item.lastResult === 'wrong' && item.status !== 'mastered' && (
                <Badge variant="destructive" className="px-1 py-0 h-4 text-[10px] rounded flex items-center bg-red-50 text-red-600 border border-red-200 ml-1">
                  错
                </Badge>
              )}
              {item.word.phonetic && (
                <span className="text-gray-500 text-sm">{item.word.phonetic}</span>
              )}
              {showStatusBadge ? (
                <Badge className={statusMeta.className}>
                  {statusMeta.label}
                </Badge>
              ) : item.status === 'mastered' && (
                <Badge className="bg-green-100 text-green-700 border-0">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  已掌握
                </Badge>
              )}
            </div>

            {revealedMeaning ? (
              <div className="mt-0.5 space-y-0.5">
                {item.word.entries && item.word.entries.length > 1 ? (
                  item.word.entries.map((entry, i) => (
                    <div key={`${i}-${entry.partOfSpeech}-${entry.meaning}`} className="flex items-center gap-2">
                      {entry.partOfSpeech && (
                        <Badge variant="secondary" className="text-xs">
                          {entry.partOfSpeech}
                        </Badge>
                      )}
                      <span className="text-gray-700 text-sm">{entry.meaning}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2">
                    {item.word.partOfSpeech && (
                      <Badge variant="secondary" className="text-xs">
                        {item.word.partOfSpeech}
                      </Badge>
                    )}
                    <span className="text-gray-700 text-sm">{item.word.meaning}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">点击朗读后显示中文释义</p>
            )}

            {!compact && (
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  复习 {item.reviewCount} 次
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {nextReviewDate ? (
                    isOverdue ? (
                      <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 rounded px-1.5 py-0.5">
                        本应 {formatReviewAtLabel(nextReviewDate)} 复习 · 已逾期 {formatOverdueDuration(Date.now() - nextReviewDate.getTime())}
                      </span>
                    ) : (
                      <>本应 {formatReviewAtLabel(nextReviewDate)} 复习</>
                    )
                  ) : (
                    <>下次复习: --</>
                  )}
                </span>
              </div>
            )}

            {showResetToNewAction && onResetToNew && (
              <div className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 border-orange-200 px-2 text-[11px] text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                  disabled={isResettingToNew}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onResetToNew(item);
                  }}
                >
                  {isResettingToNew ? '重置中...' : '重新标记为新单词'}
                </Button>
              </div>
            )}
          </div>

          {/* 放回生字本 + 播放图标 + 报错按钮 */}
          <div className="flex-shrink-0 flex items-center gap-1">
            {showPutBackAction && onPutBack && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`w-9 h-9 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-50`}
                disabled={isPuttingBack}
                onClick={(event) => {
                  event.stopPropagation();
                  void onPutBack(item);
                }}
                title="放回生字本"
              >
                {isPuttingBack ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Undo2 className="w-4 h-4" />
                )}
              </Button>
            )}
            {onReportError && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  reportedWordIds?.has(item.word.id)
                    ? 'text-red-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                disabled={reportedWordIds?.has(item.word.id) || reportingWordId === item.word.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onReportError(item);
                }}
                title={reportedWordIds?.has(item.word.id) ? '已报错' : '报错'}
              >
                {reportingWordId === item.word.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Flag className="w-4 h-4" />
                )}
              </Button>
            )}
            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${isPlaying ? 'text-blue-600 bg-blue-50' : 'text-gray-400'
              }`}>
              <Volume2 className={`w-5 h-5 ${isPlaying ? 'animate-pulse' : ''}`} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
