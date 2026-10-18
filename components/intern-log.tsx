'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/types';
import { CAREER_CHECKLISTS } from '@/lib/content/career-checklists';
import { blankResume, normalizeResume, type Resume } from '@/lib/resume-shape';
import { blankStory, storyBody, storyTarget } from '@/lib/story-bank';
import {
  appendBullets, bragBody, isDay, META_TARGET, parseBrag, parseMeta, resolveWeek, selfReview, TEAMS_TARGET, weekMonday,
  weekNo, weekTarget, winLines, WEEKS_MAX, WEEKS_MIN, WIN_MAX, WINS_MAX, FIELD_MAX, xyzBullet,
  type Brag, type BragWeek, type InternMeta, type Win,
} from '@/lib/intern-log';
import { putNote } from './problem-notes';
import { TeamMatch } from './team-match';
import '@/app/career-intern.css';

// The resume builder's key (components/resume-builder.tsx), written literally so this page does not
// load the builder; tests/intern-log-ui.test.mjs checks they match.
export const RESUME_KEY = 'cswork:resume:v1';
const blankWin = (): Win => ({ x: '', y: '', z: '', project: '' });
const blankBrag = (): Brag => ({ wins: [blankWin()], feedback: '', learned: '', next: '' });
const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
type Loaded = { meta: InternMeta | null; weeks: Record<string, Brag>; teams: unknown };
type Exported = { kind: 'mid' | 'final' | 'xyz'; text: string; lines: string[] };

function readResume(): Resume {
  try {
    const saved = localStorage.getItem(RESUME_KEY);
    return saved ? normalizeResume(JSON.parse(saved)) : blankResume();
  } catch {
    return blankResume();
  }
}
function download(name: string, text: string) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    Object.assign(document.createElement('a'), { href: url, download: name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // No Blob URLs here (an old browser or a sandbox): copying still works.
  }
}

/**
 * /career/intern: the signed-in learner's internship log. One request reads every brag: note; the
 * internship setup, this week's checklist items, the week's log (saved on demand), past weeks,
 * exports made in this browser (midpoint and final self-review drafts, XYZ bullets that can go into
 * the resume builder's copy in this browser or into the story bank) and the team-matching cards.
 */
