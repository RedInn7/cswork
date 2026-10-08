'use client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Code2,
  LayoutDashboard,
  LifeBuoy,
  Bell,
  Play,
  ArrowRight,
  Check,
  Terminal,
  Search,
  Settings,
  Inbox,
  Bookmark,
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
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api, type Boot, type Lesson } from '@/lib/types';
import {
  CourseList,
  LessonReader,
  ProblemList,
  ProblemWorkspace,
  Empty,
  Heading,
  type Navigate,
} from './learning';
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
import { isKnowledgeLesson } from '@/lib/interview-curriculum';
const nav: [LucideIcon, string, string][] = [
  [LayoutDashboard, '学习概览', 'home'],
  [BookOpen, '我的课程', 'courses'],
  [Code2, '算法题库', 'problems'],
  [BookOpen, '算法知识点', 'knowledge'],
  [LifeBuoy, '我的工单', 'tickets'],
];
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
    [view, setView] = useState('home'),
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
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- Initial bootstrap and the history subscription synchronize this SPA with external browser state.
    refresh().catch((e) => {
      setError(e.message);
      setLoading(false);
    });
    const sync = () => {
      const p = Object.fromEntries(new URLSearchParams(location.search));
      setParams(p);
      setView(p.view || 'home');
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
  const personId = boot.person?.id;
  useEffect(() => {
    if (!personId) return;
    const update = () => {
      if (document.visibilityState === 'visible')
        void refresh().catch(() => {});
    };
    const timer = setInterval(update, 45000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [personId, refresh]);
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
  function content() {
    if (loading)
      return (
        <Home boot={boot} navigate={navigate} login={() => setLogin(true)} />
      );
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
      !['home', 'courses', 'knowledge', 'problems', 'problem'].includes(view)
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
      case 'problem':
        return selectedProblem ? (
          <ProblemWorkspace
            key={selectedProblem.id}
            problem={selectedProblem}
            boot={boot}
            navigate={navigate}
            ask={ask}
            refresh={refresh}
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
        return (
          <Home boot={boot} navigate={navigate} login={() => setLogin(true)} />
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
              navigate('home');
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
              {nav.map(([Icon, label, key]) => (
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
        <SidebarFooter>
          <button
            className="profile"
            onClick={() => (boot.person ? navigate('account') : setLogin(true))}
          >
            <span className="avatar">
              {boot.person?.name.slice(0, 1) || 'S'}
            </span>
            <div>
              <strong>{boot.person?.name || '登录学习空间'}</strong>
              <small>
                {boot.person?.role === 'teacher'
                  ? '老师账号'
                  : boot.person
                    ? 'SDE 学员'
                    : '保存进度，开始学习'}
              </small>
            </div>
            <Settings size={15} />
          </button>
        </SidebarFooter>
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
                    teacher: '教师工作台',
                    account: '账号设置',
                  } as Record<string, string>
                )[view] ||
                '学习概览'}
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
type PracticeSummary = {
  collection?: { solved: number; total: number };
  currentRound?: { number: number };
};

/** The learner's curated-list round at a glance, with one click back into practice. */
function PracticeCard({
  signedIn,
  navigate,
  login,
}: {
  signedIn: boolean;
  navigate: Navigate;
  login: () => void;
}) {
  const [summary, setSummary] = useState<PracticeSummary | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    api<PracticeSummary>('oj/library?collection=ling-selected-500&page=1')
      .then((data) => current && setSummary(data))
      .catch(() => current && setSummary(null));
    return () => {
      current = false;
    };
  }, [signedIn]);
  const solved = summary?.collection?.solved ?? 0,
    total = summary?.collection?.total ?? 500;
  return (
    <div className="practice-card">
      <span className="overline">
        {signedIn
          ? `灵神题单 · 第 ${summary?.currentRound?.number ?? 1} 轮`
          : '算法练习'}
      </span>
      {signedIn ? (
        <>
          <strong>
            {solved}
            <small> / {total} 已通过</small>
          </strong>
          <Progress value={total ? (solved / total) * 100 : 0} />
        </>
      ) : (
        <p>登录后自动记录每一轮的刷题进度。</p>
      )}
      <div className="practice-card-actions">
        <Button
          className="primary-light"
          onClick={() => (signedIn ? navigate('problems') : login())}
        >
          <Code2 size={16} />
          继续刷题
        </Button>
        <button
          className="practice-card-link"
          onClick={() =>
            signedIn ? navigate('problems', { library: 'oa' }) : login()
          }
        >
          OA 题目
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function Home({
  boot,
  navigate,
  login,
}: {
  boot: Boot;
  navigate: Navigate;
  login: () => void;
}) {
  const all = boot.courses.flatMap((c) => c.lessons),
    accessible = boot.courses
      .filter((c) => c.has_access)
      .flatMap((c) => c.lessons),
    latest = [...boot.progress]
      .filter((p) => accessible.some((l) => l.id === p.lesson_id))
      .sort((a, b) => b.updated_at - a.updated_at)[0],
    resume =
      all.find((l) => l.id === latest?.lesson_id) ||
      accessible.find(
        (l) => !boot.progress.some((p) => p.lesson_id === l.id && p.completed),
      ) ||
      accessible[0] ||
      all[0],
    course =
      boot.courses.find((c) => c.lessons.some((l) => l.id === resume?.id)) ||
      boot.courses[0],
    done = accessible.filter((l) =>
      boot.progress.some((p) => p.lesson_id === l.id && p.completed),
    ).length,
    passed = new Set(
      boot.submissions
        .filter((s) => s.status === 'accepted')
        .map((s) => s.problem_id),
    ).size;
  function start(l?: Lesson) {
    if (!boot.person) {
      login();
      return;
    }
    if (
      l &&
      boot.courses.some(
        (c) => c.has_access && c.lessons.some((item) => item.id === l.id),
      )
    )
      navigate('lesson', { lesson: l.id });
    else navigate('courses');
  }
  return (
    <>
      <Heading
        title={boot.person ? '专注今天的进步。' : '从这里，成为更好的工程师。'}
      />
      <section className="continue-card">
        <div>
          <span className="overline">
            {latest ? '继续你的学习' : '从这里开始'}
          </span>
          <h2>{latest ? resume?.title : course?.title || '你的下一门课程'}</h2>
          <p>
            {latest
              ? resume?.summary
              : course?.summary || '课程准备完成后，可以从这里进入学习。'}
          </p>
          <div className="course-meta">
            <span>{course?.lessons.length || 0} 个章节</span>
            <span>课件与配套视频</span>
            <span>配套代码练习</span>
          </div>
          <Button className="primary-light" onClick={() => start(resume)}>
            <Play size={16} fill="currentColor" />
            {latest ? '继续学习' : '进入第一章'}
            <ArrowRight size={16} />
          </Button>
        </div>
        <PracticeCard
          signedIn={!!boot.person}
          navigate={navigate}
          login={login}
        />
      </section>
      {boot.person && (
        <div className="learning-stats">
          <div>
            <BookOpen size={18} />
            <span>已完成课时</span>
            <strong>
              {done}
              <small> / {accessible.length}</small>
            </strong>
          </div>
          <div>
            <Code2 size={18} />
            <span>算法已通过</span>
            <strong>
              {passed}
              <small> / {boot.problems.length}</small>
            </strong>
          </div>
          <div>
            <Bookmark size={18} />
            <span>我的收藏</span>
            <strong>{boot.progress.filter((p) => p.bookmarked).length}</strong>
          </div>
        </div>
      )}
      <div className="section-title">
        <h2>你的学习路径</h2>
        <button className="text-link" onClick={() => navigate('courses')}>
          完整课程
          <ArrowRight size={14} />
        </button>
      </div>
      <div className="path-grid">
        {[
          ...new Set(
            (course?.lessons || []).map((l) => l.section || '课程内容'),
          ),
        ].map((section, index) => {
          const n = String(index + 1).padStart(2, '0'),
            ls = (course?.lessons || []).filter(
              (l) => (l.section || '课程内容') === section,
            ),
            completed = ls.filter((l) =>
              boot.progress.some((p) => p.lesson_id === l.id && p.completed),
            ).length;
          return (
            <button className="path-card" key={n} onClick={() => start(ls[0])}>
              <div className="path-top">
                <span>{n}</span>
                <ArrowUpRight size={20} />
              </div>
              <h3>{section}</h3>
              <p>{ls[0]?.summary || '按章节推进，完成配套练习。'}</p>
              <small>{course?.title}</small>
              <Progress value={ls.length ? (completed / ls.length) * 100 : 0} />
              <div className="path-progress">
                <span>
                  {completed} / {ls.length} 课已完成
                </span>
                <span>
                  {ls.length ? Math.round((completed / ls.length) * 100) : 0}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="home-bottom">
        <section>
          <div className="section-title">
            <h2>下一道，练起来。</h2>
            <button className="text-link" onClick={() => navigate('problems')}>
              全部练习
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="quick-problems">
            {boot.problems.slice(0, 3).map((p, i) => (
              <button
                key={p.id}
                onClick={() => navigate('problem', { problem: p.id })}
              >
                <span className="quick-number">0{i + 1}</span>
                <div>
                  <strong>{p.title}</strong>
                  <small>{p.tags.join(' · ')}</small>
                </div>
                <span
                  className={
                    'difficulty ' + (p.difficulty === '中等' ? 'medium' : '')
                  }
                >
                  {p.difficulty}
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="section-title">
            <h2>学习支持</h2>
          </div>
          <div className="help-card">
            <LifeBuoy size={23} />
            <h3>把疑问留在这里。</h3>
            <p>与老师私密沟通，每个问题都能回到对应的章节或代码。</p>
            <Button
              variant="outline"
              onClick={() => (boot.person ? navigate('tickets') : login())}
            >
              我的工单
              <ArrowRight size={15} />
            </Button>
          </div>
        </section>
      </div>
      {boot.progress.some((p) => p.bookmarked) && (
        <>
          <div className="section-title">
            <h2>收藏的章节</h2>
          </div>
          {all
            .filter((l) =>
              boot.progress.some((p) => p.lesson_id === l.id && p.bookmarked),
            )
            .map((l) => (
              <button
                className="lesson-row"
                key={l.id}
                onClick={() => start(l)}
              >
                <Bookmark size={16} />
                {l.title}
                <ArrowRight size={15} />
              </button>
            ))}
        </>
      )}
    </>
  );
}

function CloseMobileNavigation({ view }: { view: string }) {
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    setOpenMobile(false);
  }, [view, setOpenMobile]);
  return null;
}
