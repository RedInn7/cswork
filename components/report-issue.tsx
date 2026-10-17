'use client';
import { useState } from 'react';
import { useT } from '@/lib/i18n';
import { ApiError, api } from '@/lib/types';
import '@/app/report-issue.css';

const REASONS: [string, string][] = [
  ['答案有误', 'Wrong answer'],
  ['题干有歧义', 'Ambiguous question'],
  ['错别字', 'Typo'],
  ['解析不清', 'Unclear explanation'],
  ['其他', 'Other'],
];

/**
 * "Report an issue" on public content: a reason and a note, filed as a ticket titled
 * "[refId] reason" (POST /api/tickets with ref) that the teacher answers under Support.
 * `signedIn` false shows a sign-in link instead; undefined (not known yet) finds out on sending.
 */
export function ReportIssue({ refId, signedIn }: { refId: string; signedIn?: boolean }) {
  const t = useT();
  const [reason, setReason] = useState(0);
  const [note, setNote] = useState('');
  const [state, setState] = useState<{ busy?: boolean; sent?: string; guest?: boolean; error?: string }>({});
  if (signedIn === false || state.guest)
    return (
      <a className="report-issue-link" href="/?view=account">
        {t('登录后纠错', 'Sign in to report an issue')}
      </a>
    );
  if (state.sent)
    return (
      <p className="report-issue-sent" role="status">
        {t('已提交，谢谢。回复会出现在', 'Sent, thank you. The reply will be in ')}
        <a href={`/?view=tickets&ticket=${encodeURIComponent(state.sent)}`}>{t('我的工单', 'your support tickets')}</a>
        {t('里。', '.')}
      </p>
    );
  return (
    <details className="report-issue">
      <summary>{t('纠错', 'Report an issue')}</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (state.busy) return;
          setState({ busy: true });
          try {
            const { id } = await api<{ id: string }>('tickets', { ref: refId, title: t(...REASONS[reason]), body: note });
            setState({ sent: id });
          } catch (error) {
            setState(error instanceof ApiError && error.status === 401 ? { guest: true } : { error: (error as Error).message });
          }
        }}
      >
        <label>
          {t('原因', 'Reason')}
          <select value={reason} onChange={(e) => setReason(Number(e.target.value))}>
            {REASONS.map((r, i) => (
              <option key={r[1]} value={i}>
                {t(...r)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('说明', 'Details')}
          <textarea
            required
            maxLength={2000}
            rows={3}
            value={note}
            placeholder={t('哪里不对，应该是什么', 'What is wrong, and what should it say?')}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {state.error && <p role="alert">{state.error}</p>}
        <button type="submit" disabled={state.busy}>
          {state.busy ? t('提交中…', 'Sending…') : t('提交', 'Send')}
        </button>
      </form>
    </details>
  );
}
