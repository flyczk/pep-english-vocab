import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, Textbook, Lesson, Word, VocabularyItem } from '@/types';
import { dataService } from '@/services/dataService';

interface VocabStats {
  total: number;
  mastered: number;
  learning: number;
  review: number;
}

interface AppState {
  currentUser: User | null;
  textbooks: Textbook[];
  selectedTextbook: Textbook | null;
  selectedLesson: Lesson | null;
  vocabularyItems: VocabularyItem[];
  reviewItems: VocabularyItem[];
  vocabStats: VocabStats;
  isLoading: boolean;
}

interface AppContextType extends AppState {
  login: (username: string, password: string) => Promise<User | null>;
  logout: () => void;
  register: (data: {
    username: string;
    password: string;
    birthDate: string;
    grade: string;
    phone: string;
    gender: string;
  }) => Promise<User | null>;
  selectTextbook: (textbookId: string) => void;
  selectLesson: (lessonId: string) => Promise<void>;
  refreshVocabulary: () => Promise<void>;
  addToVocabulary: (word: Word) => Promise<void>;
  recordWordAttempt: (wordId: string) => Promise<void>;
  markAsMastered: (wordId: string, options?: { skipRefresh?: boolean }) => Promise<void>;
  markAsCorrect: (wordId: string, options?: { skipRefresh?: boolean }) => Promise<void>;
  updateMyProfile: (data: { name?: string; bio?: string; avatarUrl?: string }) => Promise<User | null>;
  changeMyPassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  reviewWord: (wordId: string, correct: boolean) => Promise<void>;
  hasWordsToReview: () => boolean;
  getReviewCount: () => number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    currentUser: null,
    textbooks: [],
    selectedTextbook: null,
    selectedLesson: null,
    vocabularyItems: [],
    reviewItems: [],
    vocabStats: { total: 0, mastered: 0, learning: 0, review: 0 },
    isLoading: true,
  });

  // 初始化 — 检查登录状态
  useEffect(() => {
    const init = async () => {
      try {
        const user = await dataService.getCurrentUser();

        let textbooks: Textbook[] = [];
        let vocabItems: VocabularyItem[] = [];
        let reviewItems: VocabularyItem[] = [];
        let vocabStats = { total: 0, mastered: 0, learning: 0, review: 0 };

        if (user) {
          textbooks = await dataService.getTextbooks();
          try {
            const [items, dueItems, stats] = await Promise.all([
              dataService.getVocabularyItems(),
              dataService.getDueVocabularyItems(),
              dataService.getVocabularyStats(),
            ]);
            vocabItems = items;
            reviewItems = dueItems;
            vocabStats = stats;
          } catch (_e) {
            console.error('Failed to fetch vocab items');
          }
        }

        setState(prev => ({
          ...prev,
          textbooks,
          currentUser: user,
          vocabularyItems: vocabItems,
          reviewItems,
          vocabStats,
          isLoading: false,
        }));
      } catch (_e) {
        console.error('Init failed');
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };
    init();
  }, []);

  // 刷新生字本
  const refreshVocabulary = useCallback(async () => {
    if (!state.currentUser) return;
    try {
      const [vocabItems, dueItems, stats] = await Promise.all([
        dataService.getVocabularyItems(),
        dataService.getDueVocabularyItems(),
        dataService.getVocabularyStats(),
      ]);
      setState(prev => ({
        ...prev,
        vocabularyItems: vocabItems,
        reviewItems: dueItems,
        vocabStats: stats,
      }));
    } catch (_e) {
      console.error('Failed to refresh vocab');
    }
  }, [state.currentUser]);

  // 登录
  const login = useCallback(async (username: string, password: string): Promise<User | null> => {
    try {
      const user = await dataService.login(username, password);
      const textbooks = await dataService.getTextbooks();
      let vocabItems: VocabularyItem[] = [];
      let reviewItems: VocabularyItem[] = [];
      let vocabStats = { total: 0, mastered: 0, learning: 0, review: 0 };
      try {
        const [items, dueItems, stats] = await Promise.all([
          dataService.getVocabularyItems(),
          dataService.getDueVocabularyItems(),
          dataService.getVocabularyStats(),
        ]);
        vocabItems = items;
        reviewItems = dueItems;
        vocabStats = stats;
      } catch (_e) { /* no vocab yet */ }

      setState(prev => ({
        ...prev,
        currentUser: user,
        textbooks,
        vocabularyItems: vocabItems,
        reviewItems,
        vocabStats,
      }));
      return user;
    } catch (e) {
      console.error('Login failed', e);
      throw e;
    }
  }, []);

  // 登出 — properly clear token!
  const logout = useCallback(async () => {
    await dataService.logout();
    setState(prev => ({
      ...prev,
      currentUser: null,
      textbooks: [],
      selectedTextbook: null,
      selectedLesson: null,
      vocabularyItems: [],
      reviewItems: [],
      vocabStats: { total: 0, mastered: 0, learning: 0, review: 0 },
    }));
  }, []);

  // 注册
  const register = useCallback(async (data: {
    username: string;
    password: string;
    birthDate: string;
    grade: string;
    phone: string;
    gender: string;
  }): Promise<User | null> => {
    try {
      const user = await dataService.register(data);
      const textbooks = await dataService.getTextbooks();
      setState(prev => ({
        ...prev,
        currentUser: user,
        textbooks,
        vocabularyItems: [],
        reviewItems: [],
      }));
      return user;
    } catch (e) {
      console.error('Register failed', e);
      throw e;
    }
  }, []);

  // 选择课本 — use string comparison
  const selectTextbook = useCallback((textbookId: string) => {
    const textbook = state.textbooks.find(t => String(t.id) === String(textbookId));
    setState(prev => ({ ...prev, selectedTextbook: textbook || null, selectedLesson: null }));
    // 记住"正在使用的那一册"，下次登录置顶
    dataService.setCurrentTextbook(String(textbookId)).catch(() => undefined);
  }, [state.textbooks]);

  // 选择课程 — fetch words from correct endpoint
  const selectLesson = useCallback(async (lessonId: string) => {
    if (!state.selectedTextbook) return;
    try {
      // Find lesson info from the textbook's lesson list
      const lessonInfo = state.selectedTextbook.lessons.find(l => String(l.id) === String(lessonId));

      // Fetch words from the dedicated endpoint
      const words = await dataService.getWordsByLessonId(lessonId);

      const lesson: Lesson = {
        id: String(lessonId),
        textbookId: state.selectedTextbook.id,
        name: lessonInfo?.name || `Lesson ${lessonId}`,
        order: lessonInfo?.order ?? 0,
        wordCount: words.length,
        sentenceCount: lessonInfo?.sentenceCount,
        words,
      };

      setState(prev => ({ ...prev, selectedLesson: lesson }));
    } catch (e) {
      console.error('Failed to select lesson', e);
    }
  }, [state.selectedTextbook]);

  // 添加到生字本
  const addToVocabulary = useCallback(async (word: Word) => {
    if (!state.currentUser) return;
    try {
      await dataService.addToVocabulary(word.id);
      await refreshVocabulary();
    } catch (e) {
      console.error(e);
    }
  }, [state.currentUser, refreshVocabulary]);

  // 记录已作答（用于“总单词=做过就算”）
  const recordWordAttempt = useCallback(async (wordId: string) => {
    if (!state.currentUser) return;
    try {
      await dataService.recordWordAttempt(wordId);
    } catch (e) {
      console.error('Failed to record word attempt', e);
    }
  }, [state.currentUser]);

  // 标记为已掌握
  const markAsMastered = useCallback(async (wordId: string, options?: { skipRefresh?: boolean }) => {
    if (!state.currentUser) return;
    try {
      await dataService.markAsMastered(wordId);
      if (!options?.skipRefresh) {
        await refreshVocabulary();
      }
    } catch (e) {
      console.error('Failed to mark as mastered', e);
    }
  }, [state.currentUser, refreshVocabulary]);

  // 标记为答对（首次不加入错题本，但触发复习进度更新等）
  const markAsCorrect = useCallback(async (wordId: string, options?: { skipRefresh?: boolean }) => {
    if (!state.currentUser) return;
    try {
      if (dataService.markAsCorrect) {
        await dataService.markAsCorrect(wordId);
      }
      if (!options?.skipRefresh) {
        await refreshVocabulary();
      }
    } catch (e) {
      console.error('Failed to mark as correct', e);
    }
  }, [state.currentUser, refreshVocabulary]);

  // 更新个人资料
  const updateMyProfile = useCallback(async (data: { name?: string; bio?: string; avatarUrl?: string }): Promise<User | null> => {
    if (!state.currentUser) return null;
    try {
      const updated = await dataService.updateMyProfile(data);
      setState(prev => ({ ...prev, currentUser: updated }));
      return updated;
    } catch (e) {
      console.error('Failed to update profile', e);
      return null;
    }
  }, [state.currentUser]);

  // 修改密码
  const changeMyPassword = useCallback(async (currentPassword: string, newPassword: string): Promise<boolean> => {
    if (!state.currentUser) return false;
    try {
      await dataService.changeMyPassword(currentPassword, newPassword);
      return true;
    } catch (e) {
      console.error('Failed to change password', e);
      return false;
    }
  }, [state.currentUser]);

  // 复习单词
  const reviewWord = useCallback(async (wordId: string, correct: boolean) => {
    if (!state.currentUser) return;
    try {
      await dataService.reviewWord(wordId, correct);
    } catch (e) {
      console.error('Review word failed', e);
    }
  }, [state.currentUser]);

  const hasWordsToReview = useCallback((): boolean => {
    return state.reviewItems.length > 0;
  }, [state.reviewItems]);

  const getReviewCount = useCallback((): number => {
    return state.reviewItems.length;
  }, [state.reviewItems]);

  const value: AppContextType = {
    ...state,
    login,
    logout,
    register,
    selectTextbook,
    selectLesson,
    refreshVocabulary,
    addToVocabulary,
    recordWordAttempt,
    markAsMastered,
    markAsCorrect,
    updateMyProfile,
    changeMyPassword,
    reviewWord,
    hasWordsToReview,
    getReviewCount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
