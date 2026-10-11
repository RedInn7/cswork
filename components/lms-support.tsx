'use client';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  FileText,
  GitPullRequest,
  Lock,
  Plus,
  RefreshCw,
  Send,
} from 'lucide-react';
import {
  api,
  ApiError,
  type Boot,
  type Release,
  date,
  statusNames,
} from '@/lib/types';
import type { LmsReview, LmsTicket } from '@/lib/lms-types';
import type { OJSubmission } from '@/lib/oj-client';
import { readLocale, useT } from '@/lib/i18n';
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
  open: 'Awaiting teacher',
  waiting: 'Awaiting you',
  resolved: 'Resolved',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  paid: 'Paid',
  refunded: 'Refunded',
};

type ComposerProps = {
  context: Record<string, string> | null;
  close: () => void;
  onCreated: (id: string) => void;
  boot: Boot;
};
export function TicketComposer(props: ComposerProps) {
  return props.context ? (
    <TicketForm
      key={JSON.stringify(props.context)}
      {...props}
      context={props.context}
    />
  ) : null;
}
function TicketForm({
  context,
  close,
  onCreated,
  boot,
}: ComposerProps & { context: Record<string, string> }) {
  const t = useT();
  const initial = JSON.stringify({
    title: context.title || '',
    body: context.body || '',
  });
  const draft = useLocalDraft(
    `cswork:ticket:${boot.person?.id}:${context.courseId || context.lessonId || context.submissionId || 'general'}`,
    initial,
  );
  let fields = { title: context.title || '', body: context.body || '' };
  try {
    fields = JSON.parse(draft.value);
  } catch {}
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const course = boot.courses.find((c) => c.id === context.courseId);
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && close()}>
      <DialogContent className="wide-dialog">
        <DialogHeader>
          <DialogTitle>
            {context.courseId
              ? t('申请开通课程', 'Request course access')
              : t('向老师提问', 'Ask your teacher')}
          </DialogTitle>
          <DialogDescription>
            {t(
              '仅你和老师可见，未提交的内容会保留在这台设备上。',
              'Only you and your teacher can see this. Unsent text stays on this device.',
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            try {
              const result = await api<{ id: string }>('tickets', {
                ...context,
                ...fields,
                ...(context.videoPosition !== undefined
                  ? { videoPosition: Number(context.videoPosition) }
                  : {}),
              });
              draft.clear();
              onCreated(result.id);
              close();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {draft.restored && (
            <output className="notice">
              {t('已恢复未提交的草稿。', 'Restored your unsent draft.')}
            </output>
          )}
          <label htmlFor="lms-support-field-1">
            {t('标题', 'Title')}
            <Input
              id="lms-support-field-1"
              value={fields.title}
              onChange={(e) =>
                draft.update(
                  JSON.stringify({ ...fields, title: e.target.value }),
                )
              }
              required
              maxLength={180}
            />
          </label>
          <label>
            {t('详细说明', 'Details')}
            <textarea
              value={fields.body}
              onChange={(e) =>
                draft.update(
                  JSON.stringify({ ...fields, body: e.target.value }),
                )
              }
              required
              rows={7}
              maxLength={12000}
              placeholder={t(
                '预期是什么，实际发生了什么？可使用 Markdown 和代码块。',
                'What did you expect, and what happened instead? Markdown and code blocks are supported.',
              )}
            />
          </label>
          {context.courseId && (
            <p className="context-label">
              {t('申请课程：', 'Course: ')}
              {course?.title || context.courseId}
            </p>
          )}
          {context.lessonId && (
            <p className="context-label">
              {t('关联章节：', 'Lesson: ')}
              {boot.courses
                .flatMap((c) => c.lessons)
                .find((l) => l.id === context.lessonId)?.title ||
                context.lessonId}
              {context.videoPosition !== undefined &&
                ` · ${time(Number(context.videoPosition))}`}
            </p>
          )}
          {(error || draft.storageError) && (
            <p role="alert" className="error-text">
              {error ? t(error, englishMessage(error)) : draft.storageError}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            <Send size={15} />
            {busy
              ? t('提交中…', 'Submitting…')
              : context.courseId
                ? t('提交开通申请', 'Submit access request')
                : t('提交私密工单', 'Submit private ticket')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function time(value: number) {
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

export function TicketView({
  boot,
  selected,
  navigate,
  ask,
}: {
  boot: Boot;
  selected?: string;
  navigate: Navigate;
  ask: () => void;
}) {
  return selected ? (
    <TicketDetail
      key={selected}
      boot={boot}
      id={selected}
      navigate={navigate}
    />
  ) : (
    <TicketList boot={boot} navigate={navigate} ask={ask} />
  );
}
function TicketList({
  boot,
  navigate,
  ask,
}: {
  boot: Boot;
  navigate: Navigate;
  ask: () => void;
}) {
  const t = useT();
  const [filter, setFilter] = useState(
      new URLSearchParams(
        typeof location === 'undefined' ? '' : location.search,
      ).get('status') || '',
    ),
    [query, setQuery] = useState('');
  const debounced = useDebounced(query),
    list = useCursorPage<LmsTicket>(
      'lms/tickets?' + new URLSearchParams({ status: filter, q: debounced }),
    );
  return (
    <>
      <Heading
        title={
          boot.person?.role === 'teacher'
            ? t('学员的问题，集中处理。', 'All student questions in one place')
            : t('每个问题，都有回应。', 'Every question gets an answer')
        }
        description={t(
          '问题、附件和解决过程都会保留，仅学员本人和老师可见。',
          'Questions, attachments and their resolution are kept here, visible only to the student and the teacher.',
        )}
        action={
          <Button onClick={ask}>
            <Plus size={16} />
            {t('新建工单', 'New ticket')}
          </Button>
        }
      />
      <div className="lms-toolbar">
        <Input
          aria-label={t('搜索工单', 'Search tickets')}
          placeholder={t('搜索标题、内容或学员…', 'Search titles, content or students…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <NativeSelect
          aria-label={t('工单状态', 'Ticket status')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <NativeSelectOption value="">
            {t('全部状态', 'All statuses')}
          </NativeSelectOption>
          <NativeSelectOption value="open">
            {t('待老师回复', 'Awaiting teacher')}
          </NativeSelectOption>
          <NativeSelectOption value="waiting">
            {t('待学员确认', 'Awaiting student')}
          </NativeSelectOption>
          <NativeSelectOption value="resolved">
            {t('已解决', 'Resolved')}
          </NativeSelectOption>
        </NativeSelect>
        <Button variant="outline" onClick={list.refresh}>
          <RefreshCw size={15} />
          {t('刷新', 'Refresh')}
        </Button>
      </div>
      {list.error && (
        <p role="alert" className="notice error">
          {t(list.error, englishMessage(list.error))}{' '}
          <Button variant="ghost" onClick={list.refresh}>
            {t('重试', 'Retry')}
          </Button>
        </p>
      )}
      {list.busy && <output>{t('正在加载工单…', 'Loading tickets…')}</output>}
      <div className="ticket-list">
        {list.data?.items.map((ticket) => (
          <button
            key={ticket.id}
            onClick={() => navigate('tickets', { ticket: ticket.id })}
          >
            <Lock size={18} />
            <div>
              <strong>{ticket.title}</strong>
              <p>{ticket.body.slice(0, 100)}</p>
              <small>
                {ticket.name ? ticket.name + ' · ' : ''}
                {ticket.course_title ? ticket.course_title + ' · ' : ''}
                {date(ticket.updated_at)}
              </small>
            </div>
            <span className="tag">
              {t(statusNames[ticket.status], statusEn[ticket.status])}
            </span>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
      {list.data && !list.data.items.length && (
        <Empty
          title={
            query || filter
              ? t('没有符合条件的工单', 'No matching tickets')
              : t('这里还没有工单', 'No tickets yet')
          }
          description={t(
            '可以调整筛选条件，或发起新的问题。',
            'Try different filters, or ask a new question.',
          )}
        />
      )}
      <CursorPagination list={list} />
    </>
  );
}
function TicketDetail({
  boot,
  id,
  navigate,
}: {
  boot: Boot;
  id: string;
  navigate: Navigate;
}) {
  const t = useT();
  const [ticket, setTicket] = useState<LmsTicket | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(''),
    [retry, setRetry] = useState(0);
  const draft = useLocalDraft(`cswork:reply:${boot.person!.id}:${id}`, '');
  useEffect(() => {
    let active = true;
    // oxlint-disable-next-line react/react-compiler -- A keyed server fetch resets request feedback; the separate local draft preserves unsent text.
    setLoading(true);
    setError('');
    api<LmsTicket>(`lms/tickets/${id}`)
      .then((next) => active && setTicket(next))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, retry]);
  async function reload() {
    setTicket(await api<LmsTicket>(`lms/tickets/${id}`));
  }
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError(
          t(
            '工单有新的回复或状态变化，已重新加载。你的回复草稿仍在，请确认后再提交。',
            'This ticket has new replies or a status change, so it was reloaded. Your draft is still here; review it before sending.',
          ),
        );
        try {
          await reload();
        } catch {}
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!ticket)
    return (
      <Empty
        title={
          loading
            ? t('正在加载工单…', 'Loading ticket…')
            : error
              ? t(error, englishMessage(error))
              : t('工单不存在', 'Ticket not found')
        }
        action={
          <div className="form-actions">
            <Button onClick={() => setRetry((n) => n + 1)}>
              {t('重试', 'Retry')}
            </Button>
            <Button variant="outline" onClick={() => navigate('tickets')}>
              {t('返回列表', 'Back to list')}
            </Button>
          </div>
        }
      />
    );
  return (
    <>
      <div className="breadcrumb">
        <button onClick={() => navigate('tickets')}>
          {t('全部工单', 'All tickets')}
        </button>
        <ArrowRight size={13} />
        <span>#{id.slice(0, 8)}</span>
      </div>
      <Heading
        title={ticket.title}
        action={
          <Button
            variant="outline"
            disabled={busy || loading}
            onClick={() => setRetry((n) => n + 1)}
          >
            <RefreshCw size={15} />
            {t('刷新回复', 'Refresh replies')}
          </Button>
        }
      />
      <section className="thread-card">
        <div className="lms-toolbar">
          <span className="tag">
            <Lock size={12} />
            {t(statusNames[ticket.status], statusEn[ticket.status])}
          </span>
          <span className="muted">
            {ticket.name || boot.person?.name} · {date(ticket.created_at)}
          </span>
        </div>
        {ticket.course_id && (
          <div className="notice">
            {t('申请课程：', 'Course requested: ')}
            {ticket.course_title ||
              boot.courses.find((c) => c.id === ticket.course_id)?.title ||
              ticket.course_id}
            {boot.person?.role === 'teacher' && (
              <Button
                variant="link"
                onClick={() =>
                  navigate('teacher', {
                    tab: 'students',
                    email: ticket.email || '',
                    course: ticket.course_id!,
                  })
                }
              >
                {t('为该学员开通', 'Unlock for this student')}
              </Button>
            )}
          </div>
        )}
        <div className="thread-message">
          <LessonMarkdown body={ticket.body} />
          <div className="form-actions">
            {ticket.lesson_id && (
              <Button
                variant="link"
                onClick={() =>
                  navigate('lesson', {
                    lesson: ticket.lesson_id!,
                    ...(ticket.video_position !== null
                      ? { t: String(ticket.video_position) }
                      : {}),
                    ...(ticket.video_asset_id
                      ? { video: ticket.video_asset_id }
                      : {}),
                  })
                }
              >
                {ticket.video_position !== null
                  ? t(
                      `播放至 ${time(ticket.video_position)}`,
                      `Play from ${time(ticket.video_position)}`,
                    )
                  : t('查看关联章节', 'View related lesson')}
                <ArrowRight size={13} />
              </Button>
            )}
            {ticket.submission_id && (
              <SubmissionLink id={ticket.submission_id} navigate={navigate} />
            )}
          </div>
        </div>
        {ticket.replies?.map((reply) => (
          <div
            key={reply.id}
            className={
              'thread-message ' +
              (reply.role === 'teacher' ? 'teacher-message' : '')
            }
          >
            <div className="message-meta">
              <strong>
                {reply.name}
                {reply.role === 'teacher' && (
                  <span className="tag">{t('老师', 'Teacher')}</span>
                )}
              </strong>
              <span>{date(reply.created_at)}</span>
            </div>
            <LessonMarkdown body={reply.body} />
          </div>
        ))}
        <div className="attachment-section">
          <h3>{t('附件', 'Attachments')}</h3>
          {ticket.attachments?.map((file) => (
            <div key={file.id} className="lms-attachment-row">
              <a
                href={`/api/attachments/${file.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <FileText size={15} />
                {file.name}
                <small>{Math.ceil(file.size / 1024)} KB</small>
              </a>
              {(boot.person?.role === 'teacher' ||
                file.user_id === boot.person?.id) && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        t(
                          `确定删除附件「${file.name}」？`,
                          `Delete attachment "${file.name}"?`,
                        ),
                      )
                    )
                      void action(async () => {
                        await api(`lms/attachments/${file.id}/delete`, {});
                        await reload();
                        setNotice(t('附件已删除', 'Attachment deleted'));
                      });
                  }}
                >
                  {t('删除', 'Delete')}
                </Button>
              )}
            </div>
          ))}
          {!ticket.attachments?.length && (
            <p className="muted">{t('还没有附件。', 'No attachments yet.')}</p>
          )}
          <label className="attachment-upload">
            {t(
              '添加图片、PDF、文本或代码（最大 2 MB）',
              'Add an image, PDF, text or code file (max 2 MB)',
            )}
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,.txt,.log,.go,.py,.java,.cpp"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  setError(
                    t('附件不能超过 2 MB', 'Attachments must be 2 MB or smaller'),
                  );
                  return;
                }
                void action(async () => {
                  setNotice(t('正在上传附件…', 'Uploading attachment…'));
                  const response = await fetch(
                    `/api/tickets/${id}/attachments?name=${encodeURIComponent(file.name)}`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/octet-stream',
                        // Like api(): the server answers errors in the site language.
                        'X-Locale': readLocale(),
                      },
                      body: file,
                    },
                  );
                  const data = await response.json();
                  if (!response.ok)
                    throw new Error(data.error || t('上传失败', 'Upload failed'));
                  await reload();
                  setNotice(t('附件已上传', 'Attachment uploaded'));
                });
              }}
            />
          </label>
        </div>
        <form
          className="reply-form"
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              setTicket(
                await api<LmsTicket>(`lms/tickets/${id}/reply`, {
                  body: draft.value,
                  expectedRevision: ticket.revision,
                }),
              );
              draft.update('');
              draft.clear();
              setNotice(t('回复已发送', 'Reply sent'));
            });
          }}
        >
          <label htmlFor="reply-body">{t('继续沟通', 'Reply')}</label>
          {draft.restored && (
            <p className="muted">
              {t('已恢复未发送的回复。', 'Restored your unsent reply.')}
            </p>
          )}
          <textarea
            id="reply-body"
            value={draft.value}
            onChange={(e) => draft.update(e.target.value)}
            required
            rows={5}
            maxLength={12000}
            placeholder={t(
              '补充思路或回复老师，支持 Markdown…',
              'Add details or reply to your teacher. Markdown supported…',
            )}
          />
          <div className="form-actions">
            <Button type="submit" disabled={busy || !draft.value.trim()}>
              <Send size={15} />
              {busy ? t('处理中…', 'Working…') : t('发送回复', 'Send reply')}
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  setTicket(
                    await api<LmsTicket>(`lms/tickets/${id}/status`, {
                      status:
                        ticket.status === 'resolved' ? 'open' : 'resolved',
                      expectedRevision: ticket.revision,
                    }),
                  );
                  setNotice(t('工单状态已更新', 'Ticket status updated'));
                })
              }
            >
              {ticket.status === 'resolved'
                ? t('重新打开', 'Reopen')
                : t('标记已解决', 'Mark as resolved')}
            </Button>
          </div>
        </form>
        {notice && <output className="success-text">{notice}</output>}
        {(error || draft.storageError) && (
          <p role="alert" className="notice error">
            {error ? t(error, englishMessage(error)) : draft.storageError}
          </p>
        )}
      </section>
    </>
  );
}
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
            {event.actorName} · {date(event.createdAt)}
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
