'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, GitPullRequest, Plus, RefreshCw } from 'lucide-react';
import {
  api,
  ApiError,
  type Boot,
  type Release,
  date,
  statusNames,
} from '@/lib/types';
import type { LmsReview } from '@/lib/lms-types';
import type { OJSubmission } from '@/lib/oj-client';
import { useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { SubmissionResult } from './oj-results';
import { CodeEditor } from './editor';
import { Heading, Empty, type Navigate } from './learning';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  CursorPagination,
  LessonMarkdown,
  useCursorPage,
  useDebounced,
  useLocalDraft,
} from './lms-shared';

// English labels for the shared (Chinese) statusNames map in lib/types.
const statusEn: Record<string, string> = {
  accepted: 'Accepted',
  queued: 'Queued',
  compiling: 'Compiling',
  running: 'Running',
  finished: 'Finished',
  cancelled: 'Cancelled',
  memory_limit: 'Memory Limit Exceeded',
  output_limit: 'Output Limit Exceeded',
  wrong_answer: 'Wrong Answer',
  compile_error: 'Compile Error',
  time_limit: 'Time Limit Exceeded',
  runtime_error: 'Runtime Error',
  system_error: 'System Error',
  pending: 'Pending',
  submitting: 'Submitting',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  paid: 'Paid',
  refunded: 'Refunded',
};

