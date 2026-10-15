'use client';
import { useEffect, useState } from 'react';
import { englishMessage } from '@/lib/messages-en';
import { markDrill, readDrillProgress, type Drill, type DrillReview } from '@/lib/oa-drills';
import { ojRequest } from '@/lib/oj-client';

/** "2/3 done" on /oa/drills: drills of this problem passed in either mode, in this browser. */
export function DrillDone({ id, drills, zh }: { id: string; drills: number[]; zh: boolean }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const progress = readDrillProgress();
    // After mount: browser storage only, so the server render shows nothing here.
    // oxlint-disable-next-line react/react-compiler -- one read of browser storage per mount.
    setDone(drills.filter((n) => progress[`${id}:${n}`]).length);
  }, [id, drills]);
  return done ? (
    <span className="oa-drills-done">{zh ? `已完成 ${done}/${drills.length}` : `${done}/${drills.length} done`}</span>
  ) : null;
}

/**
 * The code-review drill: a planted-bug program shown read-only with line numbers; the learner
 * flags lines (a note each, kept in this page only) and the server scores them by line number.
 */
export function CodeReviewDrill({ id, drills, first, zh }: { id: string; drills: number[]; first: number; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [items, setItems] = useState<Drill[] | null>(null);
  const [error, setError] = useState('');
  const [n, setN] = useState(first);
  const [marked, setMarked] = useState<Map<number, string>>(new Map());
  const [result, setResult] = useState<DrillReview | null>(null);
  const [sending, setSending] = useState(false);
  const say = (message: string) => (zh ? message : englishMessage(message));
  useEffect(() => {
    const controller = new AbortController();
    ojRequest<{ items: Drill[] }>(`oa-library/${encodeURIComponent(id)}/drill`, undefined, controller.signal).then(
      (data) => setItems(data.items),
      (e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      },
    );
    return () => controller.abort();
  }, [id]);
  const drill = items?.find((item) => item.n === n);
  const open = (next: number) => {
    setN(next);
    setMarked(new Map());
    setResult(null);
    setError('');
  };
  const toggle = (line: number) => {
    const next = new Map(marked);
    if (next.has(line)) next.delete(line);
    else next.set(line, '');
    setMarked(next);
  };
  async function submit() {
    setSending(true);
    setError('');
    try {
      const review = await ojRequest<DrillReview>(`oa-library/${encodeURIComponent(id)}/review`, {
        n,
        lines: [...marked.keys()],
      });
      setResult(review);
      if (!review.missed.length && !review.falsePositives.length) markDrill(id, n, 'review');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  if (!drill)
    return error ? (
      <p className="public-library-empty" role="alert">
        {say(error)}
      </p>
    ) : (
      <p className="public-library-empty">{items ? say('这道题没有调试练习') : t('正在载入代码…', 'Loading the code…')}</p>
    );
  const state = (line: number) =>
    !result
      ? undefined
      : result.hits.includes(line)
        ? 'hit'
        : result.missed.includes(line)
          ? 'missed'
          : result.falsePositives.includes(line)
            ? 'false'
            : undefined;
  const labels = { hit: t('找到了', 'Found'), missed: t('漏掉的 bug', 'Missed bug'), false: t('这一行没问题', 'Not a bug') };
  const at = drills.indexOf(n);
  return (
    <section className="oa-review" aria-label={t('代码评审', 'Code review')}>
      {drills.length > 1 && (
        <p className="oa-drills-actions">
          <span>{t('代码', 'Program')}</span>
          {drills.map((item, i) => (
            <button key={item} type="button" aria-pressed={item === n} onClick={() => open(item)}>
              {i + 1}
            </button>
          ))}
        </p>
      )}
      <ol className="oa-review-code">
        {drill.code
          .replace(/\s+$/, '')
          .split('\n')
          .map((text, i) => {
            const line = i + 1,
              mark = state(line);
            return (
              <li key={line} data-state={mark}>
                <button
                  type="button"
                  aria-pressed={marked.has(line)}
                  disabled={!!result}
                  onClick={() => toggle(line)}
                  aria-label={t(`第 ${line} 行`, `Line ${line}`) + (text.trim() ? `: ${text.trim()}` : '')}
                >
                  <span className="oa-review-no" aria-hidden="true">
                    {line}
                  </span>
                  <code aria-hidden="true">{text || ' '}</code>
                </button>
                {mark && <span className="oa-review-mark">{labels[mark]}</span>}
                {marked.has(line) &&
                  (result ? (
                    marked.get(line) && <p className="oa-review-note">{marked.get(line)}</p>
                  ) : (
                    <input
                      type="text"
                      maxLength={200}
                      value={marked.get(line)}
                      onChange={(event) => setMarked(new Map(marked).set(line, event.target.value))}
                      placeholder={t('哪里不对？（可选）', "What's wrong? (optional)")}
                      aria-label={t(`第 ${line} 行的说明`, `Note on line ${line}`)}
                    />
                  ))}
              </li>
            );
          })}
      </ol>
      <output className="oa-review-score">
        {result && (
          <>
            <strong>
              {t(
                `找到 ${result.hits.length}/${result.bugLines.length} 处 bug，误报 ${result.falsePositives.length} 行。`,
                `Found ${result.hits.length} of ${result.bugLines.length} faulty lines, ${result.falsePositives.length} flagged by mistake.`,
              )}
            </strong>{' '}
            {t('埋入的 bug：', 'The planted bug: ')}
            <span lang={!zh && !result.nameEn ? 'zh-CN' : undefined}>{zh ? result.nameZh : (result.nameEn ?? result.nameZh)}</span>
          </>
        )}
      </output>
      {error && (
        <p className="oa-review-error" role="alert">
          {say(error)}
        </p>
      )}
      <p className="oa-review-actions">
        {result ? (
          <>
            <button type="button" onClick={() => open(n)}>
              {t('再评审一次', 'Review again')}
            </button>
            {at + 1 < drills.length && (
              <button type="button" onClick={() => open(drills[at + 1])}>
                {t('下一段代码', 'Next program')}
              </button>
            )}
            <a href={`/?${new URLSearchParams({ view: 'problem', problem: id, drill: String(n) })}`}>
              {t('动手修好它', 'Now fix it')}
            </a>
          </>
        ) : (
          <button type="button" aria-disabled={!marked.size || sending} onClick={() => marked.size && !sending && void submit()}>
            {sending ? t('正在判分…', 'Scoring…') : t(`提交（已标 ${marked.size} 行）`, `Submit (${marked.size} flagged)`)}
          </button>
        )}
      </p>
    </section>
  );
}
