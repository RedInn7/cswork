'use client';
import { useCallback, useEffect, useState } from 'react';
import { Copy, Link, RefreshCw } from 'lucide-react';
import { api, type Course, date } from '@/lib/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
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
  const t = useT();
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
          <h2>{t('邀请已有学员', 'Invite existing students')}</h2>
          <p className="muted">
            {t(
              '生成一次性邀请链接，学员自行设置密码。链接 7 天有效；不会自动发送邮件。',
              'Generate one-time invite links; students set their own password. Links are valid for 7 days. No emails are sent automatically.',
            )}
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
          {t('学员邮箱', 'Student emails')}
          <textarea
            required
            aria-label={t('邀请学员邮箱', 'Emails to invite')}
            rows={3}
            value={emails}
            placeholder={t(
              '每行一个邮箱，最多 50 个',
              'One email per line, up to 50',
            )}
            onChange={(e) => setEmails(e.target.value)}
          />
        </label>
        <label>
          {t('开通范围', 'Courses to unlock')}
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="__current__">
              {t(
                '当前全部课程（不含未来新增课程）',
                'All current courses (excludes future courses)',
              )}
            </option>
            <option value="*">
              {t(
                '全部课程（包含后续课程）',
                'All courses (including future ones)',
              )}
            </option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={busy || !courses.length} type="submit">
          {busy
            ? t('正在生成…', 'Generating…')
            : t('生成邀请链接', 'Generate invite links')}
        </Button>
      </form>
      {created.length > 0 && (
        <div className="invite-links">
          <p>
            {t(
              '请复制保存并私下交给对应学员。链接仅在本次生成后展示。',
              'Copy each link and share it privately with that student. Links are only shown right after they are generated.',
            )}
          </p>
          {created.map((i) => (
            <div key={i.id}>
              <strong>{i.email}</strong>
              <Input
                aria-label={t(
                  `${i.email} 的邀请链接`,
                  `Invite link for ${i.email}`,
                )}
                readOnly
                value={i.url}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(i.url!);
                    setMessage(t('链接已复制', 'Link copied'));
                  } catch {
                    setMessage(
                      t(
                        '请选中链接手动复制',
                        'Select the link and copy it manually',
                      ),
                    );
                  }
                }}
              >
                <Copy size={14} />
                {t('复制', 'Copy')}
              </Button>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="error-text" role="alert">
          {t(error, englishMessage(error))}
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
          aria-label={t('搜索邀请邮箱', 'Search invited emails')}
          placeholder={t('搜索邀请邮箱', 'Search invited emails')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button variant="outline" type="submit">
          {t('搜索', 'Search')}
        </Button>
        <Button
          variant="ghost"
          type="button"
          aria-label={t('刷新邀请列表', 'Refresh invitations')}
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
              <small>
                {t(`${date(i.expiresAt)} 到期`, `Expires ${date(i.expiresAt)}`)}
              </small>
            </span>
            <span className="tag">
              {i.redeemedAt
                ? t('已激活', 'Activated')
                : i.revokedAt
                  ? t('已撤销', 'Revoked')
                  : i.expiresAt < now
                    ? t('已过期', 'Expired')
                    : t('等待激活', 'Pending')}
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
                {t('撤销邀请', 'Revoke invite')}
              </Button>
            )}
          </div>
        ))}
        {!items.length && (
          <p className="muted">{t('暂无邀请记录。', 'No invitations yet.')}</p>
        )}
      </div>
      <div className="media-page">
        <span>{t(`第 ${page + 1} 页`, `Page ${page + 1}`)}</span>
        <span />
        <Button
          variant="outline"
          size="sm"
          disabled={!page}
          onClick={() => setPage((p) => p - 1)}
        >
          {t('上一页', 'Previous')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!more}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('下一页', 'Next')}
        </Button>
      </div>
    </section>
  );
}
