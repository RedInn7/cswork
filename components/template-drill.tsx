'use client';
import { Fragment, lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { TemplateLang } from '@/lib/route-templates';
import type { Driver } from '@/lib/route-template-drivers';
import { activeStatuses, ojRequest, verdict, type OJSubmission } from '@/lib/oj-client';
import { mcqDay } from '@/lib/mock-oa';
import { rateRecall, type RecallGrade } from '@/lib/recall';
import {
  blankDrill,
  blankRight,
  orderDrill,
  orderRight,
  recallDiff,
  sameLine,
  type Blank,
  type DiffLine,
} from '@/lib/template-drills';
import { updateRecall } from './recall-rate';
import { CODE_LANG_EVENT, eventLang, readCodeLang, saveCodeLang } from './template-lang-memory';

const CodeEditor = lazy(() => import('./recall-editor').then((m) => ({ default: m.CodeEditor })));

/** One template a drill can use: the stop's main template or a variant, with its driver. */
export type DrillTemplate = { id: string; label: string; code: Record<TemplateLang, string>; driver: Driver };
type Kind = 'order' | 'blank' | 'recall';
type Judged = { passed: boolean; status: string; stdout: string; detail: string };
type Recalled = { diff: DiffLine[]; judged: Judged | null; grade: RecallGrade | null; ms: number; error: string };

/** Last and best times of correct recalls, by `<stop>/<template>/<lang>`, in this browser only. */
export const RECALL_TIMES_KEY = 'cswork:template-recall:v1';
type Times = Record<string, { last: number; best: number }>;
function readTimes(): Times {
  try {
    const value = JSON.parse(localStorage.getItem(RECALL_TIMES_KEY) || '{}') as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Times) : {};
  } catch {
    return {};
  }
}
function saveTime(key: string, ms: number) {
  const all = readTimes();
  const best = all[key]?.best;
  all[key] = { last: ms, best: typeof best === 'number' && best > 0 ? Math.min(best, ms) : ms };
  try {
    localStorage.setItem(RECALL_TIMES_KEY, JSON.stringify(all));
  } catch {
    /* Blocked storage: the time is shown but not kept. */
  }
  return all[key];
}
/** Runs that ended on the judge's side, not the code's: only the diff counts then. */
const JUDGE_DOWN = new Set(['system_error', 'internal_error', 'cancelled', 'canceled', 'skipped']);
const FILES: Record<TemplateLang, string> = { python: 'main.py', cpp: 'main.cpp', java: 'Main.java', go: 'main.go' };
const clock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Practice on a topic page's templates (the main one and each variant): put shuffled lines back
 * in order (tap one line, then another, to swap them; no drag and drop, so it works the same on a
 * phone and a keyboard), fill in blanked-out conditions and return values, or write the whole
 * template from memory. Order and blanks are built in the browser (lib/template-drills.ts); a
 * recall runs on the playground judge with the stop's driver when signed in, is diffed line by
 * line against the template, and grades the template's card in the recall queue
 * (`tpl:<stop>/<template>`). `?drill=recall&v=<template>` opens that recall (lib/recall.ts recallHref).
 */
