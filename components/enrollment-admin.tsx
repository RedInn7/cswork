'use client';
import { useCallback, useEffect, useState } from 'react';
import { Copy, Link, RefreshCw } from 'lucide-react';
import { api, type Course, date } from '@/lib/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import '@/app/media.css';
type Invite = {
  id: string;
  email: string;
  url?: string;
  expiresAt: number;
  redeemedAt: number | null;
  revokedAt: number | null;
};
export function EnrollmentAdmin({ courses }: { courses: Course[] }) {
  const [emails, setEmails] = useState(''),
    [courseId, setCourseId] = useState('__current__'),
    [created, setCreated] = useState<Invite[]>([]);
  const [items, setItems] = useState<Invite[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [q, setQ] = useState(''),
    [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Invite[]; hasMore: boolean }>(
        `teacher/invitations?page=${page}&q=${encodeURIComponent(search)}`,
      );
      setItems(r.items);
      setMore(r.hasMore);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [page, search]);
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- The invitation page is loaded from the authenticated server API.
    void load();
  }, [load]);
  return (
    <section className="form-card enrollment-admin">
      <div className="media-picker-heading">
        <div>
          <h2>邀请已有学员</h2>
          <p className="muted">
            生成一次性邀请链接，学员自行设置密码。链接 7
            天有效；不会自动发送邮件。
          </p>
        </div>
        <Link size={20} />
      </div>
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          setMessage('');
          try {
            const r = await api<{ items: Invite[] }>('teacher/invitations', {
              emails: emails.split(/[\s,;，；]+/).filter(Boolean),
              courseIds:
                courseId === '__current__'
                  ? courses.map((course) => course.id)
                  : [courseId],
              days: 7,
            });
            setCreated(r.items);
            setEmails('');
            await load();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          学员邮箱
          <textarea
            required
            aria-label="邀请学员邮箱"
            rows={3}
            value={emails}
            placeholder="每行一个邮箱，最多 50 个"
            onChange={(e) => setEmails(e.target.value)}
          />
        </label>
        <label>
          开通范围
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="__current__">
              当前全部课程（不含未来新增课程）
            </option>
            <option value="*">全部课程（包含后续课程）</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={busy || !courses.length} type="submit">
          {busy ? '正在生成…' : '生成邀请链接'}
        </Button>
      </form>
      {created.length > 0 && (
        <div className="invite-links">
          <p>请复制保存并私下交给对应学员。链接仅在本次生成后展示。</p>
          {created.map((i) => (
            <div key={i.id}>
              <strong>{i.email}</strong>
              <Input
                aria-label={`${i.email} 的邀请链接`}
                readOnly
                value={i.url}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(i.url!);
                    setMessage('链接已复制');
                  } catch {
                    setMessage('请选中链接手动复制');
                  }
                }}
              >
                <Copy size={14} />
                复制
              </Button>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {message && <output>{message}</output>}
      <form
        className="media-search"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setSearch(q.trim());
          if (page === 0 && search === q.trim()) void load();
        }}
      >
        <Input
          aria-label="搜索邀请邮箱"
          placeholder="搜索邀请邮箱"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button variant="outline" type="submit">
          搜索
        </Button>
        <Button
          variant="ghost"
          type="button"
          aria-label="刷新邀请列表"
          onClick={() => void load()}
        >
          <RefreshCw size={15} />
        </Button>
      </form>
      <div className="invite-history">
        {items.map((i) => (
          <div key={i.id}>
            <span>
              <strong>{i.email}</strong>
              <small>{date(i.expiresAt)} 到期</small>
            </span>
            <span className="tag">
              {i.redeemedAt
                ? '已激活'
                : i.revokedAt
                  ? '已撤销'
                  : i.expiresAt < now
                    ? '已过期'
                    : '等待激活'}
            </span>
            {!i.redeemedAt && !i.revokedAt && i.expiresAt > now && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`teacher/invitations/${i.id}/revoke`, {});
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                撤销邀请
              </Button>
            )}
          </div>
        ))}
        {!items.length && <p className="muted">暂无邀请记录。</p>}
      </div>
      <div className="media-page">
        <span>第 {page + 1} 页</span>
        <span />
        <Button
          variant="outline"
          size="sm"
          disabled={!page}
          onClick={() => setPage((p) => p - 1)}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!more}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </Button>
      </div>
    </section>
  );
}