export function SubmissionLink({
  id,
  navigate,
  label,
}: {
  id: string;
  navigate: Navigate;
  label?: string;
}) {
  const t = useT();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [submission, setSubmission] = useState<OJSubmission | null>(null);
  return (
    <>
      <Button
        variant="link"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            setSubmission(await api<OJSubmission>(`oj/submissions/${id}`));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {label ?? t('查看关联代码', 'View linked code')}
        <ArrowRight size={13} />
      </Button>
      {error && (
        <span role="alert" className="error-text">
          {t(error, englishMessage(error))}
        </span>
      )}
      <Dialog
        open={!!submission}
        onOpenChange={(open) => !open && setSubmission(null)}
      >
        <DialogContent className="wide-dialog lms-history-dialog">
          <DialogHeader>
            <DialogTitle>{t('查看提交代码', 'Submitted code')}</DialogTitle>
            <DialogDescription>
              {submission
                ? `${submission.language} · ${t(statusNames[submission.status], statusEn[submission.status]) || submission.status}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {submission && (
            <>
              <div className="lms-code-preview">
                <CodeEditor
                  value={submission.code || ''}
                  language={submission.language}
                  onChange={() => {}}
                  readOnly
                  path={`cswork://support/submission/${submission.id}`}
                />
              </div>
              <SubmissionResult submission={submission} />
              <Button
                variant="outline"
                onClick={() => {
                  navigate('problem', { problem: submission.problem_id });
                  setSubmission(null);
                }}
              >
                {t('进入对应题目', 'Go to problem')}
                <ArrowRight size={15} />
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReviewsView({
  boot,
  lessonId,
}: {
  boot: Boot;
  lessonId?: string;
}) {
  const t = useT();
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState(
      new URLSearchParams(
        typeof location === 'undefined' ? '' : location.search,
      ).get('status') || '',
    ),
    [selected, setSelected] = useState(
      new URLSearchParams(
        typeof location === 'undefined' ? '' : location.search,
      ).get('review') || '',
    ),
    [creating, setCreating] = useState(!!lessonId);
  const list = useCursorPage<LmsReview>(
    'lms/reviews?' +
      new URLSearchParams({ q: useDebounced(query), status: filter }),
  );
  const lessons = boot.courses
      .filter((c) => c.has_access)
      .flatMap((c) => c.lessons),
    teacher = boot.person?.role === 'teacher';
  return (
    <>
      <Heading
        title={
          teacher
            ? t('评审每一次进步。', 'Review every step forward')
            : t('让你的代码，得到反馈。', 'Get feedback on your code')
        }
        description={t(
          '提交工程练习或项目 PR，保留每轮修改和老师的反馈。',
          "Submit project exercises or PRs. Every revision and the teacher's feedback are kept.",
        )}
        action={
          <Button disabled={!lessons.length} onClick={() => setCreating(true)}>
            <Plus size={15} />
            {t('提交工程作业', 'Submit assignment')}
          </Button>
        }
      />
      <div className="lms-toolbar">
        <Input
          aria-label={t('搜索作业', 'Search assignments')}
          placeholder={t('搜索作业或学员…', 'Search assignments or students…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <NativeSelect
          aria-label={t('作业状态', 'Assignment status')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <NativeSelectOption value="">
            {t('全部状态', 'All statuses')}
          </NativeSelectOption>
          <NativeSelectOption value="pending">
            {t('待评审', 'Awaiting review')}
          </NativeSelectOption>
          <NativeSelectOption value="changes_requested">
            {t('需要修改', 'Changes requested')}
          </NativeSelectOption>
          <NativeSelectOption value="approved">
            {t('已通过', 'Approved')}
          </NativeSelectOption>
        </NativeSelect>
        <Button variant="outline" onClick={list.refresh}>
          <RefreshCw size={15} />
          {t('刷新', 'Refresh')}
        </Button>
      </div>
      {!lessons.length && !teacher && (
        <p className="notice">
          {t(
            '开通课程后即可提交工程作业。',
            'Unlock a course to submit assignments.',
          )}
        </p>
      )}
      {list.error && (
        <p role="alert" className="notice error">
          {t(list.error, englishMessage(list.error))}{' '}
          <Button variant="ghost" onClick={list.refresh}>
            {t('重试', 'Retry')}
          </Button>
        </p>
      )}
      {list.busy && <output>{t('正在加载作业…', 'Loading assignments…')}</output>}
      <div className="lms-review-grid">
        {list.data?.items.map((review) => (
          <article className="review-card" key={review.id}>
            <div className="section-title">
              <strong>
                {boot.courses
                  .flatMap((c) => c.lessons)
                  .find((l) => l.id === review.lesson_id)?.title ||
                  review.lesson_id}
              </strong>
              <span className="tag">
                {t(statusNames[review.status], statusEn[review.status])}
              </span>
            </div>
            <p className="muted">
              {review.name ? review.name + ' · ' : ''}
              {t(
                `第 ${review.revision} 次修订`,
                `Revision ${review.revision}`,
              )}{' '}
              · {date(review.updated_at || review.created_at)}
            </p>
            <p>{review.note}</p>
            {review.feedback && (
              <div className="feedback">
                <strong>{t('老师的反馈', 'Teacher feedback')}</strong>
                <p>{review.feedback}</p>
              </div>
            )}
            <Button variant="outline" onClick={() => setSelected(review.id)}>
              {teacher
                ? t('查看与评审', 'View and review')
                : review.status === 'changes_requested'
                  ? t('修改后重新提交', 'Revise and resubmit')
                  : t('查看记录', 'View history')}
              <ArrowRight size={15} />
            </Button>
          </article>
        ))}
      </div>
      {list.data && !list.data.items.length && (
        <Empty
          title={
            filter || query
              ? t('没有符合条件的作业', 'No matching assignments')
              : t('等待第一份作品', 'Waiting for the first submission')
          }
          description={t(
            '提交后，评审状态和修改记录都会保存在这里。',
            'Once submitted, review status and revisions are kept here.',
          )}
        />
      )}
      <CursorPagination list={list} />
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>{t('提交工程作业', 'Submit assignment')}</DialogTitle>
            <DialogDescription>
              {t(
                '私有仓库请先授予老师访问权限。',
                'For a private repository, give your teacher access first.',
              )}
            </DialogDescription>
          </DialogHeader>
          <ReviewCreate
            key={lessonId || 'new'}
            boot={boot}
            lessonId={lessonId}
            done={(id) => {
              setCreating(false);
              list.refresh();
              setSelected(id);
            }}
          />
        </DialogContent>
      </Dialog>
      <ReviewDetailDialog
        id={selected}
        boot={boot}
        close={() => setSelected('')}
        changed={list.refresh}
      />
    </>
  );
}
function ReviewCreate({
  boot,
  lessonId,
  done,
}: {
  boot: Boot;
  lessonId?: string;
  done: (id: string) => void;
}) {
  const t = useT();
  const lessons = boot.courses
    .filter((c) => c.has_access)
    .flatMap((c) => c.lessons);
  const draft = useLocalDraft(
    `cswork:review-new:${boot.person!.id}:${lessonId || 'general'}`,
    JSON.stringify({
      lessonId: lessonId || lessons[0]?.id || '',
      url: '',
      note: '',
    }),
  );
  let fields = {
    lessonId: lessonId || lessons[0]?.id || '',
    url: '',
    note: '',
  };
  try {
    fields = JSON.parse(draft.value);
  } catch {}
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        try {
          const result = await api<{ id: string }>('reviews', fields);
          draft.clear();
          done(result.id);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {draft.restored && (
        <p className="notice">
          {t('已恢复未提交的作业草稿。', 'Restored your unsent assignment draft.')}
        </p>
      )}
      <label htmlFor="lms-support-field-2">
        {t('对应章节', 'Lesson')}
        <NativeSelect
          id="lms-support-field-2"
          value={fields.lessonId}
          required
          onChange={(e) =>
            draft.update(
              JSON.stringify({ ...fields, lessonId: e.target.value }),
            )
          }
        >
          {lessons.map((lesson) => (
            <NativeSelectOption key={lesson.id} value={lesson.id}>
              {lesson.title}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      <label htmlFor="lms-support-field-3">
        {t('GitHub 仓库或 PR', 'GitHub repository or PR')}
        <Input
          id="lms-support-field-3"
          type="url"
          value={fields.url}
          required
          placeholder="https://github.com/you/project/pull/1"
          onChange={(e) =>
            draft.update(JSON.stringify({ ...fields, url: e.target.value }))
          }
        />
      </label>
      <label>
        {t('实现与验证说明', 'Implementation and testing notes')}
        <textarea
          rows={5}
          maxLength={6000}
          value={fields.note}
          onChange={(e) =>
            draft.update(JSON.stringify({ ...fields, note: e.target.value }))
          }
        />
      </label>
      {(error || draft.storageError) && (
        <p role="alert" className="error-text">
          {error ? t(error, englishMessage(error)) : draft.storageError}
        </p>
      )}
      <Button type="submit" disabled={busy || !lessons.length}>
        <GitPullRequest size={15} />
        {busy
          ? t('正在提交…', 'Submitting…')
          : t('提交评审', 'Submit for review')}
      </Button>
    </form>
  );
}
export function ReviewDetailDialog({
  id,
  boot,
  close,
  changed,
}: {
  id: string;
  boot: Boot;
  close: () => void;
  changed: () => void;
}) {
  const t = useT();
  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && close()}>
      <DialogContent className="wide-dialog lms-history-dialog">
        <DialogHeader>
          <DialogTitle>
            {t('作业与评审记录', 'Assignment and review history')}
          </DialogTitle>
          <DialogDescription>
            {t(
              '每轮提交保留对应代码链接、说明和评审反馈。',
              'Each submission keeps its code link, notes and review feedback.',
            )}
          </DialogDescription>
        </DialogHeader>
        {id && <ReviewDetail key={id} id={id} boot={boot} changed={changed} />}
      </DialogContent>
    </Dialog>
  );
}
function ReviewDetail({
  id,
  boot,
  changed,
}: {
  id: string;
  boot: Boot;
  changed: () => void;
}) {
  const t = useT();
  const [review, setReview] = useState<LmsReview | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0),
    [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line react/react-compiler -- A keyed server fetch resets request feedback; the separate local draft preserves unsent text.
    setError('');
    api<LmsReview>(`lms/reviews/${id}`)
      .then((value) => active && setReview(value))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id, retry]);
  async function submit(
    kind: 'feedback' | 'resubmit',
    data: Record<string, unknown>,
  ) {
    if (!review || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await api<LmsReview>(`lms/reviews/${id}/${kind}`, {
        ...data,
        expectedRevision: review.revision,
      });
      setReview(next);
      setNotice(
        kind === 'feedback'
          ? t(
              '评审已提交，学员会收到通知',
              'Review submitted. The student will be notified.',
            )
          : t(
              '修改已提交，等待老师再次评审',
              'Revision submitted. Waiting for the teacher to review it again.',
            ),
      );
      changed();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? t(
              '这份作业已被更新，请重新加载后再提交。填写的内容会保留为本地草稿。',
              'This assignment was updated. Reload before submitting; what you wrote is kept as a local draft.',
            )
          : (e as Error).message,
      );
      throw e;
    } finally {
      setBusy(false);
    }
  }
  if (!review)
    return (
      <>
        {error ? (
          <p role="alert" className="error-text">
            {t(error, englishMessage(error))}
          </p>
        ) : (
          <output>{t('正在加载评审记录…', 'Loading review history…')}</output>
        )}
        <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
          {t('重新加载', 'Reload')}
        </Button>
      </>
    );
  return (
    <>
      <div className="lms-toolbar">
        <span className="tag">
          {t(statusNames[review.status], statusEn[review.status])}
        </span>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => setRetry((n) => n + 1)}
        >
          {t('刷新记录', 'Refresh')}
        </Button>
      </div>
      <a href={review.url} target="_blank" rel="noreferrer">
        {t('查看当前提交的代码 ↗', 'View current code ↗')}
      </a>
      <LessonMarkdown
        body={review.note || t('未填写实现说明。', 'No implementation notes.')}
      />
      {review.feedback && (
        <div className="feedback">
          <strong>{t('老师的反馈', 'Teacher feedback')}</strong>
          <LessonMarkdown body={review.feedback} />
        </div>
      )}
      <h3>{t('修改与评审历史', 'Revision and review history')}</h3>
      {review.events?.map((event, index) => (
        <article
          className="lms-event"
          key={`${event.revision}:${event.kind}:${index}`}
        >
          <strong>
            {t(`第 ${event.revision} 版`, `Version ${event.revision}`)} ·{' '}
            {t(statusNames[event.status], statusEn[event.status]) || event.kind}
          </strong>
          <small>
            {t(event.actorName, englishMessage(event.actorName))} ·{' '}
            {date(event.createdAt)}
            {event.lessonVersion
              ? t(' · 课件 v', ' · lesson v') + event.lessonVersion
              : ''}
          </small>
          <a href={event.url} target="_blank" rel="noreferrer">
            {t('查看当时的代码 ↗', 'View code at this version ↗')}
          </a>
          <LessonMarkdown body={event.feedback || event.note || ''} />
        </article>
      ))}
      {!review.events?.length && (
        <p className="muted">
          {t(
            '历史记录将从下一次修改开始保留。',
            'History is kept starting from the next revision.',
          )}
        </p>
      )}
      <ReviewAction
        key={id + ':' + review.revision}
        review={review}
        teacher={boot.person?.role === 'teacher'}
        userId={boot.person!.id}
        busy={busy}
        submit={submit}
      />
      {notice && <output className="success-text">{notice}</output>}
      {error && (
        <p role="alert" className="error-text">
          {t(error, englishMessage(error))}
        </p>
      )}
    </>
  );
}
function ReviewAction({
  review,
  teacher,
  userId,
  busy,
  submit,
}: {
  review: LmsReview;
  teacher: boolean;
  userId: string;
  busy: boolean;
  submit: (
    kind: 'feedback' | 'resubmit',
    data: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const t = useT();
  const draft = useLocalDraft(
    `cswork:review:${userId}:${review.id}:${teacher ? 'feedback' : 'resubmit'}`,
    JSON.stringify({
      url: review.url,
      note: '',
      feedback: '',
      status: 'changes_requested',
    }),
  );
  let fields = {
    url: review.url,
    note: '',
    feedback: '',
    status: 'changes_requested',
  };
  try {
    fields = JSON.parse(draft.value);
  } catch {}
  if (!teacher && review.status !== 'changes_requested')
    return (
      <p className="notice">
        {review.status === 'pending'
          ? t(
              '老师正在等待评审这份作业。收到修改建议后，可在此继续提交。',
              'Waiting for the teacher to review this assignment. If changes are requested, you can resubmit here.',
            )
          : t('这份作业已经通过评审。', 'This assignment has been approved.')}
      </p>
    );
  return (
    <form
      className="stack-form lms-review-action"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await submit(
            teacher ? 'feedback' : 'resubmit',
            teacher
              ? { feedback: fields.feedback, status: fields.status }
              : { url: fields.url, note: fields.note },
          );
          draft.clear();
        } catch {}
      }}
    >
      <h3>
        {teacher
          ? t('提交评审', 'Submit review')
          : t('修改后重新提交', 'Revise and resubmit')}
      </h3>
      {draft.restored && (
        <p className="muted">
          {t('已恢复未提交内容。', 'Restored your unsent content.')}
        </p>
      )}
      {teacher ? (
        <>
          <label htmlFor="lms-support-field-4">
            {t('结论', 'Decision')}
            <NativeSelect
              id="lms-support-field-4"
              value={fields.status}
              onChange={(e) =>
                draft.update(
                  JSON.stringify({ ...fields, status: e.target.value }),
                )
              }
            >
              <NativeSelectOption value="changes_requested">
                {t('需要修改', 'Request changes')}
              </NativeSelectOption>
              <NativeSelectOption value="approved">
                {t('评审通过', 'Approve')}
              </NativeSelectOption>
            </NativeSelect>
          </label>
          <label>
            {t('评审反馈', 'Feedback')}
            <textarea
              rows={5}
              required
              value={fields.feedback}
              maxLength={12000}
              onChange={(e) =>
                draft.update(
                  JSON.stringify({ ...fields, feedback: e.target.value }),
                )
              }
            />
          </label>
        </>
      ) : (
        <>
          <label htmlFor="lms-support-field-5">
            {t('更新后的 GitHub 仓库或 PR', 'Updated GitHub repository or PR')}
            <Input
              id="lms-support-field-5"
              type="url"
              required
              value={fields.url}
              onChange={(e) =>
                draft.update(JSON.stringify({ ...fields, url: e.target.value }))
              }
            />
          </label>
          <label>
            {t('本轮修改与验证', 'What changed and how you tested it')}
            <textarea
              rows={5}
              required
              maxLength={6000}
              value={fields.note}
              onChange={(e) =>
                draft.update(
                  JSON.stringify({ ...fields, note: e.target.value }),
                )
              }
            />
          </label>
        </>
      )}
      {draft.storageError && (
        <p role="alert" className="error-text">
          {draft.storageError}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy
          ? t('提交中…', 'Submitting…')
          : teacher
            ? t('提交评审反馈', 'Submit feedback')
            : t('提交新版本', 'Submit new version')}
      </Button>
    </form>
  );
}

export function ReleasesView({
  navigate,
  refresh,
}: {
  navigate: Navigate;
  refresh?: () => Promise<void>;
}) {
  const t = useT();
  const list = useCursorPage<Release>('lms/releases'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');
  const failure = error || list.error;
  return (
    <>
      <Heading
        title={t('课程，也在不断进步。', 'Courses keep improving too')}
        description={t(
          '查看每次修订的具体内容，重要更新会通过站内消息提醒。',
          'See what changed in each revision. Important updates also arrive as notifications.',
        )}
        action={
          <Button variant="outline" onClick={list.refresh}>
            {t('刷新更新', 'Refresh')}
          </Button>
        }
      />
      {failure && (
        <p role="alert" className="notice error">
          {t(failure, englishMessage(failure))}{' '}
          <Button variant="ghost" onClick={list.refresh}>
            {t('重试', 'Retry')}
          </Button>
        </p>
      )}
      {list.busy && (
        <output>{t('正在加载课程更新…', 'Loading course updates…')}</output>
      )}
      <div className="release-timeline">
        {list.data?.items.map((release) => (
          <article className="release-card" key={release.id}>
            <div className="release-date">
              <span>{date(release.created_at)}</span>
              <strong>v{release.version}</strong>
            </div>
            <div>
              <div className="release-title">
                <h2>{release.title}</h2>
                {!release.is_read && (
                  <span className="tag">{t('未读', 'Unread')}</span>
                )}
                {!!release.important && (
                  <span className="tag">{t('重要更新', 'Important')}</span>
                )}
              </div>
              <LessonMarkdown body={release.body} />
              <div className="form-actions">
                {release.lesson_id && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate('lesson', { lesson: release.lesson_id! })
                    }
                  >
                    {t('查看更新章节', 'View updated lesson')}
                    <ArrowRight size={15} />
                  </Button>
                )}
                {!release.is_read && (
                  <Button
                    variant="ghost"
                    disabled={!!busy}
                    onClick={async () => {
                      setBusy(release.id);
                      setError('');
                      try {
                        await api(`releases/${release.id}/read`, {});
                        list.refresh();
                        await refresh?.();
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy('');
                      }
                    }}
                  >
                    {t('标记已读', 'Mark as read')}
                  </Button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {list.data && !list.data.items.length && (
        <Empty title={t('暂无课程更新', 'No course updates yet')} />
      )}
      <CursorPagination list={list} />
    </>
  );
}
