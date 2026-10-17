'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, Mic, Play, RotateCcw, Square, Volume2 } from 'lucide-react';
import { useLocale, useT } from '@/lib/i18n';
import { ApiError, api } from '@/lib/types';
import {
  BLANK, checkCloze, checkOrder, scramble, shadowScore, type EnglishUnit as Unit, type ShadowScore,
} from '@/lib/english-drill';
import { useSpeech } from './use-speech';

/** Read-aloud speed: a touch slower than the voice's default. */
const RATE = 0.95;
const PREFIX = 'content:english/';
const LOCAL = 'cswork:english:done';
const SLUG = /^[a-z]+(?:-[a-z]+)*$/;

/* ------------------------------------------------------------ done marks */

function readLocal(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(LOCAL) ?? '[]');
    return Array.isArray(list) ? list.filter((slug): slug is string => typeof slug === 'string' && SLUG.test(slug)) : [];
  } catch {
    return [];
  }
}
function writeLocal(slugs: Iterable<string>) {
  try {
    const list = [...slugs];
    if (list.length) localStorage.setItem(LOCAL, JSON.stringify(list));
    else localStorage.removeItem(LOCAL);
  } catch {
    // Not saved; the tick stays for this page view.
  }
}

// The units marked done, fetched once per page: user_marks (content:english/<unit>, done) for a
// signed-in learner; for a guest ('local') this browser's list, which moves into the account on the
// next signed-in visit. Marks that did not load ('failed') show the error and take no ticks.
type Done = { state: 'loading' | 'local' | 'account' | 'failed'; slugs: ReadonlySet<string>; error: string };
const LOADING: Done = { state: 'loading', slugs: new Set(), error: '' };
let done = LOADING;
let requested = false;
const listeners = new Set<() => void>();
function publish(next: Done) {
  done = next;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!requested) {
    requested = true;
    api<{ items: { target: string }[] }>('oj/marks?mark=done').then(
      ({ items }) => {
        const slugs = new Set(items.flatMap(({ target }) => (target.startsWith(PREFIX) ? [target.slice(PREFIX.length)] : [])));
        const local = readLocal().filter((slug) => !slugs.has(slug));
        // ponytail: one request per unit (twelve at most); a failed move keeps the list and retries next visit.
        if (local.length)
          Promise.all(local.map((slug) => api('oj/marks', { target: PREFIX + slug, mark: 'done', on: true }))).then(
            () => writeLocal([]),
            () => {},
          );
        publish({ state: 'account', slugs: new Set([...slugs, ...local]), error: '' });
      },
      (reason: unknown) =>
        publish(
          reason instanceof ApiError && reason.status === 401
            ? { state: 'local', slugs: new Set(readLocal()), error: '' }
            : { state: 'failed', slugs: new Set(), error: (reason as Error).message },
        ),
    );
  }
  return () => {
    listeners.delete(listener);
    // The next page asks again.
    if (!listeners.size) requested = false;
  };
}
const useDone = () => useSyncExternalStore(subscribe, () => done, () => LOADING);

async function setDone(slug: string, on: boolean) {
  const flip = (slugs: ReadonlySet<string>, to: boolean) => {
    const next = new Set(slugs);
    if (to) next.add(slug);
    else next.delete(slug);
    return next;
  };
  const account = done.state === 'account';
  publish({ ...done, slugs: flip(done.slugs, on), error: '' });
  if (!account) return writeLocal(done.slugs);
  try {
    await api('oj/marks', { target: PREFIX + slug, mark: 'done', on });
  } catch (reason) {
    publish({ ...done, slugs: flip(done.slugs, !on), error: (reason as Error).message });
  }
}

/** A tick on a unit marked done. */
export function EnglishDoneCheck({ slug }: { slug: string }) {
  const t = useT();
  if (!useDone().slugs.has(slug)) return null;
  return (
    <span className="eng-done-check">
      <Check size={14} aria-hidden="true" /> {t('已完成', 'Done')}
    </span>
  );
}

