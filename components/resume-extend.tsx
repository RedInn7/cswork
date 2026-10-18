'use client';
import { useEffect, useId, useMemo, useState } from 'react';
import { blankLinkedIn, checkLinkedIn, LINKEDIN_KEY, LINKEDIN_MAX, linkedInFrom, normalizeLinkedIn, type LinkedIn, type OpenToWork } from '@/lib/linkedin-check';
import { ojRequest } from '@/lib/oj-client';
import { putCard } from '@/lib/put-card';
import { CARD_MAX } from '@/lib/recall-cards';
import { drillCard, drillEntry, drillSheet, resumeDrills } from '@/lib/resume-drill';
import type { Resume } from '@/lib/resume-shape';

/**
 * Under the builder's rule check (components/resume-builder.tsx), both by rules, no AI: the
 * follow-up questions an interviewer asks about the resume being edited (lib/resume-drill.ts),
 * which a signed-in learner adds to the review queue as cards and anyone copies for a friend to ask;
 * and a LinkedIn profile check (lib/linkedin-check.ts) on sections pasted in, kept in this browser.
 * Styles: app/career/resume/builder/resume-extend.css (loaded by the page).
 */
export function ResumeExtend({ resume, text, zh, signedIn }: { resume: Resume; text: string; zh: boolean; signedIn: boolean }) {
  return (
    <>
      <ResumeDrill resume={resume} zh={zh} signedIn={signedIn} />
      <LinkedInCheck links={resume.links} text={text} zh={zh} />
    </>
  );
}

type Status = { error: boolean; text: string; review?: boolean } | null;
const snip = (s: string) => (s.length > 60 ? `${s.slice(0, 60)}…` : s);

