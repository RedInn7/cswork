'use client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Activity,
  BookOpen,
  Code2,
  LifeBuoy,
  Bell,
  ArrowRight,
  Terminal,
  Search,
  Settings,
  Inbox,
  ChevronRight,
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
import { Input } from '@/components/ui/input';
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
  type Navigate,
} from './learning';
import { JudgeStatus } from './judge-status';
import {
  TicketComposer,
  TicketView,
  ReviewsView,
  ReleasesView,
} from './support';
import { TeacherView } from './teacher';
import { LoginDialog, AccountView } from './account';
import { registerAcademyTools } from '@/lib/webmcp';
import Link from 'next/link';
import { CheckoutFeedback } from './checkout-feedback';
import { EnrollmentClaim } from './enrollment';
import { NotificationsPane } from './lms-notifications';
import '@/app/lms.css';
import {
  INTERVIEW_COURSE_ID,
  isKnowledgeLesson,
} from '@/lib/interview-curriculum';
// Practice is the product's centre: the problem bank leads and is the landing view.
const nav: [LucideIcon, string, string][] = [
  [Code2, '算法题库', 'problems'],
  [Activity, '评测状态', 'status'],
  [BookOpen, '我的课程', 'courses'],
  [BookOpen, '算法知识点', 'knowledge'],
  [LifeBuoy, '我的工单', 'tickets'],
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
type SearchResult = { id: string; title: string; snippet: string };
export function Academy() {
  const [boot, setBoot] = useState<Boot>(initial),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [view, setView] = useState('problems'),
    [params, setParams] = useState<Record<string, string>>({}),
    [login, setLogin] = useState(false),
    [ticketContext, setTicketContext] = useState<Record<string, string> | null>(
      null,
    ),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(''),
    [results, setResults] = useState<SearchResult[]>([]),
    [searching, setSearching] = useState(false),
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
  // catalogue (~3MB) stays from the full load unless the identity changed.
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
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  useEffect(() => {
    if (!search || !query.trim()) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await api<SearchResult[]>(
          'search?q=' + encodeURIComponent(query),
        );
        if (!cancelled) setResults(found);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, search]);
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
    unread =
      boot.unreadNotifications ??
      boot.notifications.filter((n) => !n.read_at).length;
  // The server omits teaching courses hidden from this account (owner-only mode).
  const coursesHidden =
    !loading && !boot.courses.some((c) => c.id !== INTERVIEW_COURSE_ID);
  function content() {
    if (loading) return <output className="page-loading">正在加载…</output>;
    if (error && !boot.courses.length)
      return (
        <Empty
          title="学习空间暂时无法加载"
          description={error}
          action={
            <Button onClick={() => refresh().catch((e) => setError(e.message))}>
              重新加载
            </Button>
          }
        />
      );
    if (
      !boot.person &&
      !['courses', 'knowledge', 'problems', 'problem', 'status'].includes(
        view,
      )
    )
      return (
        <Empty
          title="登录后继续学习"
          description="进度、笔记与老师的反馈会跟随你的账号保存。"
          action={
            <Button onClick={() => setLogin(true)}>
              登录 / 注册
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
          title="课程暂未开放"
          description="课程正在整理中，可以先去算法题库刷题。"
          action={
            <Button onClick={() => navigate('problems')}>
              进入算法题库
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
      case 'status':
        return <JudgeStatus boot={boot} params={params} navigate={navigate} />;
      case 'problem':
        return selectedProblem ? (
          <ProblemWorkspace
            key={selectedProblem.id}
            problem={selectedProblem}
            boot={boot}
            navigate={navigate}
            ask={ask}
            refresh={refreshLite}
          />
        ) : (
          <Empty
            title="请选择一道题目"
            action={
              <Button onClick={() => navigate('problems')}>进入题库</Button>
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
          <Empty title="仅老师可以访问工作台" />
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
            <SidebarGroupLabel>学习空间</SidebarGroupLabel>
            <SidebarMenu>
              {nav
                .filter(
                  ([, , key]) => !coursesHidden || !courseViews.includes(key),
                )
                .map(([Icon, label, key]) => (
                <SidebarMenuItem key={key}>
                  <SidebarMenuButton
                    isActive={
                      view === key ||
                      (view === 'lesson' &&
                        key ===
                          (isKnowledgeLesson(params.lesson)
                            ? 'knowledge'
                            : 'courses')) ||
                      (view === 'problem' && key === 'problems')
                    }
                    onClick={() => navigate(key)}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroup>
          {boot.person?.role === 'teacher' && (
            <SidebarGroup>
              <SidebarGroupLabel>教学管理</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={view === 'teacher'}
                    onClick={() => navigate('teacher')}
                  >
                    <Inbox size={18} />
                    教师工作台
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
                <strong>{boot.person.name}</strong>
                <small>{boot.person.role === 'teacher' ? '老师账号' : 'SDE 学员'}</small>
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
            <span>
              {nav.find((n) => n[2] === view)?.[1] ||
                (
                  {
                    lesson: isKnowledgeLesson(params.lesson)
                      ? '算法知识点'
                      : '课程学习',
                    problem: '算法题库',
                    reviews: '代码评审',
                    releases: '课程更新',
                    teacher: '教师工作台',
                    account: '账号设置',
                  } as Record<string, string>
                )[view] ||
                '算法题库'}
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="search-shortcut"
              onClick={() => (boot.person ? setSearch(true) : setLogin(true))}
            >
              <Search size={15} />
              <span>搜索课程内容</span>
              <kbd>搜索</kbd>
            </button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`通知，${unread} 条未读`}
              onClick={() =>
                boot.person ? setNotificationOpen(true) : setLogin(true)
              }
              className="notification-button"
            >
              <Bell size={18} />
              {unread > 0 && <i />}
            </Button>
            {!boot.person && (
              <Button onClick={() => setLogin(true)}>登录 / 注册</Button>
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
              {error}
            </p>
          )}
          {!!params.auth_error && (
            <p className="notice" role="alert">
              第三方登录或账号绑定未完成，请重新尝试。你也可以使用邮箱登录。
            </p>
          )}
          {params.payment === 'success' && boot.person && params.session_id && (
            <CheckoutFeedback sessionId={params.session_id} refresh={refresh} />
          )}
          {params.payment === 'success' && !params.session_id && (
            <p className="notice">
              请在账号的购买记录中查看付款状态。
              <Button variant="link" onClick={() => navigate('account')}>
                查看订单
              </Button>
            </p>
          )}
          {params.payment === 'cancelled' && (
            <p className="notice">
              你已退出结账。需要时可从课程页面或购买记录继续支付。
            </p>
          )}
          {!loading && (
            <EnrollmentClaim
              person={boot.person}
              onSuccess={refresh}
              onLogin={() => setLogin(true)}
            />
          )}
          {content()}
        </main>
        <footer className="px-6 pb-6 text-xs text-muted-foreground">
          <Link href="/privacy" className="underline underline-offset-4">
            隐私说明
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
      <Dialog open={search} onOpenChange={setSearch}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>搜索课程内容</DialogTitle>
            <DialogDescription>
              搜索讲义中的知识点，直接回到对应章节。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setResults([]);
              setSearching(false);
            }}
            aria-label="搜索课程内容"
            placeholder="试试：幂等、库存、JWT…"
          />
          <div className="search-results">
            {searching ? (
              <p>正在搜索…</p>
            ) : (
              results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSearch(false);
                    navigate('lesson', { lesson: r.id });
                  }}
                >
                  <FileSearchTitle title={r.title} />
                  <p>{r.snippet}</p>
                </button>
              ))
            )}
            {query && !searching && !results.length && (
              <p className="muted">没有找到匹配内容。</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={notificationOpen} onOpenChange={setNotificationOpen}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>你的消息</DialogTitle>
            <DialogDescription>
              老师的回复、作业评审和课程重要更新。
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
function FileSearchTitle({ title }: { title: string }) {
  return (
    <strong>
      <BookOpen size={16} />
      {title}
      <ChevronRight size={15} />
    </strong>
  );
}
function CloseMobileNavigation({ view }: { view: string }) {
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    setOpenMobile(false);
  }, [view, setOpenMobile]);
  return null;
}
