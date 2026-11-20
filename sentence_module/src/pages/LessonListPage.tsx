import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  BookOpen, 
  Play,
  List,
  MessagesSquare,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

interface LessonListPageProps {
  onGoBack: () => void;
  onSelectLesson: (lessonId: string) => void;
  onOpenSentences?: (lessonId: string) => void;
}

export function LessonListPage({ onGoBack, onSelectLesson, onOpenSentences }: LessonListPageProps) {
  const { selectedTextbook } = useApp();

  if (!selectedTextbook) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">请先选择课本</p>
          <Button onClick={onGoBack} className="mt-4">
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  const lessons = [...selectedTextbook.lessons].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

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
              {selectedTextbook.name}
            </h1>
            <p className="text-xs text-gray-500">选择课程开始学习</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 课本信息卡片 */}
        <Card className="mb-6 bg-gradient-to-r from-blue-500 to-indigo-600 border-0 text-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{selectedTextbook.name}</h2>
                <p className="text-blue-100 text-sm mt-0.5">{selectedTextbook.publisher}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-white/20 text-white border-0">
                    {selectedTextbook.grade}
                  </Badge>
                  <Badge className="bg-white/20 text-white border-0">
                    {lessons.length} 课
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 课程列表 */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">课程列表</h3>
          
          {lessons.map((lesson, index) => (
            <Card
              key={lesson.id}
              className="cursor-pointer transition-all hover:shadow-md hover:border-blue-300"
              onClick={() => onSelectLesson(lesson.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* 序号 */}
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold">{index + 1}</span>
                  </div>
                  
                  {/* 课程信息 */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                      {lesson.name}
                    </h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <List className="w-3.5 h-3.5" />
                        {(lesson.wordCount ?? lesson.words?.length ?? 0)} 个单词
                      </span>
                      {(lesson.sentenceCount ?? 0) > 0 && (
                        <span className="text-sm text-amber-600 flex items-center gap-1">
                          <MessagesSquare className="w-3.5 h-3.5" />
                          {lesson.sentenceCount} 句
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2">
                    {(lesson.sentenceCount ?? 0) > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSentences?.(lesson.id);
                        }}
                      >
                        <MessagesSquare className="w-4 h-4 mr-1" />
                        句子
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLesson(lesson.id);
                      }}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      学习
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {lessons.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">该课本暂无课程</p>
          </div>
        )}
      </main>
    </div>
  );
}
