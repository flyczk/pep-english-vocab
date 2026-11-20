import type { User, Textbook, Lesson, Word, WordEntry, VocabularyItem, WordMemoryProgress } from '@/types';

export interface Sentence {
  id: string;
  lessonId: string;
  en: string;
  zh: string;
  pattern?: string;
  grammarPoint?: string;
  category?: string;
  nextReviewAt?: string | null;
  source?: string;
  reviewCount?: number;
  correctCount?: number;
  stage?: number;
  firstTry?: number;
  masteredAt?: string | null;
  examPoint?: string;
  isReview?: number;
  lessonName?: string;
  textbookName?: string;
  audioUrl?: string;
}

// 考点专练
export interface ExamPoint {
  exam_point: string;
  total: number;
  learned: number;
  mastered: number;
  drills: number;
  units: string[];
}

export interface DrillItem {
  id: string;
  sentence_id: string;
  exam_point: string;
  kind: string;
  prompt: string;
  answer: string;
  hint: string;
}

class DataService {
  private token: string | null = localStorage.getItem('token');
  private readonly OCR_DUAL_POS_FALLBACK_RULES_CACHE_KEY = 'ocr_dual_pos_fallback_rules_cache';
  private readonly OCR_DUAL_POS_PATTERN_RULES_CACHE_KEY = 'ocr_dual_pos_pattern_rules_cache';
  private readonly WORD_TTS_ENGINES = new Set(['youdao', 'baidu', 'bing', 'browser']);

  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const headers = new Headers(options?.headers);
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorText = await response.text();
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.error) throw new Error(parsed.error);
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected token' && !e.message.includes('JSON')) {
          throw e;
        }
      }
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
    return response.json();
  }

  private readLocalRuleCache(key: string): any[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeLocalRuleCache(key: string, rules: any[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(Array.isArray(rules) ? rules : []));
    } catch {
      // ignore storage quota/availability errors
    }
  }

  private normalizeWordTtsEngineForPayload(value: unknown): string {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized || normalized === 'auto') return '';
    return this.WORD_TTS_ENGINES.has(normalized) ? normalized : '';
  }

  private normalizeWordTtsEngineForUi(value: unknown): 'auto' | 'youdao' | 'baidu' | 'bing' | 'browser' {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (this.WORD_TTS_ENGINES.has(normalized)) {
      return normalized as 'youdao' | 'baidu' | 'bing' | 'browser';
    }
    return 'auto';
  }

  // ========== 用户相关方法 ==========

  async login(username: string, password: string): Promise<User> {
    const data = await this.request<{ user: any; token: string }>('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    this.token = data.token;
    localStorage.setItem('token', data.token);
    return this.mapUser(data.user);
  }

  async register(payload: {
    username: string;
    password: string;
    birthDate: string;
    grade: string;
    phone: string;
    gender: string;
  }): Promise<User> {
    const response = await this.request<{ user: any; token: string }>('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: payload.username,
        password: payload.password,
        name: payload.username,
        birth_date: payload.birthDate,
        grade: payload.grade,
        phone: payload.phone,
        gender: payload.gender,
      }),
    });
    // Save token — this was missing before!
    this.token = response.token;
    localStorage.setItem('token', response.token);
    return this.mapUser(response.user);
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/logout', { method: 'POST' });
    } catch (_e) {
      // ignore — server might already have cleared session
    }
    this.token = null;
    localStorage.removeItem('token');
  }

  async logActivity(payload: {
    action: string;
    targetType?: string;
    targetId?: string | number;
    targetName?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    if (!this.token) return;
    const action = String(payload?.action || '').trim().toLowerCase();
    if (!action) return;
    try {
      await this.request('/api/activity/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          targetType: payload.targetType || '',
          targetId: payload.targetId ?? '',
          targetName: payload.targetName || '',
          metadata: payload.metadata || {},
        }),
      });
    } catch {
      // Ignore behavior log errors to avoid affecting main user flow.
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.token) return null;
    try {
      const data = await this.request<{ user: any }>('/api/me');
      return this.mapUser(data.user);
    } catch (_e) {
      // Token expired or invalid
      this.token = null;
      localStorage.removeItem('token');
      return null;
    }
  }

  async updateMyProfile(data: { name?: string; bio?: string; avatarUrl?: string }): Promise<User> {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.bio !== undefined) payload.bio = data.bio;
    if (data.avatarUrl !== undefined) payload.avatar_url = data.avatarUrl;
    const res = await this.request<{ user: any }>('/api/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return this.mapUser(res.user);
  }

  async changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request('/api/me/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  }

  // ========== 课本相关方法 ==========

  async getTextbooks(): Promise<Textbook[]> {
    if (!this.token) return [];
    try {
      const data = await this.request<{ textbooks: any[] }>('/api/textbooks');
      return data.textbooks.map((tb: any) => this.mapTextbook(tb));
    } catch (_e) {
      return [];
    }
  }

  // ========== 课程相关方法 ==========

  async getLessonsByTextbookId(textbookId: string): Promise<Lesson[]> {
    const data = await this.request<{ lessons: any[] }>(`/api/textbooks/${textbookId}/lessons`);
    return data.lessons.map((l: any) => this.mapLesson(l));
  }

  // ========== 单词相关方法 ==========

  async getWordsByLessonId(lessonId: string): Promise<Word[]> {
    const data = await this.request<{ words: any[] }>(`/api/lessons/${lessonId}/words`);
    return data.words.map((w: any) => this.mapWord(w));
  }

  // ========== 常用语句 ==========

  async getSentencesByLessonId(lessonId: string): Promise<Sentence[]> {
    const data = await this.request<{ sentences: any[] }>(`/api/lessons/${lessonId}/sentences`);
    return (data.sentences || []).map((s: any) => ({
      id: String(s.id),
      lessonId: String(s.lesson_id),
      en: String(s.en || ''),
      zh: String(s.zh || ''),
      pattern: String(s.pattern || ''),
      grammarPoint: String(s.grammar_point || ''),
      category: String(s.category || ''),
      nextReviewAt: s.next_review_at ? String(s.next_review_at) : null,
      source: String(s.source || ''),
      reviewCount: Number(s.review_count || 0),
      correctCount: Number(s.correct_count || 0),
      stage: Number(s.stage || 0),
      firstTry: Number(s.first_try || 0),
      masteredAt: s.mastered_at ? String(s.mastered_at) : null,
      examPoint: String(s.exam_point || ''),
      isReview: Number(s.is_review || 0),
      audioUrl: String(s.audio_url || ''),
    }));
  }

  // 考点专练：考点总览
  async getExamPoints(): Promise<ExamPoint[]> {
    const data = await this.request<{ points: any[] }>('/api/sentences/exam-points');
    return (data.points || []).map((p: any) => ({
      exam_point: String(p.exam_point || ''),
      total: Number(p.total || 0),
      learned: Number(p.learned || 0),
      mastered: Number(p.mastered || 0),
      drills: Number(p.drills || 0),
      units: Array.isArray(p.units) ? p.units.map(String) : [],
    }));
  }

  // 考点专练：某考点下已学句子 + 配套挖空题
  async getDrill(examPoint: string): Promise<{ sentences: Sentence[]; drills: Record<string, DrillItem[]> }> {
    const data = await this.request<any>(
      `/api/sentences/drill?exam_point=${encodeURIComponent(examPoint)}`,
    );
    const sentences = (data.sentences || []).map((s: any) => ({
      id: String(s.id),
      lessonId: String(s.lesson_id),
      en: String(s.en || ''),
      zh: String(s.zh || ''),
      pattern: String(s.pattern || ''),
      grammarPoint: String(s.grammar_point || ''),
      category: String(s.category || ''),
      source: String(s.source || ''),
      stage: Number(s.stage || 0),
      reviewCount: Number(s.review_count || 0),
      masteredAt: s.mastered_at ? String(s.mastered_at) : null,
      nextReviewAt: s.next_review_at ? String(s.next_review_at) : null,
      examPoint: String(s.exam_point || ''),
      isReview: Number(s.is_review || 0),
      lessonName: String(s.lesson_name || ''),
      textbookName: String(s.textbook_name || ''),
      audioUrl: String(s.audio_url || ''),
    }));
    const drills: Record<string, DrillItem[]> = {};
    Object.keys(data.drills || {}).forEach((k) => {
      drills[String(k)] = (data.drills[k] || []).map((d: any) => ({
        id: String(d.id),
        sentence_id: String(d.sentence_id),
        exam_point: String(d.exam_point || ''),
        kind: String(d.kind || ''),
        prompt: String(d.prompt || ''),
        answer: String(d.answer || ''),
        hint: String(d.hint || ''),
      }));
    });
    return { sentences, drills };
  }

  async getSentenceStats(): Promise<{ total: number; mastered: number; learning: number; due: number; untouched: number }> {
    const data = await this.request<any>('/api/sentences/stats');
    return {
      total: Number(data?.total || 0),
      mastered: Number(data?.mastered || 0),
      learning: Number(data?.learning || 0),
      due: Number(data?.due || 0),
      untouched: Number(data?.untouched || 0),
    };
  }

  async getDueSentences(limit = 50): Promise<Sentence[]> {
    const data = await this.request<{ sentences: any[] }>(`/api/sentences/due?limit=${limit}`);
    return (data.sentences || []).map((s: any) => ({
      id: String(s.id),
      lessonId: String(s.lesson_id),
      en: String(s.en || ''),
      zh: String(s.zh || ''),
      pattern: String(s.pattern || ''),
      grammarPoint: String(s.grammar_point || ''),
      category: String(s.category || ''),
      source: String(s.source || ''),
      stage: Number(s.stage || 0),
      reviewCount: Number(s.review_count || 0),
      masteredAt: s.mastered_at ? String(s.mastered_at) : null,
      nextReviewAt: s.next_review_at ? String(s.next_review_at) : null,
      audioUrl: String(s.audio_url || ''),
    }));
  }

  async reviewSentence(sentenceId: string, correct: boolean, fixed = false): Promise<void> {
    await this.request(`/api/sentences/${sentenceId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correct, fixed }),
    });
  }

  async setCurrentTextbook(textbookId: string): Promise<void> {
    await this.request('/api/me/current-textbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ textbookId }),
    });
  }

  async anchorLessonReviewSchedule(
    lessonId: string,
    options?: { onlyStageZero?: boolean },
  ): Promise<{ ok: boolean; anchoredCount: number; baseTime: string }> {
    return this.request(`/api/lessons/${lessonId}/review-anchor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        onlyStageZero: options?.onlyStageZero !== false,
      }),
    });
  }

  // ========== 生字本相关方法 ==========

  private resolveVocabularyStatus(row: any, options?: { forceStatus?: VocabularyItem['status'] }): VocabularyItem['status'] {
    if (options?.forceStatus) return options.forceStatus;
    if (row?.status === 'mastered' || row?.mastered_at) return 'mastered';
    if (row?.status === 'review') return 'review';
    const nextReviewAt = row?.next_review_at || row?.nextReviewAt;
    if (nextReviewAt) {
      const time = new Date(nextReviewAt).getTime();
      if (Number.isFinite(time) && time <= Date.now()) return 'review';
    }
    return 'learning';
  }

  private mapVocabularyItem(w: any, options?: { forceStatus?: VocabularyItem['status'] }): VocabularyItem {
    const nextReviewAt = w.next_review_at || w.nextReviewAt || '';
    const lastReviewedAt = w.last_review_at || w.lastReviewedAt || '';
    const masteredAt = w.mastered_at || w.masteredAt || '';
    const createdAt = w.created_at || w.createdAt || lastReviewedAt || masteredAt || new Date().toISOString();
    const status = this.resolveVocabularyStatus(w, options);
    const rawMasteredStage = w.mastered_stage ?? w.masteredStage;
    const masteredStage = rawMasteredStage === null || rawMasteredStage === undefined || rawMasteredStage === ''
      ? null
      : Number(rawMasteredStage);

    let wordEntries: WordEntry[] | undefined;
    try {
      const raw = typeof w.entries === 'string' ? JSON.parse(w.entries) : w.entries;
      if (Array.isArray(raw) && raw.length > 0) {
        wordEntries = raw.map((e: any) => ({
          partOfSpeech: String(e.partOfSpeech || e.part_of_speech || ''),
          meaning: String(e.meaning || ''),
        }));
      }
    } catch { /* ignore parse errors */ }

    return {
      id: `v_${w.id}`,
      userId: 'current',
      wordId: String(w.id),
      word: {
        id: String(w.id),
        word: w.word,
        meaning: w.meaning,
        phonetic: w.phonetic || '',
        lessonId: String(w.lesson_id || ''),
        partOfSpeech: w.part_of_speech || '',
        entries: wordEntries,
        ttsEngine: this.normalizeWordTtsEngineForUi(w.tts_engine ?? w.ttsEngine),
      } as Word,
      lessonId: String(w.lesson_id || ''),
      textbookId: String(w.textbook_id || ''),
      lessonName: w.lesson_name || w.lessonName || undefined,
      textbookName: w.textbook_name || w.textbookName || undefined,
      stage: Number(w.stage || 0),
      status,
      masteredStage: Number.isFinite(masteredStage) ? masteredStage : null,
      nextReviewAt: nextReviewAt || new Date().toISOString(),
      createdAt,
      lastReviewedAt: lastReviewedAt || undefined,
      masteredAt: masteredAt || undefined,
      reviewCount: Number(w.review_count || 0),
      lastResult: w.last_result || undefined,
    };
  }

  async getVocabularyItems(): Promise<VocabularyItem[]> {
    try {
      const data = await this.request<{ words: any[] }>('/api/vocabulary/items');
      return data.words.map((w: any) => this.mapVocabularyItem(w));
    } catch (error) {
      const message = String(error);
      const endpointMissing = /API Error:\s*404/i.test(message) || message.includes('Cannot GET /api/vocabulary/items');
      if (!endpointMissing) throw error;
      const fallback = await this.request<{ words: any[] }>('/api/wrongbook');
      return fallback.words.map((w: any) => this.mapVocabularyItem(w));
    }
  }

  async getDueVocabularyItems(): Promise<VocabularyItem[]> {
    const data = await this.request<{ words: any[] }>('/api/wrongbook/due');
    return data.words.map((w: any) => this.mapVocabularyItem(w, { forceStatus: 'review' }));
  }

  async getVocabularyStats(): Promise<{ total: number; mastered: number; learning: number; review: number }> {
    return this.request('/api/me/stats');
  }

  async addToVocabulary(wordId: string): Promise<void> {
    await this.request(`/api/word/${wordId}/wrong`, { method: 'POST' });
  }

  async recordWordAttempt(wordId: string): Promise<void> {
    await this.request(`/api/word/${wordId}/seen`, { method: 'POST' });
  }

  async markAsMastered(wordId: string): Promise<void> {
    await this.request(`/api/word/${wordId}/mastered`, { method: 'POST' });
  }
  async resetWordToNew(wordId: string): Promise<void> {
    await this.request(`/api/word/${wordId}/reset-to-new`, { method: 'POST' });
  }
  // 放回生字本：已掌握单词重新回到学习中（保留记忆轨迹）
  async putWordBack(wordId: string): Promise<void> {
    await this.request(`/api/word/${wordId}/put-back`, { method: 'POST' });
  }
  async markAsCorrect(wordId: string): Promise<void> {
    await this.request(`/api/word/${wordId}/correct`, { method: 'POST' });
  }

  async reviewWord(wordId: string, correct: boolean): Promise<any> {
    return this.request(`/api/word/${wordId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: correct ? 'correct' : 'wrong' }),
    });
  }

  async reportWordError(
    wordId: string,
    payload: {
      userInput: string;
      expectedAnswer?: string;
      reason: string;
      isCorrect?: boolean;
    },
  ): Promise<{ ok: boolean; reportId?: number; updated?: boolean }> {
    return this.request(`/api/word/${wordId}/error-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userInput: payload.userInput,
        expectedAnswer: payload.expectedAnswer,
        reason: payload.reason,
        isCorrect: payload.isCorrect,
      }),
    });
  }

  async anchorVocabularyReviewSchedule(
    options?: { onlyStageZero?: boolean },
  ): Promise<{ ok: boolean; anchoredCount: number }> {
    return this.request(`/api/vocabulary/review-anchor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        onlyStageZero: options?.onlyStageZero !== false,
      }),
    });
  }

  async getWordMemoryProgress(wordId: string): Promise<WordMemoryProgress> {
    const data = await this.request<{ word: any; events?: any[] }>(`/api/vocabulary/words/${wordId}/memory`);
    const wordRow = data?.word || {};
    const status = this.resolveVocabularyStatus(wordRow);
    const stage = Number(wordRow.stage || 0);
    const rawMasteredStage = wordRow.mastered_stage ?? wordRow.masteredStage;
    const masteredStage = rawMasteredStage === null || rawMasteredStage === undefined || rawMasteredStage === ''
      ? null
      : Number(rawMasteredStage);

    return {
      wordId: String(wordRow.word_id || wordId),
      word: {
        id: String(wordRow.word_id || wordId),
        lessonId: String(wordRow.lesson_id || ''),
        word: String(wordRow.word || ''),
        phonetic: String(wordRow.phonetic || ''),
        meaning: String(wordRow.meaning || ''),
        partOfSpeech: String(wordRow.part_of_speech || ''),
        ttsEngine: this.normalizeWordTtsEngineForUi(wordRow.tts_engine),
      },
      stage,
      status,
      reviewCount: Number(wordRow.review_count || 0),
      nextReviewAt: wordRow.next_review_at || undefined,
      lastReviewedAt: wordRow.last_review_at || undefined,
      createdAt: wordRow.created_at || undefined,
      masteredAt: wordRow.mastered_at || undefined,
      masteredStage: Number.isFinite(masteredStage) ? masteredStage : null,
      events: Array.isArray(data?.events)
        ? data.events.map((item) => ({
          id: String(item.id),
          eventType: String(item.event_type || ''),
          fromStage: item.from_stage === null || item.from_stage === undefined ? null : Number(item.from_stage),
          toStage: item.to_stage === null || item.to_stage === undefined ? null : Number(item.to_stage),
          result: String(item.result || ''),
          source: String(item.source || ''),
          metadata: item.metadata ? String(item.metadata) : undefined,
          createdAt: String(item.created_at || ''),
        }))
        : [],
    };
  }

  // ========== Field Mapping Helpers ==========
  // Backend uses snake_case and numeric IDs; frontend uses camelCase and string IDs.

  private mapUser(u: any): User {
    return {
      id: String(u.id),
      username: u.username,
      password: '',  // Never sent from backend
      name: u.name || u.username,
      bio: u.bio || '',
      avatarUrl: u.avatar_url || u.avatarUrl || '',
      birthDate: u.birth_date || u.birthDate || '',
      grade: u.grade || '',
      phone: u.phone || '',
      gender: u.gender || '',
      role: u.role === 'admin' ? 'admin' : 'student',
      createdAt: u.created_at || '',
    };
  }

  private mapTextbook(tb: any): Textbook {
    return {
      id: String(tb.id),
      name: tb.name,
      isBase: Number(tb.is_base ?? tb.isBase ?? 0) === 1,
      grade: tb.grade || '',
      publisher: tb.publisher || '',
      description: tb.description || '',
      coverImage: tb.coverImage || '',
      lessons: (tb.lessons || []).map((l: any) => this.mapLesson(l)),
    };
  }

  private mapLesson(l: any): Lesson {
    return {
      id: String(l.id),
      textbookId: String(l.textbook_id || ''),
      name: l.name,
      order: l.sort_order ?? 0,
      wordCount: l.word_count ?? undefined,
      sentenceCount: l.sentence_count ?? undefined,
      words: (l.words || []).map((w: any) => this.mapWord(w)),
    };
  }

  private mapWord(w: any): Word {
    let entries: WordEntry[] | undefined;
    try {
      const raw = typeof w.entries === 'string' ? JSON.parse(w.entries) : w.entries;
      if (Array.isArray(raw) && raw.length > 0) {
        entries = raw.map((e: any) => ({
          partOfSpeech: String(e.partOfSpeech || e.part_of_speech || ''),
          meaning: String(e.meaning || ''),
        }));
      }
    } catch { /* ignore parse errors */ }

    return {
      id: String(w.id),
      lessonId: String(w.lesson_id || ''),
      word: w.word,
      phonetic: w.phonetic || w.phone || '',
      meaning: w.meaning,
      partOfSpeech: w.part_of_speech || '',
      entries,
      ttsEngine: this.normalizeWordTtsEngineForUi(w.tts_engine ?? w.ttsEngine),
      example: w.example || '',
      audioUrl: w.audio_url || '',
    };
  }
  // ========== Admin API Methods ==========

  async adminGetUsers(): Promise<any[]> {
    const data = await this.request<{ users: any[] }>('/api/admin/users');
    return data.users.map((u: any) => ({
      id: String(u.id),
      username: u.username,
      name: u.name || u.username,
      role: u.role,
      active: u.active !== 0,
      createdAt: u.created_at || '',
    }));
  }

  async createTextbook(name: string, grade = '', publisher = ''): Promise<Textbook> {
    const data = await this.request<{ ok: boolean; textbook?: any }>('/api/admin/textbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, grade, publisher }), // Backend currently only uses name, but good to pass others if extended
    });
    if (!data.textbook) {
      // Backward compatibility: old backend only returns { ok: true }
      const textbooks = await this.adminGetTextbooks();
      const candidate = [...textbooks].reverse().find((tb: any) => tb.name === name)
        || textbooks[textbooks.length - 1];
      if (!candidate) {
        throw new Error('创建教材失败：服务端未返回教材ID');
      }
      return this.mapTextbook({
        ...candidate,
        grade: candidate.grade || grade,
        publisher: candidate.publisher || publisher,
        lessons: [],
      });
    }
    return this.mapTextbook({
      ...data.textbook,
      grade: data.textbook.grade || grade,
      publisher: data.textbook.publisher || publisher,
      lessons: [],
    });
  }

  async createLesson(
    textbookId: string,
    name: string,
    _description = '',
    sortOrder?: number,
  ): Promise<Lesson> {
    const data = await this.request<{ ok: boolean; lesson?: any }>(`/api/admin/textbooks/${textbookId}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sort_order: sortOrder ?? 0 }),
    });
    if (!data.lesson) {
      // Backward compatibility: old backend only returns { ok: true }
      const lessons = await this.adminGetLessons(textbookId);
      const candidate = [...lessons].reverse().find((l: any) => l.name === name)
        || lessons[lessons.length - 1];
      if (!candidate) {
        throw new Error('创建Unit失败：服务端未返回Unit ID');
      }
      return this.mapLesson(candidate);
    }
    return this.mapLesson(data.lesson);
  }

  async addWord(
    lessonId: string,
    wordData: { word: string; meaning: string; phonetic?: string; partOfSpeech?: string; ttsEngine?: string },
  ): Promise<void> {
    const body = {
      word: wordData.word,
      meaning: wordData.meaning,
      phonetic: wordData.phonetic,
      part_of_speech: wordData.partOfSpeech || '',
      tts_engine: this.normalizeWordTtsEngineForPayload(wordData.ttsEngine),
    };
    await this.request<{ ok: boolean; word?: any }>(`/api/admin/lessons/${lessonId}/words`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async adminCreateUser(data: { username: string; password: string; name: string; role: string }): Promise<any> {
    return this.request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async adminUpdateUser(id: string, data: { password?: string; name?: string; role?: string; active?: boolean }): Promise<any> {
    return this.request(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async adminDeleteUser(id: string): Promise<any> {
    return this.request(`/api/admin/users/${id}`, { method: 'DELETE' });
  }

  async adminGetUserPermissions(userId: string): Promise<number[]> {
    const data = await this.request<{ textbook_ids: number[] }>(`/api/admin/users/${userId}/permissions`);
    return data.textbook_ids;
  }

  async adminSetUserPermissions(userId: string, textbookIds: number[]): Promise<any> {
    return this.request(`/api/admin/users/${userId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ textbook_ids: textbookIds }),
    });
  }

  async adminGetTextbooks(): Promise<any[]> {
    const data = await this.request<{ textbooks: any[] }>('/api/admin/textbooks');
    return data.textbooks;
  }

  async adminCreateTextbook(data: { name: string; sort_order?: number; is_base?: boolean }): Promise<any> {
    return this.request('/api/admin/textbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async adminUpdateTextbook(id: string, data: { name?: string; sort_order?: number; is_base?: boolean }): Promise<any> {
    return this.request(`/api/admin/textbooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async adminRestoreBaseTextbooks(): Promise<{ ok: boolean; created: number; updated: number; templates: number; viaFallback?: boolean }> {
    try {
      return await this.request('/api/admin/textbooks/restore-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch (error) {
      const errMsg = String(error);
      const isNotFound =
        /API Error:\s*404/i.test(errMsg) ||
        errMsg.includes('Cannot POST /api/admin/textbooks/restore-base');
      if (!isNotFound) {
        throw error;
      }

      // Fallback for old backend instances that don't have restore-base endpoint.
      const templates = ['PEP英语七下', 'PEP英语八下', 'PEP英语九下'];
      const normalize = (value: string) => String(value || '').trim().toLowerCase();
      const textbooks = await this.adminGetTextbooks();
      const byName = new Map(textbooks.map((tb: any) => [normalize(tb.name), tb]));

      let created = 0;
      let updated = 0;
      for (const name of templates) {
        const existing = byName.get(normalize(name));
        if (existing) {
          const isBase = Number(existing.is_base ?? existing.isBase ?? 0) === 1;
          if (!isBase) {
            try {
              await this.adminUpdateTextbook(String(existing.id), { is_base: true });
              updated += 1;
            } catch {
              // ignore - old backend may ignore unsupported fields
            }
          }
          continue;
        }
        await this.adminCreateTextbook({
          name,
          sort_order: textbooks.length + created,
          is_base: true,
        });
        created += 1;
      }

      return {
        ok: true,
        created,
        updated,
        templates: templates.length,
        viaFallback: true,
      };
    }
  }

  async adminDeleteTextbook(id: string): Promise<any> {
    return this.request(`/api/admin/textbooks/${id}`, { method: 'DELETE' });
  }

  async adminGetLessons(textbookId: string): Promise<any[]> {
    const data = await this.request<{ lessons: any[] }>(`/api/admin/textbooks/${textbookId}/lessons`);
    return data.lessons;
  }

  async adminCreateLesson(textbookId: string, data: { name: string; sort_order?: number }): Promise<any> {
    return this.request(`/api/admin/textbooks/${textbookId}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async adminUpdateLesson(id: string, data: { name?: string; sort_order?: number }): Promise<any> {
    return this.request(`/api/admin/lessons/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async adminDeleteLesson(id: string): Promise<any> {
    return this.request(`/api/admin/lessons/${id}`, { method: 'DELETE' });
  }

  async adminGetWords(lessonId: string): Promise<any[]> {
    const data = await this.request<{ words: any[] }>(`/api/admin/lessons/${lessonId}/words`);
    return data.words;
  }

  async adminSearchWords(
    keyword: string,
    limit = 100,
    options?: { textbookId?: string | number },
  ): Promise<{ words: any[]; keyword: string; limit: number }> {
    const normalizedKeyword = String(keyword || '').trim();
    const normalizedLimit = Math.max(10, Math.min(200, Number(limit) || 100));
    const scopedTextbookId = options?.textbookId !== undefined && options?.textbookId !== null
      ? String(options.textbookId).trim()
      : '';

    const query = new URLSearchParams();
    query.set('keyword', normalizedKeyword);
    query.set('limit', String(normalizedLimit));
    if (scopedTextbookId) {
      query.set('textbook_id', scopedTextbookId);
    }

    try {
      return await this.request(`/api/admin/words/search?${query.toString()}`);
    } catch (error) {
      const message = String(error);
      const endpointMissing = /API Error:\s*404/i.test(message)
        || message.includes('Cannot GET /api/admin/words/search');
      if (!endpointMissing) {
        throw error;
      }

      // Backward compatibility for old backend: perform local aggregation search.
      const textbookRows = await this.adminGetTextbooks();
      const scopedTextbookRows = scopedTextbookId
        ? textbookRows.filter((tb: any) => String(tb.id) === scopedTextbookId)
        : textbookRows;

      const keywordLower = normalizedKeyword.toLowerCase();
      const resultRows: any[] = [];
      for (const textbook of scopedTextbookRows) {
        const lessons = await this.adminGetLessons(String(textbook.id));
        for (const lesson of lessons) {
          const words = await this.adminGetWords(String(lesson.id));
          for (const word of words) {
            const en = String(word.word || '').toLowerCase();
            const zh = String(word.meaning || '');
            if (!normalizedKeyword || en.includes(keywordLower) || zh.includes(normalizedKeyword)) {
              resultRows.push({
                id: word.id,
                word: word.word,
                meaning: word.meaning,
                phonetic: word.phonetic || '',
                part_of_speech: word.part_of_speech || '',
                tts_engine: this.normalizeWordTtsEngineForPayload(word.tts_engine ?? word.ttsEngine),
                lesson_id: lesson.id,
                lesson_name: lesson.name,
                lesson_sort_order: Number(lesson.sort_order || 0),
                textbook_id: textbook.id,
                textbook_name: textbook.name,
                textbook_sort_order: Number(textbook.sort_order || 0),
                sort_order: Number(word.sort_order || 0),
              });
            }
          }
        }
      }

      resultRows.sort((a, b) => {
        const tbOrderDiff = Number(a.textbook_sort_order || 0) - Number(b.textbook_sort_order || 0);
        if (tbOrderDiff !== 0) return tbOrderDiff;
        const tbIdDiff = Number(a.textbook_id || 0) - Number(b.textbook_id || 0);
        if (tbIdDiff !== 0) return tbIdDiff;
        const lessonOrderDiff = Number(a.lesson_sort_order || 0) - Number(b.lesson_sort_order || 0);
        if (lessonOrderDiff !== 0) return lessonOrderDiff;
        const lessonIdDiff = Number(a.lesson_id || 0) - Number(b.lesson_id || 0);
        if (lessonIdDiff !== 0) return lessonIdDiff;
        const wordOrderDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0);
        if (wordOrderDiff !== 0) return wordOrderDiff;
        return Number(a.id || 0) - Number(b.id || 0);
      });

      return {
        words: resultRows.slice(0, normalizedLimit),
        keyword: normalizedKeyword,
        limit: normalizedLimit,
      };
    }
  }

  async adminCreateWord(
    lessonId: string,
    data: { word: string; meaning: string; phonetic?: string; partOfSpeech?: string; ttsEngine?: string; sort_order?: number },
  ): Promise<any> {
    return this.request(`/api/admin/lessons/${lessonId}/words`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        part_of_speech: data.partOfSpeech ?? '',
        tts_engine: this.normalizeWordTtsEngineForPayload(data.ttsEngine),
      }),
    });
  }

  async adminUpdateWord(
    id: string,
    data: { word?: string; meaning?: string; phonetic?: string; partOfSpeech?: string; ttsEngine?: string; sort_order?: number; entries?: { partOfSpeech: string; meaning: string }[] },
  ): Promise<any> {
    const hasTtsEngineField = Object.prototype.hasOwnProperty.call(data, 'ttsEngine');
    return this.request(`/api/admin/words/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        part_of_speech: data.partOfSpeech,
        tts_engine: hasTtsEngineField
          ? this.normalizeWordTtsEngineForPayload(data.ttsEngine)
          : undefined,
        entries: data.entries, // pass entries array if provided
      }),
    });
  }

  async adminDeleteWord(id: string): Promise<any> {
    return this.request(`/api/admin/words/${id}`, { method: 'DELETE' });
  }

  async adminGetOcrDualPosFallbackRules(): Promise<any[]> {
    try {
      const data = await this.request<{ rules?: any[] }>('/api/admin/ocr/dual-pos-fallback-rules');
      const rules = Array.isArray(data?.rules) ? data.rules : [];
      this.writeLocalRuleCache(this.OCR_DUAL_POS_FALLBACK_RULES_CACHE_KEY, rules);
      return rules;
    } catch {
      return this.readLocalRuleCache(this.OCR_DUAL_POS_FALLBACK_RULES_CACHE_KEY);
    }
  }

  async adminSaveOcrDualPosFallbackRules(rules: any[]): Promise<any[]> {
    const payload = Array.isArray(rules) ? rules : [];
    try {
      const data = await this.request<{ rules?: any[] }>('/api/admin/ocr/dual-pos-fallback-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: payload }),
      });
      const next = Array.isArray(data?.rules) ? data.rules : payload;
      this.writeLocalRuleCache(this.OCR_DUAL_POS_FALLBACK_RULES_CACHE_KEY, next);
      return next;
    } catch {
      this.writeLocalRuleCache(this.OCR_DUAL_POS_FALLBACK_RULES_CACHE_KEY, payload);
      return payload;
    }
  }

  async adminGetOcrDualPosPatternRules(): Promise<any[]> {
    try {
      const data = await this.request<{ rules?: any[] }>('/api/admin/ocr/dual-pos-pattern-rules');
      const rules = Array.isArray(data?.rules) ? data.rules : [];
      this.writeLocalRuleCache(this.OCR_DUAL_POS_PATTERN_RULES_CACHE_KEY, rules);
      return rules;
    } catch {
      return this.readLocalRuleCache(this.OCR_DUAL_POS_PATTERN_RULES_CACHE_KEY);
    }
  }

  async adminSaveOcrDualPosPatternRules(rules: any[]): Promise<any[]> {
    const payload = Array.isArray(rules) ? rules : [];
    try {
      const data = await this.request<{ rules?: any[] }>('/api/admin/ocr/dual-pos-pattern-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: payload }),
      });
      const next = Array.isArray(data?.rules) ? data.rules : payload;
      this.writeLocalRuleCache(this.OCR_DUAL_POS_PATTERN_RULES_CACHE_KEY, next);
      return next;
    } catch {
      this.writeLocalRuleCache(this.OCR_DUAL_POS_PATTERN_RULES_CACHE_KEY, payload);
      return payload;
    }
  }

  async adminReassignWordsByWordRange(
    textbookId: string,
    payload: {
      sourceLessonId?: string;
      sourceUnitName?: string;
      startWord: string;
      endWord?: string;
      toUnitName: string;
      createTargetIfMissing?: boolean;
      preview?: boolean;
    },
  ): Promise<any> {
    const requestBody = {
      sourceLessonId: payload.sourceLessonId,
      sourceUnitName: payload.sourceUnitName,
      startWord: payload.startWord,
      endWord: payload.endWord,
      toUnitName: payload.toUnitName,
      createTargetIfMissing: payload.createTargetIfMissing ?? true,
      preview: payload.preview ?? false,
    };

    const endpoints = [
      `/api/admin/textbooks/${textbookId}/reassign-words-by-word-range`,
      `/api/admin/textbooks/${textbookId}/reassign-words-by-range`,
    ];

    let lastNotFoundError: unknown = null;
    for (const endpoint of endpoints) {
      try {
        return await this.request(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
      } catch (error) {
        const message = String(error);
        if (/API Error:\s*404/i.test(message)) {
          lastNotFoundError = error;
          continue;
        }
        throw error;
      }
    }

    throw lastNotFoundError || new Error('批量迁移接口不存在');
  }

  async adminGetProgress(): Promise<any[]> {
    const data = await this.request<{ progress: any[] }>('/api/admin/progress');
    return data.progress;
  }

  async adminGetActivityLogs(params?: {
    page?: number;
    pageSize?: number;
    action?: string;
    keyword?: string;
    userId?: string | number;
  }): Promise<{ logs: any[]; page: number; pageSize: number; total: number }> {
    const query = new URLSearchParams();
    query.set('page', String(params?.page ?? 1));
    query.set('pageSize', String(params?.pageSize ?? 50));
    if (params?.action) query.set('action', String(params.action).trim().toLowerCase());
    if (params?.keyword) query.set('keyword', String(params.keyword).trim());
    if (params?.userId !== undefined && params?.userId !== null && String(params.userId).trim()) {
      query.set('userId', String(params.userId).trim());
    }
    return this.request(`/api/admin/activity-logs?${query.toString()}`);
  }

  async adminGetErrorReports(params?: {
    page?: number;
    pageSize?: number;
    status?: '' | 'pending' | 'resolved' | 'dismissed';
    keyword?: string;
    wordId?: string | number;
    userId?: string | number;
  }): Promise<{ reports: any[]; page: number; pageSize: number; total: number }> {
    const query = new URLSearchParams();
    query.set('page', String(params?.page ?? 1));
    query.set('pageSize', String(params?.pageSize ?? 50));
    if (params?.status) query.set('status', String(params.status).trim().toLowerCase());
    if (params?.keyword) query.set('keyword', String(params.keyword).trim());
    if (params?.wordId !== undefined && params?.wordId !== null && String(params.wordId).trim()) {
      query.set('wordId', String(params.wordId).trim());
    }
    if (params?.userId !== undefined && params?.userId !== null && String(params.userId).trim()) {
      query.set('userId', String(params.userId).trim());
    }
    return this.request(`/api/admin/error-reports?${query.toString()}`);
  }

  async adminUpdateErrorReport(
    id: string | number,
    data: { status?: 'pending' | 'resolved' | 'dismissed'; admin_note?: string },
  ): Promise<{ ok: boolean; updated?: boolean }> {
    return this.request(`/api/admin/error-reports/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async adminDeleteErrorReport(id: string | number): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/error-reports/${id}`, { method: 'DELETE' });
  }

  async adminGetErrorReportStats(): Promise<{ pending: number; resolved: number; dismissed: number }> {
    return this.request(`/api/admin/error-reports/stats`);
  }
}

export const dataService = new DataService();
