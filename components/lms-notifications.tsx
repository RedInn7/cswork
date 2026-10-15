'use client';
import { useState } from 'react';
import { api, type Notification, date } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import type { Navigate } from './learning';
import { Button } from './ui/button';
import { CursorPagination, useCursorPage } from './lms-shared';
/** The inbox's tabs: every notice, or one kind (lib/server/notify.ts). */
const KINDS = [
  ['', '全部', 'All'],
  ['reply', '回复', 'Replies'],
  ['mention', '@我', 'Mentions'],
  ['like', '赞', 'Upvotes'],
] as const;
export function NotificationsPane({
  refresh,
  navigate,
  close,
}: {
  refresh: () => Promise<void>;
  navigate: Navigate;
  close: () => void;
}) {
  const t = useT();
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('');
  const list = useCursorPage<Notification>(`lms/notifications${kind && `?kind=${kind}`}`),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const failure = error || list.error;
  return (
    <>
      <div className="lms-toolbar">
        <Button variant="outline" disabled={busy} onClick={list.refresh}>
          {t('刷新消息', 'Refresh')}
        </Button>
        <Button
          variant="ghost"
          disabled={busy || !list.data?.total}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await api('lms/notifications/read-all', {});
              list.refresh();
              await refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('全部标记已读', 'Mark all as read')}
        </Button>
      </div>
      <div className="lms-toolbar">
        {KINDS.map(([value, zh, en]) => (
          <Button
            key={value}
            variant={kind === value ? 'secondary' : 'ghost'}
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
          >
            {t(zh, en)}
          </Button>
        ))}
      </div>
      {failure && (
        <p role="alert" className="error-text">
          {t(failure, englishMessage(failure))}{' '}
          <Button variant="ghost" onClick={list.refresh}>
            {t('重试', 'Retry')}
          </Button>
        </p>
      )}
      {list.busy && <output>{t('正在加载消息…', 'Loading notifications…')}</output>}
      <div className="search-results">
        {list.data?.items.map((item) => (
          <button
            key={item.id}
            onClick={async () => {
              const url = new URL(item.href, location.origin);
              void api('notifications', { id: item.id })
                .then(refresh)
                .catch(() => {});
              close();
              // A page of its own (a system design chapter's discussion) rather than an app view.
              if (url.pathname !== '/') return location.assign(url.pathname + url.search);
              const { view, ...params } = Object.fromEntries(url.searchParams);
              navigate(view || 'problems', params);
            }}
          >
            <strong>
              {!item.read_at && <span className="status-dot" />}
              {/* Titles are fixed system text stored in Chinese; bodies are user content. */}
              {t(item.title, englishMessage(item.title))}
            </strong>
            <p>{item.body}</p>
            <small>{date(item.created_at)}</small>
          </button>
        ))}
      </div>
      {list.data && !list.data.items.length && (
        <p className="quiet-empty">
          {t('暂时没有新消息。', 'No new notifications.')}
        </p>
      )}
      <CursorPagination list={list} />
    </>
  );
}
