'use client';
import { useEffect, useRef, useState } from 'react';
import { ojRequest } from '@/lib/oj-client';

/**
 * /career/resume/builder: a one-page, single-column resume (standard headings, no tables, images or
 * columns, real text) previewed as it prints. It lives in this browser only (localStorage), like
 * the review page's promise; JSON export and import move it between devices.
 */
export const RESUME_KEY = 'cswork:resume:v1';
/** The review page (components/resume-review.tsx) picks this up once, then drops it. */
export const REVIEW_KEY = 'cswork:resume:review';

export type ResumeItem = { title: string; subtitle: string; dates: string; bullets: string };
type ListKey = 'education' | 'experience' | 'projects';
export type Resume = {
  name: string;
  email: string;
  phone: string;
  location: string;
  links: string;
  education: ResumeItem[];
  experience: ResumeItem[];
  projects: ResumeItem[];
  skills: string;
  awards: string;
};
export type ResumeFacts = {
  certificates: { id: string; course: string; issuedAt: number; skill: boolean }[];
  rating: number | null;
  contests: number;
  solved: { total: number; easy: number; medium: number; hard: number };
  handle: string | null;
};

const ITEMS = 20;
const blankItem = (): ResumeItem => ({ title: '', subtitle: '', dates: '', bullets: '' });
export const blankResume = (): Resume => ({
  name: '',
  email: '',
  phone: '',
  location: '',
  links: '',
  education: [blankItem()],
  experience: [blankItem()],
  projects: [blankItem()],
  skills: '',
  awards: '',
});

/** Field caps: the form's maxLength and what normalizeResume keeps are one and the same. */
const MAX: Record<Exclude<keyof Resume, ListKey> | keyof ResumeItem, number> = {
  name: 80,
  email: 120,
  phone: 40,
  location: 80,
  links: 300,
  title: 120,
  subtitle: 160,
  dates: 60,
  bullets: 3000,
  skills: 2000,
  awards: 2000,
};
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');
/** Anything (a stored or imported file) as a resume: unknown fields dropped, strings capped. */
export function normalizeResume(raw: unknown): Resume {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const items = (value: unknown) =>
    (Array.isArray(value) ? value : []).slice(0, ITEMS).map((v) => {
      const i = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
      return {
        title: text(i.title, MAX.title),
        subtitle: text(i.subtitle, MAX.subtitle),
        dates: text(i.dates, MAX.dates),
        bullets: text(i.bullets, MAX.bullets),
      };
    });
  return {
    name: text(r.name, MAX.name),
    email: text(r.email, MAX.email),
    phone: text(r.phone, MAX.phone),
    location: text(r.location, MAX.location),
    links: text(r.links, MAX.links),
    education: items(r.education),
    experience: items(r.experience),
    projects: items(r.projects),
    skills: text(r.skills, MAX.skills),
    awards: text(r.awards, MAX.awards),
  };
}

const lines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
const filled = (item: ResumeItem) => !!(item.title.trim() || item.subtitle.trim() || item.dates.trim() || item.bullets.trim());
const contact = (r: Resume) => [r.email, r.phone, r.location, r.links].map((s) => s.trim()).filter(Boolean).join(' | ');
// Standard English headings: what applicant tracking systems look for.
const HEADINGS: [ListKey, string][] = [
  ['education', 'Education'],
  ['experience', 'Experience'],
  ['projects', 'Projects'],
];

/** The resume as plain text, for the AI review page. */
export function resumeText(r: Resume) {
  const out = [r.name.trim(), contact(r)];
  for (const [key, heading] of HEADINGS) {
    const items = r[key].filter(filled);
    if (!items.length) continue;
    out.push('', heading.toUpperCase());
    for (const item of items) {
      out.push([item.title, item.subtitle, item.dates].map((s) => s.trim()).filter(Boolean).join(' | '));
      for (const bullet of lines(item.bullets)) out.push(`- ${bullet}`);
    }
  }
  if (lines(r.skills).length) out.push('', 'SKILLS', ...lines(r.skills));
  if (lines(r.awards).length) out.push('', 'AWARDS & CERTIFICATIONS', ...lines(r.awards).map((l) => `- ${l}`));
  return out.filter((line, i) => line || i > 1).join('\n').trim();
}

