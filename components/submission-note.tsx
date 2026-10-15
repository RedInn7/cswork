'use client';
import { useEffect, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useNote } from './problem-notes';

/**
 * A short private note on one submission (`sub:<id>`), in the submission's detail dialog:
 * what this attempt got wrong, what changed next. Saves and keeps a local draft like the
 * problem note; folded until opened unless it already holds text. Key it by submission id.
 */
export function SubmissionNote({ userId, submissionId }: { userId: string; submissionId: string }) {
  const t = useT();
  const note = useNote(userId, `sub:${submissionId}`);
  // Opens by itself once loaded if it already holds text; then the learner decides.
  const [open, setOpen] = useState<boolean | null>(null);
  const loaded = note.state !== 'loading';
  useEffect(() => {
    if (loaded) setOpen((value) => value ?? note.has);
  }, [loaded, note.has]);
  const status =
    note.state === 'saving'
      ? t('正在保存…', 'Saving…')
      : note.state === 'saved'
        ? t('已保存', 'Saved')
        : note.state === 'too-long'
          ? t('超过 20 KB，删减后才会保存。', 'Over 20 KB. Shorten it to save.')
          : note.state === 'unsaved'
            ? `${t('没能保存，已暂存在这台设备。', "Couldn't save. A copy is kept on this device.")} ${note.error}`
            : '';
  return (
    <details
      className="cs-submission-note"
      open={!!open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <NotebookPen size={14} aria-hidden="true" />
        {t('这次提交的笔记', 'Note on this submission')}
      </summary>
      {note.state === 'loading' ? (
        <output>{t('正在加载笔记…', 'Loading your note…')}</output>
      ) : note.state === 'load-failed' ? (
        <p role="alert">
          {t('笔记加载失败。', "Couldn't load your note.")} {note.error}{' '}
          <button type="button" onClick={note.retry}>
            {t('重试', 'Retry')}
          </button>
        </p>
      ) : (
        <>
          {note.conflict !== null && (
            <p role="alert">
              {t(
                '这台设备上有一份没保存的旧版本，但笔记之后在别处改过了。',
                'This device has an older unsaved version, but the note was changed elsewhere since.',
              )}{' '}
              <button type="button" onClick={() => note.resolve(true)}>
                {t('改用这台设备的版本', "Use this device's version")}
              </button>{' '}
              <button type="button" onClick={() => note.resolve(false)}>
                {t('丢弃它', 'Discard it')}
              </button>
            </p>
          )}
          <textarea
            aria-label={t('这次提交的笔记', 'Note on this submission')}
            readOnly={note.conflict !== null}
            value={note.text}
            onChange={(event) => note.edit(event.target.value)}
            placeholder={t(
              '这次错在哪、下次改什么……只有你能看到。',
              'What went wrong this time, what to change next… Only you can see this.',
            )}
            spellCheck={false}
          />
          <small role={note.state === 'unsaved' || note.state === 'too-long' ? 'alert' : undefined}>
            {status}
            {note.state === 'unsaved' && (
              <button type="button" onClick={note.retry}>
                {t('重试', 'Retry')}
              </button>
            )}
          </small>
        </>
      )}
    </details>
  );
}
