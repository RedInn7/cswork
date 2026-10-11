'use client';
import { useState } from 'react';
import { api, type Notification, date } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import type { Navigate } from './learning';
import { Button } from './ui/button';
import { CursorPagination, useCursorPage } from './lms-shared';
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
  const list = useCursorPage<Notification>('lms/notifications'),
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
              const dest = Object.fromEntries(
                new URL(item.href, location.origin).searchParams,
              );
              void api('notifications', { id: item.id })
                .then(refresh)
                .catch(() => {});
              close();
              const { view, ...params } = dest;
              navigate(view || 'home', params);
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
