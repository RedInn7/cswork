'use client';
import { useEffect, useState } from 'react';
import { englishMessage } from '@/lib/messages-en';
import { ojRequest } from '@/lib/oj-client';
import { ProblemNotes, useNote } from './problem-notes';
import '@/app/topic-notebook.css';

type StopNotes = { me: string; items: { problemId: string; snippet: string; confidence: number | null; tags: string[] }[] };
type State = { kind: 'loading' } | { kind: 'signin' } | { kind: 'error'; message: string } | ({ kind: 'ready' } & StopNotes);

/**
 * A Line 500 stop's pattern notebook under its key points: the learner's topic:<slug> note, then
 * their notes on this stop's problems. GET oj/notes/stop through ojRequest, not api(), so a guest
 * gets a sign-in line instead of the app's sign-in prompt. Renders nothing on the server.
 */
export function TopicNotebook({ slug, zh }: { slug: string; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    let current = true;
    ojRequest<StopNotes>(`notes/stop?${new URLSearchParams({ slug })}`)
      .then((result) => current && setState({ kind: 'ready', ...result }))
      .catch((reason: Error & { status?: number }) => {
        if (!current) return;
        setState(
          reason.status === 401
            ? { kind: 'signin' }
            : { kind: 'error', message: zh ? reason.message : englishMessage(reason.message) },
        );
      });
    return () => {
      current = false;
    };
  }, [slug, zh]);
  const note = useNote(state.kind === 'ready' ? state.me : null, `topic:${slug}`);
  if (state.kind === 'loading') return null;
  return (
    <section className="topics-template topic-notebook" aria-labelledby="topic-notebook">
      <h2 id="topic-notebook">{t('我的套路笔记', 'My pattern notes')}</h2>
      {state.kind === 'signin' ? (
        <p className="topics-template-lead">
          <a href="/?view=progress">{t('登录后记下这一站的套路', 'Sign in to keep notes on this pattern')}</a>
          {t('：怎么认出它、模板里最容易错的一行，以后在「我的进度 · 有笔记」里也能搜到。', ': how to spot it and the template line you get wrong, searchable later under My progress · With notes.')}
        </p>
      ) : state.kind === 'error' ? (
        <p className="topics-template-lead" role="alert">
          {t('笔记暂时加载不了。', "Your notes couldn't load.")} {state.message}
        </p>
      ) : (
        <>
          <ProblemNotes note={note} english={!zh} />
          {state.items.length > 0 && (
            <>
              <h3>{t('这一站我写过笔记的题', 'My notes on this stop’s problems')}</h3>
              <ul className="topic-notebook-list">
                {state.items.map((item) => (
                  <li key={item.problemId}>
                    <a href={`/?${new URLSearchParams({ view: 'problem', problem: item.problemId })}`}>
                      LC {item.problemId.slice(3)}
                    </a>
                    <span>
                      {[
                        ...(item.confidence ? [t(`把握度 ${item.confidence}`, `Confidence ${item.confidence}`)] : []),
                        ...item.tags.map((tag) => `#${tag}`),
                      ].join(' · ')}
                    </span>
                    <p>{item.snippet}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
