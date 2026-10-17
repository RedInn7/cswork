'use client';
import { lazy, Suspense, useEffect, useId, useState } from 'react';
import { useLocale, useT } from '@/lib/i18n';
import { mcqDay, mcqDue } from '@/lib/mock-oa';
import { NOTE_MAX_BYTES } from '@/lib/practice-review';
import {
  RECALL_KEY,
  RECALL_NOTE,
  emptyRecall,
  fitRecall,
  mergeRecall,
  parseRecall,
  rateRecall,
  recallHref,
  recallNext,
  type RecallCard,
  type RecallGrade,
  type RecallQueue,
} from '@/lib/recall';
import '@/app/recall.css';

const CardEditor = lazy(() => import('./card-editor').then((m) => ({ default: m.CardEditor })));
const noteUrl = (note: string) => `/api/oj/notes?target=${encodeURIComponent(note)}`;

function readLocal() {
  try {
    return parseRecall(localStorage.getItem(RECALL_KEY));
  } catch {
    return emptyRecall();
  }
}
function writeLocal(queue: RecallQueue) {
  try {
    if (Object.keys(queue.items).length) localStorage.setItem(RECALL_KEY, JSON.stringify(queue));
    else localStorage.removeItem(RECALL_KEY);
    return true;
  } catch {
    return false;
  }
}
/** Saves the queue as the note; an empty body removes it (lib/server/my-practice.ts). */
const putNote = (queue: RecallQueue, note: string) =>
  fetch(noteUrl(note), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: fitRecall(queue, NOTE_MAX_BYTES) }),
  }).then(
    (response) => response.ok,
    () => false,
  );

/**
 * The learner's queue. Signed in it is the private note `recall:queue`, and cards rated while
 * signed out move into it once (this browser's copy goes when the account has them); signed
 * out, or while the account can't be reached, it is this browser's. `note` RECALL_CARDS or
 * RECALL_IDEAS reads that queue instead, which lives in the account only.
 */
export async function loadRecall(signedIn: boolean, note = RECALL_NOTE): Promise<{ queue: RecallQueue; account: boolean }> {
  const local = note === RECALL_NOTE ? readLocal() : emptyRecall();
  if (!signedIn) return { queue: local, account: false };
  try {
    const response = await fetch(noteUrl(note));
    if (!response.ok) throw new Error(String(response.status));
    const saved = parseRecall((await response.json())?.body);
    if (!Object.keys(local.items).length) return { queue: saved, account: true };
    const merged = mergeRecall(local, saved);
    if (await putNote(merged, note)) writeLocal(emptyRecall());
    return { queue: merged, account: true };
  } catch {
    return { queue: local, account: false };
  }
}

// Changes go out one at a time and each reads the latest queue first, so a rating in another
// tab or a second component on the page is never overwritten.
let chain: Promise<unknown> = Promise.resolve();
/** `change` applied to the latest queue (of `note`) and saved; null when it could not be saved. */
export function updateRecall(signedIn: boolean, change: (queue: RecallQueue) => RecallQueue, note = RECALL_NOTE) {
  const run = chain.then(async () => {
    const { queue, account } = await loadRecall(signedIn, note);
    // Signed in but the account can't be read (429, offline, expired session): fail rather than
    // keep the change in this browser, where the account's copy would win at the next load.
    if (signedIn && !account) return null;
    const next = change(queue);
    return (account ? await putNote(next, note) : writeLocal(next)) ? next : null;
  });
  chain = run.catch(() => null);
  return run;
}