/** "3 of 12 done" with a bar, once the marks are in. */
export function EnglishDoneCount({ slugs }: { slugs: string[] }) {
  const t = useT();
  const { state, slugs: marked } = useDone();
  if (state === 'loading' || state === 'failed') return null;
  const n = slugs.filter((slug) => marked.has(slug)).length;
  return (
    <div className="eng-count">
      <p>
        <span className="eng-count-bar" aria-hidden="true">
          <span style={{ width: `${(100 * n) / slugs.length}%` }} />
        </span>
        {t(`已完成 ${n}/${slugs.length} 个单元`, `${n} of ${slugs.length} units done`)}
      </p>
      {state === 'local' && <LocalNote />}
    </div>
  );
}

function LocalNote() {
  const t = useT();
  return (
    <p className="eng-muted">
      {t(
        '没有登录时，完成情况只存在这个浏览器里；登录后再打开本页会同步到账户。',
        'Signed out, your progress stays in this browser; open this page again after signing in to keep it in your account.',
      )}
    </p>
  );
}

/* ------------------------------------------------------------------ unit */

type Blank = { value: string; state: 'right' | 'wrong' | null; shown: boolean };
const level = (similarity: number) => (similarity >= 0.85 ? 'good' : similarity >= 0.6 ? 'close' : 'low');

/**
 * One unit: phrases to hear and shadow, the dialogue read line by line, and the cloze and order
 * drills, checked as the learner answers. Getting every drill right marks the unit done.
 * Listening and shadowing use the browser's own speech and are hidden where it has none.
 */
