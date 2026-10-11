'use client';
import { useEffect, useState, useRef } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Lock,
  Bookmark,
  MessageSquare,
  FileText,
  Video,
  GitPullRequest,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress as ProgressBar } from '@/components/ui/progress';
import { api, type Boot, type Lesson, date } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { Player } from './player';
import { LessonMarkdown, LessonNotes } from './lms-shared';
import { AlgorithmLibrary } from './algorithm-library';
import interviewCatalog from '@/content/interview-catalog.json';
import {
  INTERVIEW_COURSE_ID,
  isKnowledgeLesson,
} from '@/lib/interview-curriculum';
import { KnowledgeExercises } from './knowledge-exercises';
import '@/app/knowledge-exercises.css';
import '@/app/study-library.css';
import '@/app/oa-library.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
export type Navigate = (view: string, extra?: Record<string, string>) => void;
export function CourseList({
  boot,
  navigate,
  login,
  ask,
  knowledge = false,
}: {
  boot: Boot;
  navigate: Navigate;
  login: () => void;
  ask: (context: Record<string, string>) => void;
  knowledge?: boolean;
}) {
  const t = useT(),
    // "3 篇" / "3 topics": English needs a plural, the Chinese text is unchanged.
    count = (n: number, zh: string, en: string) =>
      `${n} ${t(zh, n === 1 ? en : en + 's')}`;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <Heading
        label={knowledge ? 'ALGORITHMS' : 'THE CURRICULUM'}
        title={
          knowledge
            ? t('算法知识点', 'Algorithm Concepts')
            : t('我的课程', 'My Courses')
        }
        description={
          knowledge
            ? t(
                '原理、推导、代码与练习。按主题查阅，也可以从基础开始读。',
                'Principles, derivations, code and practice. Browse by topic, or start from the basics.',
              )
            : t('课程讲义、视频与配套练习。', 'Course handouts, videos and exercises.')
        }
      />
      {boot.courses
        .filter((c) =>
          knowledge
            ? c.id === INTERVIEW_COURSE_ID
            : c.id !== INTERVIEW_COURSE_ID,
        )
        .map((c) => {
          const done = c.lessons.filter((l) =>
            boot.progress.some((p) => p.lesson_id === l.id && p.completed),
          ).length;
          return (
            <section className="course-detail" key={c.id}>
              <div className="course-detail-head">
                <div>
                  <span className="tag">
                    {knowledge
                      ? t('SDE · 算法知识', 'SDE · Algorithms')
                      : t('SDE · 系列课程', 'SDE · Course series')}
                  </span>
                  <h2>{c.title}</h2>
                  <p>{c.summary}</p>
                  <div className="course-meta">
                    <span>
                      {count(
                        c.lessons.length,
                        knowledge ? '个主题' : '个章节',
                        knowledge ? 'topic' : 'lesson',
                      )}
                    </span>
                    <span>
                      {knowledge
                        ? t('交互图解与题目练习', 'Interactive diagrams and practice problems')
                        : t('配套算法与工程实验', 'Algorithm and engineering labs')}
                    </span>
                    <span>v{c.version}</span>
                  </div>
                </div>
                <div className="course-access">
                  {c.has_access ? (
                    <>
                      <span className="success-text">
                        <Check size={16} />
                        {t('已开通', 'Enrolled')}
                      </span>
                      <span className="muted">
                        {knowledge ? t('已读', 'Read') : t('完成', 'Completed')}{' '}
                        {done} /{' '}
                        {count(
                          c.lessons.length,
                          knowledge ? '篇' : '课',
                          knowledge ? 'topic' : 'lesson',
                        )}
                      </span>
                      <ProgressBar
                        value={
                          c.lessons.length ? (done / c.lessons.length) * 100 : 0
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Button
                        disabled={busy}
                        onClick={async () => {
                          if (!boot.person) {
                            login();
                            return;
                          }
                          if (
                            !(c.purchase_available ?? boot.services.checkout)
                          ) {
                            ask({
                              courseId: c.id,
                              title: t(
                                `申请开通：${c.title}`,
                                `Access request: ${c.title}`,
                              ),
                              body: t(
                                `希望开通「${c.title}」。\n购买记录或需要老师核实的信息：\n`,
                                `I'd like access to "${c.title}".\nPurchase record or details for the teacher to verify:\n`,
                              ),
                            });
                            return;
                          }
                          setBusy(true);
                          setError('');
                          try {
                            const { url } = await api<{ url: string }>(
                              'checkout',
                              {
                                courseId: c.id,
                              },
                            );
                            location.assign(url);
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {(c.purchase_available ?? boot.services.checkout)
                          ? `${t('购买课程', 'Buy course')}${c.price ? ' · ' + c.price.display : ''}`
                          : t('申请开通', 'Request access')}
                        <ArrowRight size={15} />
                      </Button>
                      <small>
                        {t(
                          '现有学员使用购买时的邮箱登录',
                          'Existing students: sign in with the email you purchased with',
                        )}
                      </small>
                    </>
                  )}
                </div>
              </div>
              {error && (
                <div role="alert" className="notice">
                  {t(error, englishMessage(error))}
                </div>
              )}
              <Tabs defaultValue="curriculum">
                <TabsList variant="line">
                  <TabsTrigger value="curriculum">
                    {knowledge
                      ? t('主题目录', 'Topics')
                      : t('课程目录', 'Curriculum')}
                  </TabsTrigger>
                  <TabsTrigger value="about">
                    {knowledge
                      ? t('阅读说明', 'How to use')
                      : t('课程介绍', 'About')}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="curriculum">
                  {[
                    ...new Set(
                      c.lessons.map(
                        (l) => l.section || t('课程内容', 'Course content'),
                      ),
                    ),
                  ].map((section, i) => (
                    <div className="chapter-group" key={section}>
                      <div className="chapter-heading">
                        <span>0{i + 1}</span>
                        <h3>{section}</h3>
                        <small>
                          {count(
                            c.lessons.filter(
                              (l) =>
                                (l.section || t('课程内容', 'Course content')) ===
                                section,
                            ).length,
                            knowledge ? '篇' : '课',
                            knowledge ? 'topic' : 'lesson',
                          )}
                        </small>
                      </div>
                      {c.lessons
                        .filter(
                          (l) =>
                            (l.section || t('课程内容', 'Course content')) ===
                            section,
                        )
                        .map((l) => {
                          const complete = boot.progress.some(
                            (p) => p.lesson_id === l.id && p.completed,
                          );
                          return (
                            <button
                              className="lesson-row"
                              key={l.id}
                              onClick={() =>
                                c.has_access
                                  ? navigate('lesson', { lesson: l.id })
                                  : boot.person
                                    ? ask({
                                        courseId: c.id,
                                        title: t(
                                          `申请开通：${c.title}`,
                                          `Access request: ${c.title}`,
                                        ),
                                        body: t(
                                          `希望学习「${c.title}」，请老师核实并开通课程。`,
                                          `I'd like to take "${c.title}". Please verify and unlock the course for me.`,
                                        ),
                                      })
                                    : login()
                              }
                            >
                              <span
                                className={
                                  'lesson-indicator ' + (complete ? 'done' : '')
                                }
                              >
                                {complete ? (
                                  <Check size={15} />
                                ) : (
                                  String(l.position).padStart(2, '0')
                                )}
                              </span>
                              <span className="lesson-row-title">
                                <strong>{l.title}</strong>
                                <small>{l.summary}</small>
                              </span>
                              <span className="resource-label">
                                <FileText size={13} />
                                {t('讲义', 'Handout')}
                              </span>
                              {!!l.has_video && (
                                <span className="resource-label">
                                  <Video size={13} />
                                  {t('视频', 'Video')}
                                </span>
                              )}
                              {boot.problems.some(
                                (p) =>
                                  p.lessonId === l.id ||
                                  interviewCatalog
                                    .find((chapter) => chapter.id === l.id)
                                    ?.homeworkProblemIds.includes(p.id),
                              ) && (
                                <span className="resource-label">
                                  <Code2 size={13} />
                                  {t('练习', 'Practice')}
                                </span>
                              )}
                              {c.has_access ? (
                                <ChevronRight size={16} />
                              ) : (
                                <Lock size={15} />
                              )}
                            </button>
                          );
                        })}
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="about">
                  <div className="prose-content">
                    <h3>
                      {knowledge
                        ? t('关于这些知识点', 'About these concepts')
                        : t('关于本课程', 'About this course')}
                    </h3>
                    <p>{c.summary}</p>
                    <h3>
                      {knowledge
                        ? t('练习与进度', 'Practice and progress')
                        : t('你会如何学习', "How you'll learn")}
                    </h3>
                    <p>
                      {knowledge
                        ? t(
                            '每篇正文后有配套题目、提示和当前轮次的通过状态。阅读标记与做题进度分别保存；提交通过后，题目会显示绿色勾选。',
                            'Each article ends with practice problems, hints and your status in the current round. Reading marks and practice progress are saved separately; once a submission is accepted, the problem gets a green check.',
                          )
                        : t(
                            '先读讲义理解业务规则，再跟随配套代码完成工程练习。算法题在独立判题环境运行，项目作业通过 GitHub 仓库或 PR 交给老师评审。遇到问题时，直接从当前章节发起私密工单。',
                            'Read the handout to learn the business rules, then follow the companion code to finish the engineering exercises. Algorithm problems run in an isolated judge; project work goes to a teacher for review as a GitHub repo or PR. When you get stuck, open a private ticket right from the current lesson.',
                          )}
                    </p>
                    <h3>
                      {knowledge
                        ? t('访问权限', 'Access')
                        : t('课程权益', "What's included")}
                    </h3>
                    <p>
                      {knowledge
                        ? t(
                            '已开通的学员可以阅读讲义、保存笔记，并在原有算法题库权限内完成配套练习。',
                            'Enrolled students can read the handouts, save notes, and do the practice problems within their existing Problem Bank access.',
                          )
                        : t(
                            '现有付费学员由老师按原购买记录开通当前 SDE 课程。视频按章节发布；课件修订会记录版本并在课程更新中说明。新增课程单独授权。',
                            'Teachers unlock the current SDE course for existing paid students based on their original purchase. Videos are released lesson by lesson; handout revisions are versioned and explained in course updates. New courses are licensed separately.',
                          )}
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
              {!c.lessons.length && (
                <p className="quiet-empty">
                  {t(
                    '老师正在准备课程内容，发布后会出现在这里。',
                    'The teacher is preparing this course. Lessons will appear here once published.',
                  )}
                </p>
              )}
            </section>
          );
        })}
    </>
  );
}
export function Heading({
  label,
  title,
  description,
  action,
}: {
  label?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {label && <p className="eyebrow">{label}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <BookOpen size={30} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function LessonReader({
  id,
  boot,
  navigate,
  ask,
  refresh,
}: {
  id: string;
  boot: Boot;
  navigate: Navigate;
  ask: (context: Record<string, string>) => void;
  refresh: () => Promise<void>;
}) {
  const t = useT();
  const [lesson, setLesson] = useState<Lesson | null>(null),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [loadRetry, setLoadRetry] = useState(0),
    [tab, setTab] = useState(
      !isKnowledgeLesson(id) &&
        new URLSearchParams(
          typeof location === 'undefined' ? '' : location.search,
        ).has('t')
        ? 'video'
        : 'handout',
    ),
    [historyVersion, setHistoryVersion] = useState(''),
    [historyBody, setHistoryBody] = useState<string | null>(null),
    [historyError, setHistoryError] = useState('');
  const pos = useRef(0);
  useEffect(() => {
    let active = true;
    api<Lesson>('lessons/' + id)
      .then((l) => {
        if (active) {
          setLesson(l);
          pos.current = l.progress?.position || 0;
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id, loadRetry]);
  useEffect(() => {
    if (!historyVersion) return;
    let active = true;
    api<{ body: string }>(
      `lms/lessons/${encodeURIComponent(id)}/versions/${encodeURIComponent(historyVersion)}`,
    )
      .then((data) => {
        if (active) setHistoryBody(data.body);
      })
      .catch((e) => {
        if (active) setHistoryError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, historyVersion]);
  async function save(data: Record<string, unknown>) {
    setSaving(true);
    setError('');
    try {
      await api('progress', { lessonId: id, ...data });
      setLesson((l) =>
        l
          ? {
              ...l,
              progress: {
                lesson_id: id,
                completed: l.progress?.completed || 0,
                position: l.progress?.position || 0,
                note: l.progress?.note || '',
                bookmarked: l.progress?.bookmarked || 0,
                ...l.progress,
                updated_at: Date.now(),
                ...data,
                ...(typeof data.completed === 'boolean'
                  ? { completed: data.completed ? 1 : 0 }
                  : {}),
                ...(typeof data.bookmarked === 'boolean'
                  ? { bookmarked: data.bookmarked ? 1 : 0 }
                  : {}),
              },
            }
          : l,
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  if (error && !lesson)
    return (
      <Empty
        title={t(error, englishMessage(error))}
        action={
          <div className="form-actions">
            <Button
              onClick={() => {
                setError('');
                setLoadRetry((n) => n + 1);
              }}
            >
              {t('重新加载', 'Reload')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigate(isKnowledgeLesson(id) ? 'knowledge' : 'courses')
              }
            >
              {isKnowledgeLesson(id)
                ? t('返回知识点', 'Back to concepts')
                : t('返回课程', 'Back to course')}
            </Button>
          </div>
        }
      />
    );
  if (!lesson)
    return (
      <div className="loading-state">{t('正在加载课件…', 'Loading handout…')}</div>
    );
  const course = boot.courses.find((c) => c.id === lesson.course_id),
    all = course?.lessons || [],
    interviewChapter = interviewCatalog.find((chapter) => chapter.id === id),
    related = boot.problems.filter(
      (p) =>
        p.lessonId === id ||
        interviewChapter?.homeworkProblemIds.includes(p.id),
    ),
    next = all[all.findIndex((l) => l.id === id) + 1];
  return (
    <>
      <div className="breadcrumb">
        <button
          onClick={() => navigate(interviewChapter ? 'knowledge' : 'courses')}
        >
          {interviewChapter
            ? t('算法知识点', 'Algorithm Concepts')
            : course?.title || t('我的课程', 'My Courses')}
        </button>
        <ChevronRight size={14} />
        <span>
          {interviewChapter ? t('主题', 'Topic') : t('第', 'Lesson')}{' '}
          {String(lesson.position).padStart(2, '0')}
          {interviewChapter ? '' : t(' 课', '')}
        </span>
      </div>
      <div className="reader-heading">
        <div>
          <span className="eyebrow">
            {lesson.section} · v{lesson.version}
          </span>
          <h1>{lesson.title}</h1>
        </div>
        <Button
          variant="outline"
          aria-label={
            lesson.progress?.bookmarked
              ? t('取消收藏', 'Remove bookmark')
              : t('收藏章节', 'Bookmark lesson')
          }
          disabled={saving}
          onClick={() => save({ bookmarked: !lesson.progress?.bookmarked })}
        >
          <Bookmark
            fill={lesson.progress?.bookmarked ? 'currentColor' : 'none'}
            size={16}
          />
        </Button>
      </div>
      <div className="learning-layout">
        <section className="reader-card">
          <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
            <TabsList variant="line" className="reader-tabs">
              <TabsTrigger value="handout">
                <FileText size={15} />
                {interviewChapter
                  ? t('知识讲解', 'Explanation')
                  : t('课件', 'Handout')}
              </TabsTrigger>
              {!interviewChapter && (
                <TabsTrigger value="video">
                  <Video size={15} />
                  {t('课程视频', 'Video')}
                </TabsTrigger>
              )}
              <TabsTrigger value="notes">
                <Bookmark size={15} />
                {t('我的笔记', 'My notes')}
              </TabsTrigger>
              {!interviewChapter && (
                <TabsTrigger value="practice">
                  <Code2 size={15} />
                  {t('课后练习', 'Practice')}
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="handout">
              <LessonMarkdown body={lesson.body || ''} lecture />
              {interviewChapter && (
                <KnowledgeExercises
                  lessonId={id}
                  navigate={navigate}
                  userId={boot.person?.id}
                />
              )}
            </TabsContent>
            <TabsContent value="video">
              {lesson.has_video ? (
                <Player
                  lessonId={id}
                  position={lesson.progress?.position || 0}
                  assetId={lesson.progress?.video_asset_id}
                  onProgress={(n, assetId) => {
                    pos.current = n;
                    setLesson((current) =>
                      current
                        ? {
                            ...current,
                            progress: {
                              lesson_id: id,
                              completed: 0,
                              note: '',
                              bookmarked: 0,
                              updated_at: Date.now(),
                              ...current.progress,
                              position: n,
                              video_asset_id: assetId,
                            },
                          }
                        : current,
                    );
                    api('progress', {
                      lessonId: id,
                      position: n,
                      videoAssetId: assetId,
                    }).catch((e) => setError(e.message));
                  }}
                />
              ) : (
                <Empty
                  title={t(
                    '课件已开放，视频待发布',
                    'The handout is out; the video is coming soon',
                  )}
                  description={t(
                    '可以先阅读本章讲义。老师发布视频后，会出现在课程更新中。',
                    'Start with the handout for this lesson. Once the teacher publishes the video, it will show up in course updates.',
                  )}
                />
              )}
            </TabsContent>
            <TabsContent value="notes">
              <LessonNotes
                userId={boot.person!.id}
                lessonId={id}
                initial={lesson.progress?.note || ''}
                onSaved={(note) =>
                  setLesson((current) =>
                    current
                      ? {
                          ...current,
                          progress: {
                            lesson_id: id,
                            completed: 0,
                            position: 0,
                            bookmarked: 0,
                            updated_at: Date.now(),
                            ...current.progress,
                            note,
                          },
                        }
                      : current,
                  )
                }
              />
            </TabsContent>
            <TabsContent value="practice">
              <div className="practice-pane">
                <h3>{t('算法练习', 'Algorithm practice')}</h3>
                {related.length ? (
                  related.map((p) => (
                    <button
                      className="lesson-row"
                      key={p.id}
                      onClick={() => navigate('problem', { problem: p.id })}
                    >
                      <Code2 size={18} />
                      <span>{p.title}</span>
                      <span className="difficulty">
                        {t(
                          p.difficulty,
                          { 简单: 'Easy', 中等: 'Medium', 困难: 'Hard' }[
                            p.difficulty
                          ],
                        )}
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))
                ) : (
                  <p className="muted">
                    {interviewChapter
                      ? t(
                          '请先取得对应算法题库的课程权限，再完成讲义中的训练。',
                          'Get access to the matching Problem Bank course first, then do the exercises in this lesson.',
                        )
                      : t(
                          '本章先完成讲义中的工程练习，也可以进入算法题库巩固基础。',
                          'Start with the engineering exercises in the handout, or strengthen the basics in the Problem Bank.',
                        )}
                  </p>
                )}
                {!interviewChapter && (
                  <>
                    <h3>{t('提交工程作业', 'Submit your project')}</h3>
                    <p className="muted">
                      {t(
                        '把你的实现提交到 GitHub 仓库或 PR，交给老师评审。',
                        'Submit your implementation as a GitHub repo or PR for teacher review.',
                      )}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => navigate('reviews', { lesson: id })}
                    >
                      <GitPullRequest size={16} />
                      {t('提交作业', 'Submit assignment')}
                    </Button>
                  </>
                )}
                {interviewChapter && (
                  <p className="muted">
                    {t(
                      '按讲义中的训练目标完成作业，提交后查看判题结果。复盘时在「我的笔记」记录不变量、复杂度和一个容易遗漏的边界条件。',
                      'Work toward the goals in the lesson and check the judge results after you submit. When you review, use "My notes" to record the invariant, the complexity and one easy-to-miss edge case.',
                    )}
                  </p>
                )}
                <Button variant="ghost" onClick={() => navigate('problems')}>
                  {t('浏览算法题库', 'Browse Problem Bank')}
                  <ArrowRight size={15} />
                </Button>
              </div>
            </TabsContent>
          </Tabs>
          {error && (
            <div role="alert" className="notice error">
              {t(error, englishMessage(error))}
            </div>
          )}
          <footer className="reader-footer">
            <Button
              variant={lesson.progress?.completed ? 'secondary' : 'default'}
              disabled={saving}
              onClick={() => save({ completed: !lesson.progress?.completed })}
            >
              <Check size={16} />
              {interviewChapter
                ? lesson.progress?.completed
                  ? t('已读', 'Read')
                  : t('标记已读', 'Mark as read')
                : lesson.progress?.completed
                  ? t('已完成本课', 'Lesson completed')
                  : t('标记本课完成', 'Mark lesson complete')}
            </Button>
            {next && (
              <Button
                variant="ghost"
                onClick={() => navigate('lesson', { lesson: next.id })}
              >
                {interviewChapter
                  ? t('下一知识点', 'Next concept')
                  : t('下一课', 'Next lesson')}
                <ArrowRight size={16} />
              </Button>
            )}
          </footer>
        </section>
        <aside className="reader-aside">
          <div className="side-card">
            <h3>{t('学习目录', 'Contents')}</h3>
            <div className="mini-curriculum">
              {all.map((l) => (
                <button
                  key={l.id}
                  className={l.id === id ? 'current' : ''}
                  onClick={() => navigate('lesson', { lesson: l.id })}
                >
                  <span>{String(l.position).padStart(2, '0')}</span>
                  <span>{l.title}</span>
                  {boot.progress.some(
                    (p) => p.lesson_id === l.id && p.completed,
                  ) && <Check size={12} />}
                </button>
              ))}
            </div>
          </div>
          <div className="help-card">
            <MessageSquare size={22} />
            <h3>
              {interviewChapter
                ? t('问题与反馈', 'Questions and feedback')
                : t('卡住了？一起解决。', "Stuck? Let's work it out.")}
            </h3>
            <p>
              {interviewChapter
                ? t(
                    '问题仅你和老师可见，会附上当前知识点。',
                    'Only you and the teacher can see your question. The current concept is attached.',
                  )
                : t(
                    '问题仅你和老师可见，会附上当前章节与播放位置。',
                    'Only you and the teacher can see your question. The current lesson and video position are attached.',
                  )}
            </p>
            <Button
              variant="outline"
              onClick={() =>
                ask({
                  lessonId: id,
                  videoPosition: String(Math.floor(pos.current)),
                  ...(lesson.progress?.video_asset_id
                    ? { videoAssetId: lesson.progress.video_asset_id }
                    : {}),
                })
              }
            >
              {t('向老师提问', 'Ask the teacher')}
              <ArrowRight size={15} />
            </Button>
          </div>
          <div className="side-card">
            <h3>{t('课件版本', 'Handout versions')}</h3>
            {lesson.versions?.slice(0, 5).map((v) => (
              <button
                className="version-line lms-version-link"
                key={v.version}
                onClick={() => {
                  setHistoryBody(null);
                  setHistoryError('');
                  setHistoryVersion(v.version);
                }}
              >
                <span>v{v.version}</span>
                <span>{date(v.created_at)}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
      <Dialog
        open={!!historyVersion}
        onOpenChange={(open) => !open && setHistoryVersion('')}
      >
        <DialogContent className="wide-dialog lms-history-dialog">
          <DialogHeader>
            <DialogTitle>
              {t('课件', 'Handout')} v{historyVersion}
            </DialogTitle>
            <DialogDescription>
              {t(
                '查看已发布的历史课件，当前学习进度保持不变。',
                'Viewing an earlier published handout. Your current progress stays the same.',
              )}
            </DialogDescription>
          </DialogHeader>
          {historyError ? (
            <p role="alert" className="error-text">
              {t(historyError, englishMessage(historyError))}
            </p>
          ) : historyBody === null ? (
            <output>{t('正在加载版本…', 'Loading version…')}</output>
          ) : (
            <LessonMarkdown body={historyBody} lecture />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
export function ProblemList({
  boot,
  navigate,
  library,
}: {
  boot: Boot;
  navigate: Navigate;
  library?: string;
}) {
  return (
    <AlgorithmLibrary
      key={boot.person?.id || 'anonymous'}
      navigate={navigate}
      collection={library}
      availableProblemIds={boot.problems.map((problem) => problem.id)}
      activity={boot.activity || []}
      signedIn={!!boot.person}
    />
  );
}
export { ProblemWorkspace } from './problem-workspace';
