import { useCallback, useRef, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { AppProvider, useApp } from '@/context/AppContext';
import { LoginPage } from '@/pages/LoginPage';
import { HomePage } from '@/pages/HomePage';
import { LessonListPage } from '@/pages/LessonListPage';
import { WordListPage } from '@/pages/WordListPage';
import { StudyPage } from '@/pages/StudyPage';
import { SentencePage } from '@/pages/SentencePage';
import { SentenceListPage } from '@/pages/SentenceListPage';
import { UnitPage } from '@/pages/UnitPage';
import { SentenceBookPage } from '@/pages/SentenceBookPage';
import { VocabularyPage } from '@/pages/VocabularyPage';
import { AdminPage } from '@/pages/AdminPage';
import { AccountPage } from '@/pages/AccountPage';
import type { VocabularyItem, Word } from '@/types';

// 页面类型
type PageType =
  | 'login'
  | 'home'
  | 'lessons'
  | 'unit'
  | 'sentenceList'
  | 'wordList'
  | 'study'
  | 'sentences'
  | 'vocabulary'
  | 'sentenceBook'
  | 'admin'
  | 'account'
  | 'review';

// 主应用组件
function AppContent() {
  const { currentUser, selectTextbook, selectLesson } = useApp();
  const [currentPage, setCurrentPage] = useState<PageType>('login');
  // 真实访问历史：返回走栈，而不是按父子层级硬退
  const pageStackRef = useRef<PageType[]>([]);
  const pageRef = useRef<PageType>('login');

  const nav = useCallback((next: PageType) => {
    if (pageRef.current === next) return;
    pageStackRef.current.push(pageRef.current);
    pageRef.current = next;
    setCurrentPage(next);
  }, []);

  const back = useCallback(() => {
    const prev = pageStackRef.current.pop();
    const target = prev ?? 'home';
    pageRef.current = target;
    setCurrentPage(target);
  }, []);
  const [sessionStudyWords, setSessionStudyWords] = useState<VocabularyItem['word'][]>([]);
  const [sessionSpeed, setSessionSpeed] = useState<number>(1.0);
  // 答错时的额外停留时间（毫秒），0 表示不自动跳下一题
  const [sessionWrongDelay, setSessionWrongDelay] = useState<number>(1500);
  // 复习批次队列：按记忆曲线分批，逐批复习
  const [reviewBatches, setReviewBatches] = useState<Word[][]>([]);
  const [reviewBatchIndex, setReviewBatchIndex] = useState(0);

  // 登录成功
  const handleLogin = () => {
    pageStackRef.current = [];
    pageRef.current = 'home';
    setCurrentPage('home');
  };

  // 选择课本
  const handleSelectTextbook = (textbookId: string) => {
    selectTextbook(textbookId);
    nav('lessons');
  };

  // 选择课程
  const handleSelectLesson = async (lessonId: string) => {
    await selectLesson(lessonId);
    nav('unit');
  };

  // 行内"单词"：直接进单词学习页，跳过单元总览
  const handleOpenWords = async (lessonId: string) => {
    await selectLesson(lessonId);
    nav('wordList');
  };

  // 行内"句子"：进句子列表（与单词一样先看列表，再开始练习）
  const handleOpenSentences = async (lessonId: string) => {
    await selectLesson(lessonId);
    nav('sentenceList');
  };

  // 开始学习
  const handleStartStudy = (words?: VocabularyItem['word'][], speed?: number, wrongDelay?: number) => {
    if (words) {
      setSessionStudyWords(words);
    } else {
      setSessionStudyWords([]);
    }
    if (speed) {
      setSessionSpeed(speed);
    } else {
      setSessionSpeed(1.0);
    }
    if (typeof wrongDelay === 'number') {
      setSessionWrongDelay(wrongDelay);
    } else {
      setSessionWrongDelay(1500);
    }
    nav('study');
  };

  // 学习完成
  const handleStudyComplete = () => {
    nav('vocabulary');
  };

  // 进入生字本
  const handleGoToVocabulary = () => {
    nav('vocabulary');
  };

  // 开始复习：接收已按记忆曲线分好的批次
  const handleStartReview = (batches: Word[][]) => {
    if (!batches || batches.length === 0) return;
    setReviewBatches(batches);
    setReviewBatchIndex(0);
    nav('review');
  };

  // 复习完成（含单批完成）：若还有下一批则继续，否则回到生字本
  const handleReviewComplete = () => {
    if (reviewBatchIndex + 1 < reviewBatches.length) {
      setReviewBatchIndex((i) => i + 1);
    } else {
      setReviewBatches([]);
      setReviewBatchIndex(0);
      nav('vocabulary');
    }
  };

  // 进入后台管理
  const handleGoToAdmin = () => {
    nav('admin');
  };

  // 进入账号管理
  const handleGoToAccount = () => {
    nav('account');
  };

  // 返回上一页：走真实历史栈
  const handleGoBack = () => back();

  // 渲染当前页面
  const renderPage = () => {
    // 未登录，显示登录页
    if (!currentUser) {
      return <LoginPage onLogin={handleLogin} />;
    }

    switch (currentPage) {
      case 'login':
        return <LoginPage onLogin={handleLogin} />;

      case 'home':
        return (
          <HomePage
            onSelectTextbook={handleSelectTextbook}
            onGoToVocabulary={handleGoToVocabulary}
            onGoToAdmin={handleGoToAdmin}
            onGoToAccount={handleGoToAccount}
          />
        );

      case 'lessons':
        return (
          <LessonListPage
            onGoBack={handleGoBack}
            onSelectLesson={handleSelectLesson}
            onOpenWords={handleOpenWords}
            onOpenSentences={handleOpenSentences}
          />
        );

      case 'unit':
        return (
          <UnitPage
            onGoBack={handleGoBack}
            onOpenWords={() => nav('wordList')}
            onOpenSentences={() => nav('sentenceList')}
          />
        );

      case 'wordList':
        return (
          <WordListPage
            onGoBack={handleGoBack}
            onStartStudy={handleStartStudy}
            onGoUnit={() => nav('unit')}
          />
        );

      case 'study':
        return (
          <StudyPage
            onGoBack={handleGoBack}
            onComplete={handleStudyComplete}
            reviewWords={sessionStudyWords.length > 0 ? sessionStudyWords : undefined}
            sessionSpeed={sessionSpeed}
            wrongDelay={sessionWrongDelay}
          />
        );

      case 'sentenceList':
        return (
          <SentenceListPage
            onGoBack={handleGoBack}
            onGoUnit={() => nav('unit')}
            onStartPractice={() => nav('sentences')}
          />
        );

      case 'sentences':
        return <SentencePage onGoBack={handleGoBack} onGoUnit={() => nav('unit')} />;

      case 'sentenceBook':
        return (
          <SentenceBookPage
            onGoBack={handleGoBack}
            onOpenLessonSentences={handleOpenSentences}
          />
        );

      case 'vocabulary':
        return (
          <VocabularyPage
            onGoBack={handleGoBack}
            onStartReview={handleStartReview}
            onOpenSentenceBook={() => nav('sentenceBook')}
          />
        );

      case 'review':
        return (
          <StudyPage
            onGoBack={handleGoBack}
            onComplete={handleReviewComplete}
            reviewWords={reviewBatches[reviewBatchIndex] ?? []}
            isReviewMode={true}
            reviewBatchLabel={
              reviewBatches.length > 1
                ? `第 ${reviewBatchIndex + 1}/${reviewBatches.length} 批`
                : undefined
            }
          />
        );

      case 'admin':
        return (
          <AdminPage
            onGoBack={handleGoBack}
          />
        );

      case 'account':
        return (
          <AccountPage
            onGoBack={handleGoBack}
          />
        );

      default:
        return (
          <HomePage
            onSelectTextbook={handleSelectTextbook}
            onGoToVocabulary={handleGoToVocabulary}
            onGoToAdmin={handleGoToAdmin}
            onGoToAccount={handleGoToAccount}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderPage()}
      <Toaster position="top-center" />
    </div>
  );
}

// 根组件
function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