function ResumeDrill({ resume, zh, signedIn }: { resume: Resume; zh: boolean; signedIn: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const drills = useMemo(() => resumeDrills(resume), [resume]);
  // Unticked questions; a new question starts ticked.
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  // The card ids already in the account, once looked up.
  const [saved, setSaved] = useState<ReadonlySet<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const chosen = drills.filter((d) => !off.has(d.id));
  // One group per entry (resumeDrills lists an entry's questions together).
  const groups = [...new Set(drills.map((d) => d.where))].map((where) => [where, drills.filter((d) => d.where === where)] as const);

  async function savedCards() {
    const { items } = await ojRequest<{ items: { target: string }[] }>(`notes?prefix=${encodeURIComponent('card:')}`);
    const ids = new Set(items.map((i) => i.target.slice('card:'.length)));
    setSaved(ids);
    return ids;
  }
  async function addToReview() {
    setBusy(true);
    setStatus(null);
    try {
      const ids = new Set(await savedCards());
      // Re-adding a question overwrites its card; only new ones count against the cap.
      const fresh = chosen.filter((d) => !ids.has(d.id));
      const room = Math.max(0, CARD_MAX - ids.size);
      const queue = [...chosen.filter((d) => ids.has(d.id)), ...fresh.slice(0, room)];
      let added = 0;
      for (const d of queue) {
        const error = await putCard(d.id, drillCard(d, zh), t);
        if (error) return setStatus({ error: true, text: `${t(`已加入 ${added} 张。`, `Added ${added}.`)} ${error}` });
        added++;
        ids.add(d.id);
        setSaved(new Set(ids));
      }
      const left = fresh.length - Math.min(fresh.length, room);
      setStatus({
        error: left > 0,
        review: true,
        text:
          t(`已加入 ${added} 张，今天就会出现在「今日复习」里。`, `Added ${added}: they show up in today’s review session.`) +
          (left ? t(` 卡片已满 ${CARD_MAX} 张，还有 ${left} 题没加：先删掉一些旧卡。`, ` Your ${CARD_MAX} cards are full and ${left} were left out: delete some old cards first.`) : ''),
      });
    } catch (e) {
      setStatus({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(drillSheet(chosen, zh));
      setStatus({ error: false, text: t(`已复制 ${chosen.length} 题：发给同伴，请对方照着问。`, `Copied ${chosen.length}: send them to a friend to ask you.`) });
    } catch {
      setStatus({ error: true, text: t('没能复制：浏览器没有给剪贴板权限。', 'Could not copy: the browser blocked the clipboard.') });
    }
  }
  const toggle = (id: string) => setOff((prev) => (prev.has(id) ? new Set([...prev].filter((x) => x !== id)) : new Set([...prev, id])));

  return (
    <details
      id="resume-drill"
      className="resume-extend"
      onToggle={(e) => {
        if (e.currentTarget.open && signedIn && saved === null) savedCards().catch(() => {});
      }}
    >
      <summary>{t(`你的项目会被怎么追问（${drills.length} 题）`, `How interviewers will dig into your projects (${drills.length})`)}</summary>
      <p>
        {t(
          '按规则从工作经历和项目的要点出题，不是 AI：数字是怎么测的、为什么选这个技术、你个人做了哪部分、规模扩大 10 倍哪里先撑不住。每条要点最多 2 题，共最多 24 题。',
          'Questions drawn by rules from your experience and project bullets, not AI: how a number was measured, why that technology, which part was yours, what breaks at 10× the load. Up to 2 per bullet, 24 in all.',
        )}
      </p>
      {drills.length === 0 ? (
        <p>{t('先在工作经历或项目里写几条要点。', 'Write a few bullets under experience or projects first.')}</p>
      ) : (
        <>
          {groups.map(([where, ds]) => (
            <fieldset key={where} className="resume-drill-entry">
              <legend>{drillEntry(ds[0], zh)}</legend>
              <ul>
                {ds.map((d) => (
                  <li key={d.id}>
                    <label>
                      <input type="checkbox" checked={!off.has(d.id)} onChange={() => toggle(d.id)} />
                      <span>{zh ? d.q[0] : d.q[1]}</span>
                      {saved?.has(d.id) && <em className="resume-drill-saved">{t('已加入', 'Added')}</em>}
                    </label>
                    <small>
                      {t('要点：', 'Bullet: ')}
                      {snip(d.bullet)}
                      <br />
                      {t('要讲到：', 'Cover: ')}
                      {d.listen.map(([a, b]) => (zh ? a : b)).join(t('；', '; '))}
                    </small>
                  </li>
                ))}
              </ul>
            </fieldset>
          ))}
          <div className="resume-actions">
            {signedIn && (
              <button type="button" disabled={busy || !chosen.length} onClick={() => void addToReview()}>
                {busy ? t('正在加入…', 'Adding…') : t(`加入复习（${chosen.length}）`, `Add to review (${chosen.length})`)}
              </button>
            )}
            <button type="button" className="is-quiet" disabled={!chosen.length} onClick={() => void copy()}>
              {t('复制给同伴', 'Copy for a friend')}
            </button>
            {signedIn && saved && (
              <small>{t(`账户里已有 ${saved.size} 张卡，还能加 ${Math.max(0, CARD_MAX - saved.size)} 张`, `${saved.size} of ${CARD_MAX} cards used`)}</small>
            )}
            {!signedIn && <small>{t('登录后可以把勾选的题加入复习队列。', 'Sign in to add the ticked questions to your review queue.')}</small>}
          </div>
        </>
      )}
      {/* aria-live rather than role=status: the builder's own status line stays the page's first. */}
      <p aria-live="polite" role={status?.error ? 'alert' : undefined} className={status?.error ? 'resume-extend-status is-error' : 'resume-extend-status'}>
        {status?.text}
        {status?.review && (
          <>
            {' '}
            <a href="/?view=review-session">{t('去复习', 'Open the review session')}</a>
          </>
        )}
      </p>
    </details>
  );
}

const FIELDS: [keyof typeof LINKEDIN_MAX, string, string][] = [
  ['headline', '标题（Headline）', 'Headline'],
  ['about', '简介（About）', 'About'],
  ['experience', '经历（Experience）：每段之间空一行，可以从主页直接复制', 'Experience: a blank line between roles; copy it straight from your profile'],
  ['skills', '技能（Skills）：逗号或换行分隔', 'Skills: comma or line separated'],
  ['url', '主页地址（linkedin.com/in/…）', 'Profile URL (linkedin.com/in/…)'],
];
const OPEN: [Exclude<OpenToWork, ''>, string, string][] = [
  ['off', '关闭', 'Off'],
  ['recruiters', '只对招聘方可见', 'Recruiters only'],
  ['public', '所有人可见（头像加绿框）', 'All LinkedIn members (green photo frame)'],
];

function LinkedInCheck({ links, text, zh }: { links: string; text: string; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const radio = useId();
  const [p, setP] = useState<LinkedIn>(blankLinkedIn);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LINKEDIN_KEY);
      // oxlint-disable-next-line react/react-compiler -- Hydrate from browser storage after SSR.
      if (saved) setP(normalizeLinkedIn(JSON.parse(saved)));
    } catch {
      // Blocked storage or a damaged entry: start blank.
    }
    setLoaded(true);
  }, []);
  // An empty URL starts from the resume's LinkedIn link.
  const fromResume = linkedInFrom(links);
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- Prefilled once the stored profile is in.
    if (loaded && fromResume) setP((cur) => (cur.url ? cur : { ...cur, url: fromResume }));
  }, [loaded, fromResume]);
  const change = (next: LinkedIn) => {
    setP(next);
    try {
      localStorage.setItem(LINKEDIN_KEY, JSON.stringify(next));
    } catch {
      // Private mode or full storage: the check still works for this visit.
    }
  };
  const check = useMemo(() => checkLinkedIn(p, text.trim() ? text : null), [p, text]);
  function jump(where: string) {
    const el = document.getElementById(`linkedin-${where}`);
    const field = el?.matches('input, textarea') ? el : el?.querySelector<HTMLElement>('input');
    el?.scrollIntoView?.({ block: 'center' });
    field?.focus({ preventScroll: true });
  }

  return (
    <details id="resume-linkedin" className="resume-extend resume-linkedin">
      <summary>{t('LinkedIn 主页检查', 'LinkedIn profile check')}</summary>
      <p>
        {t(
          '把主页各栏复制进来，按规则打分。只在这个浏览器里算，不抓取 LinkedIn，也不上传。',
          'Paste in each section of your profile for a rules-based score. It runs in this browser only: nothing is fetched from LinkedIn or uploaded.',
        )}
      </p>
      <form className="resume-form" onSubmit={(e) => e.preventDefault()}>
        {FIELDS.map(([key, zhLabel, enLabel]) => (
          <label key={key}>
            {t(zhLabel, enLabel)}
            {key === 'headline' || key === 'url' ? (
              <input id={`linkedin-${key}`} value={p[key]} maxLength={LINKEDIN_MAX[key]} inputMode={key === 'url' ? 'url' : undefined} onChange={(e) => change({ ...p, [key]: e.target.value })} />
            ) : (
              <textarea id={`linkedin-${key}`} rows={key === 'skills' ? 2 : 4} value={p[key]} maxLength={LINKEDIN_MAX[key]} onChange={(e) => change({ ...p, [key]: e.target.value })} />
            )}
          </label>
        ))}
        <div id="linkedin-openToWork" className="resume-linkedin-open" role="radiogroup" aria-labelledby={`${radio}-label`}>
          <span id={`${radio}-label`}>Open to Work</span>
          {OPEN.map(([value, zhLabel, enLabel]) => (
            <label key={value}>
              <input type="radio" name={radio} value={value} checked={p.openToWork === value} onChange={() => change({ ...p, openToWork: value })} />
              {t(zhLabel, enLabel)}
            </label>
          ))}
        </div>
      </form>
      <div className="resume-check" aria-live="polite">
        <p>
          <strong>
            {t('主页得分', 'Profile score')} <span className="resume-linkedin-score">{check.score}</span>
          </strong>
          /100
        </p>
        {check.issues.length ? (
          <ol>
            {check.issues.map((issue, i) => (
              <li key={i}>
                <button type="button" onClick={() => jump(issue.where)}>
                  {zh ? issue.zh : issue.en}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p>{t('规则检查没有发现问题。', 'The rule check found nothing to fix.')}</p>
        )}
        <small>
          {check.compared
            ? t(`技能已和简历里的 ${check.compared} 个技术词对照。`, `Skills compared against ${check.compared} technical terms on your resume.`)
            : t('简历里还没有技术词，技能没有和简历对照。', 'No technical terms on your resume yet, so skills were not compared with it.')}
        </small>
      </div>
    </details>
  );
}