export function InternLog({ zh }: { zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [today] = useState(localDay);
  const [setup, setSetup] = useState<InternMeta>({ company: '', role: '', start: '', weeks: 12 });
  const [monday, setMonday] = useState('');
  const [draft, setDraft] = useState<Brag>(blankBrag);
  const [exported, setExported] = useState<Exported | null>(null);
  const [target, setTarget] = useState<number | 'new'>('new');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  /** This week's Monday within the internship (week 1 before it starts, the last week after it ends). */
  const clampWeek = (meta: InternMeta) => weekMonday(meta.start, Math.min(meta.weeks, Math.max(1, weekNo(meta.start, today))));
  const pick = (weeks: Record<string, Brag>, day: string) => {
    setMonday(day);
    const saved = weeks[day];
    setDraft(saved ? { ...saved, wins: saved.wins.length ? saved.wins : [blankWin()] } : blankBrag());
  };

  useEffect(() => {
    let live = true;
    api<{ items?: { target: string; body: string }[] }>('oj/notes?prefix=brag%3A').then(
      (r) => {
        if (!live) return;
        const loaded: Loaded = { meta: null, weeks: {}, teams: null };
        for (const { target: key, body } of Array.isArray(r.items) ? r.items : []) {
          if (key === META_TARGET) loaded.meta = parseMeta(body);
          else if (key === TEAMS_TARGET) {
            try {
              loaded.teams = JSON.parse(body);
            } catch {
              // A damaged note: the cards start over.
            }
          } else if (isDay(key.slice(5))) {
            const brag = parseBrag(body);
            if (brag) loaded.weeks[key.slice(5)] = brag;
          }
        }
        setData(loaded);
        if (loaded.meta) {
          setSetup(loaded.meta);
          pick(loaded.weeks, clampWeek(loaded.meta));
        }
      },
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- loads once; pick and clampWeek only read their arguments.
  }, []);

  if (error)
    return (
      <p className="resume-error" role="alert">
        {error}
      </p>
    );
  if (!data) return <p className="intern-note">{t('加载中…', 'Loading…')}</p>;

  const { meta, weeks } = data;
  const logged: BragWeek[] = Object.entries(weeks)
    .map(([day, brag]) => ({ ...brag, monday: day }))
    .sort((a, b) => b.monday.localeCompare(a.monday));
  const weekName = (day: string) => {
    const n = meta ? weekNo(meta.start, day) : 0;
    return meta && n >= 1 && n <= meta.weeks ? t(`第 ${n} 周（${day}）`, `Week ${n} (${day})`) : t(`${day} 那一周`, `Week of ${day}`);
  };

  async function saveMeta(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!isDay(setup.start)) return setStatus(t('请填写实习开始日期。', 'Enter the start date.'));
    const next = { ...setup, company: setup.company.trim(), role: setup.role.trim() };
    setBusy(true);
    try {
      await putNote(META_TARGET, JSON.stringify(next));
      setData((d) => d && { ...d, meta: next });
      if (!meta || meta.start !== next.start || meta.weeks !== next.weeks) pick(weeks, clampWeek(next));
      setStatus(t('实习设置已保存。', 'Internship saved.'));
    } catch (err) {
      setStatus((err instanceof Error && err.message) || t('保存失败，请稍后重试。', 'Couldn’t save. Try again shortly.'));
    } finally {
      setBusy(false);
    }
  }
  async function saveWeek(e: { preventDefault(): void }) {
    e.preventDefault();
    const body = bragBody(draft);
    setBusy(true);
    try {
      await putNote(weekTarget(monday), body);
      setData((d) => {
        if (!d) return d;
        const { [monday]: _old, ...rest } = d.weeks;
        return { ...d, weeks: body ? { ...rest, [monday]: parseBrag(body)! } : rest };
      });
      setStatus(body ? t(`${weekName(monday)} 的日志已保存。`, `${weekName(monday)} saved.`) : t('这一周已清空。', 'This week is cleared.'));
    } catch (err) {
      setStatus((err instanceof Error && err.message) || t('保存失败，请稍后重试。', 'Couldn’t save. Try again shortly.'));
    } finally {
      setBusy(false);
    }
  }
  async function saveStory(win: Win) {
    const story = { ...blankStory(), title: win.x.trim(), action: win.z.trim(), result: win.y.trim(), competencies: ['impact'] };
    try {
      await putNote(storyTarget(story.id), storyBody(story));
      setStatus(t(`已存进故事库：${story.title}`, `Added to the story bank: ${story.title}`));
    } catch (err) {
      setStatus((err instanceof Error && err.message) || t('保存失败，请稍后重试。', 'Couldn’t save. Try again shortly.'));
    }
  }
  function toResume(add: string[]) {
    if (!meta) return;
    const current = readResume();
    if (target !== 'new' && !current.experience[target]) {
      setTarget('new');
      return setStatus(t('那段经历已经不在简历里了，请重新选择。', 'That entry is no longer in the resume; choose again.'));
    }
    const { resume, added, dropped } = appendBullets(current, target, add, meta);
    if (added.length) {
      try {
        localStorage.setItem(RESUME_KEY, JSON.stringify(resume));
      } catch {
        return setStatus(t('这个浏览器不能保存简历（隐私模式或存储已满）。', 'This browser can’t store the resume (private mode or full storage).'));
      }
      // The new entry is first: further bullets go to it, not to another new one.
      if (target === 'new') setTarget(0);
    }
    const skipped = add.length - added.length - dropped.length;
    setStatus(
      [
        added.length ? t(`已写入 ${added.length} 条。`, `Added ${added.length}.`) : '',
        skipped ? t(`${skipped} 条简历里已经有了。`, `${skipped} already there.`) : '',
        dropped.length
          ? target === 'new' && !added.length
            ? t('简历最多 20 段经历，先删掉一段。', 'The resume holds 20 experiences at most; remove one first.')
            : t(`${dropped.length} 条超出这段经历 3000 字的上限，没有写入。`, `${dropped.length} didn’t fit the entry’s 3000-character limit.`)
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  const n = meta ? weekNo(meta.start, today) : 0;
  const due = meta && n <= meta.weeks ? CAREER_CHECKLISTS.internship.filter((i) => resolveWeek(i.week ?? 0, meta.weeks) === Math.max(0, n)) : [];
  const options = meta ? [...new Set([...Array.from({ length: meta.weeks }, (_, i) => weekMonday(meta.start, i + 1)), ...logged.map((w) => w.monday)])].sort() : [];
  const experiences = exported?.kind === 'xyz' ? readResume().experience : [];
  // Unsaved edits are confirmed away before another week replaces them.
  const dirty = !!monday && bragBody(draft) !== (weeks[monday] ? bragBody(weeks[monday]) : '');
  const switchTo = (day: string) => {
    if (dirty && !confirm(t('这一周的修改还没保存，确定切换吗？', 'This week has unsaved changes. Switch anyway?'))) return false;
    pick(weeks, day);
    return true;
  };
  const putWin = (i: number, patch: Partial<Win>) => setDraft({ ...draft, wins: draft.wins.map((w, j) => (j === i ? { ...w, ...patch } : w)) });
  const projects = [...new Set(logged.flatMap((w) => w.wins.map((x) => x.project.trim())).filter(Boolean))];

  return (
    <div className="intern">
      <section className="intern-section" aria-labelledby="intern-setup-title">
        <h2 id="intern-setup-title">{t('实习设置', 'Your internship')}</h2>
        <form className="resume-form intern-grid" onSubmit={saveMeta}>
          <label>
            {t('公司', 'Company')}
            <input value={setup.company} maxLength={100} onChange={(e) => setSetup({ ...setup, company: e.target.value })} />
          </label>
          <label>
            {t('职位', 'Role')}
            <input value={setup.role} maxLength={120} onChange={(e) => setSetup({ ...setup, role: e.target.value })} />
          </label>
          <label>
            {t('开始日期', 'Start date')}
            <input type="date" required value={setup.start} onChange={(e) => setSetup({ ...setup, start: e.target.value })} />
          </label>
          <label>
            {t('周数', 'Length in weeks')}
            <select value={setup.weeks} onChange={(e) => setSetup({ ...setup, weeks: Number(e.target.value) })}>
              {Array.from({ length: WEEKS_MAX - WEEKS_MIN + 1 }, (_, i) => WEEKS_MIN + i).map((w) => (
                <option key={w} value={w}>
                  {t(`${w} 周`, `${w} weeks`)}
                </option>
              ))}
            </select>
          </label>
          <div className="resume-actions">
            <button type="submit" disabled={busy}>
              {t('保存设置', 'Save')}
            </button>
          </div>
        </form>
      </section>

      {meta && (
        <section className="intern-section" aria-labelledby="intern-due-title">
          <h2 id="intern-due-title">
            {n < 1
              ? t('入职前该做', 'Before day one')
              : n > meta.weeks
                ? t('实习已结束', 'Your internship has ended')
                : t(`第 ${n} 周（共 ${meta.weeks} 周）该做`, `Week ${n} of ${meta.weeks}: to do`)}
          </h2>
          {due.length ? (
            <ul className="intern-due">
              {due.map((item) => (
                <li key={item.id}>
                  <strong>{item.text[zh ? 0 : 1]}</strong>
                  <span>{item.detail[zh ? 0 : 1]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="intern-note">
              {n > meta.weeks
                ? t('导出期末自评草稿，把成果写进简历。', 'Export the final self-review draft and add your results to your resume.')
                : t('这周清单上没有新事项，专心做项目，周五记得写日志。', 'Nothing new on the checklist this week: focus on the project and log it on Friday.')}
            </p>
          )}
          <p className="intern-note">
            <a href="/guide/internship#guide-checklist-title">{t('在实习手册里勾选完成 →', 'Tick them off in the internship chapter →')}</a>
          </p>
        </section>
      )}

      {meta ? (
        <section className="intern-section" aria-labelledby="intern-week-title">
          <h2 id="intern-week-title">{t('每周日志', 'Weekly log')}</h2>
          <form className="resume-form" onSubmit={saveWeek}>
            <label>
              {t('哪一周', 'Week')}
              <select value={monday} onChange={(e) => switchTo(e.target.value)}>
                {options.map((day) => (
                  <option key={day} value={day}>
                    {weekName(day)}
                    {weeks[day] ? t('（已记录）', ' (logged)') : ''}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="intern-wins">
              <legend>{t('这周做成的事（XYZ：做成了什么、用什么衡量、怎么做到的）', 'What you got done (XYZ: what, measured how, done how)')}</legend>
              <datalist id="intern-projects">
                {projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </datalist>
              {draft.wins.map((win, i) => {
                const bullet = win.x.trim() ? xyzBullet(win) : null;
                return (
                  <fieldset key={i} className="intern-card">
                    <legend>{t(`成果 ${i + 1}`, `Result ${i + 1}`)}</legend>
                    <div className="intern-grid">
                      <label>
                        {t('X 做成了什么', 'X: what you accomplished')}
                        <input value={win.x} maxLength={WIN_MAX} placeholder={t('例如：把搜索接口的延迟', 'e.g. Cut search latency')} onChange={(e) => putWin(i, { x: e.target.value })} />
                      </label>
                      <label>
                        {t('Y 用什么衡量', 'Y: measured by')}
                        <input value={win.y} maxLength={WIN_MAX} placeholder={t('例如：从 800 ms 降到 300 ms', 'e.g. from 800 ms to 300 ms')} onChange={(e) => putWin(i, { y: e.target.value })} />
                      </label>
                      <label>
                        {t('Z 怎么做到的', 'Z: how you did it')}
                        <input value={win.z} maxLength={WIN_MAX} placeholder={t('例如：缓存热点查询', 'e.g. caching hot queries')} onChange={(e) => putWin(i, { z: e.target.value })} />
                      </label>
                      <label>
                        {t('项目（选填）', 'Project (optional)')}
                        <input value={win.project} maxLength={WIN_MAX} list="intern-projects" onChange={(e) => putWin(i, { project: e.target.value })} />
                      </label>
                    </div>
                    {bullet && (
                      <p className="intern-preview">
                        {bullet.line}
                        {bullet.addNumber && <small>{t('补一个数字会更有说服力。', 'Add a number to make it land.')}</small>}
                      </p>
                    )}
                    <div className="resume-actions">
                      {bullet && (
                        <button type="button" className="is-quiet" onClick={() => void saveStory(win)}>
                          {t('存为 STAR 故事', 'Save as a STAR story')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="is-quiet"
                        onClick={() => setDraft({ ...draft, wins: draft.wins.length > 1 ? draft.wins.filter((_, j) => j !== i) : [blankWin()] })}
                      >
                        {t('删除这条', 'Remove')}
                      </button>
                    </div>
                  </fieldset>
                );
              })}
              <div className="resume-actions">
                <button type="button" className="is-quiet" disabled={draft.wins.length >= WINS_MAX} onClick={() => setDraft({ ...draft, wins: [...draft.wins, blankWin()] })}>
                  {t('再加一条', 'Add another')}
                </button>
              </div>
            </fieldset>
            {(
              [
                ['feedback', t('收到的反馈', 'Feedback you got')],
                ['learned', t('学到的东西', 'What you learned')],
                ['next', t('下周打算', 'Plan for next week')],
              ] as const
            ).map(([key, name]) => (
              <label key={key}>
                {name}
                <textarea rows={3} value={draft[key]} maxLength={FIELD_MAX} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
              </label>
            ))}
            <div className="resume-actions">
              <button type="submit" disabled={busy || !monday}>
                {t('保存这一周', 'Save this week')}
              </button>
              <small>{t('全部清空再保存会删除这一周。', 'Saving an empty week deletes it.')}</small>
            </div>
          </form>
        </section>
      ) : (
        <p className="intern-note">{t('先填好实习开始日期和周数，再按周记录。', 'Set your start date and length first, then log week by week.')}</p>
      )}

      {meta && logged.length > 0 && (
        <section className="intern-section" aria-labelledby="intern-past-title">
          <h2 id="intern-past-title">{t('往周记录', 'Past weeks')}</h2>
          {logged.map((w) => (
            <details key={w.monday} className="intern-card">
              <summary>
                {weekName(w.monday)} · {t(`${w.wins.length} 条成果`, `${w.wins.length} ${w.wins.length === 1 ? 'result' : 'results'}`)}
              </summary>
              <ul>
                {w.wins
                  .filter((x) => x.x.trim())
                  .map((x, i) => (
                    <li key={i}>{xyzBullet(x).line}</li>
                  ))}
              </ul>
              {(
                [
                  ['feedback', t('反馈', 'Feedback')],
                  ['learned', t('学到的', 'Learned')],
                  ['next', t('下周', 'Next')],
                ] as const
              ).map(
                ([key, name]) =>
                  w[key].trim() && (
                    <p key={key}>
                      <strong>{name}</strong>
                      {t('：', ': ')}
                      {w[key]}
                    </p>
                  ),
              )}
              <div className="resume-actions">
                <button
                  type="button"
                  className="is-quiet"
                  onClick={() => {
                    if (switchTo(w.monday)) document.getElementById('intern-week-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {t('编辑这一周', 'Edit this week')}
                </button>
              </div>
            </details>
          ))}
        </section>
      )}

      {meta && (
        <section className="intern-section" aria-labelledby="intern-export-title">
          <h2 id="intern-export-title">{t('导出', 'Export')}</h2>
          <p className="intern-note">{t('都在你的浏览器里生成，不上传。', 'Made in your browser; nothing is uploaded.')}</p>
          <div className="resume-actions">
            <button type="button" onClick={() => setExported({ kind: 'mid', text: selfReview(meta, logged, 'mid', zh), lines: [] })}>
              {t('中期自评草稿', 'Midpoint draft')}
            </button>
            <button type="button" onClick={() => setExported({ kind: 'final', text: selfReview(meta, logged, 'final', zh), lines: [] })}>
              {t('期末自评草稿', 'Final draft')}
            </button>
            <button
              type="button"
              onClick={() => {
                const lines = winLines(meta, logged);
                setExported({ kind: 'xyz', text: lines.map((l) => `- ${l}`).join('\n') + '\n', lines });
              }}
            >
              {t('XYZ 简历要点', 'XYZ resume bullets')}
            </button>
          </div>
          {exported && (
            <div className="intern-export">
              <textarea readOnly rows={12} value={exported.text} aria-label={t('导出预览', 'Export preview')} />
              <div className="resume-actions">
                <button
                  type="button"
                  className="is-quiet"
                  onClick={() =>
                    (navigator.clipboard ? navigator.clipboard.writeText(exported.text) : Promise.reject(new Error('no clipboard'))).then(
                      () => setStatus(t('已复制。', 'Copied.')),
                      () => setStatus(t('复制失败，请在预览框里手动复制。', 'Couldn’t copy; select the preview and copy it by hand.')),
                    )
                  }
                >
                  {t('复制', 'Copy')}
                </button>
                <button
                  type="button"
                  className="is-quiet"
                  onClick={() => download(`${exported.kind === 'xyz' ? 'xyz-bullets' : `self-review-${exported.kind}`}-${monday || today}.md`, exported.text)}
                >
                  {t('下载 .md', 'Download .md')}
                </button>
              </div>
              {exported.kind === 'xyz' &&
                (exported.lines.length ? (
                  <div className="intern-bullets">
                    <div className="resume-form">
                      <label>
                        {t('写进简历生成器的哪段经历', 'Resume builder entry to add them to')}
                        <select value={target} onChange={(e) => setTarget(e.target.value === 'new' ? 'new' : Number(e.target.value))}>
                          <option value="new">{t(`新建一段：${meta.company || '实习'}`, `New entry: ${meta.company || 'internship'}`)}</option>
                          {experiences.map((x, i) => (
                            <option key={i} value={i}>
                              {[x.title, x.subtitle].filter((v) => v.trim()).join(' · ') || t(`第 ${i + 1} 段（空）`, `Entry ${i + 1} (empty)`)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <ul>
                      {exported.lines.map((line) => (
                        <li key={line}>
                          <span>{line}</span>
                          <button type="button" className="intern-add" onClick={() => toResume([line])}>
                            {t('写入简历', 'Add to resume')}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="resume-actions">
                      <button type="button" onClick={() => toResume(exported.lines)}>
                        {t('全部写入简历', 'Add all to resume')}
                      </button>
                      <a href="/career/resume/builder">{t('打开简历生成器 →', 'Open the resume builder →')}</a>
                    </div>
                    <p className="intern-note">
                      {t(
                        '简历只存在这个浏览器里，这里只改本机的那份；已经打开的简历生成器会自动更新。',
                        'The resume lives in this browser only, and this changes that copy; an open resume builder tab picks it up.',
                      )}
                    </p>
                  </div>
                ) : (
                  <p className="intern-note">{t('还没有填了 X 的成果。', 'No results with an X yet.')}</p>
                ))}
            </div>
          )}
        </section>
      )}

      <TeamMatch zh={zh} initial={data.teams} />
      <p className="intern-status" role="status">
        {status}
      </p>
    </div>
  );
}
