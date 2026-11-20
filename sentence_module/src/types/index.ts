// 用户类型
export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  birthDate?: string;
  grade?: string;
  phone?: string;
  gender?: string;
  role: 'student' | 'admin';
  createdAt: string;
}

// 课本类型
export interface Textbook {
  id: string;
  name: string;
  isBase?: boolean;
  grade: string;
  publisher: string;
  description?: string;
  coverImage?: string;
  lessons: Lesson[];
}

// 课程/单元类型
export interface Lesson {
  id: string;
  textbookId: string;
  name: string;
  order: number;
  wordCount?: number;
  sentenceCount?: number;
  words: Word[];
}

// 单词义项类型（一个单词可能有多个词性和释义）
export interface WordEntry {
  partOfSpeech: string;
  meaning: string;
}

// 单词类型
export interface Word {
  id: string;
  lessonId: string;
  word: string;
  phonetic?: string;
  meaning: string;
  partOfSpeech?: string;
  entries?: WordEntry[];
  ttsEngine?: 'auto' | 'youdao' | 'baidu' | 'bing' | 'browser';
  example?: string;
  audioUrl?: string;
}

// 生字本条目类型
export interface VocabularyItem {
  id: string;
  userId: string;
  wordId: string;
  word: Word;
  lessonId: string;
  textbookId: string;
  // 所属课程/课本名称（用于已掌握列表按课本/Unit 筛选）
  lessonName?: string;
  textbookName?: string;
  // 艾宾浩斯遗忘曲线阶段 (1-8)
  stage: number;
  // 状态: learning(学习中), mastered(已掌握), review(待复习)
  status: 'learning' | 'mastered' | 'review';
  masteredStage?: number | null;
  // 下次复习时间
  nextReviewAt: string;
  // 创建时间
  createdAt: string;
  // 最后复习时间
  lastReviewedAt?: string;
  masteredAt?: string;
  // 复习次数
  reviewCount: number;
  // 最后一次答题结果 (e.g. 'wrong', 'correct')
  lastResult?: string;
}

export interface WordMemoryEvent {
  id: string;
  eventType: string;
  fromStage: number | null;
  toStage: number | null;
  result: string;
  source: string;
  metadata?: string;
  createdAt: string;
}

export interface WordMemoryProgress {
  wordId: string;
  word: Word;
  stage: number;
  status: 'learning' | 'mastered' | 'review';
  reviewCount: number;
  nextReviewAt?: string;
  lastReviewedAt?: string;
  createdAt?: string;
  masteredAt?: string;
  masteredStage?: number | null;
  events: WordMemoryEvent[];
}

// 学习记录类型
export interface StudyRecord {
  id: string;
  userId: string;
  lessonId: string;
  textbookId: string;
  startedAt: string;
  completedAt?: string;
  correctCount: number;
  wrongCount: number;
  words: {
    wordId: string;
    correct: boolean;
    mastered: boolean;
  }[];
}

// 综合艾宾浩斯遗忘曲线 + SM-2 超级记忆算法的9阶段复习间隔
export const EBINGHAUS_STAGES = [
  { stage: 1, interval: 5 * 60 * 1000, label: '5分钟', color: '#ef4444' },        // 即刻强化
  { stage: 2, interval: 30 * 60 * 1000, label: '30分钟', color: '#f97316' },      // 同场巩固
  { stage: 3, interval: 24 * 60 * 60 * 1000, label: '1天', color: '#eab308' },    // 睡眠巩固
  { stage: 4, interval: 3 * 24 * 60 * 60 * 1000, label: '3天', color: '#84cc16' }, // 短期验证
  { stage: 5, interval: 7 * 24 * 60 * 60 * 1000, label: '7天', color: '#22c55e' }, // 一周检验
  { stage: 6, interval: 14 * 24 * 60 * 60 * 1000, label: '14天', color: '#06b6d4' }, // 两周巩固
  { stage: 7, interval: 30 * 24 * 60 * 60 * 1000, label: '30天', color: '#3b82f6' }, // 一个月
  { stage: 8, interval: 60 * 24 * 60 * 60 * 1000, label: '60天', color: '#8b5cf6' }, // 两个月
  { stage: 9, interval: 90 * 24 * 60 * 60 * 1000, label: '90天', color: '#a855f7' }, // 三个月
];

// 获取下一阶段
export function getNextStage(currentStage: number): number {
  if (currentStage >= 9) return 9;
  return currentStage + 1;
}

// 计算下次复习时间
export function calculateNextReviewTime(stage: number): Date {
  const stageInfo = EBINGHAUS_STAGES.find(s => s.stage === stage);
  if (!stageInfo) return new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Date(Date.now() + stageInfo.interval);
}

// 获取阶段颜色
export function getStageColor(stage: number): string {
  const stageInfo = EBINGHAUS_STAGES.find(s => s.stage === stage);
  return stageInfo?.color || '#6b7280';
}

// 获取阶段标签
export function getStageLabel(stage: number): string {
  const stageInfo = EBINGHAUS_STAGES.find(s => s.stage === stage);
  return stageInfo?.label || '';
}
