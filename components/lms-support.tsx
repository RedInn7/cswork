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
            {context.courseId ? '申请开通课程' : '向老师提问'}
          </DialogTitle>
          <DialogDescription>
            仅你和老师可见，未提交的内容会保留在这台设备上。
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
            <output className="notice">已恢复未提交的草稿。</output>
          )}
          <label htmlFor="lms-support-field-1">
            标题
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
            详细说明
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
              placeholder="预期是什么，实际发生了什么？可使用 Markdown 和代码块。"
            />
          </label>
          {context.courseId && (
            <p className="context-label">
              申请课程：{course?.title || context.courseId}
            </p>
          )}
          {context.lessonId && (
            <p className="context-label">
              关联章节：
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
              {error || draft.storageError}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            <Send size={15} />
            {busy
              ? '提交中…'
              : context.courseId
                ? '提交开通申请'
                : '提交私密工单'}
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
        label="SUPPORT THAT STAYS WITH YOU"
        title={
          boot.person?.role === 'teacher'
            ? '学员的问题，集中处理。'
            : '每个问题，都有回应。'
        }
        description="问题、附件和解决过程都会保留，仅学员本人和老师可见。"
        action={
          <Button onClick={ask}>
            <Plus size={16} />
            新建工单
          </Button>
        }
      />
      <div className="lms-toolbar">
        <Input
          aria-label="搜索工单"
          placeholder="搜索标题、内容或学员…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <NativeSelect
          aria-label="工单状态"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <NativeSelectOption value="">全部状态</NativeSelectOption>
          <NativeSelectOption value="open">待老师回复</NativeSelectOption>
          <NativeSelectOption value="waiting">待学员确认</NativeSelectOption>
          <NativeSelectOption value="resolved">已解决</NativeSelectOption>
        </NativeSelect>
        <Button variant="outline" onClick={list.refresh}>
          <RefreshCw size={15} />
          刷新
        </Button>
      </div>
      {list.error && (
        <p role="alert" className="notice error">
          {list.error}{' '}
          <Button variant="ghost" onClick={list.refresh}>
            重试
          </Button>
        </p>
      )}
      {list.busy && <output>正在加载工单…</output>}
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
            <span className="tag">{statusNames[ticket.status]}</span>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
      {list.data && !list.data.items.length && (
        <Empty
          title={query || filter ? '没有符合条件的工单' : '这里还没有工单'}
          description="可以调整筛选条件，或发起新的问题。"
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
          '工单有新的回复或状态变化，已重新加载。你的回复草稿仍在，请确认后再提交。',
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
        title={loading ? '正在加载工单…' : error || '工单不存在'}
        action={
          <div className="form-actions">
            <Button onClick={() => setRetry((n) => n + 1)}>重试</Button>
            <Button variant="outline" onClick={() => navigate('tickets')}>
              返回列表
            </Button>
          </div>
        }
      />
    );
  return (
    <>
      <div className="breadcrumb">
        <button onClick={() => navigate('tickets')}>全部工单</button>
        <ArrowRight size={13} />
        <span>#{id.slice(0, 8)}</span>
      </div>
      <Heading
        label="PRIVATE CONVERSATION"
        title={ticket.title}
        action={
          <Button
            variant="outline"
            disabled={busy || loading}
            onClick={() => setRetry((n) => n + 1)}
          >
            <RefreshCw size={15} />
            刷新回复
          </Button>
        }
      />
      <section className="thread-card">
        <div className="lms-toolbar">
          <span className="tag">
            <Lock size={12} />
            {statusNames[ticket.status]}
          </span>
          <span className="muted">
            {ticket.name || boot.person?.name} · {date(ticket.created_at)}
          </span>
        </div>
        {ticket.course_id && (
          <div className="notice">
            申请课程：
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
                为该学员开通
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
                  ? `播放至 ${time(ticket.video_position)}`
                  : '查看关联章节'}
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
                {reply.role === 'teacher' && <span className="tag">老师</span>}
              </strong>
              <span>{date(reply.created_at)}</span>
            </div>
            <LessonMarkdown body={reply.body} />
          </div>
        ))}
        <div className="attachment-section">
          <h3>附件</h3>
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
                    if (window.confirm(`确定删除附件「${file.name}」？`))
                      void action(async () => {
                        await api(`lms/attachments/${file.id}/delete`, {});
                        await reload();
                        setNotice('附件已删除');
                      });
                  }}
                >
                  删除
                </Button>
              )}
            </div>
          ))}
          {!ticket.attachments?.length && <p className="muted">还没有附件。</p>}
          <label className="attachment-upload">
            添加图片、PDF、文本或代码（最大 2 MB）
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,.txt,.log,.go,.py,.java,.cpp"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  setError('附件不能超过 2 MB');
                  return;
                }
                void action(async () => {
                  setNotice('正在上传附件…');
                  const response = await fetch(
                    `/api/tickets/${id}/attachments?name=${encodeURIComponent(file.name)}`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/octet-stream' },
                      body: file,
                    },
                  );
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error || '上传失败');
                  await reload();
                  setNotice('附件已上传');
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
              setNotice('回复已发送');
            });
          }}
        >
          <label htmlFor="reply-body">继续沟通</label>
          {draft.restored && <p className="muted">已恢复未发送的回复。</p>}
          <textarea
            id="reply-body"
            value={draft.value}
            onChange={(e) => draft.update(e.target.value)}
            required
            rows={5}
            maxLength={12000}
            placeholder="补充思路或回复老师，支持 Markdown…"
          />
          <div className="form-actions">
            <Button type="submit" disabled={busy || !draft.value.trim()}>
              <Send size={15} />
              {busy ? '处理中…' : '发送回复'}
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
                  setNotice('工单状态已更新');
                })
              }
            >
              {ticket.status === 'resolved' ? '重新打开' : '标记已解决'}
            </Button>
          </div>
        </form>
        {notice && <output className="success-text">{notice}</output>}
        {(error || draft.storageError) && (
          <p role="alert" className="notice error">
            {error || draft.storageError}
          </p>
        )}
      </section>
    </>
  );
}
export function SubmissionLink({
  id,
  navigate,
  label = '查看关联代码',
}: {
  id: string;
  navigate: Navigate;
  label?: string;
}) {
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
        {label}
        <ArrowRight size={13} />
      </Button>
      {error && (
        <span role="alert" className="error-text">
          {error}
        </span>
      )}
      <Dialog
        open={!!submission}
        onOpenChange={(open) => !open && setSubmission(null)}
      >
        <DialogContent className="wide-dialog lms-history-dialog">
          <DialogHeader>
            <DialogTitle>查看提交代码</DialogTitle>
            <DialogDescription>
              {submission
                ? `${submission.language} · ${statusNames[submission.status] || submission.status}`
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
                进入对应题目
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
        label="BUILD. SUBMIT. IMPROVE."
        title={teacher ? '评审每一次进步。' : '让你的代码，得到反馈。'}
        description="提交工程练习或项目 PR，保留每轮修改和老师的反馈。"
        action={
          <Button disabled={!lessons.length} onClick={() => setCreating(true)}>
            <Plus size={15} />
            提交工程作业
          </Button>
        }
      />
      <div className="lms-toolbar">
        <Input
          aria-label="搜索作业"
          placeholder="搜索作业或学员…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <NativeSelect
          aria-label="作业状态"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <NativeSelectOption value="">全部状态</NativeSelectOption>
          <NativeSelectOption value="pending">待评审</NativeSelectOption>
          <NativeSelectOption value="changes_requested">
            需要修改
          </NativeSelectOption>
          <NativeSelectOption value="approved">已通过</NativeSelectOption>
        </NativeSelect>
        <Button variant="outline" onClick={list.refresh}>
          <RefreshCw size={15} />
          刷新
        </Button>
      </div>
      {!lessons.length && !teacher && (
        <p className="notice">开通课程后即可提交工程作业。</p>
      )}
      {list.error && (
        <p role="alert" className="notice error">
          {list.error}{' '}
          <Button variant="ghost" onClick={list.refresh}>
            重试
          </Button>
        </p>
      )}
      {list.busy && <output>正在加载作业…</output>}
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
              <span className="tag">{statusNames[review.status]}</span>
            </div>
            <p className="muted">
              {review.name ? review.name + ' · ' : ''}第 {review.revision}{' '}
              次修订 · {date(review.updated_at || review.created_at)}
            </p>
            <p>{review.note}</p>
            {review.feedback && (
              <div className="feedback">
                <strong>老师的反馈</strong>
                <p>{review.feedback}</p>
              </div>
            )}
            <Button variant="outline" onClick={() => setSelected(review.id)}>
              {teacher
                ? '查看与评审'
                : review.status === 'changes_requested'
                  ? '修改后重新提交'
                  : '查看记录'}
              <ArrowRight size={15} />
            </Button>
          </article>
        ))}
      </div>
      {list.data && !list.data.items.length && (
        <Empty
          title={filter || query ? '没有符合条件的作业' : '等待第一份作品'}
          description="提交后，评审状态和修改记录都会保存在这里。"
        />
      )}
      <CursorPagination list={list} />
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>提交工程作业</DialogTitle>
            <DialogDescription>
              私有仓库请先授予老师访问权限。
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
      {draft.restored && <p className="notice">已恢复未提交的作业草稿。</p>}
      <label htmlFor="lms-support-field-2">
        对应章节
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
        GitHub 仓库或 PR
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
        实现与验证说明
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
          {error || draft.storageError}
        </p>
      )}
      <Button type="submit" disabled={busy || !lessons.length}>
        <GitPullRequest size={15} />
        {busy ? '正在提交…' : '提交评审'}
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
  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && close()}>
      <DialogContent className="wide-dialog lms-history-dialog">
        <DialogHeader>
          <DialogTitle>作业与评审记录</DialogTitle>
          <DialogDescription>
            每轮提交保留对应代码链接、说明和评审反馈。
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
          ? '评审已提交，学员会收到通知'
          : '修改已提交，等待老师再次评审',
      );
      changed();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? '这份作业已被更新，请重新加载后再提交。填写的内容会保留为本地草稿。'
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
            {error}
          </p>
        ) : (
          <output>正在加载评审记录…</output>
        )}
        <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
          重新加载
        </Button>
      </>
    );
  return (
    <>
      <div className="lms-toolbar">
        <span className="tag">{statusNames[review.status]}</span>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => setRetry((n) => n + 1)}
        >
          刷新记录
        </Button>
      </div>
      <a href={review.url} target="_blank" rel="noreferrer">
        查看当前提交的代码 ↗
      </a>
      <LessonMarkdown body={review.note || '未填写实现说明。'} />
      {review.feedback && (
        <div className="feedback">
          <strong>老师的反馈</strong>
          <LessonMarkdown body={review.feedback} />
        </div>
      )}
      <h3>修改与评审历史</h3>
      {review.events?.map((event, index) => (
        <article
          className="lms-event"
          key={`${event.revision}:${event.kind}:${index}`}
        >
          <strong>
            第 {event.revision} 版 · {statusNames[event.status] || event.kind}
          </strong>
          <small>
            {event.actorName} · {date(event.createdAt)}
            {event.lessonVersion ? ' · 课件 v' + event.lessonVersion : ''}
          </small>
          <a href={event.url} target="_blank" rel="noreferrer">
            查看当时的代码 ↗
          </a>
          <LessonMarkdown body={event.feedback || event.note || ''} />
        </article>
      ))}
      {!review.events?.length && (
        <p className="muted">历史记录将从下一次修改开始保留。</p>
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
          {error}
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
          ? '老师正在等待评审这份作业。收到修改建议后，可在此继续提交。'
          : '这份作业已经通过评审。'}
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
      <h3>{teacher ? '提交评审' : '修改后重新提交'}</h3>
      {draft.restored && <p className="muted">已恢复未提交内容。</p>}
      {teacher ? (
        <>
          <label htmlFor="lms-support-field-4">
            结论
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
                需要修改
              </NativeSelectOption>
              <NativeSelectOption value="approved">评审通过</NativeSelectOption>
            </NativeSelect>
          </label>
          <label>
            评审反馈
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
            更新后的 GitHub 仓库或 PR
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
            本轮修改与验证
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
        {busy ? '提交中…' : teacher ? '提交评审反馈' : '提交新版本'}
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
  const list = useCursorPage<Release>('lms/releases'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');
  return (
    <>
      <Heading
        label="KEEP LEARNING, KEEP CURRENT"
        title="课程，也在不断进步。"
        description="查看每次修订的具体内容，重要更新会通过站内消息提醒。"
        action={
          <Button variant="outline" onClick={list.refresh}>
            刷新更新
          </Button>
        }
      />
      {(list.error || error) && (
        <p role="alert" className="notice error">
          {error || list.error}{' '}
          <Button variant="ghost" onClick={list.refresh}>
            重试
          </Button>
        </p>
      )}
      {list.busy && <output>正在加载课程更新…</output>}
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
                {!release.is_read && <span className="tag">未读</span>}
                {!!release.important && <span className="tag">重要更新</span>}
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
                    查看更新章节
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
                    标记已读
                  </Button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {list.data && !list.data.items.length && <Empty title="暂无课程更新" />}
      <CursorPagination list={list} />
    </>
  );
}
