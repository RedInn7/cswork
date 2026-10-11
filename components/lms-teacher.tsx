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
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
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
  const t = useT();
  const params = new URLSearchParams(
    typeof location === 'undefined' ? '' : location.search,
  );
  const [tab, setTab] = useState(params.get('tab') || 'queue');
  return (
    <>
      <Heading
        title={t('今天，先解决这些。', 'What needs your attention today')}
        description={t(
          '课程、学员和需要回复的问题，都在同一个工作台。',
          'Courses, students, and questions awaiting a reply, all in one dashboard.',
        )}
      />
      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList variant="line" className="teacher-tabs">
          <TabsTrigger value="queue">{t('待处理', 'Pending')}</TabsTrigger>
          <TabsTrigger value="students">
            {t('学员与权限', 'Students & access')}
          </TabsTrigger>
          <TabsTrigger value="publish">
            {t('课程内容', 'Course content')}
          </TabsTrigger>
          <TabsTrigger value="problems">
            {t('题库管理', 'Problem admin')}
          </TabsTrigger>
          <TabsTrigger value="commerce">
            {t('订单与售卖', 'Orders & sales')}
          </TabsTrigger>
          <TabsTrigger value="services">
            {t('服务状态', 'Service status')}
          </TabsTrigger>
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
          <OjAdmin boot={boot} refresh={refresh} />
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
  const t = useT();
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
        title={
          error
            ? t(error, englishMessage(error))
            : t('正在加载待处理事项…', 'Loading pending items…')
        }
        action={
          error ? (
            <Button onClick={() => setRetry((n) => n + 1)}>
              {t('重试', 'Retry')}
            </Button>
          ) : undefined
        }
      />
    );
  return (
    <>
      <div className="lms-toolbar">
        <p className="muted">
          {t(
            '按等待时间排列，统计覆盖全部记录。',
            'Sorted by wait time. Counts include all records.',
          )}
        </p>
        <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
          <RefreshCw size={15} />
          {t('刷新待处理', 'Refresh queue')}
        </Button>
      </div>
      <div className="teacher-stats">
        {(
          [
            [
              MessageSquare,
              data.counts.openTickets,
              '待老师回复',
              'Awaiting teacher reply',
            ],
            [
              GitPullRequest,
              data.counts.pendingReviews,
              '待评审作业',
              'Pending reviews',
            ],
            [
              MessageSquare,
              data.counts.waitingTickets,
              '待学员确认',
              'Awaiting student confirmation',
            ],
            [Users, data.counts.students, '注册学员', 'Registered students'],
          ] as const
        ).map(([Icon, count, label, en]) => (
          <div className="stat-card" key={label}>
            <Icon size={19} />
            <strong>{count}</strong>
            <span>{t(label, en)}</span>
          </div>
        ))}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {t(error, englishMessage(error))}
        </p>
      )}
      <div className="teacher-queue">
        <div className="section-title">
          <h2>{t('待回复工单', 'Tickets awaiting reply')}</h2>
          <Button
            variant="link"
            onClick={() => navigate('tickets', { status: 'open' })}
          >
            {t('全部工单', 'All tickets')}
            <ArrowRight size={15} />
          </Button>
        </div>
        {data.tickets
          .filter((ticket) => ticket.status === 'open')
          .map((ticket) => (
            <div className="queue-row" key={ticket.id}>
              <span className="avatar">
                {(ticket.name || t('学员', 'Student')).slice(0, 1)}
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
                aria-label={t(
                  `分配工单：${ticket.title}`,
                  `Assign ticket: ${ticket.title}`,
                )}
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
                <NativeSelectOption value="">
                  {t('未分配', 'Unassigned')}
                </NativeSelectOption>
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
                {t('回复', 'Reply')}
              </Button>
            </div>
          ))}
        {!data.counts.openTickets && (
          <Empty
            title={t('没有等待回复的问题', 'No questions awaiting reply')}
          />
        )}
        <div className="section-title">
          <h2>{t('待评审作业', 'Pending reviews')}</h2>
          <Button
            variant="link"
            onClick={() => navigate('reviews', { status: 'pending' })}
          >
            {t('全部作业', 'All reviews')}
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
                {t('开始评审', 'Start review')}
              </Button>
            </div>
          ))}
        {!data.counts.pendingReviews && (
          <Empty title={t('没有待评审作业', 'No pending reviews')} />
        )}
        <div className="section-title">
          <h2>{t('反复失败的练习', 'Repeated failures')}</h2>
          <span className="muted">
            {t(
              '近 7 天至少失败 3 次，且尚未通过',
              '3+ failed attempts in the last 7 days, not yet accepted',
            )}
          </span>
        </div>
        {struggles.map((item) => (
          <div className="queue-row" key={item.user_id + item.problem_id}>
            <div className="queue-main">
              <strong>
                {item.name} ·{' '}
                {boot.problems.find((problem) => problem.id === item.problem_id)
                  ?.title || item.problem_id}
              </strong>
              <small>
                {t(
                  `${item.failures} 次未通过`,
                  `${item.failures} failed attempts`,
                )}
              </small>
            </div>
            <SubmissionLink
              id={item.latest_submission_id}
              navigate={navigate}
              label={t('查看提交', 'View submission')}
            />
          </div>
        ))}
        {struggleError && (
          <p className="error-text" role="alert">
            {t(
              `练习关注记录暂不可用：${struggleError}`,
              `Repeated-failure data unavailable: ${englishMessage(struggleError)}`,
            )}
          </p>
        )}
        {!struggles.length && !struggleError && (
          <p className="quiet-empty">
            {t(
              '暂时没有需要关注的反复失败记录。',
              'No repeated failures to look at right now.',
            )}
          </p>
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
  const t = useT();
  const locale = useLocale();
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
      <h2>{t('课程权限', 'Course access')}</h2>
      <p className="muted">
        {t(
          '使用购买记录中的邮箱。尚未注册的学员验证相同邮箱后即可获得权限。',
          "Use the email from the purchase record. Students who haven't signed up get access once they verify that email.",
        )}
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
            if (!ids.length)
              throw new Error(t('请先创建课程', 'Create a course first'));
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
                t(
                  `${ids.length - failed.length} 门已开通，${failed.length} 门未成功，请重试未开通课程。`,
                  `${ids.length - failed.length} granted, ${failed.length} failed. Retry the courses that failed.`,
                ),
              );
            setNotice(
              t(
                `已开通 ${ids.length} 门课程`,
                `Access granted to ${ids.length} ${ids.length === 1 ? 'course' : 'courses'}`,
              ),
            );
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
            {t('学员邮箱', 'Student email')}
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
            {t('开通课程', 'Course')}
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
                {t(
                  '当前全部课程（不含未来新增课程）',
                  'All current courses (excludes future courses)',
                )}
              </NativeSelectOption>
              <NativeSelectOption value="*">
                {t(
                  '全部课程，包含未来新增课程',
                  'All courses, including future ones',
                )}
              </NativeSelectOption>
            </NativeSelect>
          </label>
          <label htmlFor="lms-teacher-field-3">
            {t(
              '有效期至（留空为永久）',
              'Expires on (leave blank for lifetime access)',
            )}
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
          {busy ? t('开通中…', 'Granting…') : t('开通权限', 'Grant access')}
        </Button>
      </form>
      {notice && <output className="success-text">{notice}</output>}
      {error && (
        <p role="alert" className="notice error">
          {t(error, englishMessage(error))}
        </p>
      )}
      <div className="lms-toolbar">
        <Input
          aria-label={t('搜索授权邮箱', 'Search access by email')}
          value={query}
          placeholder={t('按邮箱搜索权限…', 'Search access by email…')}
          onChange={(e) => setQuery(e.target.value)}
        />
        <NativeSelect
          aria-label={t('按课程筛选权限', 'Filter access by course')}
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          <NativeSelectOption value="">
            {t('全部课程', 'All courses')}
          </NativeSelectOption>
          {courses.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.title}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value="*">
            {t(
              '包含未来课程的通用权限',
              'All-access (includes future courses)',
            )}
          </NativeSelectOption>
        </NativeSelect>
        <NativeSelect
          aria-label={t('权限状态', 'Access status')}
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <NativeSelectOption value="active">
            {t('有效', 'Active')}
          </NativeSelectOption>
          <NativeSelectOption value="revoked">
            {t('已撤销', 'Revoked')}
          </NativeSelectOption>
          <NativeSelectOption value="expired">
            {t('已过期', 'Expired')}
          </NativeSelectOption>
          <NativeSelectOption value="">
            {t('全部状态', 'All statuses')}
          </NativeSelectOption>
        </NativeSelect>
        <Button variant="outline" onClick={list.refresh}>
          {t('刷新', 'Refresh')}
        </Button>
      </div>
      {list.busy && <output>{t('正在加载权限…', 'Loading access…')}</output>}
      {list.error && (
        <p role="alert" className="error-text">
          {t(list.error, englishMessage(list.error))}{' '}
          <Button variant="ghost" onClick={list.refresh}>
            {t('重试', 'Retry')}
          </Button>
        </p>
      )}
      <div className="lms-table-scroll">
        <table className="lms-table">
          <thead>
            <tr>
              <th>{t('学员邮箱', 'Student email')}</th>
              <th>{t('课程', 'Course')}</th>
              <th>{t('有效期', 'Expires')}</th>
              <th>{t('状态', 'Status')}</th>
              <th>{t('操作', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((grant) => (
              <tr key={grant.id}>
                <td>{grant.email}</td>
                <td>
                  {grant.course_id === '*'
                    ? t('全部课程（含未来）', 'All courses (incl. future)')
                    : courses.find((c) => c.id === grant.course_id)?.title ||
                      grant.course_id}
                </td>
                <td>
                  {grant.expires_at
                    ? new Date(grant.expires_at).toLocaleDateString(
                        locale === 'zh' ? 'zh-CN' : 'en-US',
                      )
                    : t('永久', 'Never')}
                </td>
                <td>
                  {grant.revoked_at
                    ? t('已撤销', 'Revoked')
                    : grant.expires_at && grant.expires_at <= now
                      ? t('已过期', 'Expired')
                      : t('有效', 'Active')}
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
                            t(
                              `确定撤销 ${grant.email} 的这项课程权限？`,
                              `Revoke this course access for ${grant.email}?`,
                            ),
                          )
                        )
                          return;
                        setBusy(true);
                        setError('');
                        try {
                          await api(`lms/grants/${grant.id}/revoke`, {});
                          list.refresh();
                          setNotice(t('权限已撤销', 'Access revoked'));
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t('撤销', 'Revoke')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.data && !list.data.items.length && (
        <p className="quiet-empty">
          {t('没有符合条件的权限记录。', 'No matching access records.')}
        </p>
      )}
      <CursorPagination list={list} />
    </section>
  );
}
function Students({ courses }: { courses: Course[] }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const list = useCursorPage<LmsStudent>(
    'lms/students?' + new URLSearchParams({ q: useDebounced(query) }),
  );
  return (
    <section className="form-card">
      <div className="lms-toolbar">
        <h2>{t('学员名单', 'Students')}</h2>
        <Button variant="outline" onClick={list.refresh}>
          {t('刷新名单', 'Refresh list')}
        </Button>
      </div>
      <Input
        aria-label={t('搜索学员', 'Search students')}
        placeholder={t('搜索姓名或邮箱…', 'Search by name or email…')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {list.busy && <output>{t('正在加载学员…', 'Loading students…')}</output>}
      {list.error && (
        <p role="alert" className="error-text">
          {t(list.error, englishMessage(list.error))}{' '}
          <Button variant="ghost" onClick={list.refresh}>
            {t('重试', 'Retry')}
          </Button>
        </p>
      )}
      <div className="lms-table-scroll">
        <table className="lms-table">
          <thead>
            <tr>
              <th>{t('学员', 'Student')}</th>
              <th>{t('账号状态', 'Account status')}</th>
              <th>{t('已开通课程', 'Enrolled courses')}</th>
              <th>{t('加入时间', 'Joined')}</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((student) => (
              <tr key={student.email}>
                <td>
                  <strong>
                    {student.name || t('尚未注册', 'Not signed up')}
                  </strong>
                  <small>{student.email}</small>
                </td>
                <td>
                  {!student.userId
                    ? t('待注册', 'Awaiting sign-up')
                    : student.verified
                      ? t('邮箱已验证', 'Email verified')
                      : t('待验证邮箱', 'Email not verified')}
                </td>
                <td>
                  {student.activeCourseIds
                    .map((id) =>
                      id === '*'
                        ? t('全部课程（含未来）', 'All courses (incl. future)')
                        : courses.find((c) => c.id === id)?.title || id,
                    )
                    .join(t('、', ', ')) || t('暂无权限', 'No access')}
                </td>
                <td>{student.joinedAt ? date(student.joinedAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.data && !list.data.items.length && (
        <p className="quiet-empty">
          {t('没有符合条件的学员。', 'No matching students.')}
        </p>
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
  const t = useT();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const labels: Record<string, string> = {
    google: t('Google 登录', 'Google sign-in'),
    github: t('GitHub 登录', 'GitHub sign-in'),
    email: t('邮箱验证码', 'Email verification code'),
    password: t('密码登录', 'Password sign-in'),
    video: t('课程视频', 'Course video'),
    judge: t('算法判题', 'Code judge'),
    checkout: t('课程购买', 'Course checkout'),
  };
  return (
    <div className="form-card">
      <div className="lms-toolbar">
        <h2>{t('服务配置状态', 'Service configuration')}</h2>
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
          {t('重新检测', 'Recheck')}
        </Button>
      </div>
      <p className="muted">
        {t(
          '这里检查服务配置是否齐全。视频处理、支付和判题结果会在各自流程中显示实际状态。',
          'Checks whether each service is configured. Video processing, payments, and judging show their actual status in their own flows.',
        )}
      </p>
      <div className="service-grid">
        {Object.entries(labels).map(([key, label]) => (
          <div key={key} className="service-row">
            <span>{label}</span>
            <span
              className={'tag ' + (boot.services[key] ? 'success-text' : '')}
            >
              {boot.services[key]
                ? t('配置已就绪', 'Configured')
                : t('尚未接入', 'Not connected')}
            </span>
          </div>
        ))}
      </div>
      <p className="notice">
        {t(
          '课程内容、学员和题库可在工作台直接管理。第三方服务的密钥由服务器管理员配置，接入后可点击重新检测。',
          'Course content, students, and problems can be managed right here in the dashboard. Third-party service keys are set by the server admin; click Recheck once a service is connected.',
        )}
      </p>
      {error && (
        <p role="alert" className="error-text">
          {t(error, englishMessage(error))}
        </p>
      )}
    </div>
  );
}