export function EnglishUnit({ unit }: { unit: Unit }) {
  const t = useT();
  const locale = useLocale();
  const [englishOnly, setEnglishOnly] = useState(locale === 'en');
  const them = unit.them ? t(unit.them.zh, unit.them.en) : t('面试官', 'Interviewer');

  // Shadowing: one phrase (or candidate line) at a time; its words add up until listening stops.
  const [shadowing, setShadowing] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, ShadowScore | 'none'>>({});
  const attempt = useRef({ key: '', target: '', said: '', ms: 0 });
  const speech = useSpeech(
    'en',
    (text, ms) => {
      const a = attempt.current;
      if (!a.key || !text) return;
      a.said = a.said ? `${a.said} ${text}` : text;
      a.ms += ms;
      setScores((all) => ({ ...all, [a.key]: shadowScore(a.said, a.target, a.ms) }));
    },
    { continuous: false },
  );
  useEffect(() => {
    // Listening ended: after one utterance, a stop, or a microphone the browser refused.
    if (speech.listening || !shadowing) return;
    const heard = attempt.current.said;
    attempt.current = { key: '', target: '', said: '', ms: 0 };
    // oxlint-disable-next-line react/react-compiler -- The recognizer's end arrives as this state change.
    setShadowing(null);
    if (!heard) setScores((all) => ({ ...all, [shadowing]: 'none' }));
  }, [speech.listening, shadowing]);

  // Playback: one line, or the dialogue line by line; a newer request makes older callbacks stale.
  const [playing, setPlaying] = useState<number | null>(null);
  const run = useRef(0);
  // Leaving the page stops the run: a line cancelled on the way out may still report its end.
  useEffect(
    () => () => {
      run.current++;
    },
    [],
  );
  const stopPlaying = () => {
    run.current++;
    setPlaying(null);
    speech.hush();
  };
  const listen = (text: string) => {
    run.current++;
    setPlaying(null);
    speech.say(text, { rate: RATE, always: true });
  };
  const playFrom = (from: number) => {
    const token = ++run.current;
    const step = (i: number) => {
      if (run.current !== token) return;
      if (i >= unit.dialogue.length) return setPlaying(null);
      setPlaying(i);
      speech.say(unit.dialogue[i].en, { rate: RATE, always: true, onEnd: () => step(i + 1) });
    };
    step(from);
  };
  const shadow = (key: string, target: string) => {
    if (speech.listening) return speech.toggleListen();
    stopPlaying();
    attempt.current = { key, target, said: '', ms: 0 };
    setShadowing(key);
    setScores(({ [key]: _, ...rest }) => rest);
    speech.toggleListen();
  };

  const [blanks, setBlanks] = useState<Blank[]>(() => unit.drills.cloze.map(() => ({ value: '', state: null, shown: false })));
  const editBlank = (i: number, change: Partial<Blank>) =>
    setBlanks((all) => all.map((blank, j) => (j === i ? { ...blank, ...change } : blank)));
  const judge = (i: number) => {
    const blank = blanks[i];
    if (blank.value.trim() && blank.state !== 'right') editBlank(i, { state: 'wrong' });
  };
  const [picked, setPicked] = useState<number[][]>(() => unit.drills.order.map(() => []));
  const editPicked = (i: number, change: (chosen: number[]) => number[]) =>
    setPicked((all) => all.map((chosen, j) => (j === i ? change(chosen) : chosen)));
  const [revealed, setRevealed] = useState<boolean[]>(() => unit.drills.order.map(() => false));
  const ordered = unit.drills.order.map((drill, i) =>
    checkOrder(
      picked[i].map((at) => drill.parts[at]),
      drill.parts,
      drill.also,
    ),
  );
  const right = blanks.filter((blank) => blank.state === 'right').length + ordered.filter(Boolean).length;
  const total = blanks.length + ordered.length;

  const { state, slugs, error } = useDone();
  const marked = slugs.has(unit.slug);
  const autoMarked = useRef(false);
  useEffect(() => {
    // Every drill right marks the unit done, once per visit; unticking it afterwards sticks.
    if (right < total || autoMarked.current || state === 'loading' || state === 'failed') return;
    autoMarked.current = true;
    if (!marked) void setDone(unit.slug, true);
  }, [right, total, state, marked, unit.slug]);

  const tools = (key: string, text: string, shadowable = true) => (
    <span className="eng-tools">
      {speech.canSpeak && (
        <button type="button" className="eng-tool" aria-describedby={`${key}-en`} disabled={!!shadowing} onClick={() => listen(text)}>
          <Volume2 size={14} aria-hidden="true" /> {t('听', 'Listen')}
        </button>
      )}
      {shadowable && speech.canListen && (
        <button
          type="button"
          className="eng-tool"
          aria-describedby={`${key}-en`}
          aria-pressed={shadowing === key}
          disabled={!!shadowing && shadowing !== key}
          onClick={() => shadow(key, text)}
        >
          <Mic size={14} aria-hidden="true" /> {shadowing === key ? t('停止跟读', 'Stop') : t('跟读', 'Shadow')}
        </button>
      )}
    </span>
  );
  const score = (key: string) => {
    const s = scores[key];
    return (
      <output className="eng-score">
        {s === 'none'
          ? t('没有听到声音。允许麦克风后再试一次。', "Didn't catch anything. Allow the microphone and try again.")
          : s && (
              <>
                <strong data-level={level(s.similarity)}>
                  {t('相似度', 'Match')} {Math.round(s.similarity * 100)}% ·{' '}
                  {{ good: t('很接近', 'very close'), close: t('还差一点', 'almost'), low: t('再听一遍试试', 'listen again and retry') }[level(s.similarity)]}
                </strong>{' '}
                {s.perMinute !== null && <span>{t(`语速约 ${s.perMinute} 词/分钟`, `About ${s.perMinute} words/min`)} </span>}
                <span>{t(`口头禅 ${s.fillers} 个`, `${s.fillers} filler${s.fillers === 1 ? '' : 's'}`)} </span>
                <span className="eng-heard">
                  {t('听到：', 'Heard: ')}
                  <q lang="en">{s.said}</q>
                </span>
              </>
            )}
      </output>
    );
  };

  return (
    <div className="eng-unit">
      <div className="eng-toolbar">
        <label className="eng-switch">
          <input type="checkbox" checked={englishOnly} onChange={(event) => setEnglishOnly(event.target.checked)} />
          {t('只看英文', 'English only')}
        </label>
        {speech.canListen && (
          <p className="eng-muted">
            {t(
              '跟读使用浏览器自带的语音识别，部分浏览器（例如 Chrome）会把录音发送到浏览器厂商的服务器转成文字，这一过程不经过本平台；相似度、语速和口头禅只在你的浏览器里计算，不上传。',
              "Shadowing uses your browser's own speech recognition; some browsers (Chrome, for example) send the recording to the browser maker's servers to transcribe it, without passing through this site. Match, pace and filler counts are worked out in your browser and never uploaded.",
            )}
          </p>
        )}
      </div>

      <section className="eng-section" aria-labelledby="eng-phrases">
        <h2 id="eng-phrases">{t('常用表达', 'Phrases')}</h2>
        <ol className="eng-phrases">
          {unit.phrases.map((phrase, i) => (
            <li key={phrase.en} className="eng-phrase">
              <p className="eng-en" lang="en" id={`p${i}-en`}>
                {phrase.en}
              </p>
              {!englishOnly && (
                <p className="eng-zh" lang="zh-CN">
                  {phrase.zh}
                </p>
              )}
              <p className="eng-note">{t(phrase.note.zh, phrase.note.en)}</p>
              {tools(`p${i}`, phrase.en)}
              {score(`p${i}`)}
            </li>
          ))}
        </ol>
      </section>

      <section className="eng-section" aria-labelledby="eng-dialogue">
        <div className="eng-section-head">
          <h2 id="eng-dialogue">{t('对话', 'Dialogue')}</h2>
          {speech.canSpeak &&
            (playing === null ? (
              <button type="button" className="eng-tool is-strong" disabled={!!shadowing} onClick={() => playFrom(0)}>
                <Play size={14} aria-hidden="true" /> {t('逐句播放', 'Play line by line')}
              </button>
            ) : (
              <button type="button" className="eng-tool is-strong" onClick={stopPlaying}>
                <Square size={14} aria-hidden="true" /> {t('停止播放', 'Stop playback')}
              </button>
            ))}
        </div>
        <ol className="eng-script">
          {unit.dialogue.map((line, i) => (
            <li key={i} data-who={line.who} aria-current={playing === i || undefined}>
              <span className="eng-who">{line.who === 'C' ? t('你', 'You') : them}</span>
              <div>
                <p className="eng-en" lang="en" id={`d${i}-en`}>
                  {line.en}
                </p>
                {!englishOnly && (
                  <p className="eng-zh" lang="zh-CN">
                    {line.zh}
                  </p>
                )}
                {tools(`d${i}`, line.en, line.who === 'C')}
                {line.who === 'C' && score(`d${i}`)}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="eng-section" aria-labelledby="eng-drills">
        <h2 id="eng-drills">{t('练习', 'Drills')}</h2>
        <h3>{t('填空', 'Fill in the blank')}</h3>
        <ol className="eng-drills">
          {unit.drills.cloze.map((drill, i) => {
            const [before, after] = drill.en.split(BLANK);
            const blank = blanks[i];
            return (
              <li key={drill.en} data-state={blank.state ?? undefined}>
                <p className="eng-en" lang="en">
                  {before}
                  <input
                    className="eng-blank"
                    value={blank.value}
                    size={Math.max(8, ...drill.answers.map((answer) => answer.length + 2))}
                    aria-label={t(`第 ${i + 1} 题的空`, `Blank ${i + 1}`)}
                    aria-describedby={`c${i}-zh`}
                    aria-invalid={blank.state === 'wrong' || undefined}
                    readOnly={blank.state === 'right'}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    onChange={(event) =>
                      editBlank(i, { value: event.target.value, state: checkCloze(event.target.value, drill.answers) ? 'right' : null })
                    }
                    onBlur={() => judge(i)}
                    onKeyDown={(event) => event.key === 'Enter' && judge(i)}
                  />
                  {after}
                </p>
                <p className="eng-zh" lang="zh-CN" id={`c${i}-zh`}>
                  {drill.zh}
                </p>
                <output className="eng-verdict">
                  {blank.state === 'right' ? (
                    <>
                      <Check size={14} aria-hidden="true" /> {t('对了', 'Correct')}
                    </>
                  ) : blank.state === 'wrong' ? (
                    t('不太对，再想想', 'Not quite, try again')
                  ) : null}
                  {blank.shown && (
                    <span>
                      {' '}
                      {t('参考答案：', 'Answers: ')}
                      <span lang="en">{drill.answers.join(' / ')}</span>
                    </span>
                  )}
                </output>
                {blank.state !== 'right' && !blank.shown && (
                  <button type="button" className="eng-link" onClick={() => editBlank(i, { shown: true })}>
                    {t('看答案', 'Show answer')}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        <h3>{t('排序', 'Put it in order')}</h3>
        <ol className="eng-drills">
          {unit.drills.order.map((drill, i) => {
            const chosen = picked[i];
            const complete = chosen.length === drill.parts.length;
            const take = (at: number, event: React.MouseEvent<HTMLButtonElement>) => {
              // The tapped piece leaves the pool: focus moves to the next one, else the sentence's last
              // piece, else (right, so the pieces are locked) the drill itself.
              const pool = event.currentTarget.parentElement;
              editPicked(i, (list) => [...list, at]);
              requestAnimationFrame(() =>
                (
                  pool?.querySelector('button') ??
                  pool?.previousElementSibling?.querySelector<HTMLElement>('button:last-of-type:enabled') ??
                  pool?.closest('li')
                )?.focus(),
              );
            };
            return (
              <li key={drill.parts.join(' ')} tabIndex={-1} data-state={complete ? (ordered[i] ? 'right' : 'wrong') : undefined}>
                <p className="eng-zh" lang="zh-CN">
                  {drill.zh}
                </p>
                <fieldset className="eng-line" aria-label={t('你的句子', 'Your sentence')}>
                  {chosen.length ? (
                    chosen.map((at) => (
                      <button
                        key={at}
                        type="button"
                        className="eng-chip is-placed"
                        lang="en"
                        disabled={ordered[i]}
                        aria-label={t(`移回：${drill.parts[at]}`, `Take back: ${drill.parts[at]}`)}
                        onClick={() => editPicked(i, (list) => list.filter((x) => x !== at))}
                      >
                        {drill.parts[at]}
                      </button>
                    ))
                  ) : (
                    <span className="eng-muted">{t('按顺序点下面的短语', 'Tap the pieces below in order')}</span>
                  )}
                </fieldset>
                <fieldset className="eng-pool" aria-label={t('可选短语', 'Pieces')}>
                  {scramble(drill.parts, drill.also)
                    .filter((at) => !chosen.includes(at))
                    .map((at) => (
                      <button key={at} type="button" className="eng-chip" lang="en" onClick={(event) => take(at, event)}>
                        {drill.parts[at]}
                      </button>
                    ))}
                </fieldset>
                <output className="eng-verdict">
                  {complete &&
                    (ordered[i] ? (
                      <>
                        <Check size={14} aria-hidden="true" /> {t('对了', 'Correct')}
                      </>
                    ) : (
                      t('顺序不对', 'Not in the right order')
                    ))}
                  {revealed[i] && (
                    <span>
                      {' '}
                      {t('参考答案：', 'Answer: ')}
                      <span lang="en">{drill.parts.join(' ')}</span>
                    </span>
                  )}
                </output>
                {complete && !ordered[i] && (
                  <button type="button" className="eng-link" onClick={() => editPicked(i, () => [])}>
                    <RotateCcw size={13} aria-hidden="true" /> {t('重来', 'Start over')}
                  </button>
                )}
                {!ordered[i] && !revealed[i] && (
                  <button type="button" className="eng-link" onClick={() => setRevealed((all) => all.map((on, j) => on || j === i))}>
                    {t('看答案', 'Show answer')}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="eng-section eng-finish" aria-labelledby="eng-finish">
        <h2 id="eng-finish">{t('完成本单元', 'Finish the unit')}</h2>
        <p>
          {right === total
            ? t('练习全部答对了。', 'Every drill is right.')
            : t(`练习答对 ${right}/${total}；全部答对后会自动标记为已完成。`, `${right} of ${total} drills right; getting them all marks the unit done.`)}
        </p>
        <label className="eng-switch">
          <input
            type="checkbox"
            checked={marked}
            disabled={state === 'loading' || state === 'failed'}
            onChange={(event) => void setDone(unit.slug, event.target.checked)}
          />
          {t('这个单元我练完了', "I've finished this unit")}
        </label>
        {error && (
          <p className="eng-error" role="alert">
            {error}
          </p>
        )}
        {state === 'local' && <LocalNote />}
      </section>
    </div>
  );
}
