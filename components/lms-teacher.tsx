'use client';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  GitPullRequest,
  MessageSquare,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react';
import { api, type Boot, type Course, date } from '@/lib/types';
import type {
  LmsGrant,
  LmsReview,
  LmsStudent,
  LmsTicket,
} from '@/lib/lms-types';
import { Heading, Empty, type Navigate } from './learning';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  CursorPagination,
  useCursorPage,
  useDebounced,
  formText,
} from './lms-shared';
import { ReviewDetailDialog, SubmissionLink } from './lms-support';
import { CourseAdmin } from './course-admin';
import { OjAdmin } from './oj-admin';
import { CommerceAdmin } from './commerce-admin';

export function TeacherView({
  boot,
  navigate,
  refresh,
}: {
  boot: Boot;
  navigate: Navigate;
  refresh: () => Promise<void>;
}) {
  const params = new URLSearchParams(
    typeof location === 'undefined' ? '' : location.search,
  );
  const [tab, setTab] = useState(params.get('tab') || 'queue');
  return (
    <>
      <Heading
        label="A CLEARER DAY OF TEACHING"
        title="今天，先解决这些。"
        description="课程、学员和需要回复的问题，都在同一个工作台。"
      />
      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList variant="line" className="teacher-tabs">
          <TabsTrigger value="queue">待处理</TabsTrigger>
          <TabsTrigger value="students">学员与权限</TabsTrigger>
          <TabsTrigger value="publish">课程内容</TabsTrigger>
          <TabsTrigger value="problems">题库管理</TabsTrigger>
          <TabsTrigger value="commerce">订单与售卖</TabsTrigger>
          <TabsTrigger value="services">服务状态</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
          <TeacherQueue boot={boot} navigate={navigate} />
        </TabsContent>
        <TabsContent value="students">
          <Grants
            courses={boot.courses}
            initialEmail={params.get('email') || ''}
            initialCourse={params.get('course') || ''}
          />
          <Students courses={boot.courses} />
        </TabsContent>
        <TabsContent value="publish">
          <CourseAdmin boot={boot} refresh={refresh} />
        </TabsContent>
        <TabsContent value="problems">
          <OjAdmin boot={boot} />
        </TabsContent>
        <TabsContent value="commerce">
          <CommerceAdmin courses={boot.courses} refresh={refresh} />
        </TabsContent>
        <TabsContent value="services">
          <Services boot={boot} refresh={refresh} />
        </TabsContent>
      </Tabs>
    </>
  );
}
type Dashboard = {
  counts: {
    openTickets: number;
    waitingTickets: number;
    pendingReviews: number;
    students: number;
    activeGrants: number;
  };
  tickets: LmsTicket[];
  reviews: LmsReview[];
  staff: { id: string; name: string }[];
};
type Struggle = {
  user_id: string;
  problem_id: string;
  name: string;
  failures: number;
  latest_submission_id: string;
};
function TeacherQueue({ boot, navigate }: { boot: Boot; navigate: Navigate }) {
  const [data, setData] = useState<Dashboard | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [retry, setRetry] = useState(0),
    [review, setReview] = useState(''),
    [struggles, setStruggles] = useState<Struggle[]>([]),
    [struggleError, setStruggleError] = useState('');
  useEffect(() => {
    let active = true;
    api<Dashboard>('lms/dashboard')
      .then((value) => {
        if (active) {
          setData(value);
          setError('');
        }
      })
      .catch((e) => active && setError(e.message));
    api<{ struggles: Struggle[] }>('teacher')
      .then((value) => {
        if (active) {
          setStruggles(value.struggles || []);
          setStruggleError('');
        }
      })
      .catch((e) => active && setStruggleError((e as Error).message));
    return () => {
      active = false;
    };
  }, [retry]);
  if (!data)
    return (
      <Empty
        title={error || '正在加载待处理事项…'}
        action={
          error ? (
            <Button onClick={() => setRetry((n) => n + 1)}>重试</Button>
          ) : undefined
        }
      />
    );
  return (
    <>
      <div className="lms-toolbar">
        <p className="muted">按等待时间排列，统计覆盖全部记录。</p>
        <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
          <RefreshCw size={15} />
          刷新待处理
        </Button>
      </div>
      <div className="teacher-stats">
        {(
          [
            [MessageSquare, data.counts.openTickets, '待老师回复'],
            [GitPullRequest, data.counts.pendingReviews, '待评审作业'],
            [MessageSquare, data.counts.waitingTickets, '待学员确认'],
            [Users, data.counts.students, '注册学员'],
          ] as const
        ).map(([Icon, count, label]) => (
          <div className="stat-card" key={label}>
            <Icon size={19} />
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="teacher-queue">
        <div className="section-title">
          <h2>待回复工单</h2>
          <Button
            variant="link"
            onClick={() => navigate('tickets', { status: 'open' })}
          >
            全部工单
            <ArrowRight size={15} />
          </Button>
        </div>
        {data.tickets
          .filter((ticket) => ticket.status === 'open')
          .map((ticket) => (
            <div className="queue-row" key={ticket.id}>
              <span className="avatar">
                {(ticket.name || '学员').slice(0, 1)}
              </span>
              <button
                className="queue-main"
                onClick={() => navigate('tickets', { ticket: ticket.id })}
              >
                <strong>{ticket.title}</strong>
                <small>
                  {ticket.name} · {date(ticket.updated_at)}
                </small>
              </button>
              <NativeSelect
                aria-label={`分配工单：${ticket.title}`}
                disabled={!!busy}
                value={ticket.assigned_to || ''}
                onChange={async (e) => {
                  const staff = e.target.value;
                  setBusy(ticket.id);
                  setError('');
                  try {
                    await api(`lms/tickets/${ticket.id}/status`, {
                      expectedRevision: ticket.revision,
                      status: ticket.status,
                      assignedTo: staff || null,
                    });
                    setRetry((n) => n + 1);
                  } catch (e) {
                    setError((e as Error).message);
                    setRetry((n) => n + 1);
                  } finally {
                    setBusy('');
                  }
                }}
              >
                <NativeSelectOption value="">未分配</NativeSelectOption>
                {data.staff.map((person) => (
                  <NativeSelectOption key={person.id} value={person.id}>
                    {person.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Button
                variant="outline"
                onClick={() => navigate('tickets', { ticket: ticket.id })}
              >
                回复
              </Button>
            </div>
          ))}
        {!data.counts.openTickets && <Empty title="没有等待回复的问题" />}
        <div className="section-title">
          <h2>待评审作业</h2>
          <Button
            variant="link"
            onClick={() => navigate('reviews', { status: 'pending' })}
          >
            全部作业
            <ArrowRight size={15} />
          </Button>
        </div>
        {data.reviews
          .filter((item) => item.status === 'pending')
          .map((item) => (
            <div className="queue-row" key={item.id}>
              <GitPullRequest size={20} />
              <div className="queue-main">
                <strong>
                  {boot.courses
                    .flatMap((course) => course.lessons)
                    .find((lesson) => lesson.id === item.lesson_id)?.title ||
                    item.lesson_id}
                </strong>
                <small>
                  {item.name} · {date(item.created_at)}
                </small>
              </div>
              <Button variant="outline" onClick={() => setReview(item.id)}>
                开始评审
              </Button>
            </div>
          ))}
        {!data.counts.pendingReviews && <Empty title="没有待评审作业" />}
        <div className="section-title">
          <h2>反复失败的练习</h2>
          <span className="muted">近 7 天至少失败 3 次，且尚未通过</span>
        </div>
        {struggles.map((item) => (
          <div className="queue-row" key={item.user_id + item.problem_id}>
            <div className="queue-main">
              <strong>
                {item.name} ·{' '}
                {boot.problems.find((problem) => problem.id === item.problem_id)
                  ?.title || item.problem_id}
              </strong>
              <small>{item.failures} 次未通过</small>
            </div>
            <SubmissionLink
              id={item.latest_submission_id}
              navigate={navigate}
              label="查看提交"
            />
          </div>
        ))}
        {struggleError && (
          <p className="error-text" role="alert">
            练习关注记录暂不可用：{struggleError}
          </p>
        )}
        {!struggles.length && !struggleError && (
          <p className="quiet-empty">暂时没有需要关注的反复失败记录。</p>
        )}
      </div>
      <ReviewDetailDialog
        id={review}
        boot={boot}
        close={() => setReview('')}
        changed={() => setRetry((n) => n + 1)}
      />
    </>
  );
}

function Grants({
  courses,
  initialEmail,
  initialCourse,
}: {
  courses: Course[];
  initialEmail: string;
  initialCourse: string;
}) {
  const [query, setQuery] = useState(initialEmail),
    [course, setCourse] = useState(''),
    [state, setState] = useState('active'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const list = useCursorPage<LmsGrant>(
    'lms/grants?' +
      new URLSearchParams({ q: useDebounced(query), courseId: course, state }),
  );
  return (
    <section className="form-card">
      <h2>课程权限</h2>
      <p className="muted">
        使用购买记录中的邮箱。尚未注册的学员验证相同邮箱后即可获得权限。
      </p>
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const form = e.currentTarget,
            fd = new FormData(form),
            courseId = formText(fd, 'courseId'),
            expires = formText(fd, 'expires');
          const ids =
            courseId === '__current__' ? courses.map((c) => c.id) : [courseId];
          setBusy(true);
          setError('');
          setNotice('');
          try {
            if (!ids.length) throw new Error('请先创建课程');
            const failures = await Promise.allSettled(
              ids.map((id) =>
                api('lms/grants', {
                  email: fd.get('email'),
                  courseId: id,
                  expiresAt: expires
                    ? new Date(expires + 'T23:59:59').getTime()
                    : null,
                  idempotencyKey: crypto.randomUUID(),
                }),
              ),
            );
            const failed = failures.filter(
              (item) => item.status === 'rejected',
            );
            list.refresh();
            if (failed.length)
              throw new Error(
                `${ids.length - failed.length} 门已开通，${failed.length} 门未成功，请重试未开通课程。`,
              );
            setNotice(`已开通 ${ids.length} 门课程`);
            form.reset();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-columns">
          <label htmlFor="lms-teacher-field-1">
            学员邮箱
            <Input
              id="lms-teacher-field-1"
              name="email"
              type="email"
              defaultValue={initialEmail}
              required
              placeholder="student@example.com"
            />
          </label>
          <label htmlFor="lms-teacher-field-2">
            开通课程
            <NativeSelect
              id="lms-teacher-field-2"
              name="courseId"
              defaultValue={initialCourse || courses[0]?.id || ''}
              required
            >
              {courses.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.title}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value="__current__">
                当前全部课程（不含未来新增课程）
              </NativeSelectOption>
              <NativeSelectOption value="*">
                全部课程，包含未来新增课程
              </NativeSelectOption>
            </NativeSelect>
          </label>
          <label htmlFor="lms-teacher-field-3">
            有效期至（留空为永久）
            <Input
              id="lms-teacher-field-3"
              name="expires"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
            />
          </label>
        </div>
        <Button type="submit" disabled={busy || !courses.length}>
          <Plus size={15} />
          {busy ? '开通中…' : '开通权限'}
        </Button>
      </form>
      {notice && <output className="success-text">{notice}</output>}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <div className="lms-toolbar">
        <Input
          aria-label="搜索授权邮箱"
          value={query}
          placeholder="按邮箱搜索权限…"
          onChange={(e) => setQuery(e.target.value)}
        />
        <NativeSelect
          aria-label="按课程筛选权限"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          <NativeSelectOption value="">全部课程</NativeSelectOption>
          {courses.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.title}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value="*">
            包含未来课程的通用权限
          </NativeSelectOption>
        </NativeSelect>
        <NativeSelect
          aria-label="权限状态"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <NativeSelectOption value="active">有效</NativeSelectOption>
          <NativeSelectOption value="revoked">已撤销</NativeSelectOption>
          <NativeSelectOption value="expired">已过期</NativeSelectOption>
          <NativeSelectOption value="">全部状态</NativeSelectOption>
        </NativeSelect>
        <Button variant="outline" onClick={list.refresh}>
          刷新
        </Button>
      </div>
      {list.busy && <output>正在加载权限…</output>}
      {list.error && (
        <p role="alert" className="error-text">
          {list.error}{' '}
          <Button variant="ghost" onClick={list.refresh}>
            重试
          </Button>
        </p>
      )}
      <div className="lms-table-scroll">
        <table className="lms-table">
          <thead>
            <tr>
              <th>学员邮箱</th>
              <th>课程</th>
              <th>有效期</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((grant) => (
              <tr key={grant.id}>
                <td>{grant.email}</td>
                <td>
                  {grant.course_id === '*'
                    ? '全部课程（含未来）'
                    : courses.find((c) => c.id === grant.course_id)?.title ||
                      grant.course_id}
                </td>
                <td>
                  {grant.expires_at
                    ? new Date(grant.expires_at).toLocaleDateString('zh-CN')
                    : '永久'}
                </td>
                <td>
                  {grant.revoked_at
                    ? '已撤销'
                    : grant.expires_at && grant.expires_at <= now
                      ? '已过期'
                      : '有效'}
                </td>
                <td>
                  {!grant.revoked_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `确定撤销 ${grant.email} 的这项课程权限？`,
                          )
                        )
                          return;
                        setBusy(true);
                        setError('');
                        try {
                          await api(`lms/grants/${grant.id}/revoke`, {});
                          list.refresh();
                          setNotice('权限已撤销');
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      撤销
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.data && !list.data.items.length && (
        <p className="quiet-empty">没有符合条件的权限记录。</p>
      )}
      <CursorPagination list={list} />
    </section>
  );
}
function Students({ courses }: { courses: Course[] }) {
  const [query, setQuery] = useState('');
  const list = useCursorPage<LmsStudent>(
    'lms/students?' + new URLSearchParams({ q: useDebounced(query) }),
  );
  return (
    <section className="form-card">
      <div className="lms-toolbar">
        <h2>学员名单</h2>
        <Button variant="outline" onClick={list.refresh}>
          刷新名单
        </Button>
      </div>
      <Input
        aria-label="搜索学员"
        placeholder="搜索姓名或邮箱…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {list.busy && <output>正在加载学员…</output>}
      {list.error && (
        <p role="alert" className="error-text">
          {list.error}{' '}
          <Button variant="ghost" onClick={list.refresh}>
            重试
          </Button>
        </p>
      )}
      <div className="lms-table-scroll">
        <table className="lms-table">
          <thead>
            <tr>
              <th>学员</th>
              <th>账号状态</th>
              <th>已开通课程</th>
              <th>加入时间</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((student) => (
              <tr key={student.email}>
                <td>
                  <strong>{student.name || '尚未注册'}</strong>
                  <small>{student.email}</small>
                </td>
                <td>
                  {!student.userId
                    ? '待注册'
                    : student.verified
                      ? '邮箱已验证'
                      : '待验证邮箱'}
                </td>
                <td>
                  {student.activeCourseIds
                    .map((id) =>
                      id === '*'
                        ? '全部课程（含未来）'
                        : courses.find((c) => c.id === id)?.title || id,
                    )
                    .join('、') || '暂无权限'}
                </td>
                <td>{student.joinedAt ? date(student.joinedAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.data && !list.data.items.length && (
        <p className="quiet-empty">没有符合条件的学员。</p>
      )}
      <CursorPagination list={list} />
    </section>
  );
}
function Services({
  boot,
  refresh,
}: {
  boot: Boot;
  refresh: () => Promise<void>;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const labels: Record<string, string> = {
    google: 'Google 登录',
    github: 'GitHub 登录',
    email: '邮箱验证码',
    password: '密码登录',
    video: '课程视频',
    judge: '算法判题',
    checkout: '课程购买',
  };
  return (
    <div className="form-card">
      <div className="lms-toolbar">
        <h2>服务配置状态</h2>
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          重新检测
        </Button>
      </div>
      <p className="muted">
        这里检查服务配置是否齐全。视频处理、支付和判题结果会在各自流程中显示实际状态。
      </p>
      <div className="service-grid">
        {Object.entries(labels).map(([key, label]) => (
          <div key={key} className="service-row">
            <span>{label}</span>
            <span
              className={'tag ' + (boot.services[key] ? 'success-text' : '')}
            >
              {boot.services[key] ? '配置已就绪' : '尚未接入'}
            </span>
          </div>
        ))}
      </div>
      <p className="notice">
        课程内容、学员和题库可在工作台直接管理。第三方服务的密钥由服务器管理员配置，接入后可点击重新检测。
      </p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}
