import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { AppProvider, useApp } from '@/context/AppContext';
import { LoginPage } from '@/pages/LoginPage';
import { HomePage } from '@/pages/HomePage';
import { LessonListPage } from '@/pages/LessonListPage';
import { WordListPage } from '@/pages/WordListPage';
import { StudyPage } from '@/pages/StudyPage';
import { SentencePage } from '@/pages/SentencePage';
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
  const [sessionStudyWords, setSessionStudyWords] = useState<VocabularyItem['word'][]>([]);
  const [sessionSpeed, setSessionSpeed] = useState<number>(1.0);
  // 答错时的额外停留时间（毫秒），0 表示不自动跳下一题
  const [sessionWrongDelay, setSessionWrongDelay] = useState<number>(1500);
  // 复习批次队列：按记忆曲线分批，逐批复习
  const [reviewBatches, setReviewBatches] = useState<Word[][]>([]);
  const [reviewBatchIndex, setReviewBatchIndex] = useState(0);

  // 登录成功
  const handleLogin = () => {
    setCurrentPage('home');
  };

  // 选择课本
  const handleSelectTextbook = (textbookId: string) => {
    selectTextbook(textbookId);
    setCurrentPage('lessons');
  };

  // 选择课程
  const handleSelectLesson = async (lessonId: string) => {
    await selectLesson(lessonId);
    setCurrentPage('unit');
  };

  // 直接从单元列表进入句子练习
  const handleOpenSentences = async (lessonId: string) => {
    await selectLesson(lessonId);
    setCurrentPage('sentences');
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
    setCurrentPage('study');
  };

  // 学习完成
  const handleStudyComplete = () => {
    setCurrentPage('vocabulary');
  };

  // 进入生字本
  const handleGoToVocabulary = () => {
    setCurrentPage('vocabulary');
  };

  // 从生句本进入某个单元的句子练习
  const handleOpenLessonSentences = async (lessonId: string) => {
    await selectLesson(lessonId);
    setCurrentPage('sentences');
  };

  // 开始复习：接收已按记忆曲线分好的批次
  const handleStartReview = (batches: Word[][]) => {
    if (!batches || batches.length === 0) return;
    setReviewBatches(batches);
    setReviewBatchIndex(0);
    setCurrentPage('review');
  };

  // 复习完成（含单批完成）：若还有下一批则继续，否则回到生字本
  const handleReviewComplete = () => {
    if (reviewBatchIndex + 1 < reviewBatches.length) {
      setReviewBatchIndex((i) => i + 1);
    } else {
      setReviewBatches([]);
      setReviewBatchIndex(0);
      setCurrentPage('vocabulary');
    }
  };

  // 进入后台管理
  const handleGoToAdmin = () => {
    setCurrentPage('admin');
  };

  // 进入账号管理
  const handleGoToAccount = () => {
    setCurrentPage('account');
  };

  // 返回上一页
  const handleGoBack = () => {
    switch (currentPage) {
      case 'lessons':
        setCurrentPage('home');
        break;
      case 'unit':
        setCurrentPage('lessons');
        break;
      case 'wordList':
        setCurrentPage('unit');
        break;
      case 'study':
        setCurrentPage('wordList');
        break;
      case 'sentences':
        setCurrentPage('wordList');
        break;
      case 'vocabulary':
        setCurrentPage('home');
        break;
      case 'sentenceBook':
        setCurrentPage('vocabulary');
        break;
      case 'review':
        setCurrentPage('vocabulary');
        break;
      case 'admin':
        setCurrentPage('home');
        break;
      case 'account':
        setCurrentPage('home');
        break;
    }
  };

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
            onOpenSentences={handleOpenSentences}
          />
        );

      case 'unit':
        return (
          <UnitPage
            onGoBack={handleGoBack}
            onOpenWords={() => setCurrentPage('wordList')}
            onOpenSentences={() => setCurrentPage('sentences')}
          />
        );

      case 'wordList':
        return (
          <WordListPage
            onGoBack={handleGoBack}
            onStartStudy={handleStartStudy}
            onStartSentences={() => setCurrentPage('sentences')}
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

      case 'sentences':
        return <SentencePage onGoBack={handleGoBack} />;

      case 'sentenceBook':
        return (
          <SentenceBookPage
            onGoBack={handleGoBack}
            onOpenLessonSentences={handleOpenLessonSentences}
          />
        );

      case 'vocabulary':
        return (
          <VocabularyPage
            onGoBack={handleGoBack}
            onStartReview={handleStartReview}
            onOpenSentenceBook={() => setCurrentPage('sentenceBook')}
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