const month = (time: number) => new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(time);
const appendLines = (value: string, add: string[]) => {
  const have = new Set(lines(value));
  const fresh = add.filter((line) => !have.has(line));
  return { value: [value.trimEnd(), ...fresh].filter(Boolean).join('\n'), added: fresh.length };
};
/** `value` without its older CSWork line (matched by `stale`) when `line` brings a new one: numbers get replaced, not stacked. */
const refresh = (value: string, stale: RegExp, line?: string) =>
  !line || lines(value).includes(line) ? value : value.split('\n').filter((row) => !stale.test(lines(row)[0] ?? '')).join('\n');
/**
 * The learner's CSWork record merged in, each line once: certificates (with their verification
 * links) and the contest rating under awards, the solved counts under skills, the public profile
 * under links. A newer rating or solved count replaces the old line. Returns how many lines were new.
 */
export function mergeFacts(r: Resume, f: ResumeFacts) {
  const rating = f.rating === null ? [] : [`CSWork contest rating ${f.rating} (${f.contests} rated ${f.contests === 1 ? 'contest' : 'contests'})`];
  const solved = f.solved.total
    ? [`Algorithms: ${f.solved.total} problems solved on CSWork (${f.solved.easy} easy, ${f.solved.medium} medium, ${f.solved.hard} hard)`]
    : [];
  const awards = appendLines(refresh(r.awards, /^CSWork contest rating \d+ \(/, rating[0]), [
    ...f.certificates.map(
      (c) => `${c.course}, CSWork ${c.skill ? 'skill certification' : 'certificate'}, ${month(c.issuedAt)} (cswork.org/certificate/${c.id})`,
    ),
    ...rating,
  ]);
  const skills = appendLines(refresh(r.skills, /^Algorithms: \d+ problems solved on CSWork /, solved[0]), solved);
  const profile = f.handle ? `cswork.org/u/${f.handle}` : '';
  const linkNew = !!profile && !r.links.includes(profile);
  return {
    resume: { ...r, awards: awards.value, skills: skills.value, links: linkNew ? [r.links.trim(), profile].filter(Boolean).join(', ') : r.links },
    added: awards.added + skills.added + +linkNew,
  };
}

function download(name: string, body: string) {
  try {
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // No Blob URLs here (an old browser or a sandbox): nothing to download.
  }
}

const SECTIONS: { key: ListKey; legend: [string, string]; fields: [keyof ResumeItem, string, string][]; add: [string, string] }[] = [
  {
    key: 'education',
    legend: ['教育经历', 'Education'],
    fields: [
      ['title', '学校', 'School'],
      ['subtitle', '学位与专业', 'Degree and major'],
      ['dates', '时间（例如 Aug 2023 – May 2027）', 'Dates (e.g. Aug 2023 – May 2027)'],
      ['bullets', '要点，每行一条（GPA、相关课程）', 'Bullets, one per line (GPA, coursework)'],
    ],
    add: ['添加教育经历', 'Add education'],
  },
  {
    key: 'experience',
    legend: ['工作经历', 'Experience'],
    fields: [
      ['title', '公司', 'Company'],
      ['subtitle', '职位与地点', 'Role and location'],
      ['dates', '时间', 'Dates'],
      ['bullets', '要点，每行一条：做了什么、怎么做、带来什么结果（最好有数字）', 'Bullets, one per line: what you did, how, and the result (with a number)'],
    ],
    add: ['添加工作经历', 'Add experience'],
  },
  {
    key: 'projects',
    legend: ['项目', 'Projects'],
    fields: [
      ['title', '项目名称', 'Project'],
      ['subtitle', '技术栈或链接', 'Tech stack or link'],
      ['dates', '时间', 'Dates'],
      ['bullets', '要点，每行一条', 'Bullets, one per line'],
    ],
    add: ['添加项目', 'Add project'],
  },
];
const CONTACT: [Exclude<keyof Resume, ListKey>, string, string, string][] = [
  ['name', '姓名', 'Full name', 'name'],
  ['email', '邮箱', 'Email', 'email'],
  ['phone', '电话', 'Phone', 'tel'],
  ['location', '所在城市', 'Location', 'address-level2'],
  ['links', '链接（GitHub、LinkedIn、个人网站，用逗号分隔）', 'Links (GitHub, LinkedIn, website; comma-separated)', 'url'],
];

export function ResumeBuilder({ zh, signedIn }: { zh: boolean; signedIn: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [resume, setResume] = useState<Resume>(blankResume);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RESUME_KEY);
      // oxlint-disable-next-line react/react-compiler -- Hydrate from browser storage after SSR.
      if (saved) setResume(normalizeResume(JSON.parse(saved)));
    } catch {
      // Blocked storage or a damaged entry: start blank.
    }
  }, []);
  // The sheet is 7.5in wide (Letter less 0.5in margins): taller than 10in runs onto a second page.
  // Compared in its own units, so the preview's screen zoom doesn't matter.
  useEffect(() => {
    const el = sheet.current;
    // oxlint-disable-next-line react/react-compiler -- Measured after layout.
    if (el) setOverflow(el.clientWidth > 0 && el.scrollHeight > (el.clientWidth * 4) / 3 + 2);
  }, [resume]);
  const change = (next: Resume) => {
    setResume(next);
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify(next));
    } catch {
      // Private mode or full storage: the resume still works for this visit.
    }
  };
  const editItem = (key: ListKey, index: number, field: keyof ResumeItem, value: string) =>
    change({ ...resume, [key]: resume[key].map((item, i) => (i === index ? { ...item, [field]: value } : item)) });
  async function fill() {
    setBusy(true);
    try {
      const merged = mergeFacts(resume, await ojRequest<ResumeFacts>('profile/resume-facts'));
      change(merged.resume);
      setStatus(merged.added ? t(`已填入 ${merged.added} 条站内成绩。`, `Added ${merged.added} ${merged.added === 1 ? 'line' : 'lines'} from CSWork.`) : t('没有新的站内成绩可以填入。', 'Nothing new to add from CSWork.'));
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function load(file: File | undefined) {
    if (!file) return;
    try {
      change(normalizeResume(JSON.parse(await file.text())));
      setStatus(t('已导入简历。', 'Resume imported.'));
    } catch {
      setStatus(t('这个文件不是导出的简历 JSON。', 'That file is not an exported resume JSON.'));
    }
  }
  function review() {
    try {
      sessionStorage.setItem(REVIEW_KEY, resumeText(resume));
    } catch {
      // The review page then just opens empty.
    }
    location.assign('/career/resume');
  }
  const contactLine = contact(resume);
  return (
    <div className="resume-builder">
      <form className="resume-form resume-builder-form" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="resume-fieldset">
          <legend>{t('基本信息', 'Contact')}</legend>
          {CONTACT.map(([key, zhLabel, enLabel, autoComplete]) => (
            <label key={key}>
              {t(zhLabel, enLabel)}
              <input
                value={resume[key] as string}
                autoComplete={autoComplete}
                maxLength={MAX[key]}
                onChange={(e) => change({ ...resume, [key]: e.target.value })}
              />
            </label>
          ))}
        </fieldset>
        {SECTIONS.map(({ key, legend, fields, add }) => (
          <fieldset key={key} className="resume-fieldset">
            <legend>{t(...legend)}</legend>
            {resume[key].map((item, index) => (
              <div key={index} className="resume-entry">
                {fields.map(([field, zhLabel, enLabel]) => (
                  <label key={field}>
                    {t(zhLabel, enLabel)}
                    {field === 'bullets' ? (
                      <textarea rows={4} value={item[field]} maxLength={MAX.bullets} onChange={(e) => editItem(key, index, field, e.target.value)} />
                    ) : (
                      <input value={item[field]} maxLength={MAX[field]} onChange={(e) => editItem(key, index, field, e.target.value)} />
                    )}
                  </label>
                ))}
                <button
                  type="button"
                  className="resume-remove"
                  onClick={() => change({ ...resume, [key]: resume[key].filter((_, i) => i !== index) })}
                >
                  {t(`删除第 ${index + 1} 条${legend[0]}`, `Remove ${legend[1].toLowerCase()} ${index + 1}`)}
                </button>
              </div>
            ))}
            {resume[key].length < ITEMS && (
              <button type="button" className="resume-add" onClick={() => change({ ...resume, [key]: [...resume[key], blankItem()] })}>
                + {t(...add)}
              </button>
            )}
          </fieldset>
        ))}
        <fieldset className="resume-fieldset">
          <legend>{t('技能、奖项与证书', 'Skills, awards and certifications')}</legend>
          <label>
            {t('技能，每行一类（例如 Languages: Python, Go）', 'Skills, one group per line (e.g. Languages: Python, Go)')}
            <textarea rows={4} value={resume.skills} maxLength={MAX.skills} onChange={(e) => change({ ...resume, skills: e.target.value })} />
          </label>
          <label>
            {t('奖项与证书，每行一条', 'Awards and certifications, one per line')}
            <textarea rows={4} value={resume.awards} maxLength={MAX.awards} onChange={(e) => change({ ...resume, awards: e.target.value })} />
          </label>
          {signedIn && (
            <div className="resume-actions">
              <button type="button" className="is-quiet" disabled={busy} onClick={() => void fill()} aria-describedby="resume-fill-hint">
                {t('从 CSWork 填入', 'Fill in from CSWork')}
              </button>
              <small id="resume-fill-hint">
                {t('把你的证书和比赛 rating 加到奖项里，把解题数加到技能里。', 'Adds your certificates and contest rating to awards, and your solved counts to skills.')}
              </small>
            </div>
          )}
        </fieldset>
      </form>
      <div className="resume-builder-preview">
        <div className="resume-actions resume-builder-tools">
          <button type="button" onClick={() => window.print()}>
            {t('保存为 PDF', 'Save as PDF')}
          </button>
          <button type="button" className="is-quiet" disabled={!resumeText(resume)} onClick={review}>
            {t('送去 AI 点评', 'Send to AI review')}
          </button>
          <button type="button" className="is-quiet" onClick={() => download('cswork-resume.json', JSON.stringify(resume, null, 2))}>
            {t('导出 JSON', 'Export JSON')}
          </button>
          <label className="resume-import">
            {t('导入 JSON', 'Import JSON')}
            <input type="file" accept="application/json,.json" onChange={(e) => void load(e.target.files?.[0])} />
          </label>
        </div>
        <p className="resume-builder-status" role="status">
          {status}
        </p>
        {overflow && (
          <p className="resume-page-warning" role="status">
            {t('预览已超过一页：删掉较弱的要点，或把每条缩短到一行。', 'The preview runs past one page: cut the weakest bullets or shorten each to one line.')}
          </p>
        )}
        <div className="resume-paper">
          <article className="resume-sheet" ref={sheet} aria-label={t('简历预览', 'Resume preview')}>
            <header>
              <h2>{resume.name.trim() || t('你的姓名', 'Your Name')}</h2>
              {contactLine && <p>{contactLine}</p>}
            </header>
            {HEADINGS.map(([key, heading]) => {
              const items = resume[key].filter(filled);
              return (
                items.length > 0 && (
                  <section key={key}>
                    <h3>{heading}</h3>
                    {items.map((item, index) => (
                      <div key={index} className="resume-sheet-item">
                        <p className="resume-sheet-head">
                          <strong>{item.title}</strong>
                          <span>{item.dates}</span>
                        </p>
                        {item.subtitle && <p className="resume-sheet-sub">{item.subtitle}</p>}
                        {lines(item.bullets).length > 0 && (
                          <ul>
                            {lines(item.bullets).map((bullet, i) => (
                              <li key={i}>{bullet}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </section>
                )
              );
            })}
            {lines(resume.skills).length > 0 && (
              <section>
                <h3>Skills</h3>
                {lines(resume.skills).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </section>
            )}
            {lines(resume.awards).length > 0 && (
              <section>
                <h3>Awards &amp; Certifications</h3>
                <ul>
                  {lines(resume.awards).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