/** A UTC day number (mcqDay) as a short local date. */
export function recallDate(day: number, locale: string) {
  return new Date(day * 86_400_000).toLocaleDateString(locale === 'en' ? 'en-US' : 'zh-CN', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const GRADES: [RecallGrade, string, string][] = [
  ['know', '会了', 'Knew it'],
  ['partial', '部分会', 'Partly'],
  ['no', '不会', "Didn't know"],
];

/** Key points to tick off against an answer, the count in the legend; `candidate`: an interviewer ticks them. */
export function PointsChecklist({
  points,
  checked,
  onChange,
  candidate,
}: {
  points: string[];
  checked: readonly number[];
  onChange: (checked: number[]) => void;
  candidate?: boolean;
}) {
  const t = useT();
  if (!points.length) return null;
  const n = checked.length;
  return (
    <fieldset className="recall-points">
      <legend>
        {candidate
          ? t(`候选人讲到的要点（${n}/${points.length}）`, `Key points the candidate covered (${n} of ${points.length})`)
          : t(`对照要点（${n}/${points.length}）`, `Key points you covered (${n} of ${points.length})`)}
      </legend>
      <ul>
        {points.map((point, i) => (
          <li key={i}>
            <label>
              <input
                type="checkbox"
                checked={checked.includes(i)}
                onChange={(event) => onChange(event.target.checked ? [...checked, i].sort((a, b) => a - b) : checked.filter((x) => x !== i))}
              />
              <span>{point}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/**
 * Under a revealed reference answer: tick the key points the answer covered (this visit only),
 * then grade yourself. The card comes back after 1/3/7/21 days (lib/recall.ts) and shows up
 * under My progress → Due for review. No AI: this works when AI grading is off.
 */
export function RecallRate({
  target,
  title,
  points = [],
  signedIn,
}: {
  /** `content:<type>/<slug>` or `sd:<chapter>`. */
  target: string;
  title: string;
  points?: string[];
  signedIn: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const id = useId();
  const [card, setCard] = useState<RecallCard | null>(null);
  const [state, setState] = useState<'' | 'saving' | 'saved' | 'held' | 'failed'>('');
  const [ticked, setTicked] = useState<number[]>([]);
  const [making, setMaking] = useState(false);
  // Callers key this by target, so another question starts with fresh state.
  useEffect(() => {
    let current = true;
    void loadRecall(signedIn).then(({ queue }) => current && setCard(queue.items[target] ?? null));
    return () => {
      current = false;
    };
  }, [signedIn, target]);

  async function rate(grade: RecallGrade) {
    setState('saving');
    let held = false;
    const next = await updateRecall(signedIn, (queue) => {
      const before = queue.items[target];
      const after = rateRecall(queue, target, title, grade, mcqDay());
      // A "knew it" before the card is due keeps its box and day.
      held = grade === 'know' && !!before && after.items[target]?.[1] === before[1];
      return after;
    });
    if (!next) return setState('failed');
    setCard(next.items[target] ?? null);
    setState(held ? 'held' : 'saved');
  }

  const back = card && recallNext(card);
  const when = back === null || back === undefined ? '' : recallDate(back, locale);
  const status =
    state === 'saving'
      ? t('正在保存…', 'Saving…')
      : state === 'failed'
        ? t('没能保存，请稍后再试。', "Couldn't save. Try again in a moment.")
        : !card
          ? ''
          : back === null
            ? t('已掌握：这道题不再安排复习。', 'Mastered: this one will not come back.')
            : state === 'held'
              ? t(`还没到复习时间（${when}），这次不升格。`, `Not due until ${when}, so it stays in its box.`)
              : state === 'saved'
                ? t(`已记下，${when} 再复习。`, `Saved. It comes back on ${when}.`)
                : mcqDue([card[0], card[1]], mcqDay())
                  ? t('已在复习队列，今天到期。', 'In your review queue, due today.')
                  : t(`已在复习队列，${when} 再复习。`, `In your review queue, back on ${when}.`);
  return (
    <section className="rd-card recall" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{t('自评一下', 'Grade yourself')}</h2>
      <p className="recall-note">
        {t(
          '对照上面的答案给自己打个分。没掌握的题会按 1、3、7、21 天的间隔回来，到期的题在「我的进度 · 到期复习」里。',
          'Grade your answer against the one above. Questions you have not mastered come back after 1, 3, 7 and 21 days, listed under My progress → Due for review.',
        )}{' '}
        {!signedIn && t('只存在这台设备上；登录后会合并到你的账号。', 'Kept on this device; sign in and it moves to your account.')}
      </p>
      <PointsChecklist points={points} checked={ticked} onChange={setTicked} />
      <fieldset className="recall-grades">
        <legend className="sr-only">{t('这道题你会了吗？', 'How well did you know it?')}</legend>
        {GRADES.map(([grade, zh, en], i) => (
          <button
            key={grade}
            type="button"
            className={i ? 'rd-button is-quiet' : 'rd-button'}
            disabled={state === 'saving'}
            onClick={() => void rate(grade)}
          >
            {t(zh, en)}
          </button>
        ))}
      </fieldset>
      <p className="recall-status" aria-live="polite">
        {status}
        {card && signedIn && state !== 'saving' && state !== 'failed' && (
          <>
            {' '}
            <a href="/?view=progress&tab=review">{t('去复习队列', 'Open the review queue')}</a>
          </>
        )}
      </p>
      {/* A card of its own (lib/recall-cards.ts): the key points prefill the back. Cards need an account. */}
      {signedIn && (
        <p className="recall-make">
          <button type="button" className="rd-button is-quiet" onClick={() => setMaking(true)}>
            {t('做成记忆卡', 'Make a review card')}
          </button>
        </p>
      )}
      {making && (
        <Suspense fallback={null}>
          <CardEditor
            initial={{
              front: title,
              back: points.map((point) => `- ${point}`).join('\n'),
              ...(recallHref(target) && { src: { href: recallHref(target)!, title: title.slice(0, 200) } }),
            }}
            onClose={() => setMaking(false)}
          />
        </Suspense>
      )}
    </section>
  );
}