export function TemplateDrill({
  slug,
  title,
  templates,
  langs,
  zh,
  signedIn,
}: {
  slug: string;
  title: string;
  templates: DrillTemplate[];
  langs: readonly [TemplateLang, string][];
  zh: boolean;
  signedIn: boolean;
}) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [lang, setLang] = useState(langs[0][0]);
  const [kind, setKind] = useState<Kind>('order');
  const [pick, setPick] = useState(templates[0].id);
  const [seed, setSeed] = useState(1);
  const [order, setOrder] = useState<number[] | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState(false);
  const [said, setSaid] = useState('');
  const [written, setWritten] = useState('');
  const [started, setStarted] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [round, setRound] = useState(0);
  const [running, setRunning] = useState(false);
  const [recalled, setRecalled] = useState<Recalled | null>(null);
  const run = useRef<AbortController | null>(null);
  const current = templates.find((item) => item.id === pick) ?? templates[0];
  const code = current.code;
  const drill = orderDrill(code[lang], lang, seed);
  const blanks = blankDrill(code[lang], lang, seed);
  const now = order ?? drill.start;
  const timeKey = `${slug}/${current.id}/${lang}`;
  // Recall mode only renders after a click or on mount, so this browser read never meets SSR.
  const stored = kind === 'recall' ? readTimes()[timeKey] : undefined;
  const record = stored && Number.isFinite(stored.last) && Number.isFinite(stored.best) ? stored : undefined;
  const restart = (next: { lang?: TemplateLang; kind?: Kind; seed?: number; pick?: string }) => {
    if (next.lang) setLang(next.lang);
    if (next.kind) setKind(next.kind);
    if (next.seed) setSeed(next.seed);
    if (next.pick) setPick(next.pick);
    setOrder(null);
    setPicked(null);
    setTyped({});
    setChecked(false);
    setAnswers(false);
    setSaid('');
    run.current?.abort();
    setWritten('');
    setStarted(null);
    setRecalled(null);
    setRunning(false);
    setRound((n) => n + 1);
  };
  // The remembered language (SSR shows the first), and ?drill=recall&v=<template> from a review card.
  useEffect(() => {
    const saved = readCodeLang();
    if (langs.some(([value]) => value === saved)) setLang(saved as TemplateLang);
    const query = new URLSearchParams(location.search);
    if (query.get('drill') === 'recall') {
      setKind('recall');
      const v = query.get('v');
      if (v && templates.some((item) => item.id === v)) setPick(v);
    }
    return () => run.current?.abort();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, on mount.
  }, []);
  // A language picked elsewhere on the page follows here, unless it would wipe a recall in progress.
  useEffect(() => {
    const follow = (event: Event) => {
      const next = eventLang(event);
      if (next !== lang && langs.some(([value]) => value === next) && !(kind === 'recall' && written.trim()))
        restart({ lang: next as TemplateLang });
    };
    window.addEventListener(CODE_LANG_EVENT, follow);
    return () => window.removeEventListener(CODE_LANG_EVENT, follow);
  });
  // Writing from memory: the page's code blurs (CSS on body[data-template-recall]).
  useEffect(() => {
    if (kind !== 'recall') return;
    document.body.setAttribute('data-template-recall', '');
    return () => document.body.removeAttribute('data-template-recall');
  }, [kind]);
  useEffect(() => {
    if (started === null || recalled) return;
    setTick(Date.now());
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [started, recalled]);
  const write = (value: string) => {
    setWritten(value);
    if (started === null && value) setStarted(Date.now());
    if (recalled) setRecalled(null);
  };
  async function checkRecall() {
    if (running) return;
    const ms = started === null ? 0 : Date.now() - started;
    const diff = recallDiff(written, code[lang], lang);
    const exact = diff.every((line) => line.op === 'same');
    let judged: Judged | null = null;
    let error = '';
    // Start over, another check or unmount aborts this one, while judging or saving.
    const controller = new AbortController();
    run.current?.abort();
    run.current = controller;
    if (signedIn && written.trim()) {
      setRunning(true);
      setSaid(t('正在运行本站的测试…', "Running this stop's tests…"));
      try {
        const { driverProgram, normalizeOutput } = await import('@/lib/route-template-drivers');
        let sub = await ojRequest<OJSubmission>(
          'playground/run',
          { language: lang, code: driverProgram(lang, written, current.driver[lang]).source, stdin: '', idempotencyKey: crypto.randomUUID() },
          controller.signal,
        );
        while (activeStatuses.has(sub.status))
          sub = await ojRequest<OJSubmission>(
            `submissions/${encodeURIComponent(sub.id)}?${new URLSearchParams({ wait: '1', after: sub.watchToken ?? '' })}`,
            undefined,
            controller.signal,
          );
        const out = normalizeOutput(sub.cases?.[0]?.stdout ?? '');
        const compiled = sub.status !== 'compile_error';
        if (JUDGE_DOWN.has(sub.status)) error = t(...verdict(sub.status));
        else
          judged = {
            passed: compiled && out === current.driver.expected,
            status: sub.status,
            stdout: out,
            detail: (compiled ? (sub.cases?.[0]?.stderr ?? '') : (sub.compileOutput ?? '')).slice(0, 2000),
          };
      } catch (e) {
        if (controller.signal.aborted) return;
        // Not signed in after all, no verified email, no judge, offline: grade by the diff alone.
        error = e instanceof Error ? e.message : String(e);
      } finally {
        if (run.current === controller) setRunning(false);
      }
    }
    const grade: RecallGrade | null = judged ? (judged.passed ? (exact ? 'know' : 'partial') : 'no') : exact ? 'know' : null;
    const right = judged ? judged.passed : exact;
    const times = right && ms > 0 ? saveTime(timeKey, ms) : null;
    setRecalled({ diff, judged, grade, ms, error });
    const missing = diff.filter((line) => line.op !== 'same').length;
    const saved = grade
      ? await updateRecall(signedIn, (queue) => rateRecall(queue, `tpl:${slug}/${current.id}`, `${title} · ${current.label}`, grade, mcqDay()))
      : null;
    if (controller.signal.aborted) return;
    setSaid(
      [
        judged
          ? judged.passed
            ? t('通过了本站的测试。', "Passed this stop's tests.")
            : judged.status === 'compile_error'
              ? t('没有编译通过。', 'It did not compile.')
              : t('输出和期望不一致。', 'The output does not match.')
          : signedIn
            ? t('测试没跑成，只按逐行对比判。', 'The tests could not run, so only the line diff counts.')
            : t('登录并验证邮箱后可以跑测试；现在只按逐行对比判。', 'Sign in with a verified email to run the tests; for now only the line diff counts.'),
        exact ? t('和模板逐行一致。', 'Every line matches the template.') : t(`有 ${missing} 行和模板不同。`, `${missing} line${missing === 1 ? ' differs' : 's differ'} from the template.`),
        times ? t(`用时 ${clock(ms)}，最好 ${clock(times.best)}。`, `Time ${clock(ms)}, best ${clock(times.best)}.`) : '',
        grade && !saved
          ? t('没能记入复习，请稍后再试。', "Couldn't save to your review queue; try again in a moment.")
          : grade === 'know'
            ? t('已记为「会了」，之后按间隔回来复习。', 'Saved as known; it comes back for spaced review.')
            : grade === 'partial'
              ? t('能跑通但写法和模板不同，记为「部分会」。', 'It works but differs from the template: saved as partly known.')
              : grade === 'no'
                ? t('没跑通，记为「不会」，明天再来默写。', 'It failed: saved as not known, back tomorrow.')
                : t('没有记入复习。', 'Not added to your review queue.'),
      ]
        .filter(Boolean)
        .join(' '),
    );
  }
  const tap = (i: number) => {
    setChecked(false);
    if (picked === null || picked === i) {
      setPicked(picked === i ? null : i);
      setSaid(picked === i ? '' : t(`已选中第 ${i + 1} 行，再点一行和它交换。`, `Line ${i + 1} picked; tap another line to swap.`));
      return;
    }
    const next = [...now];
    [next[picked], next[i]] = [next[i], next[picked]];
    setOrder(next);
    setPicked(null);
    setSaid(t(`第 ${picked + 1} 行和第 ${i + 1} 行已交换。`, `Swapped lines ${picked + 1} and ${i + 1}.`));
  };
  const off = now.filter((k, i) => !sameLine(drill.lines[k], drill.lines[i])).length;
  const holes = blanks.filter((line): line is Blank => typeof line !== 'string');
  const wrongHoles = holes.filter((b, n) => !blankRight(b, typed[n] ?? '')).length;
  const check = () => {
    setChecked(true);
    setPicked(null);
    if (kind === 'order')
      setSaid(
        orderRight(drill.lines, now)
          ? t('顺序全对。', 'All lines are in order.')
          : t(`还有 ${off} 行不在原位。`, `${off} line${off === 1 ? ' is' : 's are'} still out of place.`),
      );
    else
      setSaid(
        wrongHoles
          ? t(`${holes.length} 个空里还有 ${wrongHoles} 个不对。`, `${wrongHoles} of ${holes.length} blanks are not right yet.`)
          : t('全部填对了。', 'Every blank is right.'),
      );
  };
  const context = (lines: string[], label: string) =>
    lines.some((line) => line.trim()) && (
      <pre className="topics-drill-context" role="region" tabIndex={0} aria-label={label}>
        <code translate="no">{lines.join('\n')}</code>
      </pre>
    );
  return (
    <div className="topics-drill-box">
      <div className="topics-drill-bar">
        <div role="group" aria-label={t('题型', 'Drill')}>
          <button type="button" aria-pressed={kind === 'order'} onClick={() => restart({ kind: 'order' })}>
            {t('排序题', 'Put in order')}
          </button>
          <button type="button" aria-pressed={kind === 'blank'} onClick={() => restart({ kind: 'blank' })}>
            {t('填空题', 'Fill in the blanks')}
          </button>
          <button type="button" aria-pressed={kind === 'recall'} onClick={() => restart({ kind: 'recall' })}>
            {t('默写判题', 'Write from memory')}
          </button>
        </div>
        <div role="group" aria-label={t('语言', 'Language')}>
          {langs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={lang === value}
              onClick={() => {
                restart({ lang: value });
                saveCodeLang(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {templates.length > 1 && (
          <div role="group" aria-label={t('模板', 'Template')} className="topics-drill-templates">
            {templates.map((item) => (
              <button key={item.id} type="button" aria-pressed={current.id === item.id} onClick={() => restart({ pick: item.id })}>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {kind === 'recall' ? (
        <>
          <p className="topics-drill-help" id="topics-recall-help">
            {t(
              `不看代码，在空白编辑器里把「${current.label}」从头写出来，函数名和参数照模板；上面的代码已经模糊，第一次按键开始计时。Ctrl / ⌘ + Enter 检查。`,
              `Without looking, write "${current.label}" from scratch in the empty editor, with the template's function names and parameters. The code above is blurred, and the clock starts at your first key. Ctrl / ⌘ + Enter checks it.`,
            )}
          </p>
          <p className="topics-recall-meta">
            {started !== null && !recalled && <span>{t(`用时 ${clock(Math.max(0, tick - started))}`, `Time ${clock(Math.max(0, tick - started))}`)}</span>}
            {record && <span>{t(`上次 ${clock(record.last)} · 最好 ${clock(record.best)}`, `Last ${clock(record.last)} · best ${clock(record.best)}`)}</span>}
          </p>
          <div className="topics-recall-editor" aria-describedby="topics-recall-help">
            <Suspense fallback={<p className="topics-drill-help">{t('正在打开编辑器…', 'Opening the editor…')}</p>}>
              <CodeEditor
                key={`${current.id}-${lang}-${round}`}
                value={written}
                language={lang}
                onChange={write}
                onRun={() => void checkRecall()}
                path={`cswork://template-recall/${slug}/${current.id}/${FILES[lang]}`}
                bare
              />
            </Suspense>
          </div>
          {recalled && (
            <div className="topics-recall-result">
              {recalled.error && <p className="topics-recall-error">{recalled.error}</p>}
              {recalled.judged && !recalled.judged.passed && (
                <div className="topics-recall-output">
                  {recalled.judged.status !== 'compile_error' && (
                    <>
                      <p>{t('期望输出', 'Expected output')}</p>
                      {context(current.driver.expected.split('\n'), t('期望输出', 'Expected output'))}
                      <p>{t('你的输出', 'Your output')}</p>
                      {context((recalled.judged.stdout || t('（没有输出）', '(no output)')).split('\n'), t('你的输出', 'Your output'))}
                    </>
                  )}
                  {recalled.judged.detail && (
                    <>
                      <p>{recalled.judged.status === 'compile_error' ? t('编译输出', 'Compiler output') : t('错误输出', 'Error output')}</p>
                      {context(recalled.judged.detail.split('\n'), t('编译或错误输出', 'Compiler or error output'))}
                    </>
                  )}
                </div>
              )}
              <p className="topics-drill-help">{t('逐行对比（注释和空行不算）：', 'Line by line (comments and blank lines aside):')}</p>
              <ol className="topics-recall-diff" aria-label={t('逐行对比', 'Line diff')}>
                {recalled.diff.map((line, i) => (
                  <li key={i} data-op={line.op}>
                    <span className="topics-recall-op" aria-hidden="true">
                      {line.op === 'same' ? '✓' : line.op === 'missing' ? '−' : '+'}
                    </span>
                    <span className="sr-only">
                      {line.op === 'same' ? t('一致：', 'Same: ') : line.op === 'missing' ? t('漏写：', 'Missing: ') : t('多写：', 'Extra: ')}
                    </span>
                    <code translate="no">{line.text}</code>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      ) : kind === 'order' ? (
        <>
          <p className="topics-drill-help" id="topics-drill-help">
            {t(
              '下面几行被打乱了。点一行选中，再点另一行和它交换，排回模板原来的顺序；缩进是提示。',
              'These lines are shuffled. Tap a line to pick it, then tap another to swap them, until they read as the template does; the indentation is a hint.',
            )}
          </p>
          {context(drill.before, t('前面的代码', 'Code before'))}
          <ol className="topics-drill-lines" aria-describedby="topics-drill-help">
            {now.map((k, i) => {
              const right = sameLine(drill.lines[k], drill.lines[i]);
              return (
                <li key={i}>
                  <button
                    type="button"
                    aria-pressed={picked === i}
                    data-state={checked ? (right ? 'right' : 'wrong') : undefined}
                    onClick={() => tap(i)}
                  >
                    {/* Not by colour alone: a mark, and words for screen readers. */}
                    {checked && (
                      <span className="topics-drill-mark">
                        <span aria-hidden="true">{right ? '✓' : '✗'}</span>
                        <span className="sr-only">{right ? t('位置正确：', 'In place: ') : t('位置不对：', 'Out of place: ')}</span>
                      </span>
                    )}
                    <code translate="no">{drill.lines[k]}</code>
                  </button>
                </li>
              );
            })}
          </ol>
          {context(drill.after, t('后面的代码', 'Code after'))}
        </>
      ) : (
        <>
          <p className="topics-drill-help">
            {t(
              '注释已去掉。把空出来的条件、mid 的算法或返回值填回去；空格不影响判分。',
              'Comments are gone. Fill the blanked conditions, mid computations and return values back in; spacing does not matter.',
            )}
          </p>
          <pre className="topics-drill-code" role="region" tabIndex={0} aria-label={t('填空代码', 'Code with blanks')}>
            <code translate="no">
              {blanks.map((line, i) => {
                if (typeof line === 'string')
                  return (
                    <Fragment key={i}>
                      {i > 0 && '\n'}
                      {line}
                    </Fragment>
                  );
                const n = holes.indexOf(line);
                const right = blankRight(line, typed[n] ?? '');
                return (
                  <Fragment key={i}>
                    {i > 0 && '\n'}
                    {line.before}
                    <input
                      aria-label={t(`第 ${n + 1} 空`, `Blank ${n + 1}`)}
                      value={answers ? line.answer : (typed[n] ?? '')}
                      readOnly={answers}
                      size={Math.max(4, line.answer.length)}
                      spellCheck={false}
                      autoCapitalize="off"
                      autoComplete="off"
                      data-state={checked || answers ? (answers || right ? 'right' : 'wrong') : undefined}
                      aria-invalid={checked && !answers && !right ? true : undefined}
                      onChange={(e) => {
                        setTyped((v) => ({ ...v, [n]: e.target.value }));
                        setChecked(false);
                      }}
                    />
                    {/* Not by the border colour alone, as for the order drill's lines. */}
                    {checked && !answers && (
                      <span className="topics-drill-mark" data-state={right ? 'right' : 'wrong'}>
                        <span aria-hidden="true">{right ? '✓' : '✗'}</span>
                        <span className="sr-only">{right ? t('对', 'right') : t('不对', 'not right')}</span>
                      </span>
                    )}
                    {line.after}
                  </Fragment>
                );
              })}
            </code>
          </pre>
        </>
      )}
      <div className="topics-drill-actions">
        {kind === 'recall' ? (
          <>
            <button type="button" disabled={running || !written.trim()} onClick={() => void checkRecall()}>
              {signedIn ? t('运行并检查', 'Run and check') : t('逐行对比', 'Compare lines')}
            </button>
            <button type="button" className="is-quiet" onClick={() => restart({})}>
              {t('再写一遍', 'Start over')}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={check}>
              {t('检查', 'Check')}
            </button>
            {kind === 'blank' && (
              <button type="button" className="is-quiet" aria-pressed={answers} onClick={() => setAnswers(!answers)}>
                {t('显示答案', 'Show answers')}
              </button>
            )}
            <button type="button" className="is-quiet" onClick={() => restart({ seed: seed + 1 })}>
              {t('换一题', 'Another one')}
            </button>
          </>
        )}
        <output aria-live="polite">{said}</output>
      </div>
    </div>
  );
}
