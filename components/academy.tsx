'use client';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Activity,
  BarChart3,
  Library,
  MessagesSquare,
  MessageCircle,
  ScrollText,
  BookOpen,
  Code2,
  LifeBuoy,
  Bell,
  Languages,
  ArrowRight,
  Terminal,
  Search,
  Settings,
  Inbox,
  Dices,
  BookUser,
  Timer,
  TrendingUp,
  ListChecks,
  UsersRound,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { openCommandPalette, PaletteKey } from './command-palette';
import {
  api,
  bootIdentity,
  mergeLiteBoot,
  type Boot,
} from '@/lib/types';
import {
  CourseList,
  LessonReader,
  ProblemList,
  ProblemWorkspace,
  Empty,
  loadFailed,
  type Navigate,
} from './learning';
import { JudgeStatus } from './judge-status';
import { setLocale, useLocale, useT } from '@/lib/i18n';
import { pageView as beaconPageView, track } from '@/lib/analytics';
import { englishMessage } from '@/lib/messages-en';
import { ContentDetail, ContentList, contentSection } from './content-library';
import { StoryBank } from './story-bank';
import { WorkspaceIntro } from './workspace-intro';
import { workspaceTitle } from '@/lib/seo';
import { problemTitle } from '@/lib/problems';
import {
  TicketComposer,
  TicketView,
  ReviewsView,
  ReleasesView,
} from './support';
import { LoginDialog, AccountView } from './account';
import { registerAcademyTools } from '@/lib/webmcp';
import Link from 'next/link';
import { CheckoutFeedback } from './checkout-feedback';
import { EnrollmentClaim } from './enrollment';
import { NotificationsPane } from './lms-notifications';
import { ThemeToggle } from './theme-toggle';
import '@/app/lms.css';
import {
  INTERVIEW_COURSE_ID,
  isKnowledgeLesson,
} from '@/lib/interview-curriculum';
// Teacher-only screens load on first visit instead of shipping in the main chunk.
const TeacherView = lazy(() =>
  import('./teacher').then((m) => ({ default: m.TeacherView }), loadFailed),
);
const MockInterview = lazy(() =>
  import('./mock-interview').then((m) => ({ default: m.MockInterview }), loadFailed),
);
const MockOa = lazy(() =>
  import('./mock-oa').then((m) => ({ default: m.MockOa }), loadFailed),
);
const MyProgress = lazy(() =>
  import('./my-progress').then((m) => ({ default: m.MyProgress }), loadFailed),
);
const MyLists = lazy(() =>
  import('./my-lists').then((m) => ({ default: m.MyLists }), loadFailed),
);
const StudyGroups = lazy(() =>
  import('./study-groups').then((m) => ({ default: m.StudyGroups }), loadFailed),
);
const DiscussBoard = lazy(() =>
  import('./discuss-board').then((m) => ({ default: m.DiscussBoard }), loadFailed),
);
const Speedrun = lazy(() =>
  import('./speedrun').then((m) => ({ default: m.Speedrun }), loadFailed),
);
const OwnerMetrics = lazy(() =>
  import('./owner-metrics').then((m) => ({ default: m.OwnerMetrics }), loadFailed),
);
// Practice is the product's centre: the problem bank leads and is the landing view.
// [icon, zh label, en label, view]
const nav: [LucideIcon, string, string, string][] = [
  [Code2, '算法题库', 'Problem Bank', 'problems'],
  [Zap, '题型快练', 'Pattern Speedrun', 'speedrun'],
  [Timer, '模拟 OA', 'Mock OA', 'mock'],
  [Activity, '评测状态', 'Status', 'status'],
  [TrendingUp, '我的进度', 'My progress', 'progress'],
  [ListChecks, '我的题单', 'My lists', 'lists'],
  [UsersRound, '学习小组', 'Study groups', 'group'],
  [MessagesSquare, '面试题', 'Interview Questions', 'questions'],
  [Dices, '模拟面试', 'Mock Interview', 'mock-interview'],
  [BookUser, 'STAR 故事库', 'Story Bank', 'stories'],
  [ScrollText, '面经', 'Experiences', 'experiences'],
  [MessageCircle, '讨论区', 'Discuss', 'discuss'],
  [Library, '学习资料', 'Resources', 'resources'],
  [BookOpen, '我的课程', 'My Courses', 'courses'],
  [BookOpen, '算法知识点', 'Algorithm Concepts', 'knowledge'],
  [LifeBuoy, '我的工单', 'Support', 'tickets'],
];
/** Views that only show teaching courses (the knowledge module stays open). */
const courseViews = ['courses'];
const initial: Boot = {
  person: null,
  courses: [],
  problems: [],
  progress: [],
  submissions: [],
  notifications: [],
  services: {},
};
function pageView() {
  const p = new URLSearchParams(location.search),
    view = p.get('view') || 'problems',
    content = view === 'content';
  // Owner dashboard only: GA4 counts these pushState page views itself.
  beaconPageView({
    view,
    type: content ? p.get('type') : null,
    slug: content ? p.get('slug') : null,
  });
}
export function Academy() {
  const locale = useLocale(),
    t = useT();
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);
  const [boot, setBoot] = useState<Boot>(initial),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [view, setView] = useState('problems'),
    [params, setParams] = useState<Record<string, string>>({}),
    [login, setLogin] = useState(false),
    [ticketContext, setTicketContext] = useState<Record<string, string> | null>(
      null,
    ),
    [notificationOpen, setNotificationOpen] = useState(false);
  const refresh = useCallback(async () => {
    const next = await api<Boot>('bootstrap');
    setBoot(next);
    setLoading(false);
    setError('');
  }, []);
  const personId = boot.person?.id,
    identity = bootIdentity(boot);
  // Periodic and post-submission refreshes only need personal data; the problem
  // catalogue stays from the full load unless the identity changed.
  const refreshLite = useCallback(async () => {
    const next = await api<Boot>('bootstrap?lite=1');
    if (bootIdentity(next) !== identity) return refresh();
    setBoot((prev) => mergeLiteBoot(prev, next) ?? prev);
    setError('');
  }, [identity, refresh]);
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- Initial bootstrap and the history subscription synchronize this SPA with external browser state.
    refresh().catch((e) => {
      setError(e.message);
      setLoading(false);
    });
    const sync = () => {
      const p = Object.fromEntries(new URLSearchParams(location.search));
      setParams(p);
      setView(p.view || 'problems');
      pageView();
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [refresh]);
  useEffect(() => {
    const loginAgain = () => setLogin(true);
    window.addEventListener('cswork:auth-required', loginAgain);
    return () => window.removeEventListener('cswork:auth-required', loginAgain);
  }, []);
  useEffect(() => {
    if (!personId) return;
    // A full refresh every 10 minutes picks up newly published problems.
    let lastFull = Date.now();
    const update = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFull < 600000) void refreshLite().catch(() => {});
      else {
        lastFull = Date.now();
        void refresh().catch(() => {});
      }
    };
    const timer = setInterval(update, 45000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [personId, refresh, refreshLite]);
  const navigate: Navigate = useCallback((next, extra = {}) => {
    setView(next);
    setParams({ view: next, ...extra });
    history.pushState(
      null,
      '',
      '/?' +
        new URLSearchParams({ view: next, ...extra }) +
        (new URLSearchParams(location.hash.slice(1)).has('invite')
          ? location.hash
          : ''),
    );
    pageView();
    window.scrollTo({ top: 0, behavior: 'instant' });
    window.dispatchEvent(new Event('cswork:analytics-navigation'));
  }, []);
  const bootRef = useRef(boot);
  useLayoutEffect(() => {
    bootRef.current = boot;
  }, [boot]);
  useEffect(
    () => registerAcademyTools(() => bootRef.current, navigate),
    [navigate],
  );
  function ask(context: Record<string, string> = {}) {
    if (!boot.person) {
      setLogin(true);
      return;
    }
    setTicketContext(context);
  }
  const selectedProblem = boot.problems.find((p) => p.id === params.problem),
    // An opened library item belongs to its list's menu entry.
    navView = view === 'content' ? contentSection(params.type) : view,
    current = nav.find((n) => n[3] === navView),
    unread =
      boot.unreadNotifications ??
      boot.notifications.filter((n) => !n.read_at).length;
  // The server omits teaching courses hidden from this account (owner-only mode).
  const coursesHidden =
    !loading && !boot.courses.some((c) => c.id !== INTERVIEW_COURSE_ID);
  const heading =
    (current && t(current[1], current[2])) ||
    (
      {
        lesson: isKnowledgeLesson(params.lesson)
          ? t('算法知识点', 'Algorithm Concepts')
          : t('课程学习', 'Course'),
        problem: t('算法题库', 'Problem Bank'),
        reviews: t('代码评审', 'Code reviews'),
        releases: t('课程更新', 'Course updates'),
        teacher: t('教师工作台', 'Teacher dashboard'),
        metrics: t('运营数据', 'Analytics'),
        account: t('账号设置', 'Account settings'),
      } as Record<string, string>
    )[view] ||
    t('算法题库', 'Problem Bank');
  // The bare landing keeps the server's home title; other views name themselves.
  const pageName = !params.view
    ? undefined
    : view === 'problem' &&
        selectedProblem &&
        // OA English statements only arrive with the detail fetch; don't title an English tab in Chinese.
        (locale === 'zh' || selectedProblem.titleEn)
      ? problemTitle(selectedProblem, locale)
      : heading;
  useEffect(() => {
    document.title = workspaceTitle(locale, pageName);
  }, [locale, pageName]);
  function content() {
    if (loading) return <output className="page-loading">{t('正在加载…', 'Loading…')}</output>;
    if (error && !boot.courses.length)
      return (
        <Empty
          title={t('学习空间暂时无法加载', "Couldn't load your workspace")}
          description={t(error, englishMessage(error))}
          action={
            <Button onClick={() => refresh().catch((e) => setError(e.message))}>
              {t('重新加载', 'Reload')}
            </Button>
          }
        />
      );
    if (
      !boot.person &&
      ![
        'courses', 'knowledge', 'problems', 'problem', 'status',
        'questions', 'experiences', 'resources', 'content', 'mock-interview', 'mock', 'speedrun',
        'discuss',
      ].includes(view)
    )
      return (
        <Empty
          title={t('登录后继续学习', 'Sign in to continue')}
          description={t(
            '进度、笔记与老师的反馈会跟随你的账号保存。',
            'Your progress, notes and teacher feedback are saved to your account.',
          )}
          action={
            <Button onClick={() => setLogin(true)}>
              {t('登录 / 注册', 'Sign in / Sign up')}
              <ArrowRight size={15} />
            </Button>
          }
        />
      );
    // Course content is hidden for this account (owner-only mode): no dead course pages.
    if (
      coursesHidden &&
      (courseViews.includes(view) ||
        (view === 'lesson' && !isKnowledgeLesson(params.lesson)))
    )
      return (
        <Empty
          title={t('课程暂未开放', 'Courses are not open yet')}
          description={t(
            '课程正在整理中，可以先去算法题库刷题。',
            "We're still preparing the courses. Meanwhile, practice in the Problem Bank.",
          )}
          action={
            <Button onClick={() => navigate('problems')}>
              {t('进入算法题库', 'Go to Problem Bank')}
              <ArrowRight size={15} />
            </Button>
          }
        />
      );
    switch (view) {
      case 'courses':
      case 'knowledge':
        return (
          <CourseList
            boot={boot}
            knowledge={view === 'knowledge'}
            navigate={navigate}
            login={() => setLogin(true)}
            ask={ask}
          />
        );
      case 'lesson':
        return (
          <LessonReader
            key={params.lesson}
            id={params.lesson || boot.courses[0]?.lessons[0]?.id || ''}
            boot={boot}
            navigate={navigate}
            ask={ask}
            refresh={refresh}
          />
        );
      case 'problems':
        return (
          <ProblemList
            boot={boot}
            navigate={navigate}
            library={params.library}
          />
        );
      case 'mock':
        return (
          <MockOa key={boot.person?.id || 'guest'} boot={boot} params={params} navigate={navigate} />
        );
      case 'speedrun':
        return <Speedrun key={boot.person?.id || 'guest'} boot={boot} navigate={navigate} />;
      case 'status':
        return <JudgeStatus boot={boot} params={params} navigate={navigate} />;
      case 'progress':
        return (
          <MyProgress
            key={boot.person?.id}
            boot={boot}
            navigate={navigate}
            tab={params.tab}
          />
        );
      case 'lists':
        return <MyLists key={boot.person?.id} boot={boot} navigate={navigate} list={params.list} />;
      case 'group':
        return <StudyGroups key={boot.person?.id} navigate={navigate} params={params} />;
      case 'discuss':
        return <DiscussBoard key={boot.person?.id || 'guest'} params={params} navigate={navigate} signedIn={!!boot.person} />;
      case 'questions':
      case 'experiences':
      case 'resources':
        return <ContentList key={view} section={view} params={params} navigate={navigate} />;
      case 'mock-interview':
        return (
          <MockInterview
            params={params}
            navigate={navigate}
            problemIds={boot.problems.map((p) => p.id)}
            userId={boot.person?.id ?? null}
            ai={!!boot.services?.ai && !!boot.person}
          />
        );
      case 'content':
        return (
          <ContentDetail
            params={params}
            navigate={navigate}
            problemIds={boot.problems.map((p) => p.id)}
            userId={boot.person?.id ?? null}
          />
        );
      case 'stories':
        return <StoryBank key={boot.person!.id} userId={boot.person!.id} />;
      case 'problem':
        return selectedProblem ? (
          <ProblemWorkspace
            key={selectedProblem.id}
            problem={selectedProblem}
            boot={boot}
            navigate={navigate}
            ask={ask}
            refresh={refreshLite}
            mock={params.mock}
            room={params.room}
            tab={params.tab}
          />
        ) : (
          <Empty
            title={t('请选择一道题目', 'Choose a problem')}
            action={
              <Button onClick={() => navigate('problems')}>
                {t('进入题库', 'Go to Problems')}
              </Button>
            }
          />
        );
      case 'tickets':
        return (
          <TicketView
            key={params.ticket || 'list'}
            boot={boot}
            selected={params.ticket}
            navigate={navigate}
            ask={() => ask()}
          />
        );
      case 'reviews':
        return <ReviewsView boot={boot} lessonId={params.lesson} />;
      case 'releases':
        return <ReleasesView navigate={navigate} refresh={refresh} />;
      case 'teacher':
        return boot.person?.role === 'teacher' ? (
          <TeacherView
            key={params.tab || 'teacher'}
            boot={boot}
            navigate={navigate}
            refresh={refresh}
          />
        ) : (
          <Empty
            title={t('仅老师可以访问工作台', 'Only teachers can open the dashboard')}
          />
        );
      case 'metrics':
        // The summary endpoint also checks the role; this only avoids a request that would fail.
        return boot.person?.role === 'teacher' ? (
          <OwnerMetrics navigate={navigate} />
        ) : (
          <Empty title={t('仅老师可以查看运营数据', 'Only teachers can view analytics')} />
        );
      case 'account':
        return <AccountView boot={boot} refresh={refresh} />;
      default:
        // Unknown or stale views fall back to the landing problem bank.
        return (
          <ProblemList boot={boot} navigate={navigate} library={params.library} />
        );
    }
  }
  return (
    <SidebarProvider>
      <CloseMobileNavigation view={view} />
      <Sidebar className="academy-sidebar">
        <SidebarHeader>
          <Link
            className="brand"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('problems');
            }}
          >
            <span className="brand-mark">
              <Terminal size={21} />
            </span>
            <span>
              cs<span className="brand-light">work</span>
              <small>BUILD. LEARN. SHIP.</small>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t('学习空间', 'Workspace')}</SidebarGroupLabel>
            <SidebarMenu>
              {nav
                .filter(
                  ([, , , key]) => !coursesHidden || !courseViews.includes(key),
                )
                .map(([Icon, zh, en, key]) => (
                <SidebarMenuItem key={key}>
                  <SidebarMenuButton
                    isActive={
                      navView === key ||
                      (view === 'lesson' &&
                        key ===
                          (isKnowledgeLesson(params.lesson)
                            ? 'knowledge'
                            : 'courses')) ||
                      (view === 'problem' &&
                        key === (params.mock ? 'mock' : 'problems'))
                    }
                    onClick={() => navigate(key)}
                  >
                    <Icon size={18} />
                    <span>{t(zh, en)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroup>
          {boot.person?.role === 'teacher' && (
            <SidebarGroup>
              <SidebarGroupLabel>{t('教学管理', 'Teaching')}</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={view === 'teacher'}
                    onClick={() => navigate('teacher')}
                  >
                    <Inbox size={18} />
                    {t('教师工作台', 'Teacher dashboard')}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={view === 'metrics'}
                    onClick={() => navigate('metrics')}
                  >
                    <BarChart3 size={18} />
                    {t('运营数据', 'Analytics')}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          )}
        </SidebarContent>
        {/* Signed out, the top bar's button is the one way in; signed in, this is the account. */}
        {boot.person && (
          <SidebarFooter>
            <button className="profile" onClick={() => navigate('account')}>
              <span className="avatar">{boot.person.name.slice(0, 1) || 'S'}</span>
              <div>
                <strong>{t(boot.person.name, englishMessage(boot.person.name))}</strong>
                <small>
                  {boot.person.role === 'teacher'
                    ? t('老师账号', 'Teacher account')
                    : t('SDE 学员', 'SDE student')}
                </small>
              </div>
              <Settings size={15} />
            </button>
          </SidebarFooter>
        )}
      </Sidebar>
      <SidebarInset className="workspace">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <span>{heading}</span>
          </div>
          <div className="topbar-actions">
            {/* The site-wide ⌘K palette (components/command-palette.tsx) covers lessons too. */}
            <button className="search-shortcut" onClick={() => openCommandPalette()}>
              <Search size={15} />
              <span>{t('搜索全站', 'Search CSWork')}</span>
              <PaletteKey />
            </button>
            <Button
              variant="ghost"
              className="locale-button"
              aria-label={locale === 'zh' ? 'Switch to English' : '切换到中文'}
              onClick={() => {
                const next = locale === 'zh' ? 'en' : 'zh';
                track('language_switch', { locale: next });
                setLocale(next);
              }}
            >
              <Languages size={16} />
              {locale === 'zh' ? 'EN' : '中文'}
            </Button>
            <ThemeToggle />
            <Button
              size="icon"
              variant="ghost"
              aria-label={t(
                `通知，${unread} 条未读`,
                `Notifications, ${unread} unread`,
              )}
              onClick={() =>
                boot.person ? setNotificationOpen(true) : setLogin(true)
              }
              className="notification-button"
            >
              <Bell size={18} />
              {unread > 0 && <i />}
            </Button>
            {!boot.person && (
              <Button onClick={() => setLogin(true)}>
                {t('登录 / 注册', 'Sign in / Sign up')}
              </Button>
            )}
          </div>
        </header>
        <main
          id="main-content"
          className={
            'page ' + (['lesson', 'problem'].includes(view) ? 'page-wide' : '')
          }
        >
          {error && boot.courses.length > 0 && (
            <p role="alert" className="notice error">
              {t(error, englishMessage(error))}
            </p>
          )}
          {!!params.auth_error && (
            <p className="notice" role="alert">
              {t(
                '第三方登录或账号绑定未完成，请重新尝试。你也可以使用邮箱登录。',
                "Third-party sign-in or account linking didn't finish. Please try again, or sign in with email.",
              )}
            </p>
          )}
          {params.payment === 'success' && boot.person && params.session_id && (
            <CheckoutFeedback sessionId={params.session_id} refresh={refresh} />
          )}
          {params.payment === 'success' && !params.session_id && (
            <p className="notice">
              {t(
                '请在账号的购买记录中查看付款状态。',
                'Check the payment status in your purchase history.',
              )}
              <Button variant="link" onClick={() => navigate('account')}>
                {t('查看订单', 'View orders')}
              </Button>
            </p>
          )}
          {params.payment === 'cancelled' && (
            <p className="notice">
              {t(
                '你已退出结账。需要时可从课程页面或购买记录继续支付。',
                'You left checkout. You can resume payment from the course page or your purchase history at any time.',
              )}
            </p>
          )}
          {!loading && (
            <EnrollmentClaim
              person={boot.person}
              onSuccess={refresh}
              onLogin={() => setLogin(true)}
            />
          )}
          {/* Visitors and crawlers get the introduction; members go straight to the line. */}
          {view === 'problems' &&
            !params.library &&
            (boot.person ? (
              <h1 className="sr-only">{t('算法题库', 'Problem Bank')}</h1>
            ) : (
              <WorkspaceIntro />
            ))}
          <Suspense
            fallback={<output className="page-loading">{t('正在加载…', 'Loading…')}</output>}
          >
            {content()}
          </Suspense>
        </main>
        <footer className="flex flex-wrap gap-5 px-6 pb-6 text-xs text-muted-foreground">
          <Link prefetch={false} href="/library" className="underline underline-offset-4">
            {t('公开面试资料', 'Interview resources')}
          </Link>
          <Link prefetch={false} href="/mcp" className="underline underline-offset-4">{t('在 AI 编辑器里练题', 'Practice from your AI editor')}</Link>
          <Link prefetch={false} href="/discuss" className="underline underline-offset-4">
            {t('讨论区', 'Discussion board')}
          </Link>
          <Link prefetch={false} href="/contest" className="underline underline-offset-4">
            {t('周赛与比赛房间', 'Weekly contest & rooms')}
          </Link>
          <Link prefetch={false} href="/privacy" className="underline underline-offset-4">
            {t('隐私说明', 'Privacy')}
          </Link>
        </footer>
      </SidebarInset>
      <LoginDialog
        open={login}
        close={() => setLogin(false)}
        boot={boot}
        onSuccess={refresh}
      />
      <TicketComposer
        context={ticketContext}
        close={() => setTicketContext(null)}
        onCreated={(id) => navigate('tickets', { ticket: id })}
        boot={boot}
      />
      <Dialog open={notificationOpen} onOpenChange={setNotificationOpen}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>{t('你的消息', 'Notifications')}</DialogTitle>
            <DialogDescription>
              {t(
                '老师的回复、作业评审和课程重要更新。',
                'Teacher replies, assignment reviews and important course updates.',
              )}
            </DialogDescription>
          </DialogHeader>
          {notificationOpen && boot.person && (
            <NotificationsPane
              refresh={refresh}
              navigate={navigate}
              close={() => setNotificationOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
function CloseMobileNavigation({ view }: { view: string }) {
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    setOpenMobile(false);
  }, [view, setOpenMobile]);
  return null;
}
